from __future__ import annotations

import os
from pathlib import Path

from corsheaders.defaults import default_headers, default_methods

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file(PROJECT_ROOT / ".env")
load_env_file(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    value = os.environ.get(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "subscriptions",
]

MIDDLEWARE = [
    "subscriptions.middleware.LocalDevCorsMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "mikrotik_manager.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "mikrotik_manager.wsgi.application"
ASGI_APPLICATION = "mikrotik_manager.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.environ.get("MYSQL_DATABASE", "mikrotik_subscriptions"),
        "USER": os.environ.get("MYSQL_USER", "root"),
        "PASSWORD": os.environ.get("MYSQL_PASSWORD", ""),
        "HOST": os.environ.get("MYSQL_HOST", "127.0.0.1"),
        "PORT": os.environ.get("MYSQL_PORT", "3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

if env_bool("MYSQL_SSL", False):
    DATABASES["default"].setdefault("OPTIONS", {})["ssl"] = {}

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Indian/Antananarivo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_ENGINE = "django.contrib.sessions.backends.db"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# -----------------------------------------------------------------------------
# CORS / CSRF - développement local FrontEnd Vite + BackEnd Django
# -----------------------------------------------------------------------------
def unique_list(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result


_frontend_origins = env_list("VITE_FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
_configured_cors_origins = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    os.environ.get("DJANGO_CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"),
)

CORS_ALLOWED_ORIGINS = unique_list(_configured_cors_origins + _frontend_origins)

# En développement, Vite peut parfois démarrer sur 5174/5175 si 5173 est occupé.
# Ces regex évitent le blocage CORS quand le port change localement.
CORS_ALLOWED_ORIGIN_REGEXES = env_list("DJANGO_CORS_ALLOWED_ORIGIN_REGEXES", "")
if DEBUG:
    CORS_ALLOWED_ORIGIN_REGEXES = unique_list(
        CORS_ALLOWED_ORIGIN_REGEXES
        + [
            r"^http://localhost:[0-9]+$",
            r"^http://127\.0\.0\.1:[0-9]+$",
        ]
    )

# En développement uniquement, cette option peut être activée pour diagnostiquer CORS.
# Par défaut on garde False et on autorise localhost via liste + regex + LocalDevCorsMiddleware.
CORS_ALLOW_ALL_ORIGINS = env_bool("DJANGO_CORS_ALLOW_ALL_ORIGINS", False)
CORS_ALLOW_CREDENTIALS = env_bool("DJANGO_CORS_ALLOW_CREDENTIALS", True)
CORS_ALLOW_METHODS = list(default_methods)
CORS_ALLOW_HEADERS = list(default_headers) + [
    "cache-control",
    "pragma",
]
CSRF_TRUSTED_ORIGINS = unique_list(
    env_list(
        "DJANGO_CSRF_TRUSTED_ORIGINS",
        os.environ.get("DJANGO_CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"),
    )
    + _frontend_origins
)

SPECTACULAR_SETTINGS = {
    "TITLE": "Subscription MikroTik Management API",
    "DESCRIPTION": "API Django pour gérer les clients, abonnements, sessions, reçus et actions MikroTik.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,
        "displayRequestDuration": True,
    },
}

MIKROTIK = {
    "HOST": os.environ.get("MIKROTIK_HOST", "192.168.88.1"),
    "USER": os.environ.get("MIKROTIK_USER", "admin"),
    "PASSWORD": os.environ.get("MIKROTIK_PASSWORD", ""),
    "USE_HTTPS": env_bool("MIKROTIK_USE_HTTPS", True),
    "TLS_REJECT_UNAUTHORIZED": env_bool("MIKROTIK_TLS_REJECT_UNAUTHORIZED", False),
    "TIMEOUT_SECONDS": float(os.environ.get("MIKROTIK_TIMEOUT_SECONDS", "15")),
}
