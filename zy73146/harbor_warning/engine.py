"""主引擎：串起整条处理链。

处理顺序：
  1. 幂等导入原始浮标日志
  2. 时序对齐（船上记录 + 传感器）
  3. 漂移检测与隔离
  4. 淤积异常预警判定
  5. 写回状态 / 输出结果
"""

from __future__ import annotations

import uuid
from typing import Any, Iterable, Optional

from .drift import detect_and_isolate_drifts
from .field_mapper import map_buoy_log
from .models import (
    BuoyLog,
    DataSource,
    ProcessStatus,
    WarningLevel,
    WarningRecord,
)
from .storage import HarborStorage
from .time_align import align_ship_to_sensor


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class EngineError(RuntimeError):
    CODE = "ENGINE_ERROR"

    def __init__(self, detail: str):
        super().__init__(f"[{EngineError.CODE}] {detail}")


# 低于 warning 阈值且未到 attention 区间 → normal
# 达到 attention 区间但未到 warning → attention（warning 前的软提醒）
# 达到 warning 但未到 critical → warning
# 达到 critical → critical（critical 阈值真正参与判断）
ATTENTION_FRACTION = 0.8


def classify_sediment(
    sediment_cm: float,
    sediment_warning_cm: float,
    sediment_critical_cm: float,
    attention_fraction: float = ATTENTION_FRACTION,
) -> tuple[WarningLevel, float]:
    """按可核对的阈值规则判定淤积级别。

    返回 (级别, 本次命中的阈值)：
      - critical : sediment >= critical_cm，命中阈值 = critical_cm
      - warning  : warning_cm <= sediment < critical_cm，命中阈值 = warning_cm
      - attention: attention_fraction*warning_cm <= sediment < warning_cm，命中阈值 = attention 阈值
      - normal   : 其余，命中阈值 = 0.0（不产生预警记录）
    """
    if sediment_cm >= sediment_critical_cm:
        return WarningLevel.CRITICAL, sediment_critical_cm
    if sediment_cm >= sediment_warning_cm:
        return WarningLevel.WARNING, sediment_warning_cm
    attention_threshold = sediment_warning_cm * attention_fraction
    if sediment_cm >= attention_threshold:
        return WarningLevel.ATTENTION, attention_threshold
    return WarningLevel.NORMAL, 0.0


class HarborWarningEngine:
    """对外主入口。参数名与返回字段保持稳定，供复核人日常脚本调用。"""

    def __init__(self, storage: HarborStorage):
        self.storage = storage

    # ---------- 导入 ----------
    def import_raw_records(
        self,
        raw_records: Iterable[dict[str, Any]],
    ) -> dict[str, Any]:
        """导入任意命名的原始日志，自动做字段映射与幂等去重。

        返回统计信息，字段名稳定：
          {total, mapped, map_failed, imported_new, import_skipped, map_errors}
        """
        records = list(raw_records)
        total = len(records)
        mapped_logs: list[BuoyLog] = []
        map_errors: list[dict[str, Any]] = []
        for raw in records:
            try:
                mapped_logs.append(map_buoy_log(raw))
            except Exception as exc:  # 映射异常稳定收集
                map_errors.append(
                    {
                        "raw_keys": list(raw.keys()),
                        "error": str(exc),
                    }
                )
        stats = self.storage.import_buoy_logs(mapped_logs)
        return {
            "total": total,
            "mapped": len(mapped_logs),
            "map_failed": len(map_errors),
            "imported_new": stats["new"],
            "import_skipped": stats["skipped"],
            "map_errors": map_errors,
        }

    # ---------- 处理链 ----------
    def run_pipeline(
        self,
        window_seconds: int = 3600,
        drift_threshold: float = 3.0,
        min_window: int = 5,
        sediment_warning_cm: float = 30.0,
        sediment_critical_cm: float = 60.0,
    ) -> dict[str, Any]:
        """运行完整处理链。

        参数名保持稳定：
          - window_seconds:        时序对齐窗口 (秒)
          - drift_threshold:       漂移 Z-score 阈值
          - min_window:            漂移统计窗口最小点数
          - sediment_warning_cm:   淤积厚度 WARNING 阈值 (cm)
          - sediment_critical_cm:  淤积厚度 CRITICAL 阈值 (cm)

        返回统计结果，字段名稳定。
        """
        result: dict[str, Any] = {}

        sensor_logs = self.storage.list_buoy_logs(source=DataSource.SENSOR)
        ship_logs = self.storage.list_buoy_logs(source=DataSource.SHIP_LOG)
        result["sensor_count"] = len(sensor_logs)
        result["ship_log_count"] = len(ship_logs)

        pairs, merged, unmatched = align_ship_to_sensor(
            sensor_logs, ship_logs, window_seconds=window_seconds
        )
        for p in pairs:
            self.storage.add_aligned_pair(p)
        self.storage.import_buoy_logs(merged)
        for m in merged:
            self.storage.update_buoy_log_status(m.log_id, ProcessStatus.ALIGNED)
        result["aligned_pairs"] = len(pairs)
        result["merged_logs"] = len(merged)
        result["unmatched_ship_logs"] = len(unmatched)
        result["unmatched_ids"] = [u.log_id for u in unmatched]

        candidate_logs: list[BuoyLog] = []
        for src in (DataSource.SENSOR, DataSource.SHIP_LOG, DataSource.ALIGNED):
            candidate_logs.extend(self.storage.list_buoy_logs(source=src))
        candidate_logs = [
            l for l in candidate_logs
            if l.process_status != ProcessStatus.DRIFT_ISOLATED
        ]
        marks, isolated = detect_and_isolate_drifts(
            candidate_logs,
            drift_threshold=drift_threshold,
            min_window=min_window,
        )
        isolated_ids = {l.log_id for l in isolated}
        for dm in marks:
            self.storage.add_drift_mark(dm)
        for iso in isolated:
            self.storage.update_buoy_log_status(iso.log_id, ProcessStatus.DRIFT_ISOLATED)
        result["drift_marks"] = len(marks)
        result["isolated_count"] = len(isolated_ids)
        result["isolated_ids"] = sorted(isolated_ids)

        usable: list[BuoyLog] = [
            l for l in candidate_logs
            if l.log_id not in isolated_ids
            and l.sediment_thickness is not None
        ]
        warnings_added: list[str] = []
        for log in usable:
            assert log.sediment_thickness is not None
            level, hit_threshold = classify_sediment(
                sediment_cm=log.sediment_thickness,
                sediment_warning_cm=sediment_warning_cm,
                sediment_critical_cm=sediment_critical_cm,
            )
            if level == WarningLevel.NORMAL:
                self.storage.update_buoy_log_status(log.log_id, ProcessStatus.COMPLETED)
                continue
            wr = WarningRecord(
                warning_id=_uid("warn"),
                buoy_log_id=log.log_id,
                buoy_id=log.buoy_id,
                timestamp=log.timestamp,
                warning_level=level,
                source=log.source,
                process_status=ProcessStatus.WARNING_RAISED,
                water_depth=log.water_depth,
                sediment_thickness=log.sediment_thickness,
                sediment_rate=None,
                threshold_value=hit_threshold,
                actual_value=log.sediment_thickness,
                warning_threshold=sediment_warning_cm,
                critical_threshold=sediment_critical_cm,
                description=(
                    f"淤积厚度 {log.sediment_thickness:.2f} cm 命中 {level.value} 级别"
                    f"（命中阈值={hit_threshold:.2f} cm，"
                    f"warning阈值={sediment_warning_cm:.2f} cm，"
                    f"critical阈值={sediment_critical_cm:.2f} cm），"
                    f"来源={log.source.value}"
                ),
            )
            self.storage.add_warning(wr)
            self.storage.update_buoy_log_status(log.log_id, ProcessStatus.WARNING_RAISED)
            warnings_added.append(wr.warning_id)
        result["warnings_added"] = len(warnings_added)
        result["warning_ids"] = warnings_added
        result["thresholds"] = {
            "sediment_warning_cm": sediment_warning_cm,
            "sediment_critical_cm": sediment_critical_cm,
        }
        return result

    # ---------- 人工操作（通过 engine 调用，保证状态机一致） ----------
    def revise_warning_level(
        self,
        warning_id: str,
        new_level: WarningLevel,
        reason: str,
        operator: str = "",
    ) -> tuple[bool, str]:
        if not reason:
            return False, "REVISE_REASON_REQUIRED"
        return self.storage.revise_warning_level(
            warning_id=warning_id,
            new_level=new_level,
            reason=reason,
            operator=operator,
        )

    def confirm_warning(
        self, warning_id: str, reason: str = "人工确认", operator: str = ""
    ) -> tuple[bool, str]:
        return self.storage.confirm_warning(
            warning_id=warning_id, reason=reason, operator=operator
        )

    def add_note(
        self,
        target_type: str,
        target_id: str,
        content: str,
        author: str = "",
    ) -> tuple[str, bool]:
        return self.storage.add_note(
            target_type=target_type,
            target_id=target_id,
            content=content,
            author=author,
        )

    # ---------- 导出 ----------
    def summary(self) -> dict[str, Any]:
        warnings = self.storage.list_warnings()
        drifts = self.storage.list_drift_marks()
        pairs = self.storage.list_aligned_pairs()
        all_logs = self.storage.list_buoy_logs()
        by_status: dict[str, int] = {}
        by_source: dict[str, int] = {}
        for l in all_logs:
            by_status[l.process_status.value] = by_status.get(l.process_status.value, 0) + 1
            by_source[l.source.value] = by_source.get(l.source.value, 0) + 1
        by_level: dict[str, int] = {}
        for w in warnings:
            by_level[w.warning_level.value] = by_level.get(w.warning_level.value, 0) + 1
        return {
            "buoy_logs": len(all_logs),
            "by_source": by_source,
            "by_status": by_status,
            "warnings": len(warnings),
            "warnings_by_level": by_level,
            "drift_marks": len(drifts),
            "aligned_pairs": len(pairs),
            "notes": len(self.storage.list_notes()),
            "changes": len(self.storage.list_changes()),
        }
