from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from doppler.models import AuditRecord


class AuditLog:
    def __init__(self) -> None:
        self._records: list[AuditRecord] = []

    def log(
        self,
        endpoint: str,
        method: str,
        request_summary: str,
        response_summary: str,
        client_id: Optional[str] = None,
    ) -> AuditRecord:
        record = AuditRecord(
            record_id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            endpoint=endpoint,
            method=method,
            request_summary=request_summary,
            response_summary=response_summary,
            timestamp=datetime.now(),
            client_id=client_id,
        )
        self._records.append(record)
        return record

    def query(
        self,
        endpoint: Optional[str] = None,
        limit: int = 100,
    ) -> list[AuditRecord]:
        results = self._records
        if endpoint:
            results = [r for r in results if r.endpoint == endpoint]
        return results[-limit:]

    def count(self) -> int:
        return len(self._records)
