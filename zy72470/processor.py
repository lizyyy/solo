from datetime import datetime
from typing import List, Tuple, Optional
from models import (
    RiverbankRiskRecord,
    RedlineRemark,
    GridInspection,
    ResidentOpinion,
    RecordStatus,
    RecordSource,
    ConflictEvidence,
    ConflictReviewItem,
    ProcessingStep,
    ProfessionalCalc,
    RiskLevel,
)


class RiverbankRiskProcessor:
    def __init__(self):
        self.conflict_review_table: List[ConflictReviewItem] = []
        self.processed_records: List[RiverbankRiskRecord] = []

    def step1_import_redline_remark(
        self, record: RiverbankRiskRecord, redline_remark: RedlineRemark
    ) -> RiverbankRiskRecord:
        record.redline_remark = redline_remark
        record.processing_history.append(
            ProcessingStep(
                step_name="第一步：红线图备注导入",
                operator="系统",
                action="导入红线图备注",
                remark=f"导入红线图版本 {redline_remark.redline_version}",
            )
        )

        if record.resident_opinion and not record.resident_opinion.has_original:
            record.status = RecordStatus.PENDING_REVIEW
            record.processing_history.append(
                ProcessingStep(
                    step_name="第一步：红线图备注导入",
                    operator="系统",
                    action="标记待复核",
                    remark="居民意见只剩汇总没有原文，待社区书记复核",
                )
            )

        return record

    def step2_review_grid_inspection(
        self, record: RiverbankRiskRecord, grid_inspection: GridInspection
    ) -> RiverbankRiskRecord:
        record.grid_inspection = grid_inspection
        record.processing_history.append(
            ProcessingStep(
                step_name="第二步：补看网格员巡查表",
                operator="城更项目经理阿宁",
                action="查看网格员巡查表",
                remark=f"巡查员：{grid_inspection.inspector}，"
                f"是否旧口径：{'是' if grid_inspection.is_old_caliber else '否'}",
            )
        )

        if grid_inspection.is_old_caliber:
            record.processing_history.append(
                ProcessingStep(
                    step_name="第二步：补看网格员巡查表",
                    operator="城更项目经理阿宁",
                    action="标记旧口径",
                    remark="该巡查记录为旧口径补录材料",
                )
            )
            if record.status == RecordStatus.NORMAL:
                record.status = RecordStatus.SUPPLEMENTED

        return record

    def _detect_conflicts(
        self, record: RiverbankRiskRecord
    ) -> List[ConflictEvidence]:
        conflicts: List[ConflictEvidence] = []

        if not record.redline_remark or not record.grid_inspection:
            return conflicts

        conflict_id = 1

        if (
            record.redline_remark.risk_level
            != record.grid_inspection.risk_level
        ):
            conflicts.append(
                ConflictEvidence(
                    evidence_id=f"conflict_{record.record_id}_{conflict_id}",
                    field_name="风险等级",
                    source_a=RecordSource.REDLINE_REMARK,
                    value_a=record.redline_remark.risk_level,
                    source_b=RecordSource.GRID_INSPECTION,
                    value_b=record.grid_inspection.risk_level,
                    description="红线图标注的风险等级与网格员巡查表记录不一致",
                )
            )
            conflict_id += 1

        if (
            record.redline_remark.risk_description
            != record.grid_inspection.risk_description
        ):
            conflicts.append(
                ConflictEvidence(
                    evidence_id=f"conflict_{record.record_id}_{conflict_id}",
                    field_name="风险描述",
                    source_a=RecordSource.REDLINE_REMARK,
                    value_a=record.redline_remark.risk_description,
                    source_b=RecordSource.GRID_INSPECTION,
                    value_b=record.grid_inspection.risk_description,
                    description="红线图标注的风险描述与网格员巡查表记录不一致",
                )
            )

        return conflicts

    def step3_update_conflict_review(
        self, record: RiverbankRiskRecord
    ) -> Tuple[RiverbankRiskRecord, Optional[ConflictReviewItem]]:
        conflicts = self._detect_conflicts(record)
        record.conflicts = conflicts

        review_item = None

        if conflicts:
            record.status = RecordStatus.CONFLICT
            review_item = ConflictReviewItem(
                review_id=f"review_{record.record_id}",
                record_id=record.record_id,
                location=record.location,
                conflicts=conflicts,
            )
            self.conflict_review_table.append(review_item)

            record.processing_history.append(
                ProcessingStep(
                    step_name="第三步：冲突复核表更新",
                    operator="系统",
                    action="生成冲突复核表",
                    remark=f"检测到 {len(conflicts)} 处冲突，请城更项目经理阿宁确认或驳回",
                )
            )
        else:
            record.processing_history.append(
                ProcessingStep(
                    step_name="第三步：冲突复核表更新",
                    operator="系统",
                    action="无冲突",
                    remark="红线图备注与网格员巡查表一致，无冲突",
                )
            )
            if record.status == RecordStatus.NORMAL:
                record.final_risk_level = record.redline_remark.risk_level
                record.final_description = record.redline_remark.risk_description

        record.processing_history.append(
            ProcessingStep(
                step_name="第三步：冲突复核表更新",
                operator="系统",
                action="流程推进",
                remark="三步流程完成",
            )
        )

        return record, review_item

    def resolve_conflict(
        self,
        review_item: ConflictReviewItem,
        decision: str,
        decision_remark: str,
        record: RiverbankRiskRecord,
    ) -> Tuple[ConflictReviewItem, RiverbankRiskRecord]:
        review_item.decision = decision
        review_item.decision_remark = decision_remark
        review_item.review_time = datetime.now()

        if decision == "确认":
            record.status = RecordStatus.CONFIRMED
            if record.grid_inspection:
                record.final_risk_level = record.grid_inspection.risk_level
                record.final_description = record.grid_inspection.risk_description
        elif decision == "驳回":
            record.status = RecordStatus.REJECTED
            if record.redline_remark:
                record.final_risk_level = record.redline_remark.risk_level
                record.final_description = record.redline_remark.risk_description

        record.processing_history.append(
            ProcessingStep(
                step_name="冲突处理",
                operator="城更项目经理阿宁",
                action=f"{decision}冲突",
                remark=decision_remark,
            )
        )

        return review_item, record

    def add_professional_calc(
        self, record: RiverbankRiskRecord, calc: ProfessionalCalc
    ) -> RiverbankRiskRecord:
        record.professional_calcs.append(calc)
        record.processing_history.append(
            ProcessingStep(
                step_name="专业计算",
                operator=calc.calc_name,
                action="添加专业计算结果",
                remark=f"参数版本：{calc.param_version}，取舍理由：{calc.trade_off_reason}",
            )
        )
        return record

    def process_full_flow(
        self,
        record: RiverbankRiskRecord,
        redline_remark: RedlineRemark,
        grid_inspection: Optional[GridInspection] = None,
    ) -> Tuple[RiverbankRiskRecord, Optional[ConflictReviewItem]]:
        record = self.step1_import_redline_remark(record, redline_remark)

        if grid_inspection:
            record = self.step2_review_grid_inspection(record, grid_inspection)

        record, review_item = self.step3_update_conflict_review(record)

        self.processed_records.append(record)
        return record, review_item
