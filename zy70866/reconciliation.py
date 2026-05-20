from collections import defaultdict
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from models import Database, RecordStatus, DiscrepancyType, ReviewAction


class ReconciliationEngine:
    def __init__(self, db: Database):
        self.db = db

    def create_reconciliation_batch(self, period_start: str, period_end: str) -> int:
        batch_no = f"RC{datetime.now().strftime('%Y%m%d%H%M%S')}"
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO reconciliation_batches 
               (batch_no, period_start, period_end, status) VALUES (?, ?, ?, ?)''',
            (batch_no, period_start, period_end, RecordStatus.PENDING.value)
        )
        batch_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return batch_id

    def aggregate_washing_data(self, start_date: str, end_date: str) -> Dict[str, Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''SELECT linen_type, 
                       SUM(quantity) as total_quantity, 
                       AVG(unit_price) as avg_price,
                       SUM(total_amount) as total_amount
                FROM washing_records 
                WHERE send_date BETWEEN ? AND ? 
                GROUP BY linen_type''',
            (start_date, end_date)
        )
        rows = cursor.fetchall()
        conn.close()
        result = {}
        for row in rows:
            result[row['linen_type']] = {
                'quantity': row['total_quantity'],
                'unit_price': row['avg_price'],
                'amount': row['total_amount']
            }
        return result

    def aggregate_recovery_data(self, start_date: str, end_date: str) -> Dict[str, Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''SELECT linen_type, 
                       SUM(clean_quantity) as clean_quantity,
                       SUM(damaged_quantity) as damaged_quantity,
                       SUM(lost_quantity) as lost_quantity
                FROM recovery_records 
                WHERE recovery_date BETWEEN ? AND ? 
                GROUP BY linen_type''',
            (start_date, end_date)
        )
        rows = cursor.fetchall()
        conn.close()
        result = {}
        for row in rows:
            total_recovery = row['clean_quantity'] + row['damaged_quantity'] + row['lost_quantity']
            result[row['linen_type']] = {
                'clean_quantity': row['clean_quantity'],
                'damaged_quantity': row['damaged_quantity'],
                'lost_quantity': row['lost_quantity'],
                'total_recovery': total_recovery
            }
        return result

    def calculate_discrepancies(self, washing_data: Dict, recovery_data: Dict) -> Dict:
        all_linen_types = set(washing_data.keys()) | set(recovery_data.keys())
        result = {}
        for linen_type in all_linen_types:
            washing = washing_data.get(linen_type, {'quantity': 0, 'unit_price': 0, 'amount': 0})
            recovery = recovery_data.get(linen_type, {
                'clean_quantity': 0, 'damaged_quantity': 0,
                'lost_quantity': 0, 'total_recovery': 0
            })
            washing_quantity = washing['quantity']
            recovery_quantity = recovery['total_recovery']
            damage_quantity = recovery['damaged_quantity']
            shortage_quantity = max(0, washing_quantity - recovery_quantity)
            unit_price = washing['unit_price'] if washing['unit_price'] > 0 else 0
            washing_amount = washing['amount']
            shortage_compensation = shortage_quantity * unit_price
            damage_compensation = damage_quantity * unit_price * 0.5
            final_amount = washing_amount - shortage_compensation - damage_compensation
            result[linen_type] = {
                'washing_quantity': washing_quantity,
                'recovery_quantity': recovery_quantity,
                'damage_quantity': damage_quantity,
                'shortage_quantity': shortage_quantity,
                'unit_price': unit_price,
                'washing_amount': washing_amount,
                'shortage_compensation': shortage_compensation,
                'damage_compensation': damage_compensation,
                'final_amount': final_amount
            }
        return result

    def detect_discrepancy_type(self, washing_quantity: int, recovery_quantity: int,
                                 damage_quantity: int, shortage_quantity: int) -> Tuple[Optional[str], str]:
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
        if washing_quantity == 0 and recovery_quantity > 0:
            reasons.append("无送洗记录但有回收")
            discrepancy_type = DiscrepancyType.MISMATCH.value
        if recovery_quantity == 0 and washing_quantity > 0:
            reasons.append("无回收记录")
            discrepancy_type = DiscrepancyType.MISMATCH.value
        reason_text = "、".join(reasons) if reasons else ""
        return discrepancy_type, reason_text

    def run_reconciliation(self, batch_id: int) -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT period_start, period_end FROM reconciliation_batches WHERE id = ?', (batch_id,))
        batch = cursor.fetchone()
        if not batch:
            conn.close()
            return {'success': False, 'message': '对账批次不存在'}
        period_start = batch['period_start']
        period_end = batch['period_end']
        washing_data = self.aggregate_washing_data(period_start, period_end)
        recovery_data = self.aggregate_recovery_data(period_start, period_end)
        discrepancies = self.calculate_discrepancies(washing_data, recovery_data)
        total_washing = 0
        total_recovery = 0
        total_damage = 0
        total_shortage = 0
        total_amount = 0
        for linen_type, data in discrepancies.items():
            discrepancy_type, discrepancy_reason = self.detect_discrepancy_type(
                data['washing_quantity'], data['recovery_quantity'],
                data['damage_quantity'], data['shortage_quantity']
            )
            status = RecordStatus.MATCHED.value if not discrepancy_type else RecordStatus.DISCREPANCY.value
            cursor.execute(
                '''INSERT INTO reconciliation_details 
                   (batch_id, linen_type, washing_quantity, recovery_quantity, damage_quantity,
                    shortage_quantity, unit_price, washing_amount, shortage_compensation,
                    damage_compensation, final_amount, status, discrepancy_type, discrepancy_reason)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (batch_id, linen_type, data['washing_quantity'], data['recovery_quantity'],
                 data['damage_quantity'], data['shortage_quantity'], data['unit_price'],
                 data['washing_amount'], data['shortage_compensation'], data['damage_compensation'],
                 data['final_amount'], status, discrepancy_type, discrepancy_reason)
            )
            detail_id = cursor.lastrowid
            if discrepancy_type:
                self._create_discrepancy_logs(cursor, detail_id, linen_type, data, discrepancy_type)
            total_washing += data['washing_quantity']
            total_recovery += data['recovery_quantity']
            total_damage += data['damage_quantity']
            total_shortage += data['shortage_quantity']
            total_amount += data['final_amount']
        cursor.execute(
            '''UPDATE reconciliation_batches 
               SET total_washing_quantity = ?, total_recovery_quantity = ?, 
                   total_damage = ?, total_shortage = ?, total_amount = ?, 
                   status = ?, updated_at = ?
               WHERE id = ?''',
            (total_washing, total_recovery, total_damage, total_shortage, total_amount,
             RecordStatus.PENDING.value, datetime.now(), batch_id)
        )
        conn.commit()
        conn.close()
        return {
            'success': True,
            'batch_id': batch_id,
            'total_items': len(discrepancies),
            'total_washing': total_washing,
            'total_recovery': total_recovery,
            'total_damage': total_damage,
            'total_shortage': total_shortage,
            'total_amount': total_amount
        }

    def _create_discrepancy_logs(self, cursor, detail_id: int, linen_type: str, data: Dict, discrepancy_type: str):
        if data['shortage_quantity'] > 0:
            cursor.execute(
                '''INSERT INTO discrepancy_logs 
                   (detail_id, discrepancy_type, description, expected_value, actual_value, difference)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (detail_id, DiscrepancyType.SHORTAGE.value,
                 f"{linen_type}短少{data['shortage_quantity']}件，应赔付{data['shortage_compensation']:.2f}元",
                 data['washing_quantity'], data['recovery_quantity'], data['shortage_quantity'])
            )
        if data['damage_quantity'] > 0:
            cursor.execute(
                '''INSERT INTO discrepancy_logs 
                   (detail_id, discrepancy_type, description, expected_value, actual_value, difference)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (detail_id, DiscrepancyType.DAMAGE.value,
                 f"{linen_type}破损{data['damage_quantity']}件，应扣减{data['damage_compensation']:.2f}元",
                 0, data['damage_quantity'], data['damage_quantity'])
            )

    def get_reconciliation_details(self, batch_id: int) -> List[Dict]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reconciliation_details WHERE batch_id = ? ORDER BY linen_type', (batch_id,))
        rows = cursor.fetchall()
        details = []
        for row in rows:
            detail = dict(row)
            cursor.execute('SELECT * FROM discrepancy_logs WHERE detail_id = ?', (row['id'],))
            logs = cursor.fetchall()
            detail['discrepancy_logs'] = [dict(log) for log in logs]
            cursor.execute('SELECT * FROM review_history WHERE detail_id = ? ORDER BY created_at DESC', (row['id'],))
            reviews = cursor.fetchall()
            detail['review_history'] = [dict(r) for r in reviews]
            details.append(detail)
        conn.close()
        return details

    def get_reconciliation_summary(self, batch_id: int) -> Dict:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reconciliation_batches WHERE id = ?', (batch_id,))
        batch = cursor.fetchone()
        if not batch:
            conn.close()
            return {}
        cursor.execute(
            '''SELECT status, COUNT(*) as count, SUM(final_amount) as amount 
               FROM reconciliation_details 
               WHERE batch_id = ? 
               GROUP BY status''',
            (batch_id,)
        )
        status_summary = cursor.fetchall()
        conn.close()
        return {
            'batch_info': dict(batch),
            'status_summary': [dict(s) for s in status_summary]
        }
