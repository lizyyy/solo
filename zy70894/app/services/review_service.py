from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
from app.models.models import ComparisonResult, ReviewRecord, ComparisonSummary
from app.schemas.schemas import ReviewRecordCreate


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def submit_review(self, review_data: ReviewRecordCreate) -> Dict:
        comparison_result = self.db.query(ComparisonResult).filter(
            ComparisonResult.id == review_data.comparison_result_id
        ).first()

        if not comparison_result:
            return {'success': False, 'error': 'Comparison result not found'}

        old_status = comparison_result.match_status
        old_discrepancy = comparison_result.discrepancy_details

        new_status = review_data.new_status if review_data.new_status else old_status
        new_discrepancy = review_data.new_discrepancy if review_data.new_discrepancy else old_discrepancy

        review_record = ReviewRecord(
            comparison_result_id=comparison_result.id,
            repair_record_id=comparison_result.repair_record_id,
            reviewer=review_data.reviewer,
            review_decision=review_data.review_decision,
            review_notes=review_data.review_notes,
            old_status=old_status,
            new_status=new_status,
            old_discrepancy=old_discrepancy,
            new_discrepancy=new_discrepancy,
            is_overridden=review_data.review_decision in ['APPROVE', 'OVERRIDE']
        )

        self.db.add(review_record)

        if review_data.review_decision in ['APPROVE', 'RESOLVED']:
            comparison_result.is_resolved = True
            comparison_result.resolution_notes = review_data.review_notes
        elif review_data.review_decision == 'REJECT':
            comparison_result.is_resolved = False

        if new_status != old_status:
            comparison_result.match_status = new_status

        if new_discrepancy != old_discrepancy:
            comparison_result.discrepancy_details = new_discrepancy

        comparison_result.updated_at = datetime.now()

        self.db.commit()

        self._recalculate_batch_summary(comparison_result.comparison_batch_id)

        return {
            'success': True,
            'review_id': review_record.id,
            'comparison_result_id': comparison_result.id,
            'status_changed': old_status != new_status,
            'resolution': comparison_result.is_resolved
        }

    def _recalculate_batch_summary(self, batch_id: str):
        results = self.db.query(ComparisonResult).filter(
            ComparisonResult.comparison_batch_id == batch_id
        ).all()

        summary = self.db.query(ComparisonSummary).filter(
            ComparisonSummary.batch_id == batch_id
        ).first()

        if summary:
            summary.total_records = len(results)
            summary.matched_records = sum(1 for r in results if r.match_status == 'MATCHED')
            summary.discrepancy_records = sum(1 for r in results if r.match_status == 'DISCREPANCY')
            summary.pending_review = sum(1 for r in results if r.match_status == 'DISCREPANCY' and not r.is_resolved)
            summary.resolved_records = sum(1 for r in results if r.is_resolved)
            summary.updated_at = datetime.now()

            self.db.commit()

    def get_review_history(self, comparison_result_id: int = None) -> List[ReviewRecord]:
        query = self.db.query(ReviewRecord)
        
        if comparison_result_id:
            query = query.filter(ReviewRecord.comparison_result_id == comparison_result_id)
            
        return query.order_by(ReviewRecord.review_date.desc()).all()

    def get_pending_reviews(self, batch_id: str = None) -> List[ComparisonResult]:
        query = self.db.query(ComparisonResult).filter(
            ComparisonResult.match_status == 'DISCREPANCY',
            ComparisonResult.is_resolved == False
        )

        if batch_id:
            query = query.filter(ComparisonResult.comparison_batch_id == batch_id)

        return query.order_by(ComparisonResult.created_at.desc()).all()

    def batch_resolve(self, result_ids: List[int], reviewer: str, decision: str, notes: str = None) -> Dict:
        resolved_count = 0
        errors = []

        for result_id in result_ids:
            try:
                review_data = ReviewRecordCreate(
                    comparison_result_id=result_id,
                    reviewer=reviewer,
                    review_decision=decision,
                    review_notes=notes
                )
                result = self.submit_review(review_data)
                if result['success']:
                    resolved_count += 1
                else:
                    errors.append(f"ID {result_id}: {result['error']}")
            except Exception as e:
                errors.append(f"ID {result_id}: {str(e)}")

        return {
            'resolved_count': resolved_count,
            'error_count': len(errors),
            'errors': errors
        }

    def explain_discrepancy(self, result_id: int) -> Dict:
        result = self.db.query(ComparisonResult).filter(
            ComparisonResult.id == result_id
        ).first()

        if not result:
            return {'error': 'Result not found'}

        explanation = {
            'product_sn': result.product_sn,
            'work_order_no': result.work_order_no,
            'match_status': result.match_status,
            'discrepancy_type': result.discrepancy_type,
            'discrepancy_details': result.discrepancy_details,
            'responsible_station': result.responsible_station,
            'confidence_score': result.confidence_score,
            'is_resolved': result.is_resolved,
            'explanation': self._generate_explanation(result)
        }

        return explanation

    def _generate_explanation(self, result: ComparisonResult) -> str:
        explanations = []

        if result.discrepancy_type == 'MATERIAL_BATCH_MISMATCH':
            explanations.append(
                "物料批次不匹配可能的原因：1) 工单发放时物料批次录入错误；"
                "2) 现场换料未及时更新系统；3) 返修记录手工录入错误。"
                "建议核对物料领用记录和生产日志确认。"
            )
        elif result.discrepancy_type == 'REPAIR_LOOP':
            explanations.append(
                "返修闭环说明同一产品经过多次返修仍未彻底解决问题。"
                "可能原因：1) 根本原因未找到，治标不治本；2) 前工序问题传递到后工序；"
                "3) 测试标准不明确。建议组织跨部门技术分析会议。"
            )
        elif result.discrepancy_type == 'MULTI_DEFECT':
            explanations.append(
                "同批次多缺陷暗示可能存在系统性问题。"
                "建议：1) 检查该批次原材料质量；2) 核查生产设备状态；"
                "3) 评估操作员培训是否到位；4) 考虑暂停该批次生产进行全面检查。"
            )
        elif result.discrepancy_type == 'STATION_ISSUE':
            explanations.append(
                f"工位 {result.responsible_station} 缺陷率异常偏高。"
                "建议：1) 检查该工位的设备精度和保养记录；2) 核查操作员作业方法是否符合SOP；"
                "3) 评估来料质量是否稳定；4) 考虑增加该工位的检验频次。"
            )
        elif result.discrepancy_type == 'MISSING_WORK_ORDER':
            explanations.append(
                "工单不存在可能是由于工单编号录入错误或工单尚未同步到系统。"
                "建议核对原始单据并确保系统数据同步。"
            )

        if result.responsible_station:
            explanations.append(
                f"建议与 {result.responsible_station} 主管沟通确认问题原因，"
                "并制定纠正预防措施避免同类问题重复发生。"
            )

        return " ".join(explanations) if explanations else "无特定问题说明"
