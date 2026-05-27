from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from subscriptions.views import (
    ClientSessionViewSet,
    CustomerViewSet,
    LogEntryViewSet,
    MikroTikApplyAPIView,
    MikroTikResetQuotaAPIView,
    MikroTikSystemResourceAPIView,
    ReceiptAPIView,
    RouterDeviceViewSet,
    SubscriptionViewSet,
)

router = DefaultRouter()
router.register(r"clients", CustomerViewSet, basename="client")
router.register(r"subscriptions", SubscriptionViewSet, basename="subscription")
router.register(r"sessions", ClientSessionViewSet, basename="session")
router.register(r"routers", RouterDeviceViewSet, basename="router")
router.register(r"logs", LogEntryViewSet, basename="log")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api/health", MikroTikSystemResourceAPIView.as_view(health_only=True), name="health"),
    path("api/receipts/<uuid:subscription_id>/", ReceiptAPIView.as_view(), name="subscription-receipt"),
    # Compatibility routes used by the current React service.
    path("api/mikrotik/system/resource", MikroTikSystemResourceAPIView.as_view(), name="mikrotik-resource"),
    path("api/mikrotik/subscriptions/apply", MikroTikApplyAPIView.as_view(), name="mikrotik-apply"),
    path("api/mikrotik/subscriptions/reset-quota", MikroTikResetQuotaAPIView.as_view(), name="mikrotik-reset-quota"),
]
