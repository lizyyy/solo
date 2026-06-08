import csv
import os
from datetime import datetime
from typing import Iterable
from .models import ReconcileItem, ReconcileStatus, AbnormalQueueItem


def _fmt(v):
    if v is None:
        return ""
    if isinstance(v, list):
        return " | ".join(str(x) for x in v)
    return str(v)


def export_reconcile_csv(
    items: Iterable[ReconcileItem], out_dir: str, month: str
) -> dict[str, str]:
    os.makedirs(out_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    paths: dict[str, str] = {}

    buckets: dict[str, list[ReconcileItem]] = {
        s.value: [] for s in ReconcileStatus
    }
    all_items: list[ReconcileItem] = []
    for it in items:
        all_items.append(it)
        buckets[it.status.value].append(it)

    header = [
        "对账ID", "登记表ID", "犬只", "主人", "状态", "异常类型",
        "旧记录疫苗日", "主人补充疫苗日", "最终认定日期",
        "影响范围", "来源登记表行", "主人补充原话",
        "是否人工改判", "改判理由", "处理人", "处理时间", "对账月份"
    ]

    def _row(it: ReconcileItem):
        return [
            it.reconcile_id, it.reg_id, it.dog_name, it.owner_name, it.status.value,
            _fmt([t.value for t in it.abnormal_types]),
            _fmt(it.old_vaccine_date), _fmt(it.supplement_vaccine_date),
            _fmt(it.final_vaccine_date), it.impact_scope,
            _fmt(it.source_lines), _fmt(it.owner_supplement_raw),
            "是" if it.manual_override_flag else "否",
            _fmt(it.override_reason), _fmt(it.handler),
            _fmt(it.handled_at), it.reconcile_month
        ]

    all_path = os.path.join(out_dir, f"疫苗对账明细-全部-{month}-{timestamp}.csv")
    with open(all_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for it in all_items:
            w.writerow(_row(it))
    paths["全部"] = all_path

    for status_name, bucket in buckets.items():
        if not bucket:
            continue
        p = os.path.join(out_dir, f"疫苗对账明细-{status_name}-{month}-{timestamp}.csv")
        with open(p, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(header)
            for it in bucket:
                w.writerow(_row(it))
        paths[status_name] = p

    return paths


def export_abnormal_queue_csv(
    queue: Iterable[AbnormalQueueItem], out_dir: str, month: str
) -> str:
    os.makedirs(out_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = os.path.join(out_dir, f"异常队列-{month}-{timestamp}.csv")
    header = [
        "异常队列ID", "对账ID", "登记表ID", "犬只", "状态",
        "异常类型", "异常摘要", "主人补充原话",
        "来源登记表定位", "影响范围", "入队时间"
    ]
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for q in queue:
            w.writerow([
                q.queue_id, q.reconcile_id, q.reg_id, q.dog_name, q.status.value,
                _fmt([t.value for t in q.abnormal_types]),
                q.summary, _fmt(q.owner_supplement_raw),
                q.source_register_ref, q.impact_scope, _fmt(q.created_at)
            ])
    return path
