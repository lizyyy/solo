from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import io
import xlsxwriter

from . import models, schemas
from .models import (
    ReconciliationStatus, ReviewStatus, DiscrepancyType,
    ReconciliationBatch, ReconciliationRecord, Discrepancy
)


def generate_report_summary(db: Session, batch_id: str) -> Optional[schemas.ReportSummary]:
    """生成报告汇总数据"""
    batch = db.query(ReconciliationBatch).filter(
        ReconciliationBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        return None
    
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_id.like(f"{batch_id}_%")
    ).all()
    
    approved_count = 0
    rejected_count = 0
    needs_more_info_count = 0
    discrepancy_by_type = {}
    
    for record in records:
        if record.review_status == ReviewStatus.APPROVED:
            approved_count += 1
        elif record.review_status == ReviewStatus.REJECTED:
            rejected_count += 1
        elif record.review_status == ReviewStatus.NEEDS_MORE_INFO:
            needs_more_info_count += 1
        
        for disc in record.discrepancies:
            dtype = disc.type.value
            if dtype not in discrepancy_by_type:
                discrepancy_by_type[dtype] = {"total": 0, "resolved": 0, "unresolved": 0}
            discrepancy_by_type[dtype]["total"] += 1
            if disc.is_resolved:
                discrepancy_by_type[dtype]["resolved"] += 1
            else:
                discrepancy_by_type[dtype]["unresolved"] += 1
    
    return schemas.ReportSummary(
        batch_id=batch_id,
        batch_name=batch.name,
        generated_at=datetime.now(),
        total_records=len(records),
        matched_count=batch.matched_count,
        discrepancy_count=batch.discrepancy_count,
        reviewed_count=batch.reviewed_count,
        approved_count=approved_count,
        rejected_count=rejected_count,
        needs_more_info_count=needs_more_info_count,
        discrepancy_by_type=discrepancy_by_type
    )


def generate_report_details(db: Session, batch_id: str) -> Optional[dict]:
    """生成报告详细数据"""
    batch = db.query(ReconciliationBatch).filter(
        ReconciliationBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        return None
    
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_id.like(f"{batch_id}_%")
    ).all()
    
    details = []
    for record in records:
        discrepancies = []
        for disc in record.discrepancies:
            discrepancies.append({
                "id": disc.id,
                "type": disc.type.value,
                "description": disc.description,
                "source": disc.source.value,
                "is_resolved": disc.is_resolved,
                "resolved_reason": disc.resolved_reason
            })
        
        review_histories = []
        for rh in record.review_histories:
            review_histories.append({
                "id": rh.id,
                "reviewer": rh.reviewer,
                "review_time": rh.review_time,
                "status": rh.status.value,
                "comment": rh.comment,
                "explanation": rh.explanation
            })
        
        details.append({
            "record_id": record.id,
            "reconciliation_id": record.reconciliation_id,
            "pole_id": record.pole_id,
            "light_id": record.light_id,
            "status": record.status.value,
            "review_status": record.review_status.value,
            "alarm": {
                "alarm_id": record.alarm.alarm_id,
                "alarm_type": record.alarm.alarm_type,
                "alarm_time": record.alarm.alarm_time,
                "status": record.alarm.status,
                "description": record.alarm.description
            } if record.alarm else None,
            "inspection": {
                "inspection_id": record.inspection.inspection_id,
                "inspector": record.inspection.inspector,
                "inspection_time": record.inspection.inspection_time,
                "status": record.inspection.status,
                "issues_found": record.inspection.issues_found
            } if record.inspection else None,
            "work_order": {
                "order_id": record.work_order.order_id,
                "repair_type": record.work_order.repair_type,
                "reporter": record.work_order.reporter,
                "report_time": record.work_order.report_time,
                "repairer": record.work_order.repairer,
                "repair_time": record.work_order.repair_time,
                "status": record.work_order.status
            } if record.work_order else None,
            "discrepancies": discrepancies,
            "review_histories": review_histories
        })
    
    return {
        "batch_id": batch_id,
        "batch_name": batch.name,
        "generated_at": datetime.now(),
        "summary": {
            "total_records": batch.total_records,
            "matched_count": batch.matched_count,
            "discrepancy_count": batch.discrepancy_count,
            "reviewed_count": batch.reviewed_count
        },
        "records": details
    }


def generate_excel_report(db: Session, batch_id: str) -> bytes:
    """生成Excel格式报告"""
    summary = generate_report_summary(db, batch_id)
    details = generate_report_details(db, batch_id)
    
    if not summary or not details:
        raise ValueError(f"对账批次不存在: {batch_id}")
    
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    header_format = workbook.add_format({
        'bold': True,
        'bg_color': '#4472C4',
        'font_color': 'white',
        'border': 1
    })
    
    title_format = workbook.add_format({
        'bold': True,
        'font_size': 14,
        'bg_color': '#D9E2F3'
    })
    
    normal_format = workbook.add_format({'border': 1})
    wrap_format = workbook.add_format({'border': 1, 'text_wrap': True})
    
    worksheet_summary = workbook.add_worksheet('汇总')
    
    worksheet_summary.write(0, 0, '市政运维对账报告 - 汇总', title_format)
    worksheet_summary.merge_range(0, 0, 0, 3, '市政运维对账报告 - 汇总', title_format)
    
    worksheet_summary.write(2, 0, '批次ID:', header_format)
    worksheet_summary.write(2, 1, summary.batch_id, normal_format)
    worksheet_summary.write(3, 0, '批次名称:', header_format)
    worksheet_summary.write(3, 1, summary.batch_name, normal_format)
    worksheet_summary.write(4, 0, '生成时间:', header_format)
    worksheet_summary.write(4, 1, summary.generated_at.strftime('%Y-%m-%d %H:%M:%S'), normal_format)
    
    row = 6
    worksheet_summary.write(row, 0, '对账统计', title_format)
    worksheet_summary.merge_range(row, 0, row, 1, '对账统计', title_format)
    
    row = 8
    stats = [
        ('总记录数', summary.total_records),
        ('匹配成功', summary.matched_count),
        ('存在差异', summary.discrepancy_count),
        ('已复核', summary.reviewed_count),
        ('已放行', summary.approved_count),
        ('已退回', summary.rejected_count),
        ('需补材料', summary.needs_more_info_count)
    ]
    
    for label, value in stats:
        worksheet_summary.write(row, 0, label, header_format)
        worksheet_summary.write(row, 1, value, normal_format)
        row += 1
    
    row += 2
    worksheet_summary.write(row, 0, '差异类型统计', title_format)
    worksheet_summary.merge_range(row, 0, row, 3, '差异类型统计', title_format)
    
    row += 2
    worksheet_summary.write(row, 0, '差异类型', header_format)
    worksheet_summary.write(row, 1, '总数', header_format)
    worksheet_summary.write(row, 2, '已解决', header_format)
    worksheet_summary.write(row, 3, '未解决', header_format)
    
    row += 1
    for dtype, data in summary.discrepancy_by_type.items():
        worksheet_summary.write(row, 0, _get_discrepancy_type_name(dtype), normal_format)
        worksheet_summary.write(row, 1, data['total'], normal_format)
        worksheet_summary.write(row, 2, data['resolved'], normal_format)
        worksheet_summary.write(row, 3, data['unresolved'], normal_format)
        row += 1
    
    worksheet_details = workbook.add_worksheet('明细')
    
    headers = [
        '对账记录ID', '灯杆ID', '灯具ID', '状态', '复核状态',
        '告警ID', '告警类型', '告警时间',
        '巡查ID', '巡查人', '巡查时间',
        '维修单号', '维修类型', '派单时间',
        '差异说明', '复核意见', '复核说明'
    ]
    
    for col, header in enumerate(headers):
        worksheet_details.write(0, col, header, header_format)
    
    row = 1
    for record in details['records']:
        worksheet_details.write(row, 0, record['reconciliation_id'], normal_format)
        worksheet_details.write(row, 1, record['pole_id'], normal_format)
        worksheet_details.write(row, 2, record['light_id'], normal_format)
        worksheet_details.write(row, 3, _get_status_name(record['status']), normal_format)
        worksheet_details.write(row, 4, _get_review_status_name(record['review_status']), normal_format)
        
        alarm = record.get('alarm')
        if alarm:
            worksheet_details.write(row, 5, alarm['alarm_id'], normal_format)
            worksheet_details.write(row, 6, alarm['alarm_type'], normal_format)
            worksheet_details.write(row, 7, str(alarm['alarm_time']), normal_format)
        
        inspection = record.get('inspection')
        if inspection:
            worksheet_details.write(row, 8, inspection['inspection_id'], normal_format)
            worksheet_details.write(row, 9, inspection['inspector'], normal_format)
            worksheet_details.write(row, 10, str(inspection['inspection_time']), normal_format)
        
        work_order = record.get('work_order')
        if work_order:
            worksheet_details.write(row, 11, work_order['order_id'], normal_format)
            worksheet_details.write(row, 12, work_order['repair_type'], normal_format)
            worksheet_details.write(row, 13, str(work_order['report_time']), normal_format)
        
        discrepancy_descriptions = '; '.join([
            f"{_get_discrepancy_type_name(d['type'])}: {d['description']}"
            for d in record['discrepancies']
        ])
        worksheet_details.write(row, 14, discrepancy_descriptions, wrap_format)
        
        if record['review_histories']:
            latest_review = record['review_histories'][-1]
            worksheet_details.write(row, 15, latest_review['comment'], wrap_format)
            worksheet_details.write(row, 16, latest_review['explanation'], wrap_format)
        
        row += 1
    
    worksheet_discrepancies = workbook.add_worksheet('差异详情')
    
    disc_headers = [
        '对账记录ID', '灯杆ID', '灯具ID', '差异类型',
        '差异描述', '数据来源', '是否已解决', '解决原因'
    ]
    
    for col, header in enumerate(disc_headers):
        worksheet_discrepancies.write(0, col, header, header_format)
    
    row = 1
    for record in details['records']:
        for disc in record['discrepancies']:
            worksheet_discrepancies.write(row, 0, record['reconciliation_id'], normal_format)
            worksheet_discrepancies.write(row, 1, record['pole_id'], normal_format)
            worksheet_discrepancies.write(row, 2, record['light_id'], normal_format)
            worksheet_discrepancies.write(row, 3, _get_discrepancy_type_name(disc['type']), normal_format)
            worksheet_discrepancies.write(row, 4, disc['description'], wrap_format)
            worksheet_discrepancies.write(row, 5, _get_source_name(disc['source']), normal_format)
            worksheet_discrepancies.write(row, 6, '是' if disc['is_resolved'] else '否', normal_format)
            worksheet_discrepancies.write(row, 7, disc['resolved_reason'] or '', wrap_format)
            row += 1
    
    worksheet_trace = workbook.add_worksheet('追踪说明')
    
    trace_headers = ['对账记录ID', '复核时间', '复核人', '复核结果', '复核意见', '复核说明']
    
    for col, header in enumerate(trace_headers):
        worksheet_trace.write(0, col, header, header_format)
    
    row = 1
    for record in details['records']:
        for rh in record['review_histories']:
            worksheet_trace.write(row, 0, record['reconciliation_id'], normal_format)
            worksheet_trace.write(row, 1, str(rh['review_time']), normal_format)
            worksheet_trace.write(row, 2, rh['reviewer'], normal_format)
            worksheet_trace.write(row, 3, _get_review_status_name(rh['status']), normal_format)
            worksheet_trace.write(row, 4, rh['comment'], wrap_format)
            worksheet_trace.write(row, 5, rh['explanation'], wrap_format)
            row += 1
    
    worksheet_summary.set_column('A:A', 15)
    worksheet_summary.set_column('B:B', 20)
    worksheet_details.set_column('A:A', 25)
    worksheet_details.set_column('B:C', 12)
    worksheet_details.set_column('D:E', 12)
    worksheet_details.set_column('F:N', 18)
    worksheet_details.set_column('O:Q', 40)
    worksheet_discrepancies.set_column('A:C', 15)
    worksheet_discrepancies.set_column('D:D', 18)
    worksheet_discrepancies.set_column('E:E', 40)
    worksheet_discrepancies.set_column('F:H', 15)
    worksheet_trace.set_column('A:A', 25)
    worksheet_trace.set_column('B:C', 18)
    worksheet_trace.set_column('D:D', 12)
    worksheet_trace.set_column('E:F', 40)
    
    workbook.close()
    output.seek(0)
    
    return output.getvalue()


def _get_discrepancy_type_name(dtype: str) -> str:
    names = {
        'missing_alarm': '缺少告警记录',
        'missing_inspection': '缺少巡查记录',
        'missing_work_order': '缺少维修单',
        'false_alarm': '疑似误报',
        'multi_light_same_pole': '同杆多灯',
        'repair_retest': '修复复测',
        'status_mismatch': '状态不匹配',
        'time_mismatch': '时间不匹配'
    }
    return names.get(dtype, dtype)


def _get_status_name(status: str) -> str:
    names = {
        'matched': '匹配成功',
        'discrepancy': '存在差异',
        'reviewed': '已复核'
    }
    return names.get(status, status)


def _get_review_status_name(status: str) -> str:
    names = {
        'pending': '待复核',
        'approved': '已放行',
        'rejected': '已退回',
        'needs_more_info': '需补材料'
    }
    return names.get(status, status)


def _get_source_name(source: str) -> str:
    names = {
        'alarm': '告警系统',
        'inspection': '巡查记录',
        'work_order': '维修系统'
    }
    return names.get(source, source)
