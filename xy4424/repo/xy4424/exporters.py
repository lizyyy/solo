from datetime import datetime
from typing import Dict, Any, List
from models import (
    Release, ReviewComment, ValidationIssue,
    ValidationSeverity, ReleaseStatus
)


class MarkdownExporter:
    @staticmethod
    def export_handover_note(release: Release) -> str:
        lines = []
        
        lines.append("# 公交电子墨水屏发布交接单")
        lines.append("")
        lines.append(f"**发布批次**: {release.release_name}")
        lines.append(f"**发布ID**: {release.release_id}")
        lines.append(f"**创建人**: {release.created_by}")
        lines.append(f"**创建时间**: {release.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**当前状态**: {release.status.value}")
        
        if release.approved_at and release.approved_by:
            lines.append(f"**审批人**: {release.approved_by}")
            lines.append(f"**审批时间**: {release.approved_at.strftime('%Y-%m-%d %H:%M:%S')}")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、数据概览")
        lines.append("")
        lines.append(f"- **设备总数**: {len(release.devices)} 台")
        lines.append(f"- **时刻表条目**: {len(release.schedules)} 条")
        lines.append(f"- **临时绕行**: {len(release.detours)} 条")
        lines.append(f"- **使用模板**: {len(release.templates)} 个")
        lines.append(f"- **发布清单条目**: {len(release.release_items)} 条")
        
        lines.append("")
        lines.append("## 二、设备列表")
        lines.append("")
        lines.append("| 设备ID | 站点名称 | 在线状态 | 模板ID |")
        lines.append("|--------|----------|----------|--------|")
        
        for device in release.devices:
            status = "在线" if device.is_online else "离线"
            template = device.template_id or "默认"
            lines.append(f"| {device.device_id} | {device.station_name} | {status} | {template} |")
        
        lines.append("")
        lines.append("## 三、校验结果")
        lines.append("")
        
        errors = [i for i in release.validation_issues if i.severity == ValidationSeverity.ERROR]
        warnings = [i for i in release.validation_issues if i.severity == ValidationSeverity.WARNING]
        
        lines.append(f"- **错误**: {len(errors)} 项")
        lines.append(f"- **警告**: {len(warnings)} 项")
        lines.append("")
        
        if release.validation_issues:
            lines.append("### 详细问题")
            lines.append("")
            
            for idx, issue in enumerate(release.validation_issues, 1):
                severity_icon = "🔴" if issue.severity == ValidationSeverity.ERROR else "🟡"
                lines.append(f"**{idx}. {severity_icon} {issue.message}**")
                lines.append("")
                lines.append(f"   - 类型: {issue.issue_type.value}")
                lines.append(f"   - 严重程度: {issue.severity.value}")
                
                if issue.affected_devices:
                    lines.append(f"   - 影响设备: {', '.join(issue.affected_devices)}")
                if issue.affected_stations:
                    lines.append(f"   - 影响站点: {', '.join(issue.affected_stations)}")
                if issue.affected_routes:
                    lines.append(f"   - 影响线路: {', '.join(issue.affected_routes)}")
                
                lines.append("")
        
        lines.append("## 四、发布清单")
        lines.append("")
        lines.append("| 序号 | 设备ID | 站点 | 线路 | 发车时间 | 绕行状态 |")
        lines.append("|------|--------|------|------|----------|----------|")
        
        for idx, item in enumerate(release.release_items, 1):
            detour_status = "有绕行" if item.has_detour else "正常"
            lines.append(
                f"| {idx} | {item.device_id} | {item.station_name} | "
                f"{item.route_name} | {item.schedule_time} | {detour_status} |"
            )
        
        lines.append("")
        lines.append("## 五、复核备注")
        lines.append("")
        
        if release.review_comments:
            for comment in release.review_comments:
                lines.append(f"### {comment.reviewer} ({comment.timestamp.strftime('%Y-%m-%d %H:%M:%S')})")
                lines.append("")
                lines.append(f"> {comment.comment}")
                lines.append("")
        else:
            lines.append("暂无复核备注")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)


class JSONAuditExporter:
    @staticmethod
    def export_audit_package(release: Release) -> Dict[str, Any]:
        errors = [i for i in release.validation_issues if i.severity == ValidationSeverity.ERROR]
        warnings = [i for i in release.validation_issues if i.severity == ValidationSeverity.WARNING]
        
        audit_package = {
            "audit_info": {
                "generated_at": datetime.now().isoformat(),
                "release_id": release.release_id,
                "release_name": release.release_name,
                "status": release.status.value
            },
            "summary": {
                "total_devices": len(release.devices),
                "online_devices": sum(1 for d in release.devices if d.is_online),
                "offline_devices": sum(1 for d in release.devices if not d.is_online),
                "total_schedules": len(release.schedules),
                "total_detours": len(release.detours),
                "total_templates": len(release.templates),
                "release_items_count": len(release.release_items),
                "validation_errors": len(errors),
                "validation_warnings": len(warnings),
                "can_approve": len(errors) == 0
            },
            "devices": [
                {
                    "device_id": d.device_id,
                    "station_name": d.station_name,
                    "station_id": d.station_id,
                    "is_online": d.is_online,
                    "template_id": d.template_id,
                    "location": d.location,
                    "last_seen": d.last_seen.isoformat() if d.last_seen else None
                }
                for d in release.devices
            ],
            "schedules": [s.to_dict() for s in release.schedules],
            "detours": [d.to_dict() for d in release.detours],
            "templates": [t.to_dict() for t in release.templates],
            "release_items": [r.to_dict() for r in release.release_items],
            "validation_issues": [
                {
                    "issue_id": i.issue_id,
                    "issue_type": i.issue_type.value,
                    "severity": i.severity.value,
                    "message": i.message,
                    "affected_devices": i.affected_devices,
                    "affected_stations": i.affected_stations,
                    "affected_routes": i.affected_routes,
                    "details": i.details
                }
                for i in release.validation_issues
            ],
            "review_comments": [c.to_dict() for c in release.review_comments],
            "approval_info": {
                "created_by": release.created_by,
                "created_at": release.created_at.isoformat(),
                "approved_by": release.approved_by,
                "approved_at": release.approved_at.isoformat() if release.approved_at else None
            }
        }
        
        return audit_package
