from __future__ import annotations

from typing import Any
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .mikrotik_client import MikroTikError, execute_script, router_request
from .mikrotik_scripts import build_quota_reset_script, build_subscription_apply_script, gb_to_bytes, get_mikrotik_names
from .models import ClientSession, Customer, LogEntry, QuotaResetHistory, RouterDevice, Subscription
from .realtime import collect_realtime_clients
from .serializers import (
    ClientSessionSerializer,
    CustomerSerializer,
    LogEntrySerializer,
    RouterDeviceSerializer,
    SubscriptionSerializer,
)


def safe_error(error: Exception) -> dict[str, Any]:
    if isinstance(error, MikroTikError):
        return {"message": str(error), "statusCode": error.status_code, "detail": error.detail}
    return {"message": str(error)}


def write_log(action: str, target: str = "", result: str = LogEntry.RESULT_SUCCESS, detail: str = "", payload: dict[str, Any] | None = None) -> None:
    LogEntry.objects.create(action=action, target=target, result=result, detail=detail, payload=payload or {})


def _payload_value(payload: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in payload:
            return payload.get(key)
    return default


def _payload_bool(payload: dict[str, Any], *keys: str, default: bool = False) -> bool:
    value = _payload_value(payload, *keys, default=default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on", "oui"}
    return bool(value)


def apply_renewal_payload(subscription: Subscription, payload: dict[str, Any]) -> dict[str, Any]:
    """Apply reset/renewal fields sent by React before RouterOS script execution."""
    old_values = {
        "old_expires_at": subscription.expires_at,
        "old_rate_limit": subscription.rate_limit,
        "old_data_limit_enabled": subscription.data_limit_enabled,
        "old_data_limit_gb": subscription.data_limit_gb,
        "old_data_limit_bytes": subscription.data_limit_bytes,
        "old_data_limit_check_interval": subscription.data_limit_check_interval,
        "old_bytes_in": subscription.bytes_in,
        "old_bytes_out": subscription.bytes_out,
    }

    new_expires_at = _payload_value(payload, "expiresAt", "expires_at", default=subscription.expires_at)
    if new_expires_at:
        subscription.expires_at = new_expires_at

    new_rate_limit = _payload_value(payload, "rateLimit", "rate_limit", default=subscription.rate_limit)
    if new_rate_limit:
        subscription.rate_limit = str(new_rate_limit).strip()

    if "dataLimitEnabled" in payload or "data_limit_enabled" in payload:
        subscription.data_limit_enabled = _payload_bool(payload, "dataLimitEnabled", "data_limit_enabled")

    if subscription.data_limit_enabled:
        quota_gb = _payload_value(payload, "dataLimitGb", "data_limit_gb", default=subscription.data_limit_gb or 100)
        subscription.data_limit_gb = Decimal(str(quota_gb or 100))
        quota_bytes = _payload_value(payload, "dataLimitBytes", "data_limit_bytes", default=None)
        subscription.data_limit_bytes = int(quota_bytes) if quota_bytes not in (None, "") else gb_to_bytes(subscription.data_limit_gb)
        subscription.data_limit_check_interval = str(
            _payload_value(payload, "dataLimitCheckInterval", "data_limit_check_interval", default=subscription.data_limit_check_interval or "5m")
        ).strip()
    else:
        subscription.data_limit_gb = Decimal("0")
        subscription.data_limit_bytes = 0
        subscription.data_limit_check_interval = str(
            _payload_value(payload, "dataLimitCheckInterval", "data_limit_check_interval", default=subscription.data_limit_check_interval or "5m")
        ).strip()

    subscription.data_limit_action = str(_payload_value(payload, "dataLimitAction", "data_limit_action", default=subscription.data_limit_action or "firewall-block"))
    subscription.status = Subscription.STATUS_ACTIVE
    subscription.bytes_in = 0
    subscription.bytes_out = 0
    subscription.data_limit_reached = False
    subscription.last_seen = timezone.now()

    names = get_mikrotik_names({"clientName": subscription.customer.name, "ip": subscription.ip})
    subscription.mikrotik_queue_name = names["queueName"]
    subscription.mikrotik_script_name = names["scriptName"]
    subscription.mikrotik_scheduler_name = names["schedulerName"]
    subscription.save()
    return old_values


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    search_fields = ["name", "phone", "email"]


class RouterDeviceViewSet(viewsets.ModelViewSet):
    queryset = RouterDevice.objects.all()
    serializer_class = RouterDeviceSerializer


class ClientSessionViewSet(viewsets.ModelViewSet):
    queryset = ClientSession.objects.select_related("subscription", "subscription__customer").all()
    serializer_class = ClientSessionSerializer


class LogEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LogEntry.objects.all()
    serializer_class = LogEntrySerializer


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.select_related("customer", "router").all()
    serializer_class = SubscriptionSerializer

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        target = f"{instance.customer.name} {instance.ip}"
        self.perform_destroy(instance)
        write_log("delete-subscription", target=target, detail="Abonnement supprimé de la base MySQL")
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="apply")
    def apply_to_router(self, request: Request, pk: str | None = None) -> Response:
        subscription = self.get_object()
        try:
            script = build_subscription_apply_script(subscription)
            result = execute_script(script)
            write_log("apply-subscription", target=str(subscription), detail="Configuration appliquée sur MikroTik", payload={"routerResult": result})
            return Response({"ok": True, "applied": True, "result": result})
        except Exception as error:
            write_log("apply-subscription", target=str(subscription), result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "applied": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=True, methods=["post"], url_path="reset-quota")
    @transaction.atomic
    def reset_quota(self, request: Request, pk: str | None = None) -> Response:
        subscription = self.get_object()
        old_values = apply_renewal_payload(subscription, request.data)

        try:
            script = build_quota_reset_script(subscription)
            result = execute_script(script)
            QuotaResetHistory.objects.create(
                subscription=subscription,
                old_expires_at=old_values["old_expires_at"],
                new_expires_at=subscription.expires_at,
                old_bytes_in=old_values["old_bytes_in"],
                old_bytes_out=old_values["old_bytes_out"],
                operator_name=request.data.get("operator") or "system",
                mikrotik_result={
                    "routerResult": result,
                    "oldRateLimit": old_values["old_rate_limit"],
                    "newRateLimit": subscription.rate_limit,
                    "oldDataLimitEnabled": old_values["old_data_limit_enabled"],
                    "newDataLimitEnabled": subscription.data_limit_enabled,
                    "oldDataLimitGb": str(old_values["old_data_limit_gb"]),
                    "newDataLimitGb": str(subscription.data_limit_gb),
                    "oldDataLimitBytes": old_values["old_data_limit_bytes"],
                    "newDataLimitBytes": subscription.data_limit_bytes,
                },
            )
            write_log(
                "reset-quota",
                target=str(subscription),
                detail="Quota remis à zéro, plan/quota mis à jour et script appliqué sur MikroTik",
                payload={"routerResult": result},
            )
            return Response({"ok": True, "reset": True, "result": result, "subscription": SubscriptionSerializer(subscription).data})
        except Exception as error:
            write_log("reset-quota", target=str(subscription), result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "reset": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


class MikroTikSystemResourceAPIView(APIView):
    health_only = False

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.health_only = kwargs.pop("health_only", False)
        super().__init__(*args, **kwargs)

    def get(self, request: Request) -> Response:
        if self.health_only:
            return Response({"ok": True, "service": "django-mikrotik-backend", "time": timezone.now().isoformat()})
        try:
            result = router_request("GET", "/system/resource")
            return Response({"ok": True, "result": result})
        except Exception as error:
            return Response({"ok": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


class MikroTikApplyAPIView(APIView):
    """Compatibility endpoint: create/update the DB row and apply the config to MikroTik."""

    @transaction.atomic
    def post(self, request: Request) -> Response:
        payload = request.data.get("subscription") or request.data
        subscription_id = payload.get("id")
        instance = Subscription.objects.filter(id=subscription_id).first() if subscription_id else None
        serializer = SubscriptionSerializer(instance, data=payload, partial=bool(instance))
        serializer.is_valid(raise_exception=True)
        subscription = serializer.save()

        try:
            script = build_subscription_apply_script(subscription)
            result = execute_script(script)
            write_log("apply-subscription", target=str(subscription), detail="Abonnement sauvegardé MySQL et appliqué sur MikroTik", payload={"routerResult": result})
            return Response({
                "ok": True,
                "applied": True,
                "result": result,
                "subscription": SubscriptionSerializer(subscription).data,
                "message": "Abonnement sauvegardé dans MySQL et appliqué sur MikroTik.",
            })
        except Exception as error:
            write_log("apply-subscription", target=str(subscription), result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "applied": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


class MikroTikResetQuotaAPIView(APIView):
    """Compatibility endpoint used by the current React reset button."""

    @transaction.atomic
    def post(self, request: Request) -> Response:
        payload = request.data.get("subscription") or request.data
        subscription_id = payload.get("id")
        subscription = Subscription.objects.filter(id=subscription_id).select_related("customer", "router").first() if subscription_id else None
        if not subscription:
            subscription = get_object_or_404(Subscription.objects.select_related("customer", "router"), ip=payload.get("ip"), mac=payload.get("mac"))

        old_values = apply_renewal_payload(subscription, payload)

        try:
            script = build_quota_reset_script(subscription)
            result = execute_script(script)
            QuotaResetHistory.objects.create(
                subscription=subscription,
                old_expires_at=old_values["old_expires_at"],
                new_expires_at=subscription.expires_at,
                old_bytes_in=old_values["old_bytes_in"],
                old_bytes_out=old_values["old_bytes_out"],
                operator_name=payload.get("operator") or "system",
                mikrotik_result={
                    "routerResult": result,
                    "oldRateLimit": old_values["old_rate_limit"],
                    "newRateLimit": subscription.rate_limit,
                    "oldDataLimitEnabled": old_values["old_data_limit_enabled"],
                    "newDataLimitEnabled": subscription.data_limit_enabled,
                    "oldDataLimitGb": str(old_values["old_data_limit_gb"]),
                    "newDataLimitGb": str(subscription.data_limit_gb),
                    "oldDataLimitBytes": old_values["old_data_limit_bytes"],
                    "newDataLimitBytes": subscription.data_limit_bytes,
                },
            )
            write_log("reset-quota", target=str(subscription), detail="Renouvellement/reset depuis React appliqué dans MySQL + MikroTik", payload={"routerResult": result})
            return Response({
                "ok": True,
                "reset": True,
                "result": result,
                "subscription": SubscriptionSerializer(subscription).data,
                "message": "Quota data remis à zéro, plan/quota renouvelés et script appliqué sur MikroTik.",
            })
        except Exception as error:
            write_log("reset-quota", target=str(subscription), result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "reset": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


class MikroTikConnectedClientsAPIView(APIView):
    """Return live clients discovered from RouterOS and synchronize subscription counters."""

    def get(self, request: Request) -> Response:
        try:
            sync = str(request.query_params.get("sync", "true")).lower() != "false"
            include_generic = str(request.query_params.get("includeGeneric", "false")).lower() == "true"
            data = collect_realtime_clients(sync_database=sync, include_generic=include_generic)
            return Response({"ok": True, **data})
        except Exception as error:
            write_log("sync-connected-clients", result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


class MikroTikSyncSubscriptionsAPIView(APIView):
    """Synchronize Simple Queue counters into MySQL without changing the client list UI."""

    def post(self, request: Request) -> Response:
        try:
            data = collect_realtime_clients(sync_database=True, include_generic=True)
            return Response({"ok": True, "synced": True, **data})
        except Exception as error:
            write_log("sync-subscription-usage", result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "synced": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


class ReceiptAPIView(APIView):
    def get(self, request: Request, subscription_id: str) -> Response:
        subscription = get_object_or_404(Subscription.objects.select_related("customer"), id=subscription_id)
        usage = subscription.usage_bytes
        return Response({
            "ok": True,
            "receipt": {
                "subscriptionId": str(subscription.id),
                "clientName": subscription.customer.name,
                "plan": subscription.rate_limit,
                "expiresAt": subscription.expires_at.isoformat() if subscription.expires_at else None,
                "quotaGb": float(subscription.data_limit_gb),
                "quotaBytes": subscription.data_limit_bytes,
                "usageBytes": usage,
                "ip": subscription.ip,
                "mac": subscription.mac,
                "status": subscription.status,
                "generatedAt": timezone.now().isoformat(),
            },
        })
