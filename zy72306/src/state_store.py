from __future__ import annotations

import json
import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

from .data_models import (
    AnomalyResult,
    UnifiedDataExporter,
    SummaryStats,
    AuditRecord,
    AnomalyType,
    ProcessStatus,
    BoundaryRuleType,
    ManualModification,
    ReviewRecord,
)


class StateSnapshot(BaseModel):
    version: int
    created_at: str
    created_by: str
    description: str
    checksum: str
    result_count: int


class StateMetadata(BaseModel):
    current_version: int = Field(default=0)
    snapshots: List[StateSnapshot] = Field(default_factory=list)
    created_at: str = ""
    last_modified_at: str = ""
    last_modified_by: str = ""
    import_sources: List[str] = Field(default_factory=list)
    pipeline_step: int = Field(default=0)


class StateStore:
    RESULTS_FILENAME = "state_store.json"
    STATE_DIR = ".state"
    RESULTS_KEY = "results"
    AUDIT_KEY = "audit_trail"
    META_KEY = "metadata"

    def __init__(self, workdir: str = "./output"):
        self.workdir = Path(workdir).resolve()
        self.state_dir = self.workdir / self.STATE_DIR
        self.state_file = self.state_dir / self.RESULTS_FILENAME
        self._state: Dict[str, Any] = {}
        self._load()

    # ------------------------------------------------------------------
    # 初始化与持久化
    # ------------------------------------------------------------------
    def _load(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        if self.state_file.exists():
            with open(self.state_file, "r", encoding="utf-8") as f:
                self._state = json.load(f)
        else:
            now = datetime.now().isoformat()
            self._state = {
                self.RESULTS_KEY: {},
                self.AUDIT_KEY: [],
                self.META_KEY: StateMetadata(created_at=now, last_modified_at=now).model_dump()
            }
            self._save()

    def _save(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self._state[self.META_KEY]["last_modified_at"] = datetime.now().isoformat()
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(self._state, f, ensure_ascii=False, indent=2)

    def _invalidate_results(self) -> None:
        """触发快照和备份"""
        pass

    # ------------------------------------------------------------------
    # 结果读写：读写都通过同一个 store，保证列表/详情/摘要/导出 读同一份
    # ------------------------------------------------------------------
    def _checksum_results(self, results_dict: Dict[str, Any]) -> str:
        payload = json.dumps(results_dict, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

    def upsert_results(
        self,
        results: List[AnomalyResult],
        actor: str,
        description: str = "upsert results",
    ) -> None:
        """写入/更新结果，自动做快照版本号+1，保存到磁盘"""
        result_map: Dict[int, AnomalyResult] = {}

        # 1) 合并已存在的 + 新的（按 row_number 作为主键）
        for row_str, raw in self._state.get(self.RESULTS_KEY, {}).items():
            try:
                existing = AnomalyResult.model_validate(raw)
                result_map[existing.row_number] = existing
            except Exception:
                continue

        for new_r in results:
            if new_r.row_number in result_map:
                old = result_map[new_r.row_number]
                # 保留已经积累的人工修改/复核记录
                new_r.manual_modifications = (
                    list(old.manual_modifications) + list(new_r.manual_modifications)
                )
                new_r.review_records = list(old.review_records) + list(new_r.review_records)
                new_r.snapshot_version = old.snapshot_version + 1
            else:
                new_r.snapshot_version = 1
            new_r.updated_at = datetime.now()
            result_map[new_r.row_number] = new_r

        # 2) 转成 dict 存回
        serializable: Dict[str, Any] = {}
        for rn, obj in result_map.items():
            serializable[str(rn)] = obj.to_dict()

        self._state[self.RESULTS_KEY] = serializable

        # 3) 版本与元信息
        meta = StateMetadata.model_validate(self._state[self.META_KEY])
        meta.current_version += 1
        meta.last_modified_by = actor
        checksum = self._checksum_results(serializable)
        snap = StateSnapshot(
            version=meta.current_version,
            created_at=datetime.now().isoformat(),
            created_by=actor,
            description=description,
            checksum=checksum,
            result_count=len(serializable),
        )
        meta.snapshots.append(snap)
        self._state[self.META_KEY] = meta.model_dump()

        # 4) 落盘
        self._save()

    def get_results(self) -> List[AnomalyResult]:
        """所有视图统一的入口：列表、详情、摘要、导出 都从这里拿"""
        out: List[AnomalyResult] = []
        for _, raw in self._state.get(self.RESULTS_KEY, {}).items():
            try:
                out.append(AnomalyResult.model_validate(raw))
            except Exception:
                continue
        out.sort(key=lambda r: r.row_number)
        return out

    def get_result(self, row_number: int) -> Optional[AnomalyResult]:
        raw = self._state.get(self.RESULTS_KEY, {}).get(str(row_number))
        if raw is None:
            return None
        try:
            return AnomalyResult.model_validate(raw)
        except Exception:
            return None

    def get_exporter(self) -> UnifiedDataExporter:
        """统一导出器：明细、页面展示、API 返回都读这份"""
        return UnifiedDataExporter(self.get_results())

    def get_summary(self) -> SummaryStats:
        return self.get_exporter().compute_summary()

    # ------------------------------------------------------------------
    # 单条更新：修改/复核/回滚 都走这一条路径，保证一致性
    # ------------------------------------------------------------------
    def update_single(
        self,
        row_number: int,
        actor: str,
        description: str,
        mutator,
    ) -> Optional[AnomalyResult]:
        """
        mutator(r: AnomalyResult) -> None：原地修改

        返回更新后的记录。列表/详情/摘要/导出 下一次读时会反映这个变化。
        """
        current = self.get_result(row_number)
        if current is None:
            return None

        # 原地修改
        mutator(current)
        # 写回 store
        self.upsert_results([current], actor=actor, description=description)
        return self.get_result(row_number)

    def apply_manual_modification(
        self,
        row_number: int,
        actor: str,
        field_name: str,
        new_value: Any,
        reason: str,
    ) -> Optional[AnomalyResult]:
        """人工修改：保留原值、人、时间、原因，并写人工修改记录+审计"""

        def mutate(r: AnomalyResult) -> None:
            old_value = getattr(r, field_name, None)
            # 特殊字段要同步重算
            if field_name == "denominator":
                try:
                    num_den = float(new_value) if new_value not in (None, "") else None
                except (ValueError, TypeError):
                    num_den = None
                r.denominator = num_den
                if num_den is None or abs(num_den) < 1e-10:
                    r.ratio = None
                else:
                    r.ratio = r.numerator / num_den
            elif field_name == "numerator":
                try:
                    r.numerator = float(new_value)
                except (ValueError, TypeError):
                    pass
                if r.denominator is not None and abs(r.denominator) > 1e-10:
                    r.ratio = r.numerator / r.denominator
            elif field_name == "anomaly_type":
                r.anomaly_type = AnomalyType(new_value)
            elif field_name == "process_status":
                r.process_status = ProcessStatus(new_value)
            elif field_name == "teacher_comment":
                r.teacher_comment = new_value
            elif field_name == "review_note":
                r.review_note = new_value

            r.manual_modifications.append(
                ManualModification(
                    modified_by=actor,
                    field_name=field_name,
                    old_value=str(old_value),
                    new_value=str(new_value),
                    reason=reason,
                )
            )
            r.process_status = ProcessStatus.MANUAL_UPDATED

        desc = f"manual_modify row={row_number} field={field_name}"
        result = self.update_single(row_number, actor=actor, description=desc, mutator=mutate)

        self.append_audit(
            AuditRecord(
                row_number=row_number,
                action="manual_modification",
                old_status=result.process_status if result else None,
                new_status=ProcessStatus.MANUAL_UPDATED,
                actor=actor,
                details={"field": field_name, "reason": reason},
                comment=reason,
            )
        )
        return result

    def apply_review(
        self,
        row_number: int,
        review: ReviewRecord,
    ) -> Optional[AnomalyResult]:
        """人工复核：记录原始说法、改后值、处理原因、下一步找谁。
        分母为 0 填空字符串：不提前归 normal。
        """

        def mutate(r: AnomalyResult) -> None:
            r.review_records.append(review)
            r.review_note = review.review_note or r.review_note
            r.anomaly_type = review.anomaly_type_after_review
            r.process_status = ProcessStatus.REVIEWED

        desc = f"review row={row_number} by={review.reviewed_by}"
        result = self.update_single(row_number, actor=review.reviewed_by, description=desc, mutator=mutate)

        self.append_audit(
            AuditRecord(
                row_number=row_number,
                action="review_complete",
                old_status=result.process_status if result else None,
                new_status=ProcessStatus.REVIEWED,
                actor=review.reviewed_by,
                details={
                    "original_statement": review.original_statement,
                    "next_owner": review.next_owner,
                },
                comment=review.review_reason,
            )
        )
        return result

    def apply_finalize(
        self,
        row_number: int,
        actor: str,
    ) -> Optional[AnomalyResult]:

        # 如果还是 pending_verification / pending_review → 不允许 finalize，留给复核人
        current = self.get_result(row_number)
        if current is None:
            return None
        if current.anomaly_type == AnomalyType.PENDING_VERIFICATION:
            # 必须先复核，不能直接 finalized
            raise ValueError(
                f"行号 {row_number} 处于 pending_verification（分母为0空字符串），需先走人工复核后才能最终确认"
            )

        def mutate(r: AnomalyResult) -> None:
            r.process_status = ProcessStatus.FINALIZED

        result = self.update_single(
            row_number, actor=actor, description=f"finalize row={row_number}", mutator=mutate
        )
        self.append_audit(
            AuditRecord(
                row_number=row_number,
                action="finalize",
                old_status=ProcessStatus.REVIEWED,
                new_status=ProcessStatus.FINALIZED,
                actor=actor,
                comment="课堂演示结果更新，最终确认",
            )
        )
        return result

    def apply_rollback(
        self,
        row_number: int,
        actor: str,
        reason: str,
    ) -> Optional[AnomalyResult]:
        def mutate(r: AnomalyResult) -> None:
            r.process_status = ProcessStatus.ROLLBACKED

        result = self.update_single(
            row_number, actor=actor, description=f"rollback row={row_number}", mutator=mutate
        )
        self.append_audit(
            AuditRecord(
                row_number=row_number,
                action="rollback",
                old_status=result.process_status if result else None,
                new_status=ProcessStatus.ROLLBACKED,
                actor=actor,
                comment=reason,
            )
        )
        return result

    # ------------------------------------------------------------------
    # 审计记录
    # ------------------------------------------------------------------
    def append_audit(self, record: AuditRecord) -> None:
        self._state.setdefault(self.AUDIT_KEY, []).append(record.to_dict())
        self._save()

    def get_audit_trail(self, row_number: Optional[int] = None) -> List[AuditRecord]:
        data = self._state.get(self.AUDIT_KEY, [])
        records = [AuditRecord.model_validate(d) for d in data]
        if row_number is not None:
            return [r for r in records if r.row_number == row_number]
        return records

    # ------------------------------------------------------------------
    # 元数据/快照
    # ------------------------------------------------------------------
    @property
    def metadata(self) -> StateMetadata:
        return StateMetadata.model_validate(self._state.get(self.META_KEY, {}))

    def set_pipeline_step(self, step: int, actor: str = "system") -> None:
        meta = StateMetadata.model_validate(self._state[self.META_KEY])
        meta.pipeline_step = step
        meta.last_modified_by = actor
        self._state[self.META_KEY] = meta.model_dump()
        self._save()

    def add_import_source(self, source: str, actor: str = "system") -> None:
        meta = StateMetadata.model_validate(self._state[self.META_KEY])
        if source not in meta.import_sources:
            meta.import_sources.append(source)
        meta.last_modified_by = actor
        self._state[self.META_KEY] = meta.model_dump()
        self._save()

    # ------------------------------------------------------------------
    # 一致性检查
    # ------------------------------------------------------------------
    def consistency_check(self, row_number: Optional[int] = None) -> Dict[str, Any]:
        """检查：列表 / 详情 / 摘要 / 导出 四份视图 的一致性"""
        exporter = self.get_exporter()
        results_all = exporter.get_results()
        df = exporter.get_dataframe(flat=False)
        summary = self.get_summary()

        issues: List[str] = []

        if summary.total != len(results_all):
            issues.append(f"summary.total({summary.total}) != len(results)({len(results_all)})")

        if summary.total != len(df):
            issues.append(f"summary.total({summary.total}) != len(dataframe)({len(df)})")

        if row_number is not None:
            detail = self.get_result(row_number)
            if detail is None:
                issues.append(f"详情：row={row_number} 不存在")
            else:
                in_list = any(r.row_number == row_number for r in results_all)
                in_df = (df["row_number"] == row_number).any() if len(df) else False
                if not in_list:
                    issues.append(f"row={row_number} 在 results_all 中缺失")
                if not in_df:
                    issues.append(f"row={row_number} 在 dataframe 中缺失")

        return {
            "ok": len(issues) == 0,
            "issues": issues,
            "summary": summary.to_dict(),
            "snapshot": {
                "version": self.metadata.current_version,
                "result_count": len(results_all),
                "snapshots": [s.model_dump() for s in self.metadata.snapshots[-5:]],
            },
        }
