import json
from typing import Any, Dict, List
from datetime import datetime

from .models import HandoverRecord


class OutputFormatter:
    @staticmethod
    def to_dict(record: HandoverRecord) -> Dict[str, Any]:
        return {
            "id": record.id,
            "title": record.title,
            "description": record.description,
            "operator": record.operator,
            "status": record.status.value,
            "materials": [
                {
                    "id": m.id,
                    "name": m.name,
                    "type": m.type,
                    "content": m.content,
                    "attachments": [
                        {
                            "id": a.id,
                            "name": a.name,
                            "status": a.status.value,
                            "expire_time": a.expire_time.isoformat() if a.expire_time else None
                        }
                        for a in m.attachments
                    ]
                }
                for m in record.materials
            ],
            "system_judgment": {
                "is_abnormal": record.system_judgment.is_abnormal,
                "reason": record.system_judgment.reason,
                "details": record.system_judgment.details
            } if record.system_judgment else None,
            "remarks": [
                {
                    "content": r.content,
                    "operator": r.operator,
                    "created_at": r.created_at.isoformat(),
                    "reason": r.reason
                }
                for r in record.remarks
            ],
            "manual_corrections": [
                {
                    "operator": c.operator,
                    "correction_type": c.correction_type,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "reason": c.reason,
                    "created_at": c.created_at.isoformat(),
                    "resource_scope": c.resource_scope
                }
                for c in record.manual_corrections
            ],
            "created_at": record.created_at.isoformat(),
            "updated_at": record.updated_at.isoformat()
        }

    @staticmethod
    def to_json(records: List[HandoverRecord], pretty: bool = True) -> str:
        data = [OutputFormatter.to_dict(r) for r in records]
        indent = 2 if pretty else None
        return json.dumps(data, ensure_ascii=False, indent=indent)

    @staticmethod
    def to_markdown(records: List[HandoverRecord]) -> str:
        lines = []
        lines.append("# 仓库交接单记录\n")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        for idx, record in enumerate(records, 1):
            lines.append(f"## {idx}. {record.title} (ID: {record.id})\n")
            lines.append(f"- **描述**: {record.description}")
            lines.append(f"- **操作人**: {record.operator}")
            lines.append(f"- **状态**: {record.status.value}")
            lines.append(f"- **创建时间**: {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append("")

            if record.system_judgment:
                lines.append("### 系统判定")
                status_icon = "⚠️" if record.system_judgment.is_abnormal else "✅"
                lines.append(f"- **结果**: {status_icon} {'异常' if record.system_judgment.is_abnormal else '正常'}")
                lines.append(f"- **原因**: {record.system_judgment.reason}")
                if record.system_judgment.details.get('expired_attachments'):
                    lines.append("- **过期附件**:")
                    for att in record.system_judgment.details['expired_attachments']:
                        lines.append(f"  - {att['attachment_name']} (材料: {att['material_name']})")
                lines.append("")

            lines.append("### 材料清单")
            for material in record.materials:
                lines.append(f"- **{material.name}** ({material.type})")
                if material.attachments:
                    lines.append("  - 附件:")
                    for att in material.attachments:
                        status_str = "✅ 有效" if att.status.value == 'valid' else "❌ 过期"
                        expire_str = f", 过期时间: {att.expire_time.strftime('%Y-%m-%d')}" if att.expire_time else ""
                        lines.append(f"    - {att.name}: {status_str}{expire_str}")
            lines.append("")

            if record.remarks:
                lines.append("### 人工备注")
                for remark in record.remarks:
                    reason_str = f" (原因: {remark.reason})" if remark.reason else ""
                    lines.append(f"- **{remark.operator}** ({remark.created_at.strftime('%Y-%m-%d %H:%M')}){reason_str}:")
                    lines.append(f"  > {remark.content}")
                lines.append("")

            if record.manual_corrections:
                lines.append("### 人工修正记录")
                for corr in record.manual_corrections:
                    lines.append(f"- **{corr.correction_type}** by {corr.operator} ({corr.created_at.strftime('%Y-%m-%d %H:%M')})")
                    lines.append(f"  - 资源范围: {corr.resource_scope}")
                    lines.append(f"  - 原值: {corr.old_value}")
                    lines.append(f"  - 新值: {corr.new_value}")
                    lines.append(f"  - 理由: {corr.reason}")
                lines.append("")

            lines.append("---\n")

        return "\n".join(lines)

    @staticmethod
    def save_json(records: List[HandoverRecord], file_path: str) -> None:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(OutputFormatter.to_json(records))

    @staticmethod
    def save_markdown(records: List[HandoverRecord], file_path: str) -> None:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(OutputFormatter.to_markdown(records))