from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from .config import settings
from .schemas import AnalysisReport, BatchIngestRequest, BatchMeta, ItemTrace


class BatchStore:
    def __init__(self, storage_dir: Optional[str] = None):
        base = Path(storage_dir or settings.storage_dir)
        self.batches_dir = base / "batches"
        self.reports_dir = base / "reports"
        self.traces_dir = base / "traces"
        self.meta_dir = base / "meta"
        for d in (self.batches_dir, self.reports_dir, self.traces_dir, self.meta_dir):
            d.mkdir(parents=True, exist_ok=True)

    def exists(self, batch_id: str) -> bool:
        return (self.meta_dir / f"{batch_id}.json").exists()

    def save_ingest(self, req: BatchIngestRequest) -> BatchMeta:
        payload = req.model_dump(mode="json")
        (self.batches_dir / f"{batch_id}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        meta = BatchMeta(
            batch_id=req.batch_id,
            created_at=req.packages[0].inbound_at if req.packages else None,
            package_count=len(req.packages),
            sms_count=len(req.sms_records),
            rule_count=len(req.rules),
        )
        (self.meta_dir / f"{batch_id}.json").write_text(
            json.dumps(meta.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return meta

    def load_ingest(self, batch_id: str) -> Optional[BatchIngestRequest]:
        p = self.batches_dir / f"{batch_id}.json"
        if not p.exists():
            return None
        data = json.loads(p.read_text(encoding="utf-8"))
        return BatchIngestRequest(**data)

    def save_report(self, report: AnalysisReport) -> str:
        ref = f"reports/{report.batch_id}.json"
        (self.reports_dir / f"{report.batch_id}.json").write_text(
            json.dumps(report.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        meta_path = self.meta_dir / f"{report.batch_id}.json"
        if meta_path.exists():
            meta = BatchMeta(**json.loads(meta_path.read_text(encoding="utf-8")))
            meta.report_ref = ref
            meta_path.write_text(
                json.dumps(meta.model_dump(mode="json"), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        return ref

    def save_traces(self, batch_id: str, traces: list[ItemTrace]) -> None:
        data = [t.model_dump(mode="json") for t in traces]
        (self.traces_dir / f"{batch_id}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def load_traces(self, batch_id: str) -> list[ItemTrace]:
        p = self.traces_dir / f"{batch_id}.json"
        if not p.exists():
            return []
        raw = json.loads(p.read_text(encoding="utf-8"))
        return [ItemTrace(**x) for x in raw]

    def find_trace(self, batch_id: str, tracking_no: str) -> Optional[ItemTrace]:
        for t in self.load_traces(batch_id):
            if t.tracking_no == tracking_no:
                return t
        return None

    def load_report(self, batch_id: str) -> Optional[AnalysisReport]:
        p = self.reports_dir / f"{batch_id}.json"
        if not p.exists():
            return None
        return AnalysisReport(**json.loads(p.read_text(encoding="utf-8")))

    def list_batches(self) -> list[BatchMeta]:
        out: list[BatchMeta] = []
        for p in self.meta_dir.glob("*.json"):
            try:
                out.append(BatchMeta(**json.loads(p.read_text(encoding="utf-8"))))
            except Exception:
                continue
        out.sort(key=lambda m: m.batch_id)
        return out


store = BatchStore()
