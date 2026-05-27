from django.conf import settings
from django.core.management.base import BaseCommand

from subscriptions.models import RouterDevice


class Command(BaseCommand):
    help = "Crée ou met à jour le routeur principal depuis les variables .env."

    def handle(self, *args, **options):
        host = settings.MIKROTIK["HOST"]
        scheme = "https" if settings.MIKROTIK["USE_HTTPS"] else "http"
        router, created = RouterDevice.objects.update_or_create(
            name="Routeur principal",
            defaults={
                "host": host,
                "api_scheme": scheme,
                "username": settings.MIKROTIK["USER"],
                "enabled": True,
                "notes": "Créé automatiquement depuis .env. Le mot de passe reste dans .env.",
            },
        )
        action = "créé" if created else "mis à jour"
        self.stdout.write(self.style.SUCCESS(f"Routeur {action}: {router}"))
