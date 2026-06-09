from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import copy
from models import ScheduleRecord, ParamVersion, RunDiff, Anomaly, _now, _uid
from storage import (
    save_records, add_version, add_diff,
    save_sample_input,
)


FIELD_ALIASES = {
    "part_id": ["part_id", "备件编号", "编号", "物料编号", "物料编码", "part_code", "code"],
    "part_name": ["part_name", "备件名称", "名称", "物料名称", "part", "name"],
    "category": ["category", "分类", "类别", "类型", "刀盘部位", "部位", "cate"],
    "scheduled_date": ["scheduled_date", "计划日期", "排程日期", "预计日期", "更换日期", "date", "plan_date"],
    "quantity": ["quantity", "数量", "件数", "需求数量", "qty", "amount", "num"],
    "status": ["status", "状态", "处理状态", "进度", "state"],
    "photo_url": ["photo_url", "照片", "维修照片", "图片", "照片链接", "image", "img", "图片链接", "attachment"],
    "photo_time": ["photo_time", "拍摄时间", "照片时间", "拍照时间", "时间戳", "img_time", "shot_time", "time"],
    "source": ["source", "来源", "来源渠道", "提交人", "from"],
}


def build_reverse_map() -> Dict[str, str]:
    rev = {}
    for canonical, aliases in FIELD_ALIASES.items():
        for a in aliases:
            rev[a.strip().lower()] = canonical
    return rev


REV_MAP = build_reverse_map()


def map_field(raw_key: str) -> Tuple[str, bool]:
    if not raw_key:
        return "", False
    k = raw_key.strip().lower()
    if k in REV_MAP:
        return REV_MAP[k], True
    return raw_key, False


def normalize_records(raw_rows: List[Dict[str, Any]], source_tag: str = "导入") -> List[ScheduleRecord]:
    records = []
    for row in raw_rows:
        rec = ScheduleRecord(source=source_tag)
        rec.source_fields = copy.deepcopy(row)
        for raw_key, raw_val in row.items():
            canonical, mapped = map_field(raw_key)
            if mapped and canonical in rec.__dataclass_fields__:
                if canonical == "quantity":
                    try:
                        setattr(rec, canonical, int(float(raw_val))) if raw_val not in (None, "") else None
                    except Exception:
                        rec.add_anomaly("字段格式", f"数量字段 [{raw_key}={raw_val}] 不是数字", "warning")
                else:
                    setattr(rec, canonical, raw_val)
                rec.add_field_mapping(raw_key, canonical)
            else:
                rec.add_field_mapping(raw_key, "未匹配→保留source_fields")
        records.append(rec)
    return records


def detect_anomalies(records: List[ScheduleRecord], params: Dict[str, Any]) -> List[ScheduleRecord]:
    today = datetime.now()
    photo_window_days = int(params.get("photo_window_days", 7))
    min_quantity = int(params.get("min_quantity", 1))

    for rec in records:
        if not rec.part_id or not rec.part_name:
            rec.add_anomaly("关键字段缺失", f"备件编号/名称不完整 (编号={rec.part_id}, 名称={rec.part_name})", "error")

        if rec.quantity < min_quantity:
            rec.add_anomaly("数量异常", f"数量 {rec.quantity} 低于阈值 {min_quantity}", "warning")

        if rec.scheduled_date:
            try:
                sd = datetime.strptime(str(rec.scheduled_date)[:10], "%Y-%m-%d")
                if sd < today - timedelta(days=1):
                    rec.add_anomaly("日期滞后", f"排程日期 {rec.scheduled_date} 早于今日", "warning")
            except Exception:
                rec.add_anomaly("日期格式", f"排程日期 [{rec.scheduled_date}] 无法解析 (需要 YYYY-MM-DD)", "error")

        if rec.photo_url and rec.photo_time:
            try:
                pt = datetime.strptime(str(rec.photo_time)[:10], "%Y-%m-%d")
                if rec.scheduled_date:
                    sd = datetime.strptime(str(rec.scheduled_date)[:10], "%Y-%m-%d")
                    diff = (sd - pt).days
                    if abs(diff) > photo_window_days:
                        rec.add_anomaly(
                            "照片时间错位",
                            f"照片时间 {rec.photo_time} 与排程日期 {rec.scheduled_date} 相差 {abs(diff)} 天，"
                            f"超过窗口 {photo_window_days} 天 → 未按正常记录走",
                            "warning",
                        )
            except Exception:
                rec.add_anomaly("照片时间格式", f"照片时间 [{rec.photo_time}] 无法解析", "warning")

        if not rec.photo_url:
            rec.add_anomaly("缺少凭证", "该备件记录未附带维修照片", "info")

    return records


def apply_status_rule(records: List[ScheduleRecord], params: Dict[str, Any]) -> List[ScheduleRecord]:
    priority = params.get("priority", "default")
    for rec in records:
        has_error = any(a.severity == "error" for a in rec.anomalies)
        if has_error:
            rec.status = "异常-待处理"
        elif rec.anomalies:
            rec.status = "待确认"
        elif priority == "urgent" and rec.category in params.get("urgent_categories", ["滚刀", "主轴承密封"]):
            rec.status = "优先排产"
        else:
            rec.status = "正常排程"
    return records


def run_schedule(raw_rows: List[Dict[str, Any]], params: Dict[str, Any],
                 version_name: str, created_by: str, note: str = "",
                 source_tag: str = "导入") -> ParamVersion:
    records = normalize_records(raw_rows, source_tag)
    records = detect_anomalies(records, params)
    records = apply_status_rule(records, params)

    total_anom = sum(len(r.anomalies) for r in records)

    v = ParamVersion(
        version_name=version_name,
        created_by=created_by,
        created_at=_now(),
        params=copy.deepcopy(params),
        note=note,
        record_count=len(records),
        anomaly_count=total_anom,
    )
    save_records(v.version_id, records)
    add_version(v)
    return v


def diff_param(p1: Dict, p2: Dict) -> List[Dict[str, Any]]:
    keys = set(p1.keys()) | set(p2.keys())
    changes = []
    for k in sorted(keys):
        v1, v2 = p1.get(k), p2.get(k)
        if v1 != v2:
            changes.append({"key": k, "old": v1, "new": v2})
    return changes


def diff_records(rs1: List[ScheduleRecord], rs2: List[ScheduleRecord],
                 param_changes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by1 = {r.part_id: r for r in rs1 if r.part_id}
    by2 = {r.part_id: r for r in rs2 if r.part_id}

    changes = []
    all_parts = set(by1.keys()) | set(by2.keys())

    for pid in sorted(all_parts):
        r1, r2 = by1.get(pid), by2.get(pid)
        if r1 and not r2:
            changes.append({
                "part_id": pid, "part_name": r1.part_name,
                "change_type": "删除", "old_status": r1.status,
                "new_status": None, "driving_param_changes": param_changes,
            })
        elif r2 and not r1:
            changes.append({
                "part_id": pid, "part_name": r2.part_name,
                "change_type": "新增", "old_status": None,
                "new_status": r2.status, "driving_param_changes": param_changes,
            })
        else:
            field_deltas = []
            for f in ["status", "scheduled_date", "quantity", "category"]:
                o, n = getattr(r1, f, None), getattr(r2, f, None)
                if o != n:
                    field_deltas.append({"field": f, "old": o, "new": n})
            anom_old = len(r1.anomalies)
            anom_new = len(r2.anomalies)
            if anom_old != anom_new:
                field_deltas.append({"field": "anomalies", "old": anom_old, "new": anom_new})
            if field_deltas:
                changes.append({
                    "part_id": pid, "part_name": r2.part_name,
                    "change_type": "变更",
                    "old_status": r1.status, "new_status": r2.status,
                    "field_deltas": field_deltas,
                    "driving_param_changes": param_changes,
                })
    return changes


def run_diff(base_version_id: str, compare_version_id: str) -> RunDiff:
    from storage import get_version, load_records
    v1 = get_version(base_version_id)
    v2 = get_version(compare_version_id)
    if not v1 or not v2:
        raise ValueError("版本不存在")

    rs1 = load_records(base_version_id)
    rs2 = load_records(compare_version_id)

    pch = diff_param(v1.params, v2.params)
    rch = diff_records(rs1, rs2, pch)

    summary = {
        "added": sum(1 for c in rch if c["change_type"] == "新增"),
        "removed": sum(1 for c in rch if c["change_type"] == "删除"),
        "modified": sum(1 for c in rch if c["change_type"] == "变更"),
        "param_changes": len(pch),
    }

    d = RunDiff(
        base_version=base_version_id,
        compare_version=compare_version_id,
        param_changes=pch,
        record_changes=rch,
        summary=summary,
    )
    add_diff(d)
    return d
