from django.contrib import admin

from .models import ClientSession, Customer, LogEntry, QuotaResetHistory, RouterDevice, Subscription


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email", "created_at")
    search_fields = ("name", "phone", "email")


@admin.register(RouterDevice)
class RouterDeviceAdmin(admin.ModelAdmin):
    list_display = ("name", "host", "api_scheme", "enabled")
    list_filter = ("enabled", "api_scheme")


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ("customer", "ip", "mac", "rate_limit", "status", "expires_at", "data_limit_enabled", "data_limit_reached")
    list_filter = ("status", "data_limit_enabled", "data_limit_reached")
    search_fields = ("customer__name", "ip", "mac", "comment")


@admin.register(ClientSession)
class ClientSessionAdmin(admin.ModelAdmin):
    list_display = ("subscription", "ip", "mac", "status", "started_at", "ended_at")
    list_filter = ("status",)
    search_fields = ("subscription__customer__name", "ip", "mac", "hostname")


@admin.register(QuotaResetHistory)
class QuotaResetHistoryAdmin(admin.ModelAdmin):
    list_display = ("subscription", "old_expires_at", "new_expires_at", "operator_name", "created_at")
    search_fields = ("subscription__customer__name", "operator_name")


@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ("action", "target", "operator", "result", "created_at")
    list_filter = ("result", "action")
    search_fields = ("action", "target", "detail")
