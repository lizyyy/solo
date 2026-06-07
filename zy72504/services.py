from datetime import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import (
    PromptVersion, MatchExplanation, KnowledgeBaseRef,
    ManualOverride, RollbackRecord, ChangeHistory,
    EvaluationReport, EvaluationItem, MatchStatus, ChangeType,
    SessionLocal, init_db
)
from errors import (
    PromptVersionExistsError, PromptVersionNotFoundError,
    MatchExplanationNotFoundError, KnowledgeRefNotFoundError,
    ManualOverrideExistsError, BatchOverrideConflictError,
    InvalidStatusTransitionError, EmptyImportError,
    MissingRequiredFieldError
)


class PromptVersionService:
    """提示词版本管理服务

    边界规则:
    1. 重复导入同一版本号时不创建新记录，返回现有记录
    2. 版本号唯一标识，content 变更需新建版本号
    3. 导入时记录操作人和时间
    """

    def __init__(self, db: Session):
        self.db = db

    def import_version(
        self,
        version_number: str,
        content: str,
        imported_by: str,
        description: str = None
    ) -> Tuple[PromptVersion, bool]:
        """导入提示词版本

        Args:
            version_number: 版本号（唯一）
            content: 提示词内容
            imported_by: 操作人
            description: 版本描述

        Returns:
            (version对象, 是否新建)
        """
        if not version_number:
            raise MissingRequiredFieldError("version_number", "提示词版本号")
        if not content:
            raise MissingRequiredFieldError("content", "提示词内容")
        if not imported_by:
            raise MissingRequiredFieldError("imported_by", "操作人")

        existing = self.db.query(PromptVersion).filter(
            PromptVersion.version_number == version_number
        ).first()

        if existing:
            return existing, False

        version = PromptVersion(
            version_number=version_number,
            content=content,
            description=description,
            imported_by=imported_by
        )
        self.db.add(version)
        self.db.commit()
        self.db.refresh(version)
        return version, True

    def batch_import(
        self,
        versions_data: List[Dict],
        imported_by: str
    ) -> Dict:
        """批量导入提示词版本

        边界规则: 重复导入同一批时数量不翻倍，跳过已存在的版本号
        """
        if not versions_data:
            raise EmptyImportError()

        results = {
            "created": [],
            "skipped": [],
            "total": len(versions_data)
        }

        for data in versions_data:
            try:
                version, created = self.import_version(
                    version_number=data.get("version_number", ""),
                    content=data.get("content", ""),
                    imported_by=imported_by,
                    description=data.get("description")
                )
                if created:
                    results["created"].append(version.version_number)
                else:
                    results["skipped"].append(version.version_number)
            except Exception as e:
                results.setdefault("errors", []).append({
                    "version": data.get("version_number"),
                    "error": str(e)
                })

        return results

    def get_by_version(self, version_number: str) -> PromptVersion:
        version = self.db.query(PromptVersion).filter(
            PromptVersion.version_number == version_number
        ).first()
        if not version:
            raise PromptVersionNotFoundError(version_number=version_number)
        return version


class ChangeHistoryService:
    """变更历史记录服务

    边界规则:
    1. 每次变更都记录旧值和新值
    2. 备注修改单独标记 change_type=REMARK_CHANGE
    3. 历史记录不可删除或修改
    """

    def __init__(self, db: Session):
        self.db = db

    def record_change(
        self,
        change_type: ChangeType,
        changed_by: str,
        match_explanation_id: int = None,
        prompt_version_id: int = None,
        field_name: str = None,
        old_value: str = None,
        new_value: str = None,
        diff_summary: str = None,
        metadata: Dict = None
    ) -> ChangeHistory:
        """记录变更历史"""
        if old_value is None and new_value is None:
            diff_summary = diff_summary or "创建记录"
        elif old_value != new_value:
            if not diff_summary:
                diff_summary = self._generate_diff_summary(
                    field_name, old_value, new_value
                )

        history = ChangeHistory(
            match_explanation_id=match_explanation_id,
            prompt_version_id=prompt_version_id,
            change_type=change_type.value,
            changed_by=changed_by,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            diff_summary=diff_summary,
            metadata_=metadata
        )
        self.db.add(history)
        self.db.flush()
        return history

    def _generate_diff_summary(
        self, field_name: str, old_value: str, new_value: str
    ) -> str:
        """生成人类可读的差异摘要"""
        display_name = self._get_field_display_name(field_name)
        old_str = str(old_value)[:50] + ("..." if len(str(old_value)) > 50 else "")
        new_str = str(new_value)[:50] + ("..." if len(str(new_value)) > 50 else "")
        return f"{display_name}: '{old_str}' → '{new_str}'"

    def _get_field_display_name(self, field_name: str) -> str:
        field_map = {
            "explanation": "匹配解释",
            "status": "状态",
            "match_score": "匹配分数",
            "remark": "备注",
            "knowledge_ref_id": "知识库引用",
            "prompt_version_id": "提示词版本"
        }
        return field_map.get(field_name, field_name or "字段")

    def get_history_for_explanation(
        self, explanation_id: int
    ) -> List[ChangeHistory]:
        """获取匹配解释的完整变更历史"""
        return self.db.query(ChangeHistory).filter(
            ChangeHistory.match_explanation_id == explanation_id
        ).order_by(ChangeHistory.changed_at.desc()).all()


class MatchExplanationService:
    """匹配解释核心服务

    边界规则:
    1. 人工改判被下一次批跑覆盖时，标记为 OVERRIDDEN_BY_BATCH，设置 needs_review=True
    2. 被批跑覆盖的记录不能直接归为正常，需安全审核同事复核
    3. 所有状态变更都记录历史
    """

    def __init__(self, db: Session):
        self.db = db
        self.history_service = ChangeHistoryService(db)

    def create_explanation(
        self,
        resume_id: str,
        job_id: str,
        explanation: str,
        prompt_version_id: int,
        created_by: str,
        match_score: int = None,
        knowledge_ref_id: int = None
    ) -> MatchExplanation:
        """创建匹配解释"""
        if not resume_id:
            raise MissingRequiredFieldError("resume_id", "简历ID")
        if not job_id:
            raise MissingRequiredFieldError("job_id", "职位ID")
        if not explanation:
            raise MissingRequiredFieldError("explanation", "匹配解释")

        record = MatchExplanation(
            resume_id=resume_id,
            job_id=job_id,
            explanation=explanation,
            prompt_version_id=prompt_version_id,
            knowledge_ref_id=knowledge_ref_id,
            match_score=match_score,
            status=MatchStatus.NORMAL
        )
        self.db.add(record)
        self.db.flush()

        self.history_service.record_change(
            change_type=ChangeType.CREATE,
            changed_by=created_by,
            match_explanation_id=record.id,
            prompt_version_id=prompt_version_id,
            diff_summary="创建匹配解释记录"
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def batch_run_update(
        self,
        explanations_data: List[Dict],
        run_by: str
    ) -> Dict:
        """批跑更新匹配解释

        边界规则:
        - 如记录有人工改判，批跑后标记为被覆盖，需等待复核
        - 不能直接将有人工改判的记录归为正常
        """
        results = {
            "updated": [],
            "needs_review": [],
            "errors": []
        }
        now = datetime.now()

        for data in explanations_data:
            try:
                exp_id = data.get("id")
                if not exp_id:
                    continue

                record = self.db.query(MatchExplanation).get(exp_id)
                if not record:
                    raise MatchExplanationNotFoundError(exp_id)

                old_explanation = record.explanation
                old_status = record.status

                has_manual_override = (
                    record.manual_override is not None
                    and not record.manual_override.is_overridden_by_batch
                )

                record.explanation = data.get("explanation", record.explanation)
                record.match_score = data.get("match_score", record.match_score)
                record.last_batch_run_at = now

                if has_manual_override:
                    record.status = MatchStatus.OVERRIDDEN_BY_BATCH
                    record.needs_review = True
                    record.manual_override.is_overridden_by_batch = True
                    record.manual_override.batch_overridden_at = now
                    results["needs_review"].append(exp_id)

                    self.history_service.record_change(
                        change_type=ChangeType.BATCH_RUN,
                        changed_by=run_by,
                        match_explanation_id=record.id,
                        field_name="status",
                        old_value=old_status,
                        new_value=MatchStatus.OVERRIDDEN_BY_BATCH.value,
                        diff_summary="批跑覆盖了人工改判，等待安全审核复核"
                    )
                else:
                    if old_explanation != record.explanation:
                        self.history_service.record_change(
                            change_type=ChangeType.BATCH_RUN,
                            changed_by=run_by,
                            match_explanation_id=record.id,
                            field_name="explanation",
                            old_value=old_explanation,
                            new_value=record.explanation
                        )

                results["updated"].append(exp_id)
                self.db.flush()

            except Exception as e:
                results["errors"].append({
                    "id": data.get("id"),
                    "error": str(e)
                })

        self.db.commit()
        return results

    def create_manual_override(
        self,
        explanation_id: int,
        new_explanation: str,
        new_status: str,
        overridden_by: str,
        reason: str = None
    ) -> ManualOverride:
        """创建人工改判

        边界规则:
        - 每条记录只能有一个活跃的人工改判
        - 保留原始值便于回滚
        """
        record = self.db.query(MatchExplanation).get(explanation_id)
        if not record:
            raise MatchExplanationNotFoundError(explanation_id)

        if record.manual_override and not record.manual_override.is_overridden_by_batch:
            raise ManualOverrideExistsError(explanation_id)

        override = ManualOverride(
            match_explanation_id=explanation_id,
            original_explanation=record.explanation,
            original_status=record.status,
            new_explanation=new_explanation,
            new_status=new_status,
            reason=reason,
            overridden_by=overridden_by
        )
        self.db.add(override)
        self.db.flush()

        old_status = record.status
        old_explanation = record.explanation

        record.explanation = new_explanation
        record.status = MatchStatus.MANUAL_OVERRIDDEN

        self.history_service.record_change(
            change_type=ChangeType.OVERRIDE,
            changed_by=overridden_by,
            match_explanation_id=explanation_id,
            field_name="explanation",
            old_value=old_explanation,
            new_value=new_explanation,
            diff_summary=f"人工改判: {reason or '无原因'}"
        )

        self.history_service.record_change(
            change_type=ChangeType.OVERRIDE,
            changed_by=overridden_by,
            match_explanation_id=explanation_id,
            field_name="status",
            old_value=old_status,
            new_value=MatchStatus.MANUAL_OVERRIDDEN.value
        )

        self.db.commit()
        self.db.refresh(override)
        return override

    def review_override(
        self,
        explanation_id: int,
        approved: bool,
        reviewed_by: str,
        review_note: str = None
    ) -> MatchExplanation:
        """安全审核同事复核被批跑覆盖的人工改判

        边界规则:
        - 只有 OVERRIDDEN_BY_BATCH 状态的记录可复核
        - 通过: 状态改为 REVIEW_APPROVED，保留批跑结果
        - 驳回: 回滚到人工改判值
        """
        record = self.db.query(MatchExplanation).get(explanation_id)
        if not record:
            raise MatchExplanationNotFoundError(explanation_id)

        if record.status != MatchStatus.OVERRIDDEN_BY_BATCH:
            raise InvalidStatusTransitionError(
                record.status, "review"
            )

        if not record.manual_override:
            raise BatchOverrideConflictError(explanation_id)

        old_status = record.status

        if approved:
            record.status = MatchStatus.REVIEW_APPROVED
            record.needs_review = False
            diff_summary = f"安全审核通过，保留批跑结果: {review_note or '无备注'}"
        else:
            record.explanation = record.manual_override.new_explanation
            record.status = MatchStatus.MANUAL_OVERRIDDEN
            record.needs_review = False
            record.manual_override.is_overridden_by_batch = False
            diff_summary = f"安全审核驳回，回滚至人工改判: {review_note or '无备注'}"

        self.history_service.record_change(
            change_type=ChangeType.UPDATE,
            changed_by=reviewed_by,
            match_explanation_id=explanation_id,
            field_name="status",
            old_value=old_status,
            new_value=record.status,
            diff_summary=diff_summary
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def rollback_override(
        self,
        explanation_id: int,
        rolled_back_by: str,
        reason: str = None
    ) -> RollbackRecord:
        """回滚人工改判，恢复到改判前的值"""
        record = self.db.query(MatchExplanation).get(explanation_id)
        if not record:
            raise MatchExplanationNotFoundError(explanation_id)

        if not record.manual_override:
            raise InvalidStatusTransitionError(record.status, "rollback")

        override = record.manual_override
        rollback = RollbackRecord(
            manual_override_id=override.id,
            rolled_back_by=rolled_back_by,
            reason=reason,
            rollback_type="full_rollback"
        )
        self.db.add(rollback)
        self.db.flush()

        old_explanation = record.explanation
        old_status = record.status

        record.explanation = override.original_explanation
        record.status = MatchStatus.ROLLED_BACK
        record.needs_review = False

        self.db.delete(override)

        self.history_service.record_change(
            change_type=ChangeType.ROLLBACK,
            changed_by=rolled_back_by,
            match_explanation_id=explanation_id,
            field_name="explanation",
            old_value=old_explanation,
            new_value=override.original_explanation,
            diff_summary=f"回滚人工改判: {reason or '无原因'}"
        )

        self.history_service.record_change(
            change_type=ChangeType.ROLLBACK,
            changed_by=rolled_back_by,
            match_explanation_id=explanation_id,
            field_name="status",
            old_value=old_status,
            new_value=MatchStatus.ROLLED_BACK.value
        )

        self.db.commit()
        self.db.refresh(rollback)
        return rollback

    def get_pending_review(self) -> List[MatchExplanation]:
        """获取所有待安全审核复核的记录"""
        return self.db.query(MatchExplanation).filter(
            and_(
                MatchExplanation.status == MatchStatus.OVERRIDDEN_BY_BATCH,
                MatchExplanation.needs_review == True
            )
        ).order_by(MatchExplanation.updated_at.desc()).all()

    def get_by_id(self, explanation_id: int) -> MatchExplanation:
        record = self.db.query(MatchExplanation).get(explanation_id)
        if not record:
            raise MatchExplanationNotFoundError(explanation_id)
        return record


class KnowledgeBaseService:
    """知识库引用管理服务"""

    def __init__(self, db: Session):
        self.db = db
        self.history_service = ChangeHistoryService(db)

    def create_ref(
        self,
        ref_link: str,
        created_by: str,
        title: str = None,
        remark: str = None
    ) -> KnowledgeBaseRef:
        if not ref_link:
            raise MissingRequiredFieldError("ref_link", "知识库引用链接")

        ref = KnowledgeBaseRef(
            ref_link=ref_link,
            title=title,
            remark=remark,
            created_by=created_by
        )
        self.db.add(ref)
        self.db.commit()
        self.db.refresh(ref)
        return ref

    def update_remark(
        self,
        ref_id: int,
        new_remark: str,
        updated_by: str
    ) -> KnowledgeBaseRef:
        """更新知识库引用备注

        边界规则:
        - 记录旧备注和新备注的差异
        - 关联的匹配解释都标记为变更，用于评测报告
        """
        ref = self.db.query(KnowledgeBaseRef).get(ref_id)
        if not ref:
            raise KnowledgeRefNotFoundError(ref_id)

        old_remark = ref.remark

        if old_remark == new_remark:
            return ref

        ref.remark = new_remark

        affected_explanations = self.db.query(MatchExplanation).filter(
            MatchExplanation.knowledge_ref_id == ref_id
        ).all()

        for exp in affected_explanations:
            self.history_service.record_change(
                change_type=ChangeType.REMARK_CHANGE,
                changed_by=updated_by,
                match_explanation_id=exp.id,
                field_name="knowledge_remark",
                old_value=old_remark,
                new_value=new_remark,
                diff_summary=f"知识库引用备注修改: {ref.ref_link}"
            )

        self.db.commit()
        self.db.refresh(ref)
        return ref

    def link_to_explanation(
        self,
        ref_id: int,
        explanation_id: int,
        linked_by: str
    ) -> MatchExplanation:
        """将知识库引用关联到匹配解释"""
        ref = self.db.query(KnowledgeBaseRef).get(ref_id)
        if not ref:
            raise KnowledgeRefNotFoundError(ref_id)

        exp = self.db.query(MatchExplanation).get(explanation_id)
        if not exp:
            raise MatchExplanationNotFoundError(explanation_id)

        old_ref_id = exp.knowledge_ref_id
        exp.knowledge_ref_id = ref_id

        self.history_service.record_change(
            change_type=ChangeType.UPDATE,
            changed_by=linked_by,
            match_explanation_id=explanation_id,
            field_name="knowledge_ref_id",
            old_value=str(old_ref_id) if old_ref_id else None,
            new_value=str(ref_id),
            diff_summary=f"关联知识库: {ref.title or ref.ref_link}"
        )

        self.db.commit()
        self.db.refresh(exp)
        return exp

    def get_affected_by_remark_change(
        self, ref_id: int
    ) -> List[MatchExplanation]:
        """获取受备注修改影响的匹配解释列表"""
        return self.db.query(MatchExplanation).filter(
            MatchExplanation.knowledge_ref_id == ref_id
        ).all()


class EvaluationService:
    """评测报告生成服务"""

    def __init__(self, db: Session):
        self.db = db
        self.history_service = ChangeHistoryService(db)

    def generate_daily_report(
        self,
        generated_by: str,
        report_date: datetime = None
    ) -> EvaluationReport:
        """生成每日评测报告

        边界规则:
        - 指出受知识库备注修改影响的记录
        - 列出待复核的人工改判被覆盖记录
        - 按变更类型分类统计
        """
        report_date = report_date or datetime.now()
        start_of_day = report_date.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        report = EvaluationReport(
            report_date=report_date,
            generated_by=generated_by
        )
        self.db.add(report)
        self.db.flush()

        remark_changes = self.db.query(ChangeHistory).filter(
            and_(
                ChangeHistory.change_type == ChangeType.REMARK_CHANGE.value,
                ChangeHistory.changed_at >= start_of_day
            )
        ).all()

        batch_overrides = self.db.query(ChangeHistory).filter(
            and_(
                ChangeHistory.change_type == ChangeType.BATCH_RUN.value,
                ChangeHistory.changed_at >= start_of_day,
                ChangeHistory.diff_summary.like("%人工改判%")
            )
        ).all()

        all_changes = self.db.query(ChangeHistory).filter(
            ChangeHistory.changed_at >= start_of_day
        ).all()

        unique_explanation_ids = set()
        remark_change_explanation_ids = set()

        for change in remark_changes:
            if change.match_explanation_id:
                remark_change_explanation_ids.add(change.match_explanation_id)
                item = EvaluationItem(
                    report_id=report.id,
                    match_explanation_id=change.match_explanation_id,
                    change_type=ChangeType.REMARK_CHANGE.value,
                    field_changed=change.field_name,
                    old_value=change.old_value,
                    new_value=change.new_value,
                    needs_review=True,
                    note="知识库备注已修改，请安全审核同事复核"
                )
                self.db.add(item)
                unique_explanation_ids.add(change.match_explanation_id)

        for change in batch_overrides:
            if change.match_explanation_id:
                unique_explanation_ids.add(change.match_explanation_id)
                item = EvaluationItem(
                    report_id=report.id,
                    match_explanation_id=change.match_explanation_id,
                    change_type=ChangeType.BATCH_RUN.value,
                    field_changed=change.field_name,
                    old_value=change.old_value,
                    new_value=change.new_value,
                    needs_review=True,
                    note="人工改判被批跑覆盖，需安全审核同事复核"
                )
                self.db.add(item)

        report.total_records = len(unique_explanation_ids)
        report.changed_records = len(unique_explanation_ids)
        report.remark_change_count = len(remark_change_explanation_ids)

        pending_review = self.db.query(MatchExplanation).filter(
            and_(
                MatchExplanation.needs_review == True,
                MatchExplanation.status == MatchStatus.OVERRIDDEN_BY_BATCH
            )
        ).count()
        report.pending_review_count = pending_review + len(remark_change_explanation_ids)

        report.summary = (
            f"今日共 {report.total_records} 条记录发生变更，"
            f"其中 {report.remark_change_count} 条受知识库备注修改影响，"
            f"{len(batch_overrides)} 条涉及人工改判被批跑覆盖。"
            f"共 {report.pending_review_count} 条记录待安全审核同事复核。"
        )

        self.db.commit()
        self.db.refresh(report)
        return report

    def get_report_items(self, report_id: int) -> List[EvaluationItem]:
        return self.db.query(EvaluationItem).filter(
            EvaluationItem.report_id == report_id
        ).all()


class WorkflowService:
    """三步流程串联服务

    流程:
    1. 提示词版本号第一次导入
    2. 知识库编辑小乔补看知识库引用链接
    3. 评测报告更新

    边界规则:
    - 中间碰到人工改判被批跑覆盖，别急着归正常，留给安全审核同事复核
    """

    def __init__(self, db: Session):
        self.db = db
        self.prompt_service = PromptVersionService(db)
        self.knowledge_service = KnowledgeBaseService(db)
        self.match_service = MatchExplanationService(db)
        self.evaluation_service = EvaluationService(db)

    def run_three_step_workflow(
        self,
        step1_data: Dict,
        step2_data: Dict,
        operator: str
    ) -> Dict:
        """执行完整三步流程"""
        results = {
            "step1": None,
            "step2": None,
            "step3": None,
            "pending_review": []
        }

        version, created = self.prompt_service.import_version(
            version_number=step1_data["version_number"],
            content=step1_data["content"],
            imported_by=operator,
            description=step1_data.get("description")
        )
        results["step1"] = {
            "version_number": version.version_number,
            "created": created
        }

        ref = self.knowledge_service.create_ref(
            ref_link=step2_data["ref_link"],
            created_by=operator,
            title=step2_data.get("title"),
            remark=step2_data.get("remark")
        )
        results["step2"] = {
            "ref_id": ref.id,
            "ref_link": ref.ref_link
        }

        report = self.evaluation_service.generate_daily_report(
            generated_by=operator
        )
        results["step3"] = {
            "report_id": report.id,
            "summary": report.summary
        }

        pending = self.match_service.get_pending_review()
        results["pending_review"] = [
            {
                "id": p.id,
                "resume_id": p.resume_id,
                "job_id": p.job_id,
                "status": p.status
            }
            for p in pending
        ]

        return results


def init_database():
    """初始化数据库"""
    init_db()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
