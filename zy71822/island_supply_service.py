import csv
import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple, Set
from dataclasses import asdict

from database import Database
from models import (
    DropConfig,
    LeaderboardRecord,
    VersionHistory,
    ImportBatch,
    TraceableResult,
    ReviewStatus,
    AnomalyType,
    SourceType,
)


class VersionDiff:
    def __init__(self, old_record: LeaderboardRecord, new_record: LeaderboardRecord):
        self.old_record = old_record
        self.new_record = new_record
        self.changed_fields: List[str] = []
        self.old_values: Dict[str, Any] = {}
        self.new_values: Dict[str, Any] = {}
        self.summary: str = ""
        self._compare()

    def _compare(self):
        fields_to_check = ["player_name", "score", "rank", "stage_progress"]
        for field in fields_to_check:
            old_val = getattr(self.old_record, field)
            new_val = getattr(self.new_record, field)
            if old_val != new_val:
                self.changed_fields.append(field)
                self.old_values[field] = old_val
                self.new_values[field] = new_val

        if self.changed_fields:
            changes = []
            for f in self.changed_fields:
                changes.append(f"{f}: {self.old_values[f]} → {self.new_values[f]}")
            self.summary = "; ".join(changes)

    @property
    def has_changes(self) -> bool:
        return len(self.changed_fields) > 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.old_record.id,
            "player_id": self.old_record.player_id,
            "player_name": self.old_record.player_name,
            "changed_fields": self.changed_fields,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "summary": self.summary,
        }


class ImportResult:
    def __init__(self, batch: ImportBatch):
        self.batch = batch
        self.new_records: List[LeaderboardRecord] = []
        self.updated_records: List[LeaderboardRecord] = []
        self.version_diffs: List[VersionDiff] = []
        self.skipped_records: List[Tuple[LeaderboardRecord, str]] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch.batch_id,
            "source_file": self.batch.source_file,
            "new_count": len(self.new_records),
            "updated_count": len(self.updated_records),
            "diff_count": len(self.version_diffs),
            "skipped_count": len(self.skipped_records),
            "version_diffs": [d.to_dict() for d in self.version_diffs],
            "skipped": [(r.player_id, reason) for r, reason in self.skipped_records],
        }


class IslandSupplyService:
    def __init__(self, db_path: str = "island_supply.db"):
        self.db = Database(db_path)

    def import_drop_configs(
        self, csv_path: str, operator: str = ""
    ) -> List[DropConfig]:
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"掉落配置文件不存在: {csv_path}")

        configs = []
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                config = DropConfig(
                    stage=row.get("stage", "").strip(),
                    item_name=row.get("item_name", "").strip(),
                    drop_rate=float(row.get("drop_rate", 0)),
                    source_file=os.path.basename(csv_path),
                    version=int(row.get("version", 1)),
                    note=row.get("note", "").strip(),
                )
                if config.stage and config.item_name:
                    configs.append(self.db.insert_drop_config(config))

        return configs

    def import_leaderboard(
        self,
        csv_path: str,
        source_type: SourceType = SourceType.SCREENSHOT,
        source_ref: str = "",
        operator: str = "",
        auto_detect_anomaly: bool = True,
    ) -> ImportResult:
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"排行榜文件不存在: {csv_path}")

        records_to_import: List[LeaderboardRecord] = []
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    record = LeaderboardRecord(
                        player_id=row.get("player_id", "").strip(),
                        player_name=row.get("player_name", "").strip(),
                        score=int(float(row.get("score", 0) or 0)),
                        rank=int(row.get("rank", 0) or 0),
                        stage_progress=int(row.get("stage_progress", 0) or 0),
                        source_type=source_type,
                        source_file=os.path.basename(csv_path),
                        source_ref=source_ref or f"行{row_num}",
                        version=1,
                    )

                    if auto_detect_anomaly:
                        self._auto_detect_anomaly_single(record, row)

                    if record.player_id and record.player_name:
                        records_to_import.append(record)
                except (ValueError, KeyError) as e:
                    print(f"跳过第{row_num}行: {e}")

        batch = self.db.create_import_batch(
            source_file=os.path.basename(csv_path),
            record_type="leaderboard",
            record_count=len(records_to_import),
            operator=operator,
        )

        result = ImportResult(batch)

        for record in records_to_import:
            record.import_batch_id = batch.batch_id
            existing = self._find_existing_record(record.player_id)

            if existing is None:
                saved = self.db.insert_leaderboard_record(record)
                result.new_records.append(saved)
            else:
                diff = VersionDiff(existing, record)

                if not diff.has_changes:
                    result.skipped_records.append((record, "数据无变化"))
                    continue

                if self._is_older_version(existing, record):
                    self._record_version_history(existing, record, diff, batch.batch_id, operator)

                    old_score = existing.score
                    existing.player_name = record.player_name
                    existing.score = record.score
                    existing.rank = record.rank
                    existing.stage_progress = record.stage_progress
                    existing.source_file = record.source_file
                    existing.source_ref = record.source_ref
                    existing.source_type = record.source_type
                    existing.import_batch_id = batch.batch_id
                    existing.anomaly_type = AnomalyType.DISCONNECT_PROGRESS_CORRUPT
                    existing.review_status = ReviewStatus.PENDING_CONFIRM
                    existing.anomaly_note = (
                        f"疑似断线后进度错乱: 分数从{old_score}降至{record.score}，请核对截图"
                    )
                    existing.version += 1

                    saved = self.db.update_leaderboard_record(existing)
                    result.updated_records.append(saved)
                    result.version_diffs.append(diff)
                    continue

                self._record_version_history(existing, record, diff, batch.batch_id, operator)

                existing.player_name = record.player_name
                existing.score = record.score
                existing.rank = record.rank
                existing.stage_progress = record.stage_progress
                existing.source_file = record.source_file
                existing.source_ref = record.source_ref
                existing.source_type = record.source_type
                existing.import_batch_id = batch.batch_id
                existing.version += 1

                saved = self.db.update_leaderboard_record(existing)
                result.updated_records.append(saved)
                result.version_diffs.append(diff)

        return result

    def _auto_detect_anomaly_single(
        self, record: LeaderboardRecord, row: Dict[str, str]
    ):
        anomaly_hint = row.get("anomaly", "").strip().lower()
        note = row.get("note", "").strip()

        if "断线" in anomaly_hint or "disconnect" in anomaly_hint or "progress" in anomaly_hint:
            record.anomaly_type = AnomalyType.DISCONNECT_PROGRESS_CORRUPT
            record.review_status = ReviewStatus.PENDING_CONFIRM
            record.anomaly_note = note or "疑似断线后进度错乱，待确认"
        elif "刷分" in anomaly_hint or "重开" in anomaly_hint or "restart" in anomaly_hint:
            record.anomaly_type = AnomalyType.RESTART_BRUSH_SCORE
            record.review_status = ReviewStatus.PENDING_CONFIRM
            record.anomaly_note = note or "疑似重开刷分，待确认"
        elif "漏发" in anomaly_hint or "miss" in anomaly_hint or "reward" in anomaly_hint:
            record.anomaly_type = AnomalyType.REWARD_MISSED
            record.review_status = ReviewStatus.PENDING_CONFIRM
            record.anomaly_note = note or "疑似奖励漏发，待确认"
        elif anomaly_hint or (note and ("待确认" in note or "异常" in note)):
            record.review_status = ReviewStatus.PENDING_CONFIRM
            record.anomaly_note = note or anomaly_hint

    def _find_existing_record(self, player_id: str) -> Optional[LeaderboardRecord]:
        records = self.db.find_leaderboard_by_player(player_id)
        for r in records:
            if r.review_status != ReviewStatus.REJECTED:
                return r
        return None

    def _is_older_version(
        self, existing: LeaderboardRecord, new_record: LeaderboardRecord
    ) -> bool:
        if existing.score > new_record.score:
            return True
        if existing.score == new_record.score and existing.stage_progress >= new_record.stage_progress:
            return True
        return False

    def _record_version_history(
        self,
        old_record: LeaderboardRecord,
        new_record: LeaderboardRecord,
        diff: VersionDiff,
        batch_id: str,
        operator: str,
    ):
        history = VersionHistory(
            batch_id=batch_id,
            record_type="leaderboard",
            record_id=old_record.id,
            old_version=old_record.version,
            new_version=old_record.version + 1,
            change_summary=diff.summary,
            changed_fields=diff.changed_fields,
            old_values=diff.old_values,
            new_values=diff.new_values,
            operator=operator,
        )
        self.db.insert_version_history(history)

    def mark_anomaly(
        self,
        record_id: int,
        anomaly_type: AnomalyType,
        note: str,
        operator: str = "",
    ) -> Optional[LeaderboardRecord]:
        record = self.db.get_leaderboard_record(record_id)
        if not record:
            return None

        old_status = record.review_status
        old_anomaly = record.anomaly_type

        record.anomaly_type = anomaly_type
        record.review_status = ReviewStatus.PENDING_CONFIRM
        record.anomaly_note = note

        history = VersionHistory(
            batch_id=f"MANUAL-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            record_type="leaderboard",
            record_id=record_id,
            old_version=record.version,
            new_version=record.version + 1,
            change_summary=f"标记异常: {old_anomaly.value} → {anomaly_type.value}, 状态: {old_status.value} → pending_confirm",
            changed_fields=["anomaly_type", "review_status", "anomaly_note"],
            old_values={
                "anomaly_type": old_anomaly.value,
                "review_status": old_status.value,
                "anomaly_note": record.anomaly_note,
            },
            new_values={
                "anomaly_type": anomaly_type.value,
                "review_status": ReviewStatus.PENDING_CONFIRM.value,
                "anomaly_note": note,
            },
            operator=operator,
        )
        self.db.insert_version_history(history)

        record.version += 1
        return self.db.update_leaderboard_record(record)

    def confirm_record(
        self, record_id: int, is_normal: bool, note: str = "", operator: str = ""
    ) -> Optional[LeaderboardRecord]:
        record = self.db.get_leaderboard_record(record_id)
        if not record:
            return None

        old_status = record.review_status

        if is_normal:
            record.review_status = ReviewStatus.NORMAL
            if not note:
                record.anomaly_note = ""
        else:
            record.review_status = ReviewStatus.REJECTED
            record.anomaly_note = note or "审核不通过"

        history = VersionHistory(
            batch_id=f"REVIEW-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            record_type="leaderboard",
            record_id=record_id,
            old_version=record.version,
            new_version=record.version + 1,
            change_summary=f"审核状态变更: {old_status.value} → {record.review_status.value}",
            changed_fields=["review_status", "anomaly_note"],
            old_values={
                "review_status": old_status.value,
                "anomaly_note": record.anomaly_note,
            },
            new_values={
                "review_status": record.review_status.value,
                "anomaly_note": record.anomaly_note,
            },
            operator=operator,
        )
        self.db.insert_version_history(history)

        record.version += 1
        return self.db.update_leaderboard_record(record)

    def revoke_batch(
        self, batch_id: str, reason: str, operator: str = ""
    ) -> bool:
        return self.db.revoke_import_batch(batch_id, reason, operator)

    def get_version_diff_warnings(
        self, batch_id: str
    ) -> List[Dict[str, Any]]:
        records = self.db.find_leaderboard_by_batch(batch_id)
        warnings = []

        for record in records:
            history = self.db.get_version_history("leaderboard", record.id)
            for h in history:
                if h.batch_id == batch_id and h.old_version > 0:
                    warnings.append(
                        {
                            "record_id": record.id,
                            "player_id": record.player_id,
                            "player_name": record.player_name,
                            "warning": "已覆盖旧版本数据",
                            "old_version": h.old_version,
                            "new_version": h.new_version,
                            "changes": h.change_summary,
                            "old_values": h.old_values,
                            "new_values": h.new_values,
                        }
                    )

        return warnings

    def detect_disconnect_corruption(
        self, score_deviation_threshold: int = 5000
    ) -> List[LeaderboardRecord]:
        all_records = self.db.query_leaderboard(include_revoked=False)
        suspicious: List[LeaderboardRecord] = []

        for record in all_records:
            if record.review_status == ReviewStatus.REJECTED:
                continue

            history = self.db.get_version_history("leaderboard", record.id)
            if len(history) < 2:
                continue

            for h in history:
                old_score = h.old_values.get("score", 0)
                new_score = h.new_values.get("score", 0)
                if isinstance(old_score, str):
                    old_score = int(old_score)
                if isinstance(new_score, str):
                    new_score = int(new_score)

                if old_score > 0 and new_score < old_score - score_deviation_threshold:
                    if record.review_status == ReviewStatus.NORMAL:
                        suspicious.append(record)
                    break

        return suspicious

    def detect_restart_brush_score(
        self, rank_jump_threshold: int = 20
    ) -> List[LeaderboardRecord]:
        all_records = self.db.query_leaderboard(include_revoked=False)
        suspicious: List[LeaderboardRecord] = []

        for record in all_records:
            if record.review_status == ReviewStatus.REJECTED:
                continue

            history = self.db.get_version_history("leaderboard", record.id)
            if len(history) < 2:
                continue

            for h in history:
                old_rank = h.old_values.get("rank", 999)
                new_rank = h.new_values.get("rank", 999)
                if isinstance(old_rank, str):
                    old_rank = int(old_rank)
                if isinstance(new_rank, str):
                    new_rank = int(new_rank)

                if old_rank > 0 and new_rank > 0:
                    if new_rank < old_rank - rank_jump_threshold:
                        if record.review_status == ReviewStatus.NORMAL:
                            suspicious.append(record)
                        break

        return suspicious

    def export_with_trace(
        self,
        output_path: str,
        review_status: ReviewStatus = None,
        anomaly_type: AnomalyType = None,
        min_score: int = None,
        include_pending: bool = False,
        include_trace: bool = True,
    ) -> List[TraceableResult]:
        drop_configs = self.db.get_drop_configs(active_only=True)
        drop_by_stage: Dict[str, List[DropConfig]] = {}
        for dc in drop_configs:
            if dc.stage not in drop_by_stage:
                drop_by_stage[dc.stage] = []
            drop_by_stage[dc.stage].append(dc)

        query_status = review_status
        if query_status is None and not include_pending:
            query_status = ReviewStatus.NORMAL

        records = self.db.query_leaderboard(
            review_status=query_status,
            anomaly_type=anomaly_type,
            min_score=min_score,
            include_revoked=False,
        )

        results: List[TraceableResult] = []
        for record in records:
            related_drops = drop_by_stage.get(str(record.stage_progress), [])
            result = TraceableResult(record, related_drops)

            if include_trace:
                result.evidence_paths.append(record.source_file)
                if record.source_ref:
                    result.evidence_paths.append(f"引用位置: {record.source_ref}")

                history = self.db.get_version_history("leaderboard", record.id)
                result.version_history = history

            results.append(result)

        self._write_export(output_path, results, include_trace)

        return results

    def _write_export(
        self,
        output_path: str,
        results: List[TraceableResult],
        include_trace: bool,
    ):
        base, ext = os.path.splitext(output_path)

        summary_csv = f"{base}_summary.csv"
        with open(summary_csv, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "排名",
                    "玩家ID",
                    "玩家名称",
                    "分数",
                    "关卡进度",
                    "审核状态",
                    "异常类型",
                    "异常说明",
                    "数据版本",
                    "来源文件",
                    "来源引用",
                    "记录ID",
                ]
            )

            current_rank = 0
            for i, result in enumerate(results):
                if result.record.review_status == ReviewStatus.NORMAL:
                    current_rank += 1
                    display_rank = current_rank
                else:
                    display_rank = f"待确认({i + 1})"

                writer.writerow(
                    [
                        display_rank,
                        result.record.player_id,
                        result.record.player_name,
                        result.record.score,
                        result.record.stage_progress,
                        result.record.review_status.value,
                        result.record.anomaly_type.value,
                        result.record.anomaly_note,
                        result.record.version,
                        result.record.source_file,
                        result.record.source_ref,
                        result.record.id,
                    ]
                )

        if include_trace:
            detail_json = f"{base}_detail.json"
            export_data = {
                "export_time": datetime.now().isoformat(),
                "filter_criteria": {
                    "include_pending": True,
                },
                "total_normal": sum(
                    1
                    for r in results
                    if r.record.review_status == ReviewStatus.NORMAL
                ),
                "total_pending": sum(
                    1
                    for r in results
                    if r.record.review_status == ReviewStatus.PENDING_CONFIRM
                ),
                "records": [r.to_dict() for r in results],
            }

            with open(detail_json, "w", encoding="utf-8") as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2)

        warnings_path = f"{base}_warnings.txt"
        with open(warnings_path, "w", encoding="utf-8") as f:
            pending_count = sum(
                1
                for r in results
                if r.record.review_status == ReviewStatus.PENDING_CONFIRM
            )
            if pending_count > 0:
                f.write(f"⚠️  共有 {pending_count} 条记录处于待确认状态，请先审核！\n\n")

                for r in results:
                    if r.record.review_status == ReviewStatus.PENDING_CONFIRM:
                        f.write(
                            f"  - [{r.record.anomaly_type.value}] {r.record.player_name} (ID: {r.record.player_id}): {r.record.anomaly_note}\n"
                        )

    def get_record_trace(self, record_id: int) -> Optional[Dict[str, Any]]:
        record = self.db.get_leaderboard_record(record_id)
        if not record:
            return None

        history = self.db.get_version_history("leaderboard", record_id)
        batch = self.db.get_import_batch(record.import_batch_id)
        drop_configs = self.db.get_drop_configs(
            stage=str(record.stage_progress), active_only=True
        )

        return {
            "record": record.to_dict(),
            "version_history": [h.to_dict() for h in history],
            "import_batch": batch.to_dict() if batch else None,
            "related_drop_configs": [dc.to_dict() for dc in drop_configs],
            "evidence": {
                "source_file": record.source_file,
                "source_ref": record.source_ref,
                "source_type": record.source_type.value,
            },
        }

    def list_batches(self) -> List[Dict[str, Any]]:
        batches = self.db.list_import_batches()
        result = []
        for batch in batches:
            records = self.db.find_leaderboard_by_batch(batch.batch_id)
            diff_warnings = self.get_version_diff_warnings(batch.batch_id)
            result.append(
                {
                    "batch": batch.to_dict(),
                    "record_count": len(records),
                    "has_warnings": len(diff_warnings) > 0,
                    "warnings": diff_warnings,
                }
            )
        return result
