from sqlalchemy.orm import Session
from datetime import datetime
import time
import json
from typing import List, Dict, Any, Tuple
from models import (
    TaskBatch, WatermarkRecord, FailedItem, RollbackCandidate,
    ManualCorrection, ProcessReport, ParameterCombinationCheck
)
from schemas import (
    BatchProcessRequest, RollbackCandidateCreate,
    ManualCorrectionCreate, BlockReasonResponse
)


class ParameterCombinationValidator:
    REQUIRED_COMBINATIONS = [
        {"channel": "online", "product": "A", "region": "domestic"},
        {"channel": "online", "product": "B", "region": "domestic"},
        {"channel": "offline", "product": "A", "region": "domestic"},
        {"channel": "online", "product": "A", "region": "international"},
    ]

    BLOCK_RULES = {
        "missing_channel": "缺少渠道参数，无法确定业务路径",
        "missing_product": "缺少产品编码，无法匹配产品规则",
        "missing_region": "缺少地区标识，跨境业务无法处理",
        "invalid_combination": "参数组合不在测试覆盖范围内，存在规则漏测风险",
        "cross_region_product_mismatch": "跨境渠道与产品组合未经过联调测试",
    }

    @classmethod
    def validate_combination(cls, params: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not params:
            return False, "missing_all", "缺少所有必要参数"

        missing_fields = []
        for field in ["channel", "product", "region"]:
            if field not in params:
                missing_fields.append(field)

        if missing_fields:
            return False, "missing_fields", f"缺少必要参数: {', '.join(missing_fields)}"

        combination = {
            "channel": params.get("channel"),
            "product": params.get("product"),
            "region": params.get("region")
        }

        if combination not in cls.REQUIRED_COMBINATIONS:
            suggestion = cls._generate_suggestion(combination)
            return False, "invalid_combination", cls.BLOCK_RULES["invalid_combination"] + f"。建议: {suggestion}"

        return True, "valid", "参数组合验证通过"

    @classmethod
    def _generate_suggestion(cls, combination: Dict[str, Any]) -> str:
        suggestions = []
        for required in cls.REQUIRED_COMBINATIONS:
            diff = []
            for k, v in required.items():
                if combination.get(k) != v:
                    diff.append(f"{k}: {combination.get(k)} -> {v}")
            if len(diff) <= 2:
                suggestions.append(f"尝试调整: {', '.join(diff)}")
        return suggestions[0] if suggestions else "请与业务分析师确认该组合是否合规"


class WatermarkBatchService:
    def __init__(self, db: Session):
        self.db = db
        self.validator = ParameterCombinationValidator()

    def process_batch(self, request: BatchProcessRequest) -> Dict[str, Any]:
        start_time = time.time()

        batch = TaskBatch(
            batch_no=request.batch_no,
            temp_permission_ticket=request.temp_permission_ticket,
            parameters=request.parameters,
            created_by=request.created_by,
            status="processing",
            total_count=len(request.records)
        )
        self.db.add(batch)
        self.db.flush()

        batch.started_at = datetime.utcnow()

        success_count = 0
        failed_count = 0
        blocked_count = 0
        blocked_reasons = []

        before_stats = self._collect_before_stats(request.records)

        for record_data in request.records:
            try:
                is_valid, block_code, block_reason = self.validator.validate_combination(
                    record_data.parameter_combination
                )

                watermark_record = WatermarkRecord(
                    batch_id=batch.id,
                    record_no=record_data.record_no,
                    is_exception=record_data.is_exception,
                    exception_type=record_data.exception_type,
                    exception_message=record_data.exception_message,
                    original_data=record_data.original_data,
                    processed_data=record_data.processed_data,
                    parameter_combination=record_data.parameter_combination,
                    status="processed",
                    processed_at=datetime.utcnow()
                )

                if not is_valid:
                    watermark_record.is_blocked = True
                    watermark_record.block_reason = block_reason
                    watermark_record.status = "blocked"
                    blocked_count += 1
                    blocked_reasons.append(BlockReasonResponse(
                        parameter_combination=record_data.parameter_combination or {},
                        block_reason=block_reason,
                        suggestion=self._extract_suggestion(block_reason)
                    ))

                    self._create_parameter_check(
                        batch.id, record_data.parameter_combination, False, True, block_reason
                    )
                else:
                    success_count += 1
                    self._create_parameter_check(
                        batch.id, record_data.parameter_combination, True, False, "验证通过"
                    )

                self.db.add(watermark_record)

            except Exception as e:
                failed_count += 1
                self._save_failed_item(
                    batch.id, record_data.record_no, "PROCESSING_ERROR",
                    str(e), record_data.original_data, e
                )

        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.blocked_count = blocked_count
        batch.status = "completed"
        batch.completed_at = datetime.utcnow()

        execution_time = time.time() - start_time

        after_stats = {
            "total_count": len(request.records),
            "success_count": success_count,
            "failed_count": failed_count,
            "blocked_count": blocked_count,
        }

        self._generate_report(batch.id, before_stats, after_stats, execution_time, request.created_by)

        self.db.commit()

        return {
            "batch_id": batch.id,
            "total_processed": len(request.records),
            "success_count": success_count,
            "failed_count": failed_count,
            "blocked_count": blocked_count,
            "blocked_reasons": blocked_reasons,
            "execution_time_seconds": round(execution_time, 2)
        }

    def _collect_before_stats(self, records: List) -> Dict[str, Any]:
        exception_count = sum(1 for r in records if r.is_exception)
        return {
            "total_count": len(records),
            "exception_count": exception_count,
            "normal_count": len(records) - exception_count,
        }

    def _extract_suggestion(self, block_reason: str) -> str:
        if "建议:" in block_reason:
            return block_reason.split("建议:")[-1].strip()
        return None

    def _create_parameter_check(self, batch_id: int, params: Dict, is_tested: bool, is_blocked: bool, reason: str):
        check = ParameterCombinationCheck(
            batch_id=batch_id,
            parameter_combination=params,
            is_tested=is_tested,
            is_blocked=is_blocked,
            block_reason=reason,
            check_result="blocked" if is_blocked else "passed",
            checked_at=datetime.utcnow()
        )
        self.db.add(check)

    def _save_failed_item(self, batch_id: int, record_no: str, failure_type: str,
                          failure_reason: str, original_data: Dict, exception: Exception = None):
        import traceback
        failed_item = FailedItem(
            batch_id=batch_id,
            record_no=record_no,
            failure_type=failure_type,
            failure_reason=failure_reason,
            original_data=original_data,
            error_details={"type": failure_type, "message": failure_reason},
            stack_trace=traceback.format_exc() if exception else None
        )
        self.db.add(failed_item)

    def _generate_report(self, batch_id: int, before_stats: Dict, after_stats: Dict,
                         execution_time: float, generated_by: str):
        comparison = self._generate_comparison(before_stats, after_stats)
        next_steps = self._generate_next_steps(after_stats)
        blocked_analysis = self._analyze_blocked_items(batch_id)
        failed_summary = self._summarize_failed_items(batch_id)

        report = ProcessReport(
            batch_id=batch_id,
            report_no=f"RPT-{batch_id}-{int(time.time())}",
            before_processing_stats=before_stats,
            after_processing_stats=after_stats,
            comparison_summary=comparison,
            execution_time_seconds=round(execution_time, 2),
            next_step_suggestions=next_steps,
            blocked_items_analysis=blocked_analysis,
            failed_items_summary=failed_summary,
            generated_by=generated_by
        )
        self.db.add(report)

    def _generate_comparison(self, before: Dict, after: Dict) -> str:
        lines = [
            f"处理前: 共{before['total_count']}条记录, 其中异常{before['exception_count']}条, 正常{before['normal_count']}条",
            f"处理后: 成功{after['success_count']}条, 失败{after['failed_count']}条, 拦截{after['blocked_count']}条",
        ]
        if after['blocked_count'] > 0:
            lines.append(f"注意: {after['blocked_count']}条记录因参数组合问题被拦截, 需要人工确认")
        return "\n".join(lines)

    def _generate_next_steps(self, after_stats: Dict) -> str:
        steps = []
        if after_stats['failed_count'] > 0:
            steps.append("1. 优先处理失败项清单, 分析错误原因并修复")
        if after_stats['blocked_count'] > 0:
            steps.append("2. 复核被拦截的参数组合, 确认是否属于业务漏测")
        if after_stats['failed_count'] == 0 and after_stats['blocked_count'] == 0:
            steps.append("1. 本次批次处理完成, 可以进入下一流程")
        steps.append("3. 所有人工操作必须留存备注, 禁止直接覆盖系统判断")
        return "\n".join(steps)

    def _analyze_blocked_items(self, batch_id: int) -> str:
        blocked = self.db.query(WatermarkRecord).filter(
            WatermarkRecord.batch_id == batch_id,
            WatermarkRecord.is_blocked == True
        ).all()
        if not blocked:
            return "无拦截记录"
        reasons = {}
        for item in blocked:
            reason = item.block_reason.split("。")[0] if "。" in item.block_reason else item.block_reason
            reasons[reason] = reasons.get(reason, 0) + 1
        analysis = [f"{k}: {v}条" for k, v in reasons.items()]
        return f"共{len(blocked)}条拦截记录, 原因分布: {'; '.join(analysis)}"

    def _summarize_failed_items(self, batch_id: int) -> str:
        failed = self.db.query(FailedItem).filter(FailedItem.batch_id == batch_id).all()
        if not failed:
            return "无失败记录"
        types = {}
        for item in failed:
            types[item.failure_type] = types.get(item.failure_type, 0) + 1
        summary = [f"{k}: {v}条" for k, v in types.items()]
        return f"共{len(failed)}条失败记录, 类型分布: {'; '.join(summary)}"


class RollbackService:
    def __init__(self, db: Session):
        self.db = db

    def generate_candidate_list(self, batch_id: int, operation_type: str,
                                created_by: str) -> List[RollbackCandidate]:
        batch = self.db.query(TaskBatch).filter(TaskBatch.id == batch_id).first()
        if not batch:
            raise ValueError("批次不存在")

        records = self.db.query(WatermarkRecord).filter(
            WatermarkRecord.batch_id == batch_id
        ).all()

        candidates = []
        for record in records:
            candidate = RollbackCandidate(
                batch_id=batch_id,
                record_no=record.record_no,
                operation_type=operation_type,
                candidate_reason=f"批量{operation_type}候选记录",
                original_value=record.processed_data or record.original_data,
                suggested_value=record.original_data if operation_type == "rollback" else None,
                risk_level="medium",
                created_by=created_by
            )
            self.db.add(candidate)
            candidates.append(candidate)

        self.db.commit()
        return candidates

    def approve_candidate(self, candidate_id: int, approved_by: str, approve: bool = True):
        candidate = self.db.query(RollbackCandidate).filter(RollbackCandidate.id == candidate_id).first()
        if not candidate:
            raise ValueError("候选记录不存在")
        candidate.is_approved = approve
        candidate.approved_by = approved_by
        candidate.approved_at = datetime.utcnow()
        self.db.commit()
        return candidate

    def execute_rollback(self, candidate_id: int):
        candidate = self.db.query(RollbackCandidate).filter(RollbackCandidate.id == candidate_id).first()
        if not candidate:
            raise ValueError("候选记录不存在")
        if not candidate.is_approved:
            raise ValueError("候选记录未通过审批, 无法执行")

        candidate.is_executed = True
        candidate.executed_at = datetime.utcnow()
        self.db.commit()
        return candidate


class ManualCorrectionService:
    def __init__(self, db: Session):
        self.db = db

    def create_correction(self, request: ManualCorrectionCreate) -> ManualCorrection:
        correction = ManualCorrection(
            record_id=request.record_id,
            corrected_by=request.corrected_by,
            correction_notes=request.correction_notes,
            original_judgment=request.original_judgment,
            corrected_judgment=request.corrected_judgment,
            review_opinion=request.review_opinion,
            related_ticket_id=request.related_ticket_id,
            original_record_reference=request.original_record_reference
        )
        self.db.add(correction)
        self.db.commit()
        self.db.refresh(correction)
        return correction

    def get_correction_by_ticket(self, ticket_id: str) -> List[ManualCorrection]:
        return self.db.query(ManualCorrection).filter(
            ManualCorrection.related_ticket_id == ticket_id
        ).all()
