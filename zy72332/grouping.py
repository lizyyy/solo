from typing import List, Optional, Dict, Any
from datetime import datetime
import math

from models import (
    StoreGroupingRecord, GroupingResult, RecordStatus,
    ProcessingType, AuditTrail
)
from store import DataStore


class GroupingEngine:
    """分群算法引擎 - 基于距离度量的门店分群"""

    GROUPS = ["A类高潜门店", "B类成长门店", "C类稳定门店", "D类待优化门店"]

    def __init__(self, store: DataStore):
        self.store = store

    def _calculate_distance_score(self, record: StoreGroupingRecord) -> float:
        """计算距离度量分数 - 基于学生答案内容"""
        if not record.student_answers:
            return 0.0

        valid_answers = [a for a in record.student_answers if not a.is_duplicate]
        if not valid_answers:
            valid_answers = record.student_answers

        total_score = 0.0
        for ans in valid_answers:
            content = ans.content
            foot_traffic = content.get("foot_traffic", 0)
            sales_amount = content.get("sales_amount", 0)
            customer_loyalty = content.get("customer_loyalty", 0)

            score = (foot_traffic * 0.4 + sales_amount * 0.4 + customer_loyalty * 0.2) / 100
            total_score += score

        return total_score / len(valid_answers) if valid_answers else 0.0

    def _determine_group(self, score: float, record: StoreGroupingRecord) -> str:
        """根据分数确定分群，不同处理类型有不同的调整逻辑"""
        base_score = score

        if record.processing_type == ProcessingType.OLD_STANDARD_SUPPLEMENT:
            base_score *= 0.85

        if record.manual_correction_note:
            base_score *= 0.95

        if base_score >= 0.8:
            return self.GROUPS[0]
        elif base_score >= 0.6:
            return self.GROUPS[1]
        elif base_score >= 0.4:
            return self.GROUPS[2]
        else:
            return self.GROUPS[3]

    def run_grouping(self, record_id: str, operator: str = "小祁") -> Optional[GroupingResult]:
        """运行分群算法"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if record.status == RecordStatus.PENDING_REVIEW:
            record.log_operation("分群被阻止", operator, {
                "reason": "记录待业务运营复核，暂不进行分群"
            })
            self.store.save_record(record)
            return None

        if record.status == RecordStatus.DUPLICATE_DETECTED:
            record.log_operation("分群被阻止", operator, {
                "reason": "检测到重复答案未处理，暂不进行分群"
            })
            self.store.save_record(record)
            return None

        record.re_run_count += 1
        score = self._calculate_distance_score(record)
        final_group = self._determine_group(score, record)
        confidence = min(0.95, score + 0.1) if score > 0.3 else 0.5

        result = GroupingResult(
            record_id=record_id,
            store_id=record.store_id,
            final_group=final_group,
            confidence=confidence,
            processing_type=record.processing_type,
            status=record.status,
            error_explanation=record.error_explanation.current_text,
            generated_at=datetime.now()
        )

        record.final_group = final_group
        record.status = RecordStatus.RE_RUN if record.re_run_count > 1 else RecordStatus.NORMAL
        record.log_operation("分群完成", operator, {
            "run_count": record.re_run_count,
            "score": score,
            "final_group": final_group,
            "confidence": confidence
        })

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "GROUPING_RUN",
                f"第{record.re_run_count}次分群运行，结果: {final_group} (置信度: {confidence:.2%})",
                operator,
                {
                    "run_count": record.re_run_count,
                    "score": score,
                    "final_group": final_group,
                    "confidence": confidence,
                    "processing_type": record.processing_type.value
                }
            )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        self.store.save_grouping_result(result)
        return result

    def re_run(self, record_id: str, operator: str = "小祁") -> Optional[GroupingResult]:
        """重跑分群"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "RE_RUN_REQUESTED",
                f"请求第{record.re_run_count + 1}次重跑分群",
                operator,
                {"previous_group": record.final_group}
            )
            self.store.save_audit_trail(audit)

        return self.run_grouping(record_id, operator)
