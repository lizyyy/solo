import pandas as pd
from datetime import datetime
from typing import List, Dict
from workflow import get_prescription_history
from database import execute_query


def export_prescriptions_to_excel(
    start_date: str = None,
    end_date: str = None,
    status: str = None,
    operator: str = None,
    output_file: str = None
) -> str:
    if not output_file:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f'prescription_export_{timestamp}.xlsx'
    
    prescriptions = get_prescription_history(start_date, end_date, status, operator)
    
    if not prescriptions:
        return "无数据可导出"
    
    prescription_data = []
    for rx in prescriptions:
        prescription_data.append({
            '处方编号': rx['prescription_no'],
            '宠物名称': rx['pet_name'],
            '体重(kg)': rx['pet_weight_kg'],
            '物种': rx['species'],
            '医生': rx['doctor_name'],
            '状态': rx['status'],
            '创建人': rx['created_by'],
            '创建时间': rx['created_at'],
            '更新时间': rx['updated_at']
        })
    
    prescription_df = pd.DataFrame(prescription_data)
    
    item_data = []
    for rx in prescriptions:
        for item in rx['items']:
            item_data.append({
                '处方编号': rx['prescription_no'],
                '药品名称': item['medicine_name'],
                '处方剂量': item['prescribed_dose'],
                '计算剂量': item['calculated_dose'],
                '单位': item['dose_unit'],
                '数量': item['quantity'],
                '批号': item['batch_number'] if item['batch_number'] else '',
                '状态': item['status'],
                '备注': item['notes'] if item['notes'] else ''
            })
    
    item_df = pd.DataFrame(item_data)
    
    workflow_data = []
    for rx in prescriptions:
        logs = execute_query('''
            SELECT * FROM workflow_logs WHERE prescription_id = ? ORDER BY operated_at
        ''', (rx['id'],), fetch=True)
        
        for log in logs:
            workflow_data.append({
                '处方编号': rx['prescription_no'],
                '操作': log['action'],
                '状态': log['status'],
                '原因': log['reason'] if log['reason'] else '',
                '操作人': log['operator'],
                '操作时间': log['operated_at'],
                '原状态': log['previous_status'] if log['previous_status'] else '',
                '新状态': log['new_status'] if log['new_status'] else ''
            })
    
    workflow_df = pd.DataFrame(workflow_data)
    
    audit_data = []
    audits = execute_query('''
        SELECT * FROM audit_trail 
        WHERE table_name = 'prescriptions'
        ORDER BY operated_at DESC
    ''', fetch=True)
    
    for audit in audits:
        audit_data.append({
            '表名': audit['table_name'],
            '记录ID': audit['record_id'],
            '操作类型': audit['operation'],
            '操作人': audit['operator'],
            '操作时间': audit['operated_at']
        })
    
    audit_df = pd.DataFrame(audit_data)
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        prescription_df.to_excel(writer, sheet_name='处方汇总', index=False)
        item_df.to_excel(writer, sheet_name='药品明细', index=False)
        workflow_df.to_excel(writer, sheet_name='操作日志', index=False)
        audit_df.to_excel(writer, sheet_name='审计记录', index=False)
    
    return output_file


def export_dispensing_summary(month: str = None, output_file: str = None) -> str:
    if not month:
        month = datetime.now().strftime('%Y-%m')
    
    if not output_file:
        output_file = f'dispensing_summary_{month}.xlsx'
    
    dispensed = execute_query('''
        SELECT p.prescription_no, p.pet_name, p.pet_weight_kg, p.doctor_name,
               p.created_at as dispensed_at, wl.operator as dispensed_by
        FROM prescriptions p
        JOIN workflow_logs wl ON p.id = wl.prescription_id
        WHERE p.status = 'DISPENSED'
          AND wl.action = 'DISPENSE'
          AND strftime('%Y-%m', p.updated_at) = ?
        ORDER BY p.updated_at
    ''', (month,), fetch=True)
    
    if not dispensed:
        return f"{month} 月无发药记录"
    
    df = pd.DataFrame(dispensed)
    df.rename(columns={
        'prescription_no': '处方编号',
        'pet_name': '宠物名称',
        'pet_weight_kg': '体重(kg)',
        'doctor_name': '医生',
        'dispensed_at': '发药时间',
        'dispensed_by': '发药人'
    }, inplace=True)
    
    df.to_excel(output_file, index=False)
    return output_file
