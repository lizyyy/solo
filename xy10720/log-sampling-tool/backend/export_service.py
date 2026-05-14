import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import models


ERROR_STATUS_MAP = {
    "pending": "待处理",
    "analyzed": "已分析",
    "resolved": "已解决",
    "none": "无错误"
}

STATUS_MAP = {
    "active": "生效中",
    "inactive": "已停用",
    "archived": "已归档"
}


def format_for_export(records: List[models.LogSamplingRecord]) -> List[dict]:
    export_data = []
    for record in records:
        error_status = ERROR_STATUS_MAP.get(record.error_fragment_status, record.error_fragment_status)
        status = STATUS_MAP.get(record.status, record.status)
        confirmed_status = "是" if record.is_manually_confirmed else "否"

        row = {
            "序号": record.id,
            "服务名称": record.service_name,
            "采样规则": record.sampling_rule,
            "Trace ID": record.trace_id or "-",
            "错误片段": record.error_fragment or "-",
            "错误状态": error_status,
            "排障摘要": record.troubleshooting_summary or "-",
            "是否人工确认": confirmed_status,
            "确认人": record.confirmed_by or "-",
            "确认时间": record.confirmed_at.strftime("%Y-%m-%d %H:%M:%S") if record.confirmed_at else "-",
            "创建人": record.created_by or "-",
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "-",
            "更新时间": record.updated_at.strftime("%Y-%m-%d %H:%M:%S") if record.updated_at else "-",
            "记录状态": status,
        }
        export_data.append(row)
    return export_data


def export_to_excel(records: List[models.LogSamplingRecord]) -> BytesIO:
    export_data = format_for_export(records)

    if not export_data:
        df = pd.DataFrame(columns=[
            "序号", "服务名称", "采样规则", "Trace ID", "错误片段",
            "错误状态", "排障摘要", "是否人工确认", "确认人", "确认时间",
            "创建人", "创建时间", "更新时间", "记录状态"
        ])
    else:
        df = pd.DataFrame(export_data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="日志采样记录", index=False)

        workbook = writer.book
        worksheet = writer.sheets["日志采样记录"]

        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except Exception:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width

    output.seek(0)
    return output


def get_export_records(
    db: Session,
    record_ids: Optional[List[int]] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    service_name: Optional[str] = None,
) -> List[models.LogSamplingRecord]:
    query = db.query(models.LogSamplingRecord)

    if record_ids:
        query = query.filter(models.LogSamplingRecord.id.in_(record_ids))
    if start_date:
        query = query.filter(models.LogSamplingRecord.created_at >= start_date)
    if end_date:
        query = query.filter(models.LogSamplingRecord.created_at <= end_date)
    if service_name:
        query = query.filter(models.LogSamplingRecord.service_name.contains(service_name))

    return query.order_by(models.LogSamplingRecord.created_at.desc()).all()


def generate_export_summary(records: List[models.LogSamplingRecord]) -> dict:
    total_records = len(records)
    error_count = sum(1 for r in records if r.error_fragment_status != "none")
    confirmed_count = sum(1 for r in records if r.is_manually_confirmed)
    services = list(set(r.service_name for r in records))

    return {
        "导出时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "记录总数": total_records,
        "含错误记录数": error_count,
        "已人工确认数": confirmed_count,
        "涉及服务数": len(services),
        "服务列表": ", ".join(services),
    }
