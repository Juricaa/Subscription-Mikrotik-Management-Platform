from __future__ import annotations

from typing import Any

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .mikrotik_client import MikroTikError, execute_script, router_request
from .mikrotik_scripts import build_quota_reset_script, build_subscription_apply_script
from .models import ClientSession, Customer, LogEntry, QuotaResetHistory, RouterDevice, Subscription
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
        old_expires_at = subscription.expires_at
        new_expires_at = request.data.get("expiresAt") or request.data.get("expires_at") or old_expires_at
        old_bytes_in = subscription.bytes_in
        old_bytes_out = subscription.bytes_out
        if new_expires_at:
            subscription.expires_at = new_expires_at
        subscription.bytes_in = 0
        subscription.bytes_out = 0
        subscription.data_limit_reached = False
        subscription.status = Subscription.STATUS_ACTIVE
        subscription.last_seen = timezone.now()
        subscription.save()

        try:
            script = build_quota_reset_script(subscription)
            result = execute_script(script)
            QuotaResetHistory.objects.create(
                subscription=subscription,
                old_expires_at=old_expires_at,
                new_expires_at=subscription.expires_at,
                old_bytes_in=old_bytes_in,
                old_bytes_out=old_bytes_out,
                operator_name=request.data.get("operator") or "system",
                mikrotik_result={"routerResult": result},
            )
            write_log("reset-quota", target=str(subscription), detail="Quota remis à zéro et expiration renouvelée", payload={"routerResult": result})
            return Response({"ok": True, "reset": True, "result": result, "subscription": SubscriptionSerializer(subscription).data})
        except Exception as error:
            write_log("reset-quota", target=str(subscription), result=LogEntry.RESULT_ERROR, detail=str(error))
            raise


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

        old_expires_at = subscription.expires_at
        old_bytes_in = subscription.bytes_in
        old_bytes_out = subscription.bytes_out
        new_expires_at = payload.get("expiresAt") or payload.get("expires_at") or old_expires_at

        if new_expires_at:
            subscription.expires_at = new_expires_at
        subscription.status = Subscription.STATUS_ACTIVE
        subscription.bytes_in = 0
        subscription.bytes_out = 0
        subscription.data_limit_reached = False
        subscription.last_seen = timezone.now()
        subscription.save()

        try:
            script = build_quota_reset_script(subscription)
            result = execute_script(script)
            QuotaResetHistory.objects.create(
                subscription=subscription,
                old_expires_at=old_expires_at,
                new_expires_at=subscription.expires_at,
                old_bytes_in=old_bytes_in,
                old_bytes_out=old_bytes_out,
                operator_name=payload.get("operator") or "system",
                mikrotik_result={"routerResult": result},
            )
            write_log("reset-quota", target=str(subscription), detail="Quota remis à zéro depuis endpoint compatible React", payload={"routerResult": result})
            return Response({
                "ok": True,
                "reset": True,
                "result": result,
                "subscription": SubscriptionSerializer(subscription).data,
                "message": "Quota data remis à zéro sur MikroTik et expiration mise à jour dans MySQL.",
            })
        except Exception as error:
            write_log("reset-quota", target=str(subscription), result=LogEntry.RESULT_ERROR, detail=str(error))
            return Response({"ok": False, "reset": False, "error": safe_error(error)}, status=status.HTTP_502_BAD_GATEWAY)


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
