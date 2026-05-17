content = """#!/usr/bin/env python3
import json
import re
import sys
from datetime import datetime
from pathlib import Path
import click

__version__ = "0.1.0"

DEFAULT_SENSITIVE_FIELDS = [
    \"authorization\", \"token\", \"password\", \"secret\", \"key\", \"apikey\",
    \"access_token\", \"refresh_token\", \"jwt\", \"cookie\", \"session\"
]
"""
