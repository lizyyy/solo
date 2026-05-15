import json
from typing import List, Optional
from datetime import datetime
from .models import MigrationRecord, Status
from .service import get_effective_status
from .storage import DateTimeEncoder

def record_to_json(record: MigrationRecord) -> str:
    data = {
        "receipt_id": record.receipt.receipt_id,
        "device_id": record.receipt.device_id,
        "device_name": record.receipt.device_name,
        "receipt_type": record.receipt.receipt_type,
        "received_date": record.receipt.received_date,
        "operator": record.receipt.operator,
        "original_input": record.receipt.original_input,
        "attachments": [
            {
                "id": a.id,
                "name": a.name,
                "upload_date": a.upload_date,
                "expire_date": a.expire_date,
                "is_expired": a.is_expired
            } for a in record.receipt.attachments
        ],
        "system_judgment": {
            "status": record.system_judgment.status.value if record.system_judgment else None,
            "issues": record.system_judgment.issues if record.system_judgment else [],
            "judgment_time": record.system_judgment.judgment_time if record.system_judgment else None
        },
        "manual_correction": {
            "operator": record.manual_correction.operator if record.manual_correction else None,
            "correction_note": record.manual_correction.correction_note if record.manual_correction else None,
            "corrected_status": record.manual_correction.corrected_status.value if record.manual_correction and record.manual_correction.corrected_status else None,
            "correction_time": record.manual_correction.correction_time if record.manual_correction else None
        },
        "effective_status": get_effective_status(record).value,
        "material_summary": record.material_summary.summary_text if record.material_summary else None,
        "change_histories": [
            {
                "resource_scope": ch.resource_scope,
                "change_type": ch.change_type,
                "change_reason": ch.change_reason,
                "operator": ch.operator,
                "change_time": ch.change_time,
                "previous_value": ch.previous_value,
                "new_value": ch.new_value
            } for ch in record.change_histories
        ]
    }
    return json.dumps(data, cls=DateTimeEncoder, ensure_ascii=False, indent=2)

def records_to_json(records: List[MigrationRecord]) -> str:
    data = []
    for record in records:
        data.append(json.loads(record_to_json(record)))
    return json.dumps(data, ensure_ascii=False, indent=2)

def record_to_markdown(record: MigrationRecord) -> str:
    lines = []
    lines.append(f"# 数据库迁移记录 - {record.receipt.device_name}")
    lines.append("")
    lines.append("## 基本信息")
    lines.append(f"- **回执ID**: {record.receipt.receipt_id}")
    lines.append(f"- **设备ID**: {record.receipt.device_id}")
    lines.append(f"- **设备名称**: {record.receipt.device_name}")
    lines.append(f"- **回执类型**: {record.receipt.receipt_type}")
    lines.append(f"- **接收日期**: {record.receipt.received_date.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"- **操作人员**: {record.receipt.operator}")
    lines.append("")

    lines.append("## 原始输入字段")
    for key, value in record.receipt.original_input.items():
        lines.append(f"- **{key}**: {value}")
    lines.append("")

    lines.append("## 附件列表")
    if record.receipt.attachments:
        for att in record.receipt.attachments:
            status = "已过期" if att.is_expired else "正常"
            expire_str = att.expire_date.strftime('%Y-%m-%d') if att.expire_date else "无过期时间"
            lines.append(f"- **{att.name}** (上传: {att.upload_date.strftime('%Y-%m-%d')}, 过期: {expire_str}) - {status}")
    else:
        lines.append("- 无附件")
    lines.append("")

    lines.append("## 系统判断")
    if record.system_judgment:
        lines.append(f"- **状态**: {record.system_judgment.status.value}")
        lines.append(f"- **判断时间**: {record.system_judgment.judgment_time.strftime('%Y-%m-%d %H:%M:%S')}")
        if record.system_judgment.issues:
            lines.append("- **问题列表**:")
            for issue in record.system_judgment.issues:
                lines.append(f"  - {issue}")
    else:
        lines.append("- 无系统判断")
    lines.append("")

    lines.append("## 人工修正")
    if record.manual_correction:
        lines.append(f"- **操作人员**: {record.manual_correction.operator}")
        lines.append(f"- **修正备注**: {record.manual_correction.correction_note}")
        if record.manual_correction.corrected_status:
            lines.append(f"- **修正状态**: {record.manual_correction.corrected_status.value}")
        lines.append(f"- **修正时间**: {record.manual_correction.correction_time.strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        lines.append("- 无人工修正")
    lines.append("")

    lines.append("## 最终生效状态")
    lines.append(f"- **{get_effective_status(record).value}**")
    lines.append("")

    if record.material_summary:
        lines.append("## 材料摘要")
        lines.append(record.material_summary.summary_text)
        lines.append("")

    if record.change_histories:
        lines.append("## 变更历史")
        for ch in record.change_histories:
            lines.append(f"- **[{ch.resource_scope}]** {ch.change_type} - {ch.change_reason}")
            lines.append(f"  - 操作人员: {ch.operator}")
            lines.append(f"  - 变更时间: {ch.change_time.strftime('%Y-%m-%d %H:%M:%S')}")
            if ch.previous_value is not None:
                lines.append(f"  - 原值: {ch.previous_value}")
            if ch.new_value is not None:
                lines.append(f"  - 新值: {ch.new_value}")
        lines.append("")

    return "\n".join(lines)

def records_to_markdown(records: List[MigrationRecord], title: str = "数据库迁移清单") -> str:
    lines = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**记录总数**: {len(records)}")
    lines.append("")
    lines.append("---")
    lines.append("")

    normal_count = sum(1 for r in records if get_effective_status(r) == Status.NORMAL)
    abnormal_count = sum(1 for r in records if get_effective_status(r) == Status.ABNORMAL)
    pending_count = sum(1 for r in records if get_effective_status(r) == Status.PENDING)

    lines.append("## 统计汇总")
    lines.append(f"- 正常: {normal_count}")
    lines.append(f"- 异常: {abnormal_count}")
    lines.append(f"- 待处理: {pending_count}")
    lines.append("")
    lines.append("---")
    lines.append("")

    for record in records:
        lines.append(record_to_markdown(record))
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)

def export_to_file(records: List[MigrationRecord], filepath: str, format: str = "json"):
    if format == "json":
        content = records_to_json(records)
    elif format == "markdown" or format == "md":
        content = records_to_markdown(records)
    else:
        raise ValueError(f"不支持的格式: {format}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
