from __future__ import annotations

import uuid
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Customer(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160, db_index=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"])]

    def __str__(self) -> str:
        return self.name


class RouterDevice(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, default="Routeur principal")
    host = models.CharField(max_length=160)
    api_scheme = models.CharField(max_length=8, choices=[("http", "HTTP"), ("https", "HTTPS")], default="https")
    username = models.CharField(max_length=80, blank=True)
    enabled = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.host})"


class Subscription(TimeStampedModel):
    STATUS_ACTIVE = "active"
    STATUS_SUSPENDED = "suspended"
    STATUS_EXPIRED = "expired"
    STATUS_PENDING = "pending"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Actif"),
        (STATUS_SUSPENDED, "Suspendu"),
        (STATUS_EXPIRED, "Expiré"),
        (STATUS_PENDING, "En attente"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="subscriptions")
    router = models.ForeignKey(RouterDevice, on_delete=models.SET_NULL, related_name="subscriptions", null=True, blank=True)
    mac = models.CharField(max_length=32, db_index=True)
    ip = models.GenericIPAddressField(protocol="IPv4", db_index=True)
    rate_limit = models.CharField(max_length=40, default="10M/5M")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    expires_at = models.DateField(null=True, blank=True, db_index=True)
    comment = models.CharField(max_length=255, blank=True)

    data_limit_enabled = models.BooleanField(default=False)
    data_limit_gb = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    data_limit_bytes = models.BigIntegerField(default=0)
    data_limit_check_interval = models.CharField(max_length=16, default="5m")
    data_limit_action = models.CharField(max_length=40, default="firewall-block")
    data_limit_reached = models.BooleanField(default=False, db_index=True)
    bytes_in = models.BigIntegerField(default=0)
    bytes_out = models.BigIntegerField(default=0)
    last_seen = models.DateTimeField(null=True, blank=True)

    mikrotik_queue_name = models.CharField(max_length=120, blank=True)
    mikrotik_script_name = models.CharField(max_length=120, blank=True)
    mikrotik_scheduler_name = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["customer__name"]
        constraints = [
            models.UniqueConstraint(fields=["ip"], name="unique_subscription_ip"),
            models.UniqueConstraint(fields=["mac"], name="unique_subscription_mac"),
        ]
        indexes = [
            models.Index(fields=["status", "expires_at"]),
            models.Index(fields=["data_limit_enabled", "data_limit_reached"]),
        ]

    def __str__(self) -> str:
        return f"{self.customer.name} - {self.ip}"

    @property
    def usage_bytes(self) -> int:
        return int(self.bytes_in or 0) + int(self.bytes_out or 0)


class ClientSession(TimeStampedModel):
    STATUS_ONLINE = "online"
    STATUS_OFFLINE = "offline"
    STATUS_BLOCKED = "blocked"
    STATUS_CHOICES = [
        (STATUS_ONLINE, "Online"),
        (STATUS_OFFLINE, "Offline"),
        (STATUS_BLOCKED, "Bloqué"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="sessions")
    ip = models.GenericIPAddressField(protocol="IPv4")
    mac = models.CharField(max_length=32)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    rx_bytes = models.BigIntegerField(default=0)
    tx_bytes = models.BigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ONLINE)
    interface = models.CharField(max_length=80, blank=True)
    hostname = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["status", "started_at"])]

    def __str__(self) -> str:
        return f"{self.subscription.customer.name} {self.started_at:%Y-%m-%d %H:%M}"


class QuotaResetHistory(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="quota_resets")
    old_expires_at = models.DateField(null=True, blank=True)
    new_expires_at = models.DateField(null=True, blank=True)
    old_bytes_in = models.BigIntegerField(default=0)
    old_bytes_out = models.BigIntegerField(default=0)
    operator_name = models.CharField(max_length=120, blank=True)
    mikrotik_result = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]


class LogEntry(TimeStampedModel):
    RESULT_SUCCESS = "success"
    RESULT_ERROR = "error"
    RESULT_CHOICES = [(RESULT_SUCCESS, "Succès"), (RESULT_ERROR, "Erreur")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action = models.CharField(max_length=120)
    target = models.CharField(max_length=160, blank=True)
    operator = models.CharField(max_length=120, blank=True, default="system")
    result = models.CharField(max_length=20, choices=RESULT_CHOICES, default=RESULT_SUCCESS)
    detail = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["result", "created_at"])]

    def __str__(self) -> str:
        return f"{self.action} - {self.result}"
