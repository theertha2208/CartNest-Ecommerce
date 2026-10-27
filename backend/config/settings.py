
"""
Django settings for CartNest E-Commerce Project.

Backend: Django + Django REST Framework
Frontend: React + Vite + Tailwind CSS
Authentication: JWT (Simple JWT)
Database: SQLite
"""

from pathlib import Path
from datetime import timedelta
import os


# ==========================================
# BASE DIRECTORY
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent


# ==========================================
# SECURITY SETTINGS
# ==========================================

# Development-only fallback.
# Set DJANGO_SECRET_KEY in the environment for deployment.
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

DEBUG = os.environ.get(
    "DJANGO_DEBUG", "True"
).lower() == "true"

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
]


# ==========================================
# INSTALLED APPLICATIONS
# ==========================================

INSTALLED_APPS = [
    # Django built-in applications
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party applications
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt.token_blacklist",

    # CartNest application
    "store",
]


# ==========================================
# MIDDLEWARE
# ==========================================

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",

    # CORS middleware
    "corsheaders.middleware.CorsMiddleware",

    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ==========================================
# URL CONFIGURATION
# ==========================================

ROOT_URLCONF = "config.urls"


# ==========================================
# TEMPLATES
# ==========================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ==========================================
# WSGI APPLICATION
# ==========================================

WSGI_APPLICATION = "config.wsgi.application"


# ==========================================
# DATABASE
# ==========================================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# ==========================================
# PASSWORD VALIDATION
# ==========================================

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "UserAttributeSimilarityValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "MinimumLengthValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "CommonPasswordValidator"
        ),
    },
    {
        "NAME": (
            "django.contrib.auth.password_validation."
            "NumericPasswordValidator"
        ),
    },
]


# ==========================================
# INTERNATIONALIZATION
# ==========================================

LANGUAGE_CODE = "en-us"

TIME_ZONE = "Asia/Kolkata"

USE_I18N = True

USE_TZ = True


# ==========================================
# DJANGO REST FRAMEWORK
# ==========================================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],

    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],

    "DEFAULT_PAGINATION_CLASS": (
        "rest_framework.pagination.PageNumberPagination"
    ),

    "PAGE_SIZE": 12,
}


# ==========================================
# JWT AUTHENTICATION
# ==========================================

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),

    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),

    "ROTATE_REFRESH_TOKENS": True,

    "BLACKLIST_AFTER_ROTATION": True,

    "AUTH_HEADER_TYPES": ("Bearer",),

    "USER_ID_FIELD": "id",

    "USER_ID_CLAIM": "user_id",
}


# ==========================================
# CORS CONFIGURATION
# ==========================================

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# ==========================================
# CSRF TRUSTED ORIGINS
# ==========================================

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# ==========================================
# STATIC FILES
# ==========================================

STATIC_URL = "static/"

STATIC_ROOT = BASE_DIR / "staticfiles"


# ==========================================
# MEDIA FILES
# PRODUCT IMAGE UPLOADS
# ==========================================

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"


# ==========================================
# DEFAULT PRIMARY KEY
# ==========================================

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
