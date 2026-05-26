from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import (
    ReconciliationResult, ReviewRecord, PenaltyHistory,
    ReconciliationBatch, Waybill
)


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def review_waybill(self, waybill_no: str, reviewer: str, action: str,
                       status: Optional[str] = None, total_penalty: Optional[float] = None,
                       delay_penalty: Optional[float] = None, damage_penalty: Optional[float] = None,
                       transfer_penalty: Optional[float] = None, is_exempt: Optional[bool] = None,
                       exempt_reason: Optional[str] = None, is_delayed: Optional[bool] = None,
                       is_damaged: Optional[bool] = None, is_transfer_issue: Optional[bool] = None,
                       comment: str = None, evidence: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.waybill_no == waybill_no
        ).first()

        if not result:
            raise ValueError(f"未找到运单 {waybill_no} 的对账结果")

        old_status = result.status
        old_total_penalty = result.total_penalty
        old_review_status = result.review_status

        manual_adjustment = result.manual_adjustment or {}
        manual_adjustment['history'] = manual_adjustment.get('history', [])
        change_record = {
            'timestamp': datetime.now().isoformat(),
            'reviewer': reviewer,
            'action': action,
            'changes': {}
        }

        if status is not None:
            change_record['changes']['status'] = {'from': result.status, 'to': status}
            result.status = status

        if total_penalty is not None:
            change_record['changes']['total_penalty'] = {'from': result.total_penalty, 'to': total_penalty}
            result.total_penalty = total_penalty

        if delay_penalty is not None:
            change_record['changes']['delay_penalty'] = {'from': result.delay_penalty, 'to': delay_penalty}
            result.delay_penalty = delay_penalty

        if damage_penalty is not None:
            change_record['changes']['damage_penalty'] = {'from': result.damage_penalty, 'to': damage_penalty}
            result.damage_penalty = damage_penalty

        if transfer_penalty is not None:
            change_record['changes']['transfer_penalty'] = {'from': result.transfer_penalty, 'to': transfer_penalty}
            result.transfer_penalty = transfer_penalty

        if is_exempt is not None:
            change_record['changes']['is_exempt'] = {'from': result.is_exempt, 'to': is_exempt}
            result.is_exempt = is_exempt
            if is_exempt:
                result.total_penalty = 0
                result.delay_penalty = 0
                result.damage_penalty = 0
                result.transfer_penalty = 0

        if exempt_reason is not None:
            change_record['changes']['exempt_reason'] = {'from': result.exempt_reason, 'to': exempt_reason}
            result.exempt_reason = exempt_reason

        if is_delayed is not None:
            change_record['changes']['is_delayed'] = {'from': result.is_delayed, 'to': is_delayed}
            result.is_delayed = is_delayed

        if is_damaged is not None:
            change_record['changes']['is_damaged'] = {'from': result.is_damaged, 'to': is_damaged}
            result.is_damaged = is_damaged

        if is_transfer_issue is not None:
            change_record['changes']['is_transfer_issue'] = {'from': result.is_transfer_issue, 'to': is_transfer_issue}
            result.is_transfer_issue = is_transfer_issue

        manual_adjustment['history'].append(change_record)
        manual_adjustment['last_modified'] = datetime.now().isoformat()
        manual_adjustment['last_modified_by'] = reviewer
        result.manual_adjustment = manual_adjustment

        if action == 'approve':
            result.review_status = 'approved'
        elif action == 'reject':
            result.review_status = 'rejected'
        elif action == 'pending':
            result.review_status = 'pending'
        elif action == 'exempt':
            result.review_status = 'exempt'
            result.is_exempt = True
        elif action == 'request_more_info':
            result.review_status = 'need_more_info'

        result.reviewer = reviewer
        result.review_comment = comment
        result.reviewed_at = datetime.now()

        review_record = ReviewRecord(
            reconciliation_id=result.id,
            waybill_no=waybill_no,
            reviewer=reviewer,
            action=action,
            old_status=old_review_status,
            new_status=result.review_status,
            old_total_penalty=old_total_penalty,
            new_total_penalty=result.total_penalty,
            adjustment_reason=comment,
            evidence=evidence,
            comment=comment
        )
        self.db.add(review_record)

        self._update_batch_summary(result.batch_id)

        self.db.commit()

        return {
            'waybill_no': waybill_no,
            'action': action,
            'old_status': old_review_status,
            'new_status': result.review_status,
            'old_total_penalty': old_total_penalty,
            'new_total_penalty': result.total_penalty,
            'reviewer': reviewer,
            'comment': comment,
            'reviewed_at': result.reviewed_at
        }

    def _update_batch_summary(self, batch_id: str):
        if not batch_id:
            return

        results = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.batch_id == batch_id
        ).all()

        batch = self.db.query(ReconciliationBatch).filter(
            ReconciliationBatch.batch_id == batch_id
        ).first()

        if not batch:
            return

        approved_count = sum(1 for r in results if r.review_status == 'approved')
        rejected_count = sum(1 for r in results if r.review_status == 'rejected')
        pending_count = sum(1 for r in results if r.review_status == 'pending')
        exempt_count = sum(1 for r in results if r.is_exempt or r.weather_exempt)

        total_penalty = sum(r.total_penalty for r in results if not r.is_exempt)

        summary = batch.summary or {}
        summary.update({
            'review_progress': {
                'total': len(results),
                'approved': approved_count,
                'rejected': rejected_count,
                'pending': pending_count,
                'exempt': exempt_count
            },
            'final_total_penalty': total_penalty
        })
        batch.summary = summary
        batch.total_penalty = total_penalty
        batch.reconciled_count = approved_count
        batch.pending_count = pending_count
        batch.exempt_count = exempt_count

    def get_review_history(self, waybill_no: str) -> List[Dict[str, Any]]:
        records = self.db.query(ReviewRecord).filter(
            ReviewRecord.waybill_no == waybill_no
        ).order_by(ReviewRecord.created_at.desc()).all()

        return [{
            'id': r.id,
            'reviewer': r.reviewer,
            'action': r.action,
            'old_status': r.old_status,
            'new_status': r.new_status,
            'old_total_penalty': r.old_total_penalty,
            'new_total_penalty': r.new_total_penalty,
            'adjustment_reason': r.adjustment_reason,
            'evidence': r.evidence,
            'comment': r.comment,
            'created_at': r.created_at
        } for r in records]

    def batch_review(self, waybill_nos: List[str], reviewer: str, action: str,
                     comment: str = None) -> Dict[str, Any]:
        success_count = 0
        failed_count = 0
        errors = []

        for waybill_no in waybill_nos:
            try:
                self.review_waybill(
                    waybill_no=waybill_no,
                    reviewer=reviewer,
                    action=action,
                    comment=comment
                )
                success_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"{waybill_no}: {str(e)}")

        return {
            'total_count': len(waybill_nos),
            'success_count': success_count,
            'failed_count': failed_count,
            'errors': errors
        }

    def recalculate_penalty(self, waybill_no: str, recalculator: str,
                            reason: str) -> Dict[str, Any]:
        from app.services.reconciliation_engine import ReconciliationEngine

        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.waybill_no == waybill_no
        ).first()

        if not result:
            raise ValueError(f"未找到运单 {waybill_no} 的对账结果")

        waybill = self.db.query(Waybill).filter(
            Waybill.waybill_no == waybill_no
        ).first()

        old_total_penalty = result.total_penalty

        engine = ReconciliationEngine(self.db)
        new_result = engine.reconcile_waybill(waybill, result.batch_id)

        review_record = ReviewRecord(
            reconciliation_id=result.id,
            waybill_no=waybill_no,
            reviewer=recalculator,
            action='recalculate',
            old_status=result.status,
            new_status='recalculated',
            old_total_penalty=old_total_penalty,
            new_total_penalty=new_result.total_penalty,
            adjustment_reason=reason,
            comment=f"重新计算: {reason}"
        )
        self.db.add(review_record)

        self.db.commit()

        return {
            'waybill_no': waybill_no,
            'old_total_penalty': old_total_penalty,
            'new_total_penalty': new_result.total_penalty,
            'difference': new_result.total_penalty - old_total_penalty,
            'recalculator': recalculator,
            'reason': reason
        }


class PenaltyTraceService:
    def __init__(self, db: Session):
        self.db = db

    def trace_penalty(self, waybill_no: str, penalty_type: str = None) -> List[Dict[str, Any]]:
        query = self.db.query(PenaltyHistory).filter(
            PenaltyHistory.waybill_no == waybill_no
        )

        if penalty_type:
            query = query.filter(PenaltyHistory.penalty_type == penalty_type)

        histories = query.order_by(PenaltyHistory.created_at.desc()).all()

        result = []
        for h in histories:
            trace_info = {
                'waybill_no': h.waybill_no,
                'penalty_type': h.penalty_type,
                'rule_code': h.rule_code,
                'rule_name': h.rule_name,
                'penalty_amount': h.penalty_amount,
                'calculation_basis': h.calculation_basis,
                'original_value': h.original_value,
                'source_batch': h.source_batch,
                'source_type': h.source_type,
                'traceability_path': h.traceability_path,
                'is_adjusted': h.is_adjusted,
                'adjustment_reason': h.adjustment_reason,
                'created_at': h.created_at
            }

            historical_records = self._get_historical_records(h.rule_code, h.penalty_type)
            trace_info['historical_comparison'] = historical_records

            result.append(trace_info)

        return result

    def _get_historical_records(self, rule_code: str, penalty_type: str) -> Dict[str, Any]:
        recent_histories = self.db.query(PenaltyHistory).filter(
            PenaltyHistory.rule_code == rule_code,
            PenaltyHistory.penalty_type == penalty_type
        ).order_by(PenaltyHistory.created_at.desc()).limit(50).all()

        if not recent_histories:
            return {}

        amounts = [h.penalty_amount for h in recent_histories]
        avg_amount = sum(amounts) / len(amounts)
        min_amount = min(amounts)
        max_amount = max(amounts)

        same_amount_count = sum(1 for h in recent_histories if h.penalty_amount == recent_histories[0].penalty_amount)

        return {
            'sample_size': len(recent_histories),
            'average_amount': round(avg_amount, 2),
            'min_amount': min_amount,
            'max_amount': max_amount,
            'consistency_rate': round(same_amount_count / len(recent_histories) * 100, 2),
            'historical_range': {
                'from': recent_histories[-1].created_at.isoformat() if recent_histories else None,
                'to': recent_histories[0].created_at.isoformat() if recent_histories else None
            }
        }

    def get_penalty_statistics(self, rule_code: str = None, penalty_type: str = None,
                                start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        query = self.db.query(PenaltyHistory)

        if rule_code:
            query = query.filter(PenaltyHistory.rule_code == rule_code)
        if penalty_type:
            query = query.filter(PenaltyHistory.penalty_type == penalty_type)
        if start_date:
            query = query.filter(PenaltyHistory.created_at >= start_date)
        if end_date:
            query = query.filter(PenaltyHistory.created_at <= end_date)

        histories = query.all()

        if not histories:
            return {'total_count': 0, 'total_amount': 0}

        by_type = {}
        by_rule = {}

        for h in histories:
            if h.penalty_type not in by_type:
                by_type[h.penalty_type] = {'count': 0, 'amount': 0}
            by_type[h.penalty_type]['count'] += 1
            by_type[h.penalty_type]['amount'] += h.penalty_amount

            if h.rule_code not in by_rule:
                by_rule[h.rule_code] = {'count': 0, 'amount': 0, 'rule_name': h.rule_name}
            by_rule[h.rule_code]['count'] += 1
            by_rule[h.rule_code]['amount'] += h.penalty_amount

        return {
            'total_count': len(histories),
            'total_amount': round(sum(h.penalty_amount for h in histories), 2),
            'by_type': by_type,
            'by_rule': by_rule,
            'average_per_record': round(sum(h.penalty_amount for h in histories) / len(histories), 2)
        }
