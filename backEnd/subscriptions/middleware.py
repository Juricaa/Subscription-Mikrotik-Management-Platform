from __future__ import annotations

from django.conf import settings
from django.http import HttpResponse


class SimpleCorsMiddleware:
    """Small CORS helper for local Vite <-> Django development without extra dependencies."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        allowed_origin = getattr(settings, "DJANGO_CORS_ORIGIN", None) or None
        allowed_origin = allowed_origin or __import__("os").environ.get("DJANGO_CORS_ORIGIN", "*")

        if request.method == "OPTIONS":
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        if origin and (allowed_origin == "*" or origin == allowed_origin):
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
        elif allowed_origin == "*":
            response["Access-Control-Allow-Origin"] = "*"

        response["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-CSRFToken"
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response["Access-Control-Allow-Credentials"] = "true"
        return response
