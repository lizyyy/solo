import uuid
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any

from ..models import (
    DJShow,
    WorkflowStage,
    BatchStatus,
    ContractScreenshot,
    Batch,
    ModificationRecord,
)
from ..rules import BoundaryRuleEngine
from ..history import HistoryEngine


class WorkflowEngine:
    STAGE_DESCRIPTIONS = {
        WorkflowStage.STAGE_1_IMPORTED: "第一步: 排练群接龙已导入",
        WorkflowStage.STAGE_2_CONTRACT_REVIEWED: "第二步: 合同页截图已补看",
        WorkflowStage.STAGE_3_AUTHORIZED: "第三步: 授权已更新",
    }

    @staticmethod
    def get_current_stage(show: DJShow) -> WorkflowStage:
        return show.workflow_stage

    @staticmethod
    def get_stage_description(stage: WorkflowStage) -> str:
        return WorkflowEngine.STAGE_DESCRIPTIONS.get(stage, str(stage))

    @staticmethod
    def can_advance_to_stage(
        show: DJShow,
        target_stage: WorkflowStage,
    ) -> Tuple[bool, List[str]]:
        blockers = []
        current = show.workflow_stage

        stage_order = [
            WorkflowStage.STAGE_1_IMPORTED,
            WorkflowStage.STAGE_2_CONTRACT_REVIEWED,
            WorkflowStage.STAGE_3_AUTHORIZED,
        ]

        current_idx = stage_order.index(current)
        target_idx = stage_order.index(target_stage)

        if target_idx <= current_idx:
            blockers.append(f"无法回退到已完成的阶段: {WorkflowEngine.get_stage_description(target_stage)}")
            return False, blockers

        if target_idx > current_idx + 1:
            blockers.append("必须按顺序推进，不能跳过阶段")
            return False, blockers

        if target_stage == WorkflowStage.STAGE_2_CONTRACT_REVIEWED:
            if not show.contract_screenshots:
                blockers.append("未上传合同页截图，无法进入第二步")

        if target_stage == WorkflowStage.STAGE_3_AUTHORIZED:
            mixed_batches = BoundaryRuleEngine.get_mixed_batches(show)
            unreviewed = [b for b in mixed_batches if b.status == BatchStatus.MIXED]
            if unreviewed:
                blockers.append(
                    f"存在 {len(unreviewed)} 个混票批次未送审，"
                    f"请先标记为待复核后再授权。批次: {[b.name for b in unreviewed]}"
                )

            pending = [b for b in show.batches if b.status == BatchStatus.PENDING_REVIEW]
            if pending:
                blockers.append(
                    f"存在 {len(pending)} 个批次等待录音师复核，"
                    f"复核完成前请勿授权。批次: {[b.name for b in pending]}"
                )

        return len(blockers) == 0, blockers

    @staticmethod
    def advance_stage(
        show: DJShow,
        operator: str,
        reason: str = "",
    ) -> Tuple[bool, List[str], WorkflowStage]:
        stage_order = [
            WorkflowStage.STAGE_1_IMPORTED,
            WorkflowStage.STAGE_2_CONTRACT_REVIEWED,
            WorkflowStage.STAGE_3_AUTHORIZED,
        ]
        current_idx = stage_order.index(show.workflow_stage)

        if current_idx >= len(stage_order) - 1:
            return False, ["已到达最终阶段，无法继续推进"], show.workflow_stage

        target_stage = stage_order[current_idx + 1]
        can_advance, blockers = WorkflowEngine.can_advance_to_stage(show, target_stage)

        if not can_advance:
            return False, blockers, show.workflow_stage

        old_stage = show.workflow_stage
        show.workflow_stage = target_stage

        HistoryEngine.record_modification(
            show=show,
            entity_type="workflow",
            entity_id=show.id,
            field_name="stage",
            old_value=old_stage.value,
            new_value=target_stage.value,
            modified_by=operator,
            reason=reason or f"推进到 {WorkflowEngine.get_stage_description(target_stage)}",
        )

        return True, [], target_stage

    @staticmethod
    def upload_contract_screenshot(
        show: DJShow,
        image_path: str,
        uploaded_by: str,
        ocr_text: Optional[str] = None,
        linked_batch_ids: Optional[List[str]] = None,
        note: Optional[str] = None,
    ) -> ContractScreenshot:
        screenshot = ContractScreenshot(
            id=f"screenshot_{uuid.uuid4().hex[:8]}",
            show_id=show.id,
            image_path=image_path,
            uploaded_by=uploaded_by,
            ocr_text=ocr_text,
            linked_batch_ids=linked_batch_ids or [],
            note=note,
        )
        show.contract_screenshots.append(screenshot)
        return screenshot

    @staticmethod
    def flag_batch_for_audio_engineer_review(
        show: DJShow,
        batch_id: str,
        operator: str,
        review_note: str = "",
    ) -> Optional[Batch]:
        for batch in show.batches:
            if batch.id == batch_id:
                BoundaryRuleEngine.flag_for_review(batch, operator, review_note)
                HistoryEngine.record_modification(
                    show=show,
                    entity_type="batch",
                    entity_id=batch_id,
                    field_name="status",
                    old_value=BatchStatus.MIXED.value if batch.mixed_issue_found else BatchStatus.NORMAL.value,
                    new_value=BatchStatus.PENDING_REVIEW.value,
                    modified_by=operator,
                    reason="送录音师复核",
                )
                return batch
        return None

    @staticmethod
    def audio_engineer_review(
        show: DJShow,
        batch_id: str,
        reviewer: str,
        is_approved: bool,
        resolution: str = "",
    ) -> Optional[Batch]:
        for batch in show.batches:
            if batch.id == batch_id and batch.status == BatchStatus.PENDING_REVIEW:
                BoundaryRuleEngine.resolve_batch(
                    batch=batch,
                    operator=reviewer,
                    show=show,
                    approved=is_approved,
                    resolution=resolution,
                )
                return batch
        return None

    @staticmethod
    def get_workflow_summary(show: DJShow) -> Dict[str, Any]:
        mixed_batches = BoundaryRuleEngine.get_mixed_batches(show)
        pending = [b for b in mixed_batches if b.status == BatchStatus.PENDING_REVIEW]
        just_mixed = [b for b in mixed_batches if b.status == BatchStatus.MIXED]

        return {
            "当前阶段": WorkflowEngine.get_stage_description(show.workflow_stage),
            "已导入接龙数": len(show.rehearsal_imports),
            "已上传合同截图数": len(show.contract_screenshots),
            "总批次数": len(show.batches),
            "混票批次数": len(mixed_batches),
            "待录音师复核数": len(pending),
            "未送审混票数": len(just_mixed),
            "待复核批次": [b.name for b in pending],
            "未送审批次": [b.name for b in just_mixed],
        }

    @staticmethod
    def run_complete_workflow(
        show: DJShow,
        operator: str,
        contract_image_path: Optional[str] = None,
        auto_send_for_review: bool = False,
    ) -> Dict[str, Any]:
        log = []
        log.append(f"开始执行工作流，当前阶段: {WorkflowEngine.get_stage_description(show.workflow_stage)}")

        mixed_batches = BoundaryRuleEngine.get_mixed_batches(show)
        if mixed_batches:
            if auto_send_for_review:
                for batch in mixed_batches:
                    if batch.status == BatchStatus.MIXED:
                        WorkflowEngine.flag_batch_for_audio_engineer_review(
                            show, batch.id, operator, "自动送审"
                        )
                log.append(f"自动送审 {len(mixed_batches)} 个混票批次到录音师复核")
            else:
                log.append(
                    f"检测到 {len(mixed_batches)} 个混票批次，"
                    f"需录音师复核后才能进入最终授权阶段"
                )

        if contract_image_path:
            WorkflowEngine.upload_contract_screenshot(
                show=show,
                image_path=contract_image_path,
                uploaded_by=operator,
                note="工作流自动上传",
            )
            log.append("已上传合同页截图")

        success, blockers, new_stage = WorkflowEngine.advance_stage(show, operator)
        if success:
            log.append(f"已推进到: {WorkflowEngine.get_stage_description(new_stage)}")
        else:
            log.append(f"推进受阻: {'; '.join(blockers)}")

        success2, blockers2, final_stage = WorkflowEngine.advance_stage(show, operator)
        if success2:
            log.append(f"已推进到: {WorkflowEngine.get_stage_description(final_stage)}")
        elif blockers2 and "无法回退" not in str(blockers2):
            log.append(f"最终阶段推进受阻: {'; '.join(blockers2)}")

        return {
            "执行日志": log,
            "最终阶段": WorkflowEngine.get_stage_description(show.workflow_stage),
            "状态汇总": WorkflowEngine.get_workflow_summary(show),
        }
