import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any

from .models import (
    BadDataTrace,
    DeviceId,
    HandoverRecord,
    ImportReport,
    PageSummary,
    PhotoEvidence,
    PhotoMismatchImpact,
    SchedulerResult,
)
from .normalizer import normalize_device_id


SPARE_PART_CATALOG = {
    "主母线连接排": {"code": "SP-BUS-001", "default_qty": 2},
    "断路器": {"code": "SP-BRK-003", "default_qty": 1},
    "散热风扇": {"code": "SP-FAN-007", "default_qty": 4},
    "温控开关": {"code": "SP-THR-012", "default_qty": 2},
    "绝缘垫片": {"code": "SP-INS-025", "default_qty": 10},
    "电容补偿模块": {"code": "SP-CAP-033", "default_qty": 1},
}


TEMPERATURE_RULES = [
    (80.0, "HIGH", 1),
    (65.0, "MEDIUM", 3),
    (0.0, "LOW", 7),
]


PHOTO_MISMATCH_THRESHOLD_SECONDS = 300


def _make_dedup_key(
    device_id: DeviceId,
    spare_part_code: str,
    scheduled_date: datetime,
) -> str:
    key_parts = [
        device_id.canonical,
        spare_part_code,
        scheduled_date.strftime("%Y-%m-%d"),
    ]
    raw = "|".join(key_parts).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def _resolve_priority(temperature_c: Optional[float]) -> Tuple[str, int]:
    if temperature_c is None:
        return ("MEDIUM", 3)
    for threshold, pri, days in TEMPERATURE_RULES:
        if temperature_c >= threshold:
            return (pri, days)
    return ("LOW", 7)


def _parse_handover_from_dict(raw: Dict[str, Any]) -> HandoverRecord:
    raw_id = raw.get("record_id") or f"AUTO-{uuid.uuid4().hex[:8]}"
    raw_device = str(raw.get("device_id") or "")
    normalized = normalize_device_id(raw_device)

    photos: List[PhotoEvidence] = []
    for p in raw.get("photos", []) or []:
        p_time = datetime.fromisoformat(p["photo_time"].replace("Z", "+00:00"))
        u_time = datetime.fromisoformat(p["upload_time"].replace("Z", "+00:00"))
        delta = abs((u_time - p_time).total_seconds())
        photos.append(
            PhotoEvidence(
                photo_id=p.get("photo_id", f"PH-{uuid.uuid4().hex[:6]}"),
                filename=p.get("filename", "unknown.jpg"),
                photo_time=p_time,
                upload_time=u_time,
                time_mismatch=delta > PHOTO_MISMATCH_THRESHOLD_SECONDS,
                mismatch_seconds=int(delta),
            )
        )

    return HandoverRecord(
        record_id=raw_id,
        source_device_id_raw=raw_device,
        normalized_device_id=normalized,
        shift=str(raw.get("shift", "白班")),
        recorder=str(raw.get("recorder", "未知")),
        record_time=datetime.fromisoformat(
            str(raw.get("record_time", datetime.now().isoformat())).replace("Z", "+00:00")
        ),
        on_site_trace=str(raw.get("on_site_trace", "")),
        temperature_c=raw.get("temperature_c"),
        spare_part_needed=raw.get("spare_part_needed"),
        spare_part_quantity=raw.get("spare_part_quantity"),
        photos=photos,
        raw_json=json.dumps(raw, ensure_ascii=False),
    )


class TemperatureRiseScheduler:
    def __init__(self) -> None:
        self._results: Dict[str, SchedulerResult] = {}
        self._bad_data: Dict[str, BadDataTrace] = {}
        self._handover_records: Dict[str, HandoverRecord] = {}
        self._last_import_report: Optional[ImportReport] = None
        self._previous_result_ids: set = set()

    def all_results(self) -> List[SchedulerResult]:
        return list(self._results.values())

    def all_bad_data(self) -> List[BadDataTrace]:
        return list(self._bad_data.values())

    def find_result(self, dedup_key: str) -> Optional[SchedulerResult]:
        return self._results.get(dedup_key)

    def import_handover_records(
        self,
        raw_records: List[Dict[str, Any]],
        run_label: str = "",
        today: Optional[datetime] = None,
    ) -> ImportReport:
        now = today or datetime.now()
        report = ImportReport(
            import_run_id=f"IMP-{now.strftime('%Y%m%d%H%M%S')}-{run_label or uuid.uuid4().hex[:4]}",
            start_time=now,
            end_time=None,
            records_read=0,
            records_new=0,
            records_duplicate_skipped=0,
            records_bad_data=0,
        )
        self._previous_result_ids = set(self._results.keys())

        photo_mismatch_result_ids: List[str] = []
        photo_mismatch_device_ids: List[str] = []

        try:
            for raw in raw_records:
                report.records_read += 1
                record = _parse_handover_from_dict(raw)
                self._handover_records[record.record_id] = record

                if record.normalized_device_id is None:
                    trace = BadDataTrace(
                        trace_id=f"BAD-{uuid.uuid4().hex[:10]}",
                        handover_record_id=record.record_id,
                        source_device_id_raw=record.source_device_id_raw,
                        error_type="DEVICE_ID_UNPARSEABLE",
                        error_message=(
                            f"设备编号「{record.source_device_id_raw}」无法归一。"
                            "请检查写法是否在规范字典或正则可匹配范围。"
                        ),
                        record_time=record.record_time,
                        on_site_trace_hint=record.on_site_trace or "（现场痕迹为空）",
                        raw_snippet=record.raw_json[:200],
                    )
                    self._bad_data[trace.trace_id] = trace
                    report.bad_data_trace_ids.append(trace.trace_id)
                    report.records_bad_data += 1
                    continue

                if not record.spare_part_needed:
                    trace = BadDataTrace(
                        trace_id=f"BAD-{uuid.uuid4().hex[:10]}",
                        handover_record_id=record.record_id,
                        source_device_id_raw=record.source_device_id_raw,
                        error_type="SPARE_PART_EMPTY",
                        error_message="备件需求字段为空，无法生成排程。",
                        record_time=record.record_time,
                        on_site_trace_hint=record.on_site_trace or "（现场痕迹为空）",
                        raw_snippet=record.raw_json[:200],
                    )
                    self._bad_data[trace.trace_id] = trace
                    report.bad_data_trace_ids.append(trace.trace_id)
                    report.records_bad_data += 1
                    continue

                catalog = SPARE_PART_CATALOG.get(record.spare_part_needed)
                if catalog is None:
                    trace = BadDataTrace(
                        trace_id=f"BAD-{uuid.uuid4().hex[:10]}",
                        handover_record_id=record.record_id,
                        source_device_id_raw=record.source_device_id_raw,
                        error_type="SPARE_PART_UNKNOWN",
                        error_message=(
                            f"备件名称「{record.spare_part_needed}」不在备件目录。"
                        ),
                        record_time=record.record_time,
                        on_site_trace_hint=record.on_site_trace or "（现场痕迹为空）",
                        raw_snippet=record.raw_json[:200],
                    )
                    self._bad_data[trace.trace_id] = trace
                    report.bad_data_trace_ids.append(trace.trace_id)
                    report.records_bad_data += 1
                    continue

                priority, days_ahead = _resolve_priority(record.temperature_c)
                scheduled_date = (now + timedelta(days=days_ahead)).replace(
                    hour=0, minute=0, second=0, microsecond=0
                )

                dedup_key = _make_dedup_key(
                    record.normalized_device_id,
                    catalog["code"],
                    scheduled_date,
                )

                if dedup_key in self._results:
                    existing = self._results[dedup_key]
                    if record.record_id not in existing.handover_record_ids:
                        existing.handover_record_ids.append(record.record_id)
                        existing.source_dedup_count += 1
                    report.records_duplicate_skipped += 1
                    continue

                qty = record.spare_part_quantity or catalog["default_qty"]

                has_photo_mismatch = any(p.time_mismatch for p in record.photos)
                if has_photo_mismatch:
                    pass

                result = SchedulerResult(
                    result_id=f"RES-{uuid.uuid4().hex[:12]}",
                    device_id=record.normalized_device_id,
                    scheduled_date=scheduled_date,
                    spare_part_code=catalog["code"],
                    spare_part_name=record.spare_part_needed,
                    quantity=qty,
                    priority=priority,
                    handover_record_ids=[record.record_id],
                    dedup_key=dedup_key,
                    source_dedup_count=1,
                )
                self._results[dedup_key] = result
                report.records_new += 1

                if has_photo_mismatch:
                    photo_mismatch_result_ids.append(result.result_id)
                    if result.device_id.canonical not in photo_mismatch_device_ids:
                        photo_mismatch_device_ids.append(result.device_id.canonical)

            if photo_mismatch_result_ids:
                report.photo_mismatch_impact = PhotoMismatchImpact(
                    affected_result_ids=photo_mismatch_result_ids,
                    affected_device_ids=photo_mismatch_device_ids,
                    impact_scope=(
                        f"共有 {len(photo_mismatch_result_ids)} 条排程结果（涉及"
                        f"{len(photo_mismatch_device_ids)} 台设备）关联的现场照片"
                        f"拍摄时间与上传时间差超过 {PHOTO_MISMATCH_THRESHOLD_SECONDS} 秒。"
                        "可能存在相机时钟未校准、跨时区导入、或照片重命名导致的"
                        "时间归属错误，影响温升趋势判断的优先级依据。"
                    ),
                    wrap_up_action=(
                        "收尾步骤：1) 逐条对照班组交接记录核对拍摄人员口述时间；"
                        "2) 将明显错位的照片时间人工校正后重新导入（重复导入会自动"
                        "去重，不会生成额外排程）；3) 在页面摘要的人工备注中标记"
                        "「照片时间已人工校准」。如无法核实，降级该条排程优先级"
                        "至 LOW，避免误判高优先级更换。"
                    ),
                )

            report.end_time = datetime.now()
            self._last_import_report = report
            return report

        except Exception as exc:
            report.end_time = datetime.now()
            report.failure_code = "FATAL"
            report.failure_reason = (
                f"导入过程中抛出未捕获异常: {type(exc).__name__}: {str(exc)}"
            )
            self._last_import_report = report
            return report

    def update_manual_remark(
        self, dedup_key: str, remark: str, operator: str = "值班员"
    ) -> Tuple[bool, str]:
        if dedup_key not in self._results:
            return False, "排程记录不存在。"

        result = self._results[dedup_key]
        if result.manual_remark and not result.is_manual_remark_protected:
            result.is_manual_remark_protected = True

        if result.is_manual_remark_protected and result.manual_remark:
            if self._last_import_report is not None:
                self._last_import_report.overwritten_remark_rejected += 1
            return (
                False,
                (
                    f"该排程（{result.result_id}）已存在人工备注且被保护，"
                    "本次导入/修改未覆盖。若确需修改，请先解除保护或追加备注。"
                ),
            )

        result.manual_remark = f"[{operator}@{datetime.now().strftime('%Y-%m-%d %H:%M')}] {remark}"
        result.is_manual_remark_protected = True
        if self._last_import_report is not None:
            self._last_import_report.preserved_manual_remarks += 1
        return True, "人工备注已写入并设为保护，后续重复导入不会覆盖。"

    def build_page_summary(self, tonight: Optional[datetime] = None) -> PageSummary:
        tonight = tonight or datetime.now().replace(
            hour=23, minute=59, second=59, microsecond=0
        )
        tonight_start = tonight.replace(hour=0, minute=0, second=0, microsecond=0)

        total = len(self._results)
        pending = sum(
            1
            for r in self._results.values()
            if tonight_start <= r.scheduled_date <= tonight
        )
        high = sum(1 for r in self._results.values() if r.priority == "HIGH")
        medium = sum(1 for r in self._results.values() if r.priority == "MEDIUM")
        low = sum(1 for r in self._results.values() if r.priority == "LOW")

        changed_keys = set(self._results.keys()) - self._previous_result_ids
        changed_results = [self._results[k].result_id for k in changed_keys]

        boundary: List[str] = []
        for k in changed_keys:
            r = self._results[k]
            if r.priority == "HIGH" or r.quantity >= 10 or r.source_dedup_count >= 3:
                boundary.append(r.result_id)

        change_desc_parts = []
        if changed_results:
            change_desc_parts.append(
                f"本次新增/变更排程 {len(changed_results)} 条，"
                f"其中 HIGH 优先级 {sum(1 for k in changed_keys if self._results[k].priority == 'HIGH')} 条。"
            )
        if boundary:
            change_desc_parts.append(
                f"已识别边界样本 {len(boundary)} 条（优先级/数量/合并次数触发阈值），"
                "请值班长重点复核。"
            )
        if self._last_import_report and self._last_import_report.photo_mismatch_impact:
            change_desc_parts.append(
                "检测到照片时间错位，请按摘要中收尾建议处理。"
            )
        if not change_desc_parts:
            change_desc_parts.append("本次运行无新增变更，排程与上次一致。")

        return PageSummary(
            as_of_time=datetime.now(),
            total_results=total,
            pending_tonight=pending,
            priority_high_count=high,
            priority_medium_count=medium,
            priority_low_count=low,
            last_import_report=self._last_import_report,
            active_bad_data_count=len(self._bad_data),
            changed_since_last_run=changed_results,
            change_description="".join(change_desc_parts),
            boundary_samples_added=boundary,
        )

    @staticmethod
    def _photo_mismatch_impact_from_dict(
        d: Optional[Dict[str, Any]]
    ) -> Optional[PhotoMismatchImpact]:
        if not d:
            return None
        return PhotoMismatchImpact(
            affected_result_ids=list(d.get("affected_result_ids", [])),
            affected_device_ids=list(d.get("affected_device_ids", [])),
            impact_scope=str(d.get("impact_scope", "")),
            wrap_up_action=str(d.get("wrap_up_action", "")),
        )

    @staticmethod
    def import_report_from_dict(d: Dict[str, Any]) -> ImportReport:
        start = datetime.fromisoformat(d["start_time"])
        end = None
        if d.get("end_time"):
            end = datetime.fromisoformat(d["end_time"])
        return ImportReport(
            import_run_id=d.get("import_run_id", ""),
            start_time=start,
            end_time=end,
            records_read=int(d.get("records_read", 0)),
            records_new=int(d.get("records_new", 0)),
            records_duplicate_skipped=int(d.get("records_duplicate_skipped", 0)),
            records_bad_data=int(d.get("records_bad_data", 0)),
            bad_data_trace_ids=list(d.get("bad_data_trace_ids", [])),
            preserved_manual_remarks=int(d.get("preserved_manual_remarks", 0)),
            overwritten_remark_rejected=int(d.get("overwritten_remark_rejected", 0)),
            photo_mismatch_impact=TemperatureRiseScheduler._photo_mismatch_impact_from_dict(
                d.get("photo_mismatch_impact")
            ),
            failure_code=d.get("failure_code", "OK"),
            failure_reason=d.get("failure_reason", ""),
        )

    def dump_persist_extra(self) -> Dict[str, Any]:
        return {
            "last_import_report": (
                self._last_import_report.to_dict()
                if self._last_import_report
                else None
            ),
            "previous_result_ids": sorted(self._previous_result_ids),
        }

    def load_persist_extra(self, data: Dict[str, Any]) -> None:
        report_raw = data.get("last_import_report")
        if report_raw:
            try:
                self._last_import_report = (
                    TemperatureRiseScheduler.import_report_from_dict(report_raw)
                )
            except Exception:
                self._last_import_report = None
        else:
            self._last_import_report = None

        prev = data.get("previous_result_ids", [])
        if isinstance(prev, list):
            self._previous_result_ids = set(prev)
        else:
            self._previous_result_ids = set()
