from __future__ import annotations

import hashlib
import json
from typing import Any


def compute_batch_hash(items: list[dict[str, Any]]) -> str:
    canonical = json.dumps(
        sorted(items, key=lambda x: json.dumps(x, sort_keys=True)),
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
