from typing import Dict, List, Any, Optional
from datetime import datetime
from config import (
    Operation, OperationStatus, SettingVersion, SettingValue,
    PlateStatus, PlateState, ApprovalTicket, ApprovalSignature,
    CheckResult, SimulationLog, AuditLog
)


class MarkdownExporter:
    def __init__(self):
        self.encoding = "utf-8"

    def export_operation(self, operation: Operation, 
                         current_version: Optional[SettingVersion] = None,
                         target_version: Optional[SettingVersion] = None,
                         current_values: List[SettingValue] = None,
                         target_values: List[SettingValue] = None,
                         plate_status: Optional[PlateStatus] = None,
                         plates: List[PlateState] = None,
                         approval_ticket: Optional[ApprovalTicket] = None,
                         signatures: List[ApprovalSignature] = None,
                         check_results: List[CheckResult] = None,
                         simulation_logs: List[SimulationLog] = None) -> str:
        
        lines = []
        lines.append(f"# 定值票联锁核验 - 操作审计报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 1. 基本信息")
        lines.append("")
        lines.append(f"| 项目 | 内容 |")
        lines.append(f"|------|------|")
        lines.append(f"| 操作ID | {operation.id} |")
        lines.append(f"| 操作名称 | {operation.name} |")
        lines.append(f"| 操作描述 | {operation.description or '-'} |")
        lines.append(f"| 间隔ID | {operation.bay_id} |")
        lines.append(f"| 间隔名称 | {operation.bay_name} |")
        lines.append(f"| 当前状态 | {self._format_status(operation.status)} |")
        lines.append(f"| 创建时间 | {operation.created_at.strftime('%Y-%m-%d %H:%M:%S') if operation.created_at else '-'} |")
        lines.append(f"| 更新时间 | {operation.updated_at.strftime('%Y-%m-%d %H:%M:%S') if operation.updated_at else '-'} |")
        lines.append("")
        
        if current_version and target_version:
            lines.append("## 2. 定值版本比对")
            lines.append("")
            lines.append("### 2.1 版本信息")
            lines.append("")
            lines.append(f"| 项目 | 当前版本 | 目标版本 |")
            lines.append(f"|------|----------|----------|")
            lines.append(f"| 版本号 | {current_version.version} | {target_version.version} |")
            lines.append(f"| 间隔ID | {current_version.bay_id} | {target_version.bay_id} |")
            lines.append(f"| 间隔名称 | {current_version.bay_name} | {target_version.bay_name} |")
            lines.append(f"| 装置类型 | {current_version.device_type} | {target_version.device_type} |")
            lines.append(f"| 装置型号 | {current_version.device_model} | {target_version.device_model} |")
            lines.append(f"| 厂家 | {current_version.manufacturer or '-'} | {target_version.manufacturer or '-'} |")
            lines.append(f"| 生效日期 | {current_version.effective_date or '-'} | {target_version.effective_date or '-'} |")
            lines.append(f"| 源文件 | {current_version.source_file or '-'} | {target_version.source_file or '-'} |")
            lines.append("")
            
            if current_values and target_values:
                lines.append("### 2.2 定值差异")
                lines.append("")
                
                current_dict = {v.name: v for v in current_values}
                target_dict = {v.name: v for v in target_values}
                
                all_names = set(current_dict.keys()) | set(target_dict.keys())
                
                changes = []
                additions = []
                removals = []
                
                for name in all_names:
                    curr = current_dict.get(name)
                    targ = target_dict.get(name)
                    
                    if curr and targ:
                        if curr.value != targ.value:
                            changes.append({
                                "name": name,
                                "old": curr.value,
                                "new": targ.value,
                                "unit": curr.unit or targ.unit or ""
                            })
                    elif targ and not curr:
                        additions.append({
                            "name": name,
                            "value": targ.value,
                            "unit": targ.unit or ""
                        })
                    elif curr and not targ:
                        removals.append({
                            "name": name,
                            "value": curr.value,
                            "unit": curr.unit or ""
                        })
                
                lines.append(f"**变更统计**: 变更 {len(changes)} 项, 新增 {len(additions)} 项, 删除 {len(removals)} 项")
                lines.append("")
                
                if changes:
                    lines.append("#### 变更的定值")
                    lines.append("")
                    lines.append("| 定值项 | 当前值 | 目标值 | 单位 |")
                    lines.append("|--------|--------|--------|------|")
                    for c in changes:
                        lines.append(f"| {c['name']} | {c['old']} | {c['new']} | {c['unit']} |")
                    lines.append("")
                
                if additions:
                    lines.append("#### 新增的定值")
                    lines.append("")
                    lines.append("| 定值项 | 目标值 | 单位 |")
                    lines.append("|--------|--------|------|")
                    for a in additions:
                        lines.append(f"| {a['name']} | {a['value']} | {a['unit']} |")
                    lines.append("")
                
                if removals:
                    lines.append("#### 删除的定值")
                    lines.append("")
                    lines.append("| 定值项 | 当前值 | 单位 |")
                    lines.append("|--------|--------|------|")
                    for r in removals:
                        lines.append(f"| {r['name']} | {r['value']} | {r['unit']} |")
                    lines.append("")
        
        if plate_status and plates:
            lines.append("## 3. 压板状态")
            lines.append("")
            lines.append(f"**压板状态表名称**: {plate_status.name}")
            lines.append(f"**源文件**: {plate_status.source_file or '-'}")
            lines.append("")
            lines.append("| 压板ID | 压板名称 | 类型 | 当前状态 | 目标状态 | 操作顺序 | 描述 |")
            lines.append("|--------|----------|------|----------|----------|----------|------|")
            for p in plates:
                lines.append(f"| {p.plate_id} | {p.plate_name} | {p.plate_type} | {p.current_state} | {p.target_state or '-'} | {p.sequence or '-'} | {p.description or '-'} |")
            lines.append("")
        
        if approval_ticket:
            lines.append("## 4. 审批票信息")
            lines.append("")
            lines.append(f"| 项目 | 内容 |")
            lines.append(f"|------|------|")
            lines.append(f"| 票号 | {approval_ticket.ticket_no} |")
            lines.append(f"| 标题 | {approval_ticket.title} |")
            lines.append(f"| 状态 | {approval_ticket.status} |")
            lines.append(f"| 源文件 | {approval_ticket.source_file or '-'} |")
            lines.append("")
            
            if signatures:
                lines.append("### 4.1 签字记录")
                lines.append("")
                lines.append("| 顺序 | 角色 | 签字人 | 是否已签字 | 签字时间 | 备注 |")
                lines.append("|------|------|--------|------------|----------|------|")
                for s in signatures:
                    signed_status = "✅ 已签字" if s.signed else "❌ 未签字"
                    lines.append(f"| {s.sequence} | {s.role} | {s.signatory} | {signed_status} | {s.signed_at or '-'} | {s.comment or '-'} |")
                lines.append("")
        
        if check_results:
            lines.append("## 5. 联锁检查结果")
            lines.append("")
            
            passed_count = sum(1 for c in check_results if c.passed)
            failed_count = len(check_results) - passed_count
            high_risk = sum(1 for c in check_results if not c.passed and c.risk_level in ["high", "critical"])
            
            lines.append(f"**检查统计**: 通过 {passed_count} 项, 未通过 {failed_count} 项, 高风险问题 {high_risk} 项")
            lines.append("")
            lines.append("### 5.1 详细结果")
            lines.append("")
            lines.append("| 检查类型 | 是否通过 | 风险等级 | 检查消息 |")
            lines.append("|----------|----------|----------|----------|")
            for c in check_results:
                passed_icon = "✅ 通过" if c.passed else "❌ 未通过"
                risk_icon = self._format_risk_level(c.risk_level)
                lines.append(f"| {c.check_type} | {passed_icon} | {risk_icon} | {c.message} |")
            lines.append("")
        
        if simulation_logs:
            lines.append("## 6. 模拟执行日志")
            lines.append("")
            lines.append("| 步骤 | 操作类型 | 目标 | 结果 | 消息 |")
            lines.append("|------|----------|------|------|------|")
            for log in simulation_logs:
                result_icon = "✅ 成功" if log.result == "SUCCESS" else "❌ 失败"
                lines.append(f"| {log.step} | {log.action} | {log.target or '-'} | {result_icon} | {log.message or '-'} |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*此报告由定值票联锁核验系统自动生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)

    def export_check_results(self, check_results: List[CheckResult], operation: Operation = None) -> str:
        lines = []
        lines.append(f"# 联锁检查结果报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if operation:
            lines.append(f"**操作ID**: {operation.id}")
            lines.append(f"**操作名称**: {operation.name}")
            lines.append(f"**间隔**: {operation.bay_name} ({operation.bay_id})")
            lines.append("")
        
        passed_count = sum(1 for c in check_results if c.passed)
        failed_count = len(check_results) - passed_count
        high_risk = sum(1 for c in check_results if not c.passed and c.risk_level in ["high", "critical"])
        medium_risk = sum(1 for c in check_results if not c.passed and c.risk_level == "medium")
        low_risk = sum(1 for c in check_results if not c.passed and c.risk_level == "low")
        
        lines.append("## 检查摘要")
        lines.append("")
        lines.append(f"- **总检查项**: {len(check_results)}")
        lines.append(f"- **通过**: {passed_count}")
        lines.append(f"- **未通过**: {failed_count}")
        lines.append(f"  - 致命风险 (Critical): {sum(1 for c in check_results if c.risk_level == 'critical' and not c.passed)}")
        lines.append(f"  - 高风险 (High): {sum(1 for c in check_results if c.risk_level == 'high' and not c.passed)}")
        lines.append(f"  - 中风险 (Medium): {medium_risk}")
        lines.append(f"  - 低风险 (Low): {low_risk}")
        lines.append("")
        
        if failed_count > 0:
            lines.append("## 未通过项目详情")
            lines.append("")
            
            failed_results = [c for c in check_results if not c.passed]
            for idx, result in enumerate(failed_results, 1):
                lines.append(f"### {idx}. {result.check_type}")
                lines.append("")
                lines.append(f"- **风险等级**: {self._format_risk_level(result.risk_level)}")
                lines.append(f"- **问题描述**: {result.message}")
                if result.details:
                    lines.append(f"- **详细信息**: {result.details}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append(f"*此报告由定值票联锁核验系统自动生成*")
        
        return "\n".join(lines)

    def export_audit_logs(self, audit_logs: List[AuditLog]) -> str:
        lines = []
        lines.append(f"# 审计日志报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**日志总数**: {len(audit_logs)}")
        lines.append("")
        lines.append("## 详细日志")
        lines.append("")
        lines.append("| 时间 | 操作类型 | 资源类型 | 资源ID | 操作人 | 详情 |")
        lines.append("|------|----------|----------|--------|--------|------|")
        
        for log in audit_logs:
            timestamp = log.timestamp.strftime('%Y-%m-%d %H:%M:%S') if log.timestamp else '-'
            details = str(log.details)[:50] + "..." if log.details and len(str(log.details)) > 50 else str(log.details) if log.details else '-'
            lines.append(f"| {timestamp} | {log.operation} | {log.resource_type} | {log.resource_id or '-'} | {log.user or '-'} | {details} |")
        
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(f"*此报告由定值票联锁核验系统自动生成*")
        
        return "\n".join(lines)

    def _format_status(self, status: OperationStatus) -> str:
        status_names = {
            OperationStatus.DRAFT: "草稿",
            OperationStatus.IMPORTED: "已导入",
            OperationStatus.COMPARED: "已比对",
            OperationStatus.CHECKED: "已检查",
            OperationStatus.APPROVED: "已审批",
            OperationStatus.SIMULATED: "已模拟",
            OperationStatus.ISSUED: "已下发",
            OperationStatus.ROLLED_BACK: "已回滚",
            OperationStatus.CANCELLED: "已取消"
        }
        return status_names.get(status, status.value)

    def _format_risk_level(self, risk_level: str) -> str:
        risk_icons = {
            "low": "🟢 低风险",
            "medium": "🟡 中风险",
            "high": "🟠 高风险",
            "critical": "🔴 致命风险"
        }
        return risk_icons.get(risk_level, risk_level)
