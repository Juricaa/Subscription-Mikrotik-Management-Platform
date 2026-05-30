from __future__ import annotations

import re

from django.conf import settings
from django.http import HttpResponse


def _is_local_dev_origin(origin: str | None) -> bool:
    if not origin:
        return False
    return bool(re.match(r"^https?://(localhost|127\.0\.0\.1):\d+$", origin))


class LocalDevCorsMiddleware:
    """Force les headers CORS en développement local.

    Cette sécurité supplémentaire évite les blocages quand Vite change de port
    automatiquement, par exemple 5173 -> 5174. Elle complète
    django-cors-headers et ne doit être active qu'en DEBUG.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        should_apply = bool(settings.DEBUG and _is_local_dev_origin(origin))

        if should_apply and request.method == "OPTIONS":
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if should_apply and origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = (
                "Accept, Authorization, Content-Type, X-CSRFToken, X-Requested-With, "
                "Cache-Control, Pragma"
            )
            response["Access-Control-Max-Age"] = "86400"
            # En développement local on autorise explicitement les credentials
            # car certains navigateurs/clients fetch peuvent envoyer
            # credentials: include. Sans ce header, Firefox/Chrome bloquent
            # même si la réponse HTTP est 200.
            response["Access-Control-Allow-Credentials"] = "true"

        return response


# Compatibilité avec l'ancien nom si un fichier settings.py le référence encore.
SimpleCorsMiddleware = LocalDevCorsMiddleware
