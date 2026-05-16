import json
from datetime import datetime
from models import AuditTrailReport, RepairOrder


class OutputFormatter:
    @staticmethod
    def to_json(report: AuditTrailReport, pretty: bool = True) -> str:
        indent = 2 if pretty else None
        return json.dumps(report.model_dump(), default=str, ensure_ascii=False, indent=indent)
    
    @staticmethod
    def to_markdown(report: AuditTrailReport) -> str:
        lines = []
        lines.append(f"# 数据修订留痕审计报告")
        lines.append("")
        lines.append(f"**报告编号**: {report.report_id}")
        lines.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("## 统计概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 报修单总数 | {report.total_orders} |")
        lines.append(f"| 跨天报修单 | {report.cross_day_orders} |")
        lines.append(f"| 含错误记录 | {report.orders_with_errors} |")
        lines.append(f"| 含修订记录 | {report.orders_with_revisions} |")
        lines.append(f"| 含字段截断 | {report.orders_with_truncated_fields} |")
        lines.append("")
        lines.append("## 报修单详情")
        lines.append("")
        
        for order in report.orders:
            lines.append(f"### {order.order_id}")
            lines.append("")
            lines.append(f"**物业公司**: {order.property_company}")
            lines.append(f"**报修位置**: {order.building} {order.unit}")
            lines.append(f"**报修类型**: {order.repair_type}")
            lines.append(f"**报修人**: {order.reporter_name} ({order.reporter_phone})")
            lines.append(f"**报修时间**: {order.report_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"**状态**: {order.status}")
            lines.append(f"**费用**: ¥{order.cost if order.cost else 0}")
            lines.append(f"**跨天处理**: {'是' if order.is_cross_day else '否'}")
            lines.append("")
            
            lines.append("#### 原始输入")
            lines.append("```json")
            lines.append(json.dumps(order.raw_input, ensure_ascii=False, indent=2))
            lines.append("```")
            lines.append("")
            
            if order.has_truncated_fields:
                lines.append("#### ⚠️ 字段截断记录")
                lines.append("")
                for field in order.truncated_fields:
                    lines.append(f"- **{field}**: 字段内容被截断")
                lines.append("")
            
            if order.revisions:
                lines.append("#### 📝 修订记录")
                lines.append("")
                for rev in order.revisions:
                    lines.append(f"**字段路径**: `{rev.field_path}`")
                    lines.append(f"- **原始值**: {rev.original_value}")
                    lines.append(f"- **修订后**: {rev.revised_value}")
                    lines.append(f"- **修订原因**: {rev.revision_reason}")
                    lines.append(f"- **修订人**: {rev.revised_by}")
                    lines.append(f"- **修订时间**: {rev.revised_at.strftime('%Y-%m-%d %H:%M:%S')}")
                    lines.append(f"- **来源**: {rev.source}")
                    if rev.handling_basis:
                        lines.append(f"- **处理依据**: {rev.handling_basis}")
                    lines.append("")
            
            if order.processing_errors:
                lines.append("#### ❌ 处理错误")
                lines.append("")
                for err in order.processing_errors:
                    lines.append(f"**错误代码**: `{err.error_code}`")
                    lines.append(f"- **错误信息**: {err.error_message}")
                    lines.append(f"- **字段路径**: `{err.field_path}`")
                    if err.error_details:
                        lines.append(f"- **详细信息**: {json.dumps(err.error_details, ensure_ascii=False)}")
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        return "\n".join(lines)
    
    @staticmethod
    def order_to_json(order: RepairOrder, pretty: bool = True) -> str:
        indent = 2 if pretty else None
        return json.dumps(order.model_dump(), default=str, ensure_ascii=False, indent=indent)
