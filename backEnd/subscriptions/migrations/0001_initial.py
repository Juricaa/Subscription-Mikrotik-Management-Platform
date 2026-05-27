# Generated for Subscription MikroTik Management Platform Django backend.
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Customer",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(db_index=True, max_length=160)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("address", models.CharField(blank=True, max_length=255)),
                ("notes", models.TextField(blank=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="RouterDevice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(default="Routeur principal", max_length=120)),
                ("host", models.CharField(max_length=160)),
                ("api_scheme", models.CharField(choices=[("http", "HTTP"), ("https", "HTTPS")], default="https", max_length=8)),
                ("username", models.CharField(blank=True, max_length=80)),
                ("enabled", models.BooleanField(default=True)),
                ("notes", models.TextField(blank=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="LogEntry",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("action", models.CharField(max_length=120)),
                ("target", models.CharField(blank=True, max_length=160)),
                ("operator", models.CharField(blank=True, default="system", max_length=120)),
                ("result", models.CharField(choices=[("success", "Succès"), ("error", "Erreur")], default="success", max_length=20)),
                ("detail", models.TextField(blank=True)),
                ("payload", models.JSONField(blank=True, default=dict)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Subscription",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("mac", models.CharField(db_index=True, max_length=32)),
                ("ip", models.GenericIPAddressField(db_index=True, protocol="IPv4")),
                ("rate_limit", models.CharField(default="10M/5M", max_length=40)),
                ("status", models.CharField(choices=[("active", "Actif"), ("suspended", "Suspendu"), ("expired", "Expiré"), ("pending", "En attente")], db_index=True, default="active", max_length=20)),
                ("expires_at", models.DateField(blank=True, db_index=True, null=True)),
                ("comment", models.CharField(blank=True, max_length=255)),
                ("data_limit_enabled", models.BooleanField(default=False)),
                ("data_limit_gb", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("data_limit_bytes", models.BigIntegerField(default=0)),
                ("data_limit_check_interval", models.CharField(default="5m", max_length=16)),
                ("data_limit_action", models.CharField(default="firewall-block", max_length=40)),
                ("data_limit_reached", models.BooleanField(db_index=True, default=False)),
                ("bytes_in", models.BigIntegerField(default=0)),
                ("bytes_out", models.BigIntegerField(default=0)),
                ("last_seen", models.DateTimeField(blank=True, null=True)),
                ("mikrotik_queue_name", models.CharField(blank=True, max_length=120)),
                ("mikrotik_script_name", models.CharField(blank=True, max_length=120)),
                ("mikrotik_scheduler_name", models.CharField(blank=True, max_length=120)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subscriptions", to="subscriptions.customer")),
                ("router", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="subscriptions", to="subscriptions.routerdevice")),
            ],
            options={"ordering": ["customer__name"]},
        ),
        migrations.CreateModel(
            name="ClientSession",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("ip", models.GenericIPAddressField(protocol="IPv4")),
                ("mac", models.CharField(max_length=32)),
                ("started_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("rx_bytes", models.BigIntegerField(default=0)),
                ("tx_bytes", models.BigIntegerField(default=0)),
                ("status", models.CharField(choices=[("online", "Online"), ("offline", "Offline"), ("blocked", "Bloqué")], default="online", max_length=20)),
                ("interface", models.CharField(blank=True, max_length=80)),
                ("hostname", models.CharField(blank=True, max_length=120)),
                ("subscription", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sessions", to="subscriptions.subscription")),
            ],
            options={"ordering": ["-started_at"]},
        ),
        migrations.CreateModel(
            name="QuotaResetHistory",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("old_expires_at", models.DateField(blank=True, null=True)),
                ("new_expires_at", models.DateField(blank=True, null=True)),
                ("old_bytes_in", models.BigIntegerField(default=0)),
                ("old_bytes_out", models.BigIntegerField(default=0)),
                ("operator_name", models.CharField(blank=True, max_length=120)),
                ("mikrotik_result", models.JSONField(blank=True, default=dict)),
                ("subscription", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="quota_resets", to="subscriptions.subscription")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddIndex(model_name="customer", index=models.Index(fields=["name"], name="subscriptio_name_94c042_idx")),
        migrations.AddIndex(model_name="logentry", index=models.Index(fields=["result", "created_at"], name="subscriptio_result_0a3c9c_idx")),
        migrations.AddIndex(model_name="subscription", index=models.Index(fields=["status", "expires_at"], name="subscriptio_status_41ed2c_idx")),
        migrations.AddIndex(model_name="subscription", index=models.Index(fields=["data_limit_enabled", "data_limit_reached"], name="subscriptio_data_li_efb7a4_idx")),
        migrations.AddConstraint(model_name="subscription", constraint=models.UniqueConstraint(fields=("ip",), name="unique_subscription_ip")),
        migrations.AddConstraint(model_name="subscription", constraint=models.UniqueConstraint(fields=("mac",), name="unique_subscription_mac")),
        migrations.AddIndex(model_name="clientsession", index=models.Index(fields=["status", "started_at"], name="subscriptio_status_c61d13_idx")),
    ]
