import json
from datetime import datetime
from typing import Dict, List, Optional
from database import execute_query, get_connection
from business_rules import validate_prescription, validate_prescription_item, calculate_dose


PRESCRIPTION_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'BLOCKED', 'APPROVED', 'DISPENSED', 'CANCELLED']
ITEM_STATUSES = ['PENDING', 'BLOCKED', 'APPROVED', 'DISPENSED', 'CANCELLED']


def log_workflow(
    prescription_id: Optional[int],
    prescription_item_id: Optional[int],
    action: str,
    status: str,
    reason: str,
    operator: str,
    previous_status: str = None,
    new_status: str = None,
    details: Dict = None
):
    details_json = json.dumps(details) if details else None
    
    execute_query('''
        INSERT INTO workflow_logs 
        (prescription_id, prescription_item_id, action, status, reason, operator, 
         previous_status, new_status, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        prescription_id, prescription_item_id, action, status, reason, operator,
        previous_status, new_status, details_json
    ))


def log_audit(table_name: str, record_id: int, operation: str, old_values: Dict, new_values: Dict, operator: str):
    old_json = json.dumps(old_values) if old_values else None
    new_json = json.dumps(new_values) if new_values else None
    
    execute_query('''
        INSERT INTO audit_trail 
        (table_name, record_id, operation, old_values, new_values, operator)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (table_name, record_id, operation, old_json, new_json, operator))


def generate_prescription_no() -> str:
    today = datetime.now().strftime('%Y%m%d')
    last = execute_query('''
        SELECT prescription_no FROM prescriptions 
        WHERE prescription_no LIKE ? 
        ORDER BY prescription_no DESC LIMIT 1
    ''', (f'RX{today}%',), fetch=True)
    
    if last:
        seq = int(last[0]['prescription_no'][-4:]) + 1
    else:
        seq = 1
    
    return f'RX{today}{seq:04d}'


def create_prescription(
    pet_name: str,
    pet_weight_kg: float,
    species: str,
    doctor_name: str,
    created_by: str,
    items: List[Dict]
) -> Dict:
    prescription_no = generate_prescription_no()
    
    existing = execute_query('''
        SELECT id FROM prescriptions WHERE prescription_no = ?
    ''', (prescription_no,), fetch=True)
    
    if existing:
        return {
            "success": False,
            "reason": f"处方号 {prescription_no} 已存在，防止重复提交"
        }
    
    prescription_id = execute_query('''
        INSERT INTO prescriptions 
        (prescription_no, pet_name, pet_weight_kg, species, doctor_name, status, created_by)
        VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)
    ''', (prescription_no, pet_name, pet_weight_kg, species, doctor_name, created_by))
    
    for item in items:
        medicine_id = item['medicine_id']
        prescribed_dose = item['prescribed_dose']
        
        _, calculated_dose, _ = calculate_dose(medicine_id, pet_weight_kg)
        
        execute_query('''
            INSERT INTO prescription_items 
            (prescription_id, medicine_id, prescribed_dose, dose_unit, calculated_dose, quantity, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            prescription_id, medicine_id, prescribed_dose, 
            item.get('dose_unit', 'mg'), calculated_dose,
            item.get('quantity', 1), item.get('notes', '')
        ))
    
    log_workflow(
        prescription_id, None, 'CREATE', 'DRAFT',
        '创建处方草稿', created_by, None, 'DRAFT'
    )
    
    log_audit('prescriptions', prescription_id, 'INSERT', None, {
        'prescription_no': prescription_no,
        'pet_name': pet_name,
        'pet_weight_kg': pet_weight_kg
    }, created_by)
    
    return {
        "success": True,
        "prescription_id": prescription_id,
        "prescription_no": prescription_no
    }


def submit_prescription(prescription_id: int, operator: str) -> Dict:
    prescription = execute_query('''
        SELECT * FROM prescriptions WHERE id = ?
    ''', (prescription_id,), fetch=True)
    
    if not prescription:
        return {"success": False, "reason": "处方不存在"}
    
    prev_status = prescription[0]['status']
    
    if prev_status == 'SUBMITTED':
        return {
            "success": False,
            "reason": "处方已提交，防止重复提交",
            "prescription_id": prescription_id
        }
    
    if prev_status not in ['DRAFT']:
        return {
            "success": False,
            "reason": f"当前状态 {prev_status} 不允许提交"
        }
    
    validation = validate_prescription(prescription_id)
    
    execute_query('''
        UPDATE prescriptions SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (prescription_id,))
    
    new_status = 'SUBMITTED'
    
    log_workflow(
        prescription_id, None, 'SUBMIT', new_status,
        '提交处方审核', operator, prev_status, new_status,
        validation
    )
    
    log_audit('prescriptions', prescription_id, 'UPDATE',
              {'status': prev_status}, {'status': new_status}, operator)
    
    return {
        "success": True,
        "prescription_id": prescription_id,
        "validation": validation,
        "previous_status": prev_status,
        "new_status": new_status
    }


def review_prescription(prescription_id: int, operator: str, approve: bool, reason: str = "") -> Dict:
    prescription = execute_query('''
        SELECT * FROM prescriptions WHERE id = ?
    ''', (prescription_id,), fetch=True)
    
    if not prescription:
        return {"success": False, "reason": "处方不存在"}
    
    prev_status = prescription[0]['status']
    
    if prev_status not in ['SUBMITTED', 'UNDER_REVIEW']:
        return {
            "success": False,
            "reason": f"当前状态 {prev_status} 不允许审核"
        }
    
    validation = validate_prescription(prescription_id)
    
    if approve and not validation['overall_passed']:
        return {
            "success": False,
            "reason": "验证未通过，无法批准: " + "; ".join([
                item['dose_validation']['reason'] 
                for item in validation['items'] 
                if not item['dose_validation']['passed']
            ])
        }
    
    new_status = 'APPROVED' if approve else 'BLOCKED'
    action = 'APPROVE' if approve else 'BLOCK'
    log_reason = reason if reason else ('审核通过' if approve else '审核拦截')
    
    execute_query('''
        UPDATE prescriptions SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (new_status, prescription_id))
    
    item_new_status = 'APPROVED' if approve else 'BLOCKED'
    items = execute_query('''
        SELECT id FROM prescription_items WHERE prescription_id = ?
    ''', (prescription_id,), fetch=True)
    
    for item in items:
        execute_query('''
            UPDATE prescription_items SET status = ? WHERE id = ?
        ''', (item_new_status, item['id']))
        
        log_workflow(
            prescription_id, item['id'], action, item_new_status,
            log_reason, operator, 'PENDING', item_new_status
        )
    
    log_workflow(
        prescription_id, None, action, new_status,
        log_reason, operator, prev_status, new_status,
        validation
    )
    
    log_audit('prescriptions', prescription_id, 'UPDATE',
              {'status': prev_status}, {'status': new_status}, operator)
    
    return {
        "success": True,
        "prescription_id": prescription_id,
        "previous_status": prev_status,
        "new_status": new_status,
        "validation": validation,
        "reason": log_reason
    }


def dispense_prescription(prescription_id: int, operator: str, batch_assignments: Dict[int, int] = None) -> Dict:
    prescription = execute_query('''
        SELECT * FROM prescriptions WHERE id = ?
    ''', (prescription_id,), fetch=True)
    
    if not prescription:
        return {"success": False, "reason": "处方不存在"}
    
    prev_status = prescription[0]['status']
    
    if prev_status != 'APPROVED':
        return {
            "success": False,
            "reason": f"当前状态 {prev_status} 不允许发药，需要先批准"
        }
    
    items = execute_query('''
        SELECT pi.*, m.name as medicine_name
        FROM prescription_items pi
        JOIN medicines m ON pi.medicine_id = m.id
        WHERE pi.prescription_id = ?
    ''', (prescription_id,), fetch=True)
    
    batch_info_list = []
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        for item in items:
            batch_id = batch_assignments.get(item['id']) if batch_assignments else None
            
            if not batch_id:
                available_batches = cursor.execute('''
                    SELECT id, batch_number FROM medicine_batches 
                    WHERE medicine_id = ? AND quantity >= ? AND expiry_date >= DATE('now')
                    ORDER BY expiry_date ASC LIMIT 1
                ''', (item['medicine_id'], item['quantity'])).fetchall()
                
                if not available_batches:
                    conn.rollback()
                    conn.close()
                    return {
                        "success": False,
                        "reason": f"药品 {item['medicine_name']} 无有效批号或库存不足"
                    }
                
                batch_id = available_batches[0]['id']
                batch_number = available_batches[0]['batch_number']
            else:
                cursor.execute('''
                    SELECT quantity, batch_number FROM medicine_batches WHERE id = ?
                ''', (batch_id,))
                batch = cursor.fetchone()
                batch_number = batch['batch_number']
                
                if batch['quantity'] < item['quantity']:
                    conn.rollback()
                    conn.close()
                    return {
                        "success": False,
                        "reason": f"批号 {batch_number} 库存不足"
                    }
            
            batch_info_list.append({
                'item_id': item['id'],
                'batch_id': batch_id,
                'batch_number': batch_number
            })
            
            cursor.execute('''
                UPDATE medicine_batches 
                SET quantity = quantity - ?
                WHERE id = ?
            ''', (item['quantity'], batch_id))
            
            cursor.execute('''
                UPDATE prescription_items 
                SET batch_id = ?, status = 'DISPENSED'
                WHERE id = ?
            ''', (batch_id, item['id']))
        
        cursor.execute('''
            UPDATE prescriptions SET status = 'DISPENSED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (prescription_id,))
        
        conn.commit()
        conn.close()
        
        for batch_info in batch_info_list:
            log_workflow(
                prescription_id, batch_info['item_id'], 'DISPENSE', 'DISPENSED',
                f"发药完成，批号 {batch_info['batch_number']}", operator,
                'APPROVED', 'DISPENSED',
                {"batch_id": batch_info['batch_id'], "batch_number": batch_info['batch_number']}
            )
        
        log_workflow(
            prescription_id, None, 'DISPENSE', 'DISPENSED',
            '处方发药完成', operator, prev_status, 'DISPENSED'
        )
        
        log_audit('prescriptions', prescription_id, 'UPDATE',
                  {'status': prev_status}, {'status': 'DISPENSED'}, operator)
        
        return {
            "success": True,
            "prescription_id": prescription_id,
            "previous_status": prev_status,
            "new_status": 'DISPENSED'
        }
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return {"success": False, "reason": str(e)}


def trace_prescription(prescription_id: int) -> Dict:
    prescription = execute_query('''
        SELECT * FROM prescriptions WHERE id = ?
    ''', (prescription_id,), fetch=True)
    
    if not prescription:
        return {"success": False, "reason": "处方不存在"}
    
    items = execute_query('''
        SELECT pi.*, m.name as medicine_name, mb.batch_number
        FROM prescription_items pi
        JOIN medicines m ON pi.medicine_id = m.id
        LEFT JOIN medicine_batches mb ON pi.batch_id = mb.id
        WHERE pi.prescription_id = ?
    ''', (prescription_id,), fetch=True)
    
    logs = execute_query('''
        SELECT * FROM workflow_logs 
        WHERE prescription_id = ?
        ORDER BY operated_at ASC
    ''', (prescription_id,), fetch=True)
    
    for log in logs:
        if log['details']:
            log['details'] = json.loads(log['details'])
    
    return {
        "success": True,
        "prescription": prescription[0],
        "items": items,
        "workflow_logs": logs
    }


def get_prescription_history(
    start_date: str = None,
    end_date: str = None,
    status: str = None,
    operator: str = None
) -> List[Dict]:
    query = 'SELECT * FROM prescriptions WHERE 1=1'
    params = []
    
    if start_date:
        query += ' AND DATE(created_at) >= ?'
        params.append(start_date)
    
    if end_date:
        query += ' AND DATE(created_at) <= ?'
        params.append(end_date)
    
    if status:
        query += ' AND status = ?'
        params.append(status)
    
    if operator:
        query += ' AND created_by = ?'
        params.append(operator)
    
    query += ' ORDER BY created_at DESC'
    
    prescriptions = execute_query(query, tuple(params), fetch=True)
    
    for rx in prescriptions:
        rx['items'] = execute_query('''
            SELECT pi.*, m.name as medicine_name, mb.batch_number
            FROM prescription_items pi
            JOIN medicines m ON pi.medicine_id = m.id
            LEFT JOIN medicine_batches mb ON pi.batch_id = mb.id
            WHERE pi.prescription_id = ?
        ''', (rx['id'],), fetch=True)
    
    return prescriptions


def cancel_prescription(prescription_id: int, operator: str, reason: str) -> Dict:
    prescription = execute_query('''
        SELECT * FROM prescriptions WHERE id = ?
    ''', (prescription_id,), fetch=True)
    
    if not prescription:
        return {"success": False, "reason": "处方不存在"}
    
    prev_status = prescription[0]['status']
    
    if prev_status == 'DISPENSED':
        return {
            "success": False,
            "reason": "已发药处方不能取消"
        }
    
    execute_query('''
        UPDATE prescriptions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (prescription_id,))
    
    execute_query('''
        UPDATE prescription_items SET status = 'CANCELLED'
        WHERE prescription_id = ?
    ''', (prescription_id,))
    
    log_workflow(
        prescription_id, None, 'CANCEL', 'CANCELLED',
        reason, operator, prev_status, 'CANCELLED'
    )
    
    log_audit('prescriptions', prescription_id, 'UPDATE',
              {'status': prev_status}, {'status': 'CANCELLED'}, operator)
    
    return {
        "success": True,
        "prescription_id": prescription_id,
        "previous_status": prev_status,
        "new_status": 'CANCELLED',
        "reason": reason
    }
