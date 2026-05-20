import csv
import json
from datetime import datetime
from typing import List, Dict, Optional
from io import StringIO
from models import Database, RecordStatus, ReviewAction, DiscrepancyType


class ReviewManager:
    def __init__(self, db: Database):
        self.db = db

    def review_detail(self, detail_id: int, action: str, note: str, operator: str) -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reconciliation_details WHERE id = ?', (detail_id,))
        detail = cursor.fetchone()
        if not detail:
            conn.close()
            return {'success': False, 'message': '对账明细不存在'}
        previous_status = detail['status']
        new_status = self._get_new_status(action)
        cursor.execute(
            '''INSERT INTO review_history 
               (detail_id, action, previous_status, new_status, note, operator)
               VALUES (?, ?, ?, ?, ?, ?)''',
            (detail_id, action, previous_status, new_status, note, operator)
        )
        cursor.execute(
            '''UPDATE reconciliation_details 
               SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
               WHERE id = ?''',
            (new_status, note, operator, datetime.now(), datetime.now(), detail_id)
        )
        self._update_batch_status(cursor, detail['batch_id'])
        conn.commit()
        conn.close()
        return {
            'success': True,
            'detail_id': detail_id,
            'previous_status': previous_status,
            'new_status': new_status
        }

    def _get_new_status(self, action: str) -> str:
        action_map = {
            ReviewAction.APPROVE.value: RecordStatus.APPROVED.value,
            ReviewAction.REJECT.value: RecordStatus.REJECTED.value,
            ReviewAction.REVISE.value: RecordStatus.PENDING.value,
            ReviewAction.REQUEST_MORE.value: RecordStatus.DISCREPANCY.value
        }
        return action_map.get(action, RecordStatus.PENDING.value)

    def _update_batch_status(self, cursor, batch_id: int):
        cursor.execute(
            '''SELECT status, COUNT(*) as count 
               FROM reconciliation_details 
               WHERE batch_id = ? 
               GROUP BY status''',
            (batch_id,)
        )
        statuses = cursor.fetchall()
        total = sum(s['count'] for s in statuses)
        approved_count = sum(s['count'] for s in statuses if s['status'] == RecordStatus.APPROVED.value)
        if approved_count == total:
            new_batch_status = RecordStatus.APPROVED.value
        elif any(s['status'] == RecordStatus.DISCREPANCY.value for s in statuses):
            new_batch_status = RecordStatus.DISCREPANCY.value
        else:
            new_batch_status = RecordStatus.PENDING.value
        cursor.execute(
            'UPDATE reconciliation_batches SET status = ?, updated_at = ? WHERE id = ?',
            (new_batch_status, datetime.now(), batch_id)
        )

    def revise_detail(self, detail_id: int, washing_quantity: Optional[int] = None,
                      recovery_quantity: Optional[int] = None, damage_quantity: Optional[int] = None,
                      shortage_quantity: Optional[int] = None, note: str = "", operator: str = "") -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reconciliation_details WHERE id = ?', (detail_id,))
        detail = cursor.fetchone()
        if not detail:
            conn.close()
            return {'success': False, 'message': '对账明细不存在'}
        new_washing = washing_quantity if washing_quantity is not None else detail['washing_quantity']
        new_recovery = recovery_quantity if recovery_quantity is not None else detail['recovery_quantity']
        new_damage = damage_quantity if damage_quantity is not None else detail['damage_quantity']
        new_shortage = shortage_quantity if shortage_quantity is not None else detail['shortage_quantity']
        unit_price = detail['unit_price']
        washing_amount = new_washing * unit_price
        shortage_compensation = new_shortage * unit_price
        damage_compensation = new_damage * unit_price * 0.5
        final_amount = washing_amount - shortage_compensation - damage_compensation
        discrepancy_type, discrepancy_reason = self._detect_discrepancy_type(
            new_washing, new_recovery, new_damage, new_shortage
        )
        status = RecordStatus.MATCHED.value if not discrepancy_type else RecordStatus.DISCREPANCY.value
        cursor.execute(
            '''UPDATE reconciliation_details 
               SET washing_quantity = ?, recovery_quantity = ?, damage_quantity = ?, 
                   shortage_quantity = ?, washing_amount = ?, shortage_compensation = ?,
                   damage_compensation = ?, final_amount = ?, status = ?, 
                   discrepancy_type = ?, discrepancy_reason = ?, review_note = ?, 
                   updated_at = ?
               WHERE id = ?''',
            (new_washing, new_recovery, new_damage, new_shortage, washing_amount,
             shortage_compensation, damage_compensation, final_amount, status,
             discrepancy_type, discrepancy_reason, note, datetime.now(), detail_id)
        )
        if operator:
            cursor.execute(
                '''INSERT INTO review_history 
                   (detail_id, action, previous_status, new_status, note, operator)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (detail_id, ReviewAction.REVISE.value, detail['status'], status, note, operator)
            )
        cursor.execute(
            '''SELECT SUM(washing_quantity) as total_washing,
                       SUM(recovery_quantity) as total_recovery,
                       SUM(damage_quantity) as total_damage,
                       SUM(shortage_quantity) as total_shortage,
                       SUM(final_amount) as total_amount
                FROM reconciliation_details WHERE batch_id = ?''',
            (detail['batch_id'],)
        )
        totals = cursor.fetchone()
        cursor.execute(
            '''UPDATE reconciliation_batches 
               SET total_washing_quantity = ?, total_recovery_quantity = ?,
                   total_damage = ?, total_shortage = ?, total_amount = ?, updated_at = ?
               WHERE id = ?''',
            (totals['total_washing'], totals['total_recovery'], totals['total_damage'],
             totals['total_shortage'], totals['total_amount'], datetime.now(), detail['batch_id'])
        )
        conn.commit()
        conn.close()
        return {
            'success': True,
            'detail_id': detail_id,
            'final_amount': final_amount
        }

    def _detect_discrepancy_type(self, washing_quantity: int, recovery_quantity: int,
                                  damage_quantity: int, shortage_quantity: int) -> tuple:
        reasons = []
        discrepancy_type = None
        if shortage_quantity > 0:
            reasons.append(f"短少{shortage_quantity}件")
            discrepancy_type = DiscrepancyType.SHORTAGE.value
        if damage_quantity > 0:
            reasons.append(f"破损{damage_quantity}件")
            if not discrepancy_type:
                discrepancy_type = DiscrepancyType.DAMAGE.value
            else:
                discrepancy_type = DiscrepancyType.MISMATCH.value
        if washing_quantity > 0 and recovery_quantity > washing_quantity:
            over_recovery = recovery_quantity - washing_quantity
            reasons.append(f"多回收{over_recovery}件")
            discrepancy_type = DiscrepancyType.MISMATCH.value
        reason_text = "、".join(reasons) if reasons else ""
        return discrepancy_type, reason_text

    def batch_approve(self, batch_id: int, operator: str) -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM reconciliation_details WHERE batch_id = ?', (batch_id,))
        details = cursor.fetchall()
        for detail in details:
            self.review_detail(detail['id'], ReviewAction.APPROVE.value, "批量审批通过", operator)
        conn.close()
        return {'success': True, 'approved_count': len(details)}


class ReportGenerator:
    def __init__(self, db: Database):
        self.db = db

    def generate_detail_report(self, batch_id: int) -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reconciliation_batches WHERE id = ?', (batch_id,))
        batch = cursor.fetchone()
        if not batch:
            conn.close()
            return {}
        cursor.execute('SELECT * FROM reconciliation_details WHERE batch_id = ? ORDER BY linen_type', (batch_id,))
        details = cursor.fetchall()
        report = {
            'batch_no': batch['batch_no'],
            'period_start': batch['period_start'],
            'period_end': batch['period_end'],
            'status': batch['status'],
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_washing_quantity': batch['total_washing_quantity'],
                'total_recovery_quantity': batch['total_recovery_quantity'],
                'total_damage': batch['total_damage'],
                'total_shortage': batch['total_shortage'],
                'total_amount': batch['total_amount']
            },
            'details': []
        }
        for detail in details:
            detail_report = {
                'linen_type': detail['linen_type'],
                'washing_quantity': detail['washing_quantity'],
                'recovery_quantity': detail['recovery_quantity'],
                'damage_quantity': detail['damage_quantity'],
                'shortage_quantity': detail['shortage_quantity'],
                'unit_price': detail['unit_price'],
                'washing_amount': detail['washing_amount'],
                'shortage_compensation': detail['shortage_compensation'],
                'damage_compensation': detail['damage_compensation'],
                'final_amount': detail['final_amount'],
                'status': detail['status'],
                'discrepancy_type': detail['discrepancy_type'],
                'discrepancy_reason': detail['discrepancy_reason'],
                'review_note': detail['review_note'],
                'reviewed_by': detail['reviewed_by'],
                'reviewed_at': detail['reviewed_at']
            }
            if detail['discrepancy_type']:
                detail_report['discrepancy_explanation'] = self._generate_explanation(detail)
            report['details'].append(detail_report)
        conn.close()
        return report

    def _generate_explanation(self, detail: Dict) -> str:
        explanations = []
        if detail['shortage_quantity'] > 0:
            explanations.append(
                f"【短少赔付】{detail['linen_type']}送洗{detail['washing_quantity']}件，回收{detail['recovery_quantity']}件，"
                f"短少{detail['shortage_quantity']}件，按单价{detail['unit_price']:.2f}元计算，应赔付{detail['shortage_compensation']:.2f}元。"
            )
        if detail['damage_quantity'] > 0:
            explanations.append(
                f"【破损扣减】{detail['linen_type']}回收中发现破损{detail['damage_quantity']}件，"
                f"按单价50%计算，应扣减{detail['damage_compensation']:.2f}元。"
            )
        if detail['recovery_quantity'] > detail['washing_quantity']:
            over = detail['recovery_quantity'] - detail['washing_quantity']
            explanations.append(
                f"【异常说明】{detail['linen_type']}回收数量({detail['recovery_quantity']})多于送洗数量({detail['washing_quantity']})，"
                f"多回收{over}件，请核查是否上期遗留。"
            )
        return "\n".join(explanations)

    def export_csv(self, batch_id: int, file_path: str) -> bool:
        report = self.generate_detail_report(batch_id)
        if not report:
            return False
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['布草对账明细报表'])
            writer.writerow(['对账批次', report['batch_no']])
            writer.writerow(['对账周期', f"{report['period_start']} 至 {report['period_end']}"])
            writer.writerow(['生成时间', report['generated_at']])
            writer.writerow([])
            writer.writerow(['汇总信息'])
            writer.writerow(['总送洗数量', report['summary']['total_washing_quantity']])
            writer.writerow(['总回收数量', report['summary']['total_recovery_quantity']])
            writer.writerow(['总破损数量', report['summary']['total_damage']])
            writer.writerow(['总短少数量', report['summary']['total_shortage']])
            writer.writerow(['总金额(元)', report['summary']['total_amount']])
            writer.writerow([])
            writer.writerow([
                '布草类型', '送洗数量', '回收数量', '破损数量', '短少数量',
                '单价', '送洗金额', '短少赔付', '破损扣减', '最终金额',
                '状态', '差异原因', '复核说明', '差异说明'
            ])
            for detail in report['details']:
                writer.writerow([
                    detail['linen_type'],
                    detail['washing_quantity'],
                    detail['recovery_quantity'],
                    detail['damage_quantity'],
                    detail['shortage_quantity'],
                    detail['unit_price'],
                    detail['washing_amount'],
                    detail['shortage_compensation'],
                    detail['damage_compensation'],
                    detail['final_amount'],
                    detail['status'],
                    detail['discrepancy_reason'] or '',
                    detail['review_note'] or '',
                    detail.get('discrepancy_explanation', '')
                ])
        return True

    def export_json(self, batch_id: int, file_path: str) -> bool:
        report = self.generate_detail_report(batch_id)
        if not report:
            return False
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return True

    def get_review_summary(self, batch_id: int) -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched_count,
                SUM(CASE WHEN status = 'discrepancy' THEN 1 ELSE 0 END) as discrepancy_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                SUM(CASE WHEN discrepancy_type = 'shortage' THEN 1 ELSE 0 END) as shortage_count,
                SUM(CASE WHEN discrepancy_type = 'damage' THEN 1 ELSE 0 END) as damage_count,
                SUM(CASE WHEN discrepancy_type = 'duplicate' THEN 1 ELSE 0 END) as duplicate_count,
                SUM(final_amount) as total_amount
            FROM reconciliation_details 
            WHERE batch_id = ?''',
            (batch_id,)
        )
        summary = cursor.fetchone()
        conn.close()
        return dict(summary) if summary else {}
