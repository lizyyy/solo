from __future__ import annotations

import uuid
from datetime import datetime

from doppler.models import BatchReport, ResultStatus, SpeedResult


def generate_batch_report(results: list[SpeedResult]) -> BatchReport:
    confirmed = sum(1 for r in results if r.status == ResultStatus.CONFIRMED)
    pending = sum(1 for r in results if r.status == ResultStatus.PENDING_REVIEW)
    rejected = sum(1 for r in results if r.status == ResultStatus.REJECTED)

    return BatchReport(
        report_id=f"RPT-{uuid.uuid4().hex[:8].upper()}",
        created_at=datetime.now(),
        total_samples=len(results),
        confirmed_count=confirmed,
        pending_count=pending,
        rejected_count=rejected,
        results=results,
    )
