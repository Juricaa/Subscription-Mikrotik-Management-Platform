from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import requests
from django.conf import settings


class MikroTikError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, detail: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.detail = detail


def _base_url() -> str:
    host = settings.MIKROTIK["HOST"]
    if host.startswith("http://") or host.startswith("https://"):
        parsed = urlparse(host)
        return f"{parsed.scheme}://{parsed.netloc}/rest"
    scheme = "https" if settings.MIKROTIK["USE_HTTPS"] else "http"
    return f"{scheme}://{host}/rest"


def router_request(method: str, endpoint: str, payload: dict[str, Any] | None = None) -> Any:
    endpoint = endpoint if endpoint.startswith("/") else f"/{endpoint}"
    url = f"{_base_url()}{endpoint}"
    verify = bool(settings.MIKROTIK["TLS_REJECT_UNAUTHORIZED"])
    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            json=payload,
            auth=(settings.MIKROTIK["USER"], settings.MIKROTIK["PASSWORD"]),
            timeout=settings.MIKROTIK["TIMEOUT_SECONDS"],
            verify=verify,
        )
    except requests.RequestException as exc:
        raise MikroTikError(f"Impossible de joindre MikroTik: {exc}") from exc

    if response.status_code >= 400:
        detail: Any
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise MikroTikError("Erreur RouterOS REST API", response.status_code, detail)

    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


def execute_script(script: str) -> Any:
    return router_request("POST", "/execute", {"script": script})
