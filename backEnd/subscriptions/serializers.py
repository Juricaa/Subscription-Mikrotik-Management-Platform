from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.utils import timezone
from rest_framework import serializers

from .models import ClientSession, Customer, LogEntry, QuotaResetHistory, RouterDevice, Subscription
from .mikrotik_scripts import gb_to_bytes, get_mikrotik_names


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "address", "notes", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class RouterDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouterDevice
        fields = ["id", "name", "host", "api_scheme", "username", "enabled", "notes", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class SubscriptionSerializer(serializers.ModelSerializer):
    clientName = serializers.CharField(write_only=False)
    rateLimit = serializers.CharField(source="rate_limit", required=False)
    expiresAt = serializers.DateField(source="expires_at", required=False, allow_null=True)
    dataLimitEnabled = serializers.BooleanField(source="data_limit_enabled", required=False)
    dataLimitGb = serializers.DecimalField(source="data_limit_gb", max_digits=10, decimal_places=2, required=False)
    dataLimitBytes = serializers.IntegerField(source="data_limit_bytes", required=False)
    dataLimitCheckInterval = serializers.CharField(source="data_limit_check_interval", required=False)
    dataLimitAction = serializers.CharField(source="data_limit_action", required=False)
    dataLimitReached = serializers.BooleanField(source="data_limit_reached", required=False)
    bytesIn = serializers.IntegerField(source="bytes_in", required=False)
    bytesOut = serializers.IntegerField(source="bytes_out", required=False)
    lastSeen = serializers.SerializerMethodField()
    routerId = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "clientName",
            "mac",
            "ip",
            "rateLimit",
            "status",
            "expiresAt",
            "comment",
            "dataLimitEnabled",
            "dataLimitGb",
            "dataLimitBytes",
            "dataLimitCheckInterval",
            "dataLimitAction",
            "dataLimitReached",
            "bytesIn",
            "bytesOut",
            "lastSeen",
            "routerId",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "lastSeen", "created_at", "updated_at"]

    def get_lastSeen(self, obj: Subscription) -> str:
        if not obj.last_seen:
            return "—"
        return timezone.localtime(obj.last_seen).strftime("%d/%m/%Y %H:%M")

    def to_representation(self, instance: Subscription) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["clientName"] = instance.customer.name
        # React side expects a number rather than a decimal string.
        try:
            data["dataLimitGb"] = float(instance.data_limit_gb)
        except Exception:
            data["dataLimitGb"] = 0
        return data

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        client_name = self.initial_data.get("clientName") or self.initial_data.get("client_name")
        if not client_name and not self.instance:
            raise serializers.ValidationError({"clientName": "Le nom du client est obligatoire."})

        data_limit = attrs.get("data_limit_gb")
        if data_limit is not None and Decimal(data_limit) < 0:
            raise serializers.ValidationError({"dataLimitGb": "Le quota ne peut pas être négatif."})

        if attrs.get("data_limit_enabled") and not attrs.get("data_limit_bytes"):
            gb = attrs.get("data_limit_gb") or Decimal("100")
            attrs["data_limit_bytes"] = gb_to_bytes(gb)

        return attrs

    def _assign_customer_and_router(self, instance: Subscription | None, attrs: dict[str, Any]) -> tuple[Customer, RouterDevice | None]:
        client_name = self.initial_data.get("clientName") or self.initial_data.get("client_name")
        if client_name:
            customer, _ = Customer.objects.get_or_create(name=str(client_name).strip())
        elif instance:
            customer = instance.customer
        else:
            raise serializers.ValidationError({"clientName": "Le nom du client est obligatoire."})

        router = instance.router if instance else None
        router_id = self.initial_data.get("routerId") or self.initial_data.get("router_id")
        if router_id:
            router = RouterDevice.objects.filter(id=router_id).first()
        elif not router:
            router = RouterDevice.objects.filter(enabled=True).first()

        return customer, router

    def create(self, validated_data: dict[str, Any]) -> Subscription:
        customer, router = self._assign_customer_and_router(None, validated_data)
        sub = Subscription(customer=customer, router=router, **validated_data)
        names = get_mikrotik_names({"clientName": customer.name, "ip": sub.ip})
        sub.mikrotik_queue_name = names["queueName"]
        sub.mikrotik_script_name = names["scriptName"]
        sub.mikrotik_scheduler_name = names["schedulerName"]
        sub.save()
        return sub

    def update(self, instance: Subscription, validated_data: dict[str, Any]) -> Subscription:
        customer, router = self._assign_customer_and_router(instance, validated_data)
        instance.customer = customer
        instance.router = router
        for key, value in validated_data.items():
            setattr(instance, key, value)
        names = get_mikrotik_names({"clientName": customer.name, "ip": instance.ip})
        instance.mikrotik_queue_name = names["queueName"]
        instance.mikrotik_script_name = names["scriptName"]
        instance.mikrotik_scheduler_name = names["schedulerName"]
        instance.save()
        return instance


class ClientSessionSerializer(serializers.ModelSerializer):
    clientName = serializers.CharField(source="subscription.customer.name", read_only=True)

    class Meta:
        model = ClientSession
        fields = [
            "id",
            "subscription",
            "clientName",
            "ip",
            "mac",
            "started_at",
            "ended_at",
            "rx_bytes",
            "tx_bytes",
            "status",
            "interface",
            "hostname",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class QuotaResetHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotaResetHistory
        fields = [
            "id",
            "subscription",
            "old_expires_at",
            "new_expires_at",
            "old_bytes_in",
            "old_bytes_out",
            "operator_name",
            "mikrotik_result",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class LogEntrySerializer(serializers.ModelSerializer):
    timestamp = serializers.SerializerMethodField()

    class Meta:
        model = LogEntry
        fields = ["id", "timestamp", "action", "target", "operator", "result", "detail", "payload", "created_at"]
        read_only_fields = ["id", "timestamp", "created_at"]

    def get_timestamp(self, obj: LogEntry) -> str:
        return timezone.localtime(obj.created_at).strftime("%d/%m/%Y %H:%M")
