import pandas as pd
from sqlalchemy.orm import Session
from database import ReconciliationTask, ReconciliationRecord, ReconciliationSummary
from io import BytesIO
from datetime import datetime


def generate_excel_report(db: Session, task_id: int):
    task = db.query(ReconciliationTask).filter(ReconciliationTask.id == task_id).first()
    if not task:
        return None
    
    summary = db.query(ReconciliationSummary).filter(ReconciliationSummary.task_id == task_id).first()
    records = db.query(ReconciliationRecord).filter(ReconciliationRecord.task_id == task_id).order_by(
        ReconciliationRecord.floor, ReconciliationRecord.area
    ).all()
    
    output = BytesIO()
    
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        summary_data = [{
            '对账任务编号': task.task_code,
            '对账任务名称': task.task_name,
            '对账时间': task.completed_at.strftime('%Y-%m-%d %H:%M:%S') if task.completed_at else '',
            '设备总数': summary.total_devices if summary else 0,
            '正常设备数': summary.normal_count if summary else 0,
            '维保过期数': summary.maintenance_overdue_count if summary else 0,
            '多合同设备数': summary.multiple_contracts_count if summary else 0,
            '照片缺失数': summary.photo_missing_count if summary else 0,
            '合同过期数': summary.contract_expired_count if summary else 0,
            '待复核数': summary.needs_review_count if summary else 0,
            '已复核数': summary.reviewed_count if summary else 0,
        }]
        pd.DataFrame(summary_data).T.to_excel(writer, sheet_name='汇总', header=False)
        
        detail_data = []
        for r in records:
            detail_data.append({
                '设备编号': r.device_code,
                '设备类型': r.device_type,
                '设备名称': r.device_name,
                '楼层': r.floor,
                '区域': r.area,
                '合同状态': _get_status_text(r.contract_status),
                '合同数量': r.contract_count,
                '合同到期日': str(r.contract_end_date) if r.contract_end_date else '',
                '维保状态': _get_status_text(r.maintenance_status),
                '上次维保日期': str(r.last_maintenance_date) if r.last_maintenance_date else '',
                '下次维保日期': str(r.next_maintenance_date) if r.next_maintenance_date else '',
                '超期天数': r.maintenance_overdue_days,
                '照片状态': _get_status_text(r.photo_status),
                '照片数量': r.photo_count,
                '最新照片日期': str(r.latest_photo_date) if r.latest_photo_date else '',
                '总体状态': '正常' if r.overall_status == 'normal' else '异常',
                '问题说明': r.issues,
                '是否需复核': '是' if r.needs_review else '否',
                '是否已复核': '是' if r.is_reviewed else '否',
                '复核备注': r.review_notes or '',
                '复核时间': str(r.reviewed_at) if r.reviewed_at else '',
            })
        
        df_detail = pd.DataFrame(detail_data)
        df_detail.to_excel(writer, sheet_name='明细', index=False)
        
        issues_data = [d for d in detail_data if d['总体状态'] == '异常']
        pd.DataFrame(issues_data).to_excel(writer, sheet_name='问题清单', index=False)
        
        review_data = [d for d in detail_data if d['是否已复核'] == '是']
        pd.DataFrame(review_data).to_excel(writer, sheet_name='复核记录', index=False)
        
        workbook = writer.book
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1
        })
        red_format = workbook.add_format({'bg_color': '#FFC7CE', 'font_color': '#9C0006'})
        yellow_format = workbook.add_format({'bg_color': '#FFEB9C', 'font_color': '#9C5700'})
        green_format = workbook.add_format({'bg_color': '#C6EFCE', 'font_color': '#006100'})
        
        for sheet_name in ['明细', '问题清单', '复核记录']:
            worksheet = writer.sheets[sheet_name]
            for col_num, value in enumerate(df_detail.columns.values):
                worksheet.write(0, col_num, value, header_format)
            worksheet.set_column('A:A', 12)
            worksheet.set_column('B:C', 12)
            worksheet.set_column('D:E', 10)
            worksheet.set_column('Q:Q', 30)
            worksheet.set_column('R:R', 15)
    
    output.seek(0)
    return output


def _get_status_text(status):
    status_map = {
        'normal': '正常',
        'missing': '缺失',
        'multiple': '多合同',
        'expired': '已过期',
        'overdue': '已超期',
        'no_record': '无记录'
    }
    return status_map.get(status, status)


def generate_text_summary(db: Session, task_id: int):
    task = db.query(ReconciliationTask).filter(ReconciliationTask.id == task_id).first()
    summary = db.query(ReconciliationSummary).filter(ReconciliationSummary.task_id == task_id).first()
    
    if not task or not summary:
        return None
    
    text = f"""
楼宇维保对账报告
{'='*50}
任务编号: {task.task_code}
任务名称: {task.task_name}
对账时间: {task.completed_at.strftime('%Y-%m-%d %H:%M:%S') if task.completed_at else '进行中'}

{'='*50}
汇总统计:
  设备总数: {summary.total_devices} 台
  正常设备: {summary.normal_count} 台
  维保过期: {summary.maintenance_overdue_count} 台
  多合同设备: {summary.multiple_contracts_count} 台
  照片缺失: {summary.photo_missing_count} 台
  合同过期: {summary.contract_expired_count} 台
  待复核设备: {summary.needs_review_count} 台
  已复核设备: {summary.reviewed_count} 台

{'='*50}
按楼层统计:
"""
    
    records = db.query(ReconciliationRecord).filter(ReconciliationRecord.task_id == task_id).all()
    floor_stats = {}
    for r in records:
        floor = r.floor or '未知楼层'
        if floor not in floor_stats:
            floor_stats[floor] = {'total': 0, 'issues': 0}
        floor_stats[floor]['total'] += 1
        if r.overall_status == 'issue':
            floor_stats[floor]['issues'] += 1
    
    for floor, stats in sorted(floor_stats.items()):
        text += f"  {floor}: {stats['total']}台, 异常{stats['issues']}台\n"
    
    text += f"\n{'='*50}\n报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    
    return text
