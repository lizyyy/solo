#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime
from pathlib import Path
import click

__version__ = "0.1.0"

DEFAULT_SENSITIVE_FIELDS = [
    "authorization", "token", "password", "secret", "key", "apikey",
    "access_token", "refresh_token", "jwt", "cookie", "session"
]


def mask_value(value, mask_char="*"):
    if len(value) <= 4:
        return mask_char * len(value)
    return value[:2] + mask_char * (len(value) - 4) + value[-2:]


def generate_curl(method, url, headers, body=None):
    parts = ["curl"]
    if method != "GET":
        parts.append(f"-X {method}")
    for key, value in headers.items():
        escaped_value = value.replace("\"", "\\"")
        parts.append(f"-H \"{key}: {escaped_value}\"")
    if body and len(body) < 1000:
        escaped_body = body.replace("\"", "\\"").replace("$", "\$")
        parts.append(f"-d \"{escaped_body}\"")
    parts.append(f"\"{url}\"")
    return " ".join(parts)

