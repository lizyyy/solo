import csv
import io
import json
import os
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from . import services, models, schemas
from .models import TaskStatus, Conclusion, Node


REPORT_DIR = "reports"


def _ensure_dir() -> None:
    os.makedirs(REPORT_DIR, exist_ok=True)


def build_report_content(db: Session, batch: models.AcceptanceBatch) -> str:
    raw = json.loads(batch.raw_payload)
    photos = services.parse_photos(batch.photos)
    items = raw.get("items", [])
    extra = raw.get("extra") or {}

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["批次编号", batch.batch_no])
    writer.writerow(["项目名称", batch.project_name])
    writer.writerow(["监理", batch.supervisor])
    writer.writerow(["节点", batch.node.value])
    writer.writerow(["当前状态", batch.status.value])
    writer.writerow(["最终结论", batch.conclusion.value])
    writer.writerow(["创建时间", batch.created_at.isoformat()])
    writer.writerow(["更新时间", batch.updated_at.isoformat()])
    writer.writerow([])
    writer.writerow(["验收项", "必填", "备注"])
    for it in items:
        writer.writerow([it.get("item"), it.get("required", True), it.get("remark", "")])
    writer.writerow([])
    writer.writerow(["照片", ""])
    for p in photos:
        writer.writerow([p])
    if extra:
        writer.writerow([])
        writer.writerow(["扩展字段", "值"])
        for k, v in extra.items():
            writer.writerow([k, v])
    return buf.getvalue()


def export_report(db: Session, batch: models.AcceptanceBatch, operator: str) -> str:
    _ensure_dir()
    filename = f"acceptance_{batch.batch_no}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.csv"
    path = os.path.join(REPORT_DIR, filename)
    content = build_report_content(db, batch)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write(content)
    services.mark_exported(db, batch, operator, path)
    return path
