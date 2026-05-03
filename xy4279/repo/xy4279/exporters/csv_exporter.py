import csv
from typing import Dict, List, Any, Optional, IO
from io import StringIO
from datetime import datetime
from config import (
    Operation, OperationStatus, SettingVersion, SettingValue,
    PlateStatus, PlateState, ApprovalTicket, ApprovalSignature,
    CheckResult, SimulationLog, AuditLog
)


class CSVExporter:
    def __init__(self):
        self.encoding = "utf-8"

    def export_check_results(self, check_results: List[CheckResult]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            "序号", "操作ID", "检查类型", "是否通过", "风险等级", 
            "检查消息", "详细信息", "检查时间"
        ])
        
        for idx, result in enumerate(check_results, 1):
            passed = "是" if result.passed else "否"
            risk_level = self._format_risk_level(result.risk_level)
            details = str(result.details) if result.details else ""
            created_at = result.created_at.strftime('%Y-%m-%d %H:%M:%S') if result.created_at else ""
            
            writer.writerow([
                idx, result.operation_id, result.check_type, passed,
                risk_level, result.message, details, created_at
            ])
        
        return output.getvalue()

    def export_setting_versions(self, version: SettingVersion, values: List[SettingValue]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["版本信息"])
        writer.writerow(["版本号", version.version])
        writer.writerow(["间隔ID", version.bay_id])
        writer.writerow(["间隔名称", version.bay_name])
        writer.writerow(["装置类型", version.device_type])
        writer.writerow(["装置型号", version.device_model])
        writer.writerow(["厂家", version.manufacturer or ""])
        writer.writerow(["生效日期", version.effective_date or ""])
        writer.writerow(["源文件", version.source_file or ""])
        writer.writerow([])
        writer.writerow(["定值项列表"])
        writer.writerow([
            "序号", "定值项名称", "整定值", "单位", "描述", "分类", "组名"
        ])
        
        for idx, val in enumerate(values, 1):
            writer.writerow([
                idx, val.name, val.value, val.unit or "",
                val.description or "", val.category or "", val.group_name or ""
            ])
        
        return output.getvalue()

    def export_version_comparison(self, 
                                   current_version: SettingVersion,
                                   target_version: SettingVersion,
                                   current_values: List[SettingValue],
                                   target_values: List[SettingValue]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["版本比对报告"])
        writer.writerow(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])
        
        writer.writerow(["版本信息对比"])
        writer.writerow(["项目", "当前版本", "目标版本"])
        writer.writerow(["版本号", current_version.version, target_version.version])
        writer.writerow(["间隔ID", current_version.bay_id, target_version.bay_id])
        writer.writerow(["间隔名称", current_version.bay_name, target_version.bay_name])
        writer.writerow(["装置型号", current_version.device_model, target_version.device_model])
        writer.writerow([])
        
        current_dict = {v.name: v for v in current_values}
        target_dict = {v.name: v for v in target_values}
        
        all_names = set(current_dict.keys()) | set(target_dict.keys())
        
        changes = []
        additions = []
        removals = []
        unchanged = []
        
        for name in all_names:
            curr = current_dict.get(name)
            targ = target_dict.get(name)
            
            if curr and targ:
                if curr.value != targ.value:
                    changes.append({
                        "name": name,
                        "old_value": curr.value,
                        "old_unit": curr.unit or "",
                        "new_value": targ.value,
                        "new_unit": targ.unit or ""
                    })
                else:
                    unchanged.append({
                        "name": name,
                        "value": curr.value,
                        "unit": curr.unit or ""
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
        
        writer.writerow(["变更统计"])
        writer.writerow(["总定值项", len(all_names)])
        writer.writerow(["变更", len(changes)])
        writer.writerow(["新增", len(additions)])
        writer.writerow(["删除", len(removals)])
        writer.writerow(["未变更", len(unchanged)])
        writer.writerow([])
        
        if changes:
            writer.writerow(["变更的定值"])
            writer.writerow(["定值项", "当前值", "单位", "目标值", "单位"])
            for c in changes:
                writer.writerow([c["name"], c["old_value"], c["old_unit"], c["new_value"], c["new_unit"]])
            writer.writerow([])
        
        if additions:
            writer.writerow(["新增的定值"])
            writer.writerow(["定值项", "目标值", "单位"])
            for a in additions:
                writer.writerow([a["name"], a["value"], a["unit"]])
            writer.writerow([])
        
        if removals:
            writer.writerow(["删除的定值"])
            writer.writerow(["定值项", "当前值", "单位"])
            for r in removals:
                writer.writerow([r["name"], r["value"], r["unit"]])
            writer.writerow([])
        
        if unchanged:
            writer.writerow(["未变更的定值"])
            writer.writerow(["定值项", "值", "单位"])
            for u in unchanged:
                writer.writerow([u["name"], u["value"], u["unit"]])
        
        return output.getvalue()

    def export_plate_status(self, plate_status: PlateStatus, plates: List[PlateState]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["压板状态表"])
        writer.writerow(["名称", plate_status.name])
        writer.writerow(["间隔ID", plate_status.bay_id])
        writer.writerow(["间隔名称", plate_status.bay_name])
        writer.writerow(["源文件", plate_status.source_file or ""])
        writer.writerow([])
        writer.writerow([
            "序号", "压板ID", "压板名称", "类型", "当前状态", 
            "目标状态", "操作顺序", "描述"
        ])
        
        for idx, plate in enumerate(plates, 1):
            writer.writerow([
                idx, plate.plate_id, plate.plate_name, plate.plate_type,
                plate.current_state, plate.target_state or "",
                plate.sequence or "", plate.description or ""
            ])
        
        return output.getvalue()

    def export_approval_ticket(self, ticket: ApprovalTicket, signatures: List[ApprovalSignature]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["审批票信息"])
        writer.writerow(["票号", ticket.ticket_no])
        writer.writerow(["标题", ticket.title])
        writer.writerow(["状态", ticket.status])
        writer.writerow(["源文件", ticket.source_file or ""])
        writer.writerow([])
        writer.writerow(["签字记录"])
        writer.writerow([
            "顺序", "角色", "签字人", "是否签字", "签字时间", "备注"
        ])
        
        for sig in signatures:
            signed = "是" if sig.signed else "否"
            writer.writerow([
                sig.sequence, sig.role, sig.signatory, signed,
                sig.signed_at or "", sig.comment or ""
            ])
        
        return output.getvalue()

    def export_simulation_logs(self, logs: List[SimulationLog]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["模拟执行日志"])
        writer.writerow(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])
        writer.writerow([
            "步骤", "操作ID", "操作类型", "目标", "结果", "消息", "时间戳"
        ])
        
        for log in logs:
            result = "成功" if log.result == "SUCCESS" else "失败"
            timestamp = log.timestamp.strftime('%Y-%m-%d %H:%M:%S') if log.timestamp else ""
            writer.writerow([
                log.step, log.operation_id, log.action, log.target or "",
                result, log.message or "", timestamp
            ])
        
        return output.getvalue()

    def export_audit_logs(self, logs: List[AuditLog]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["审计日志"])
        writer.writerow(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow(["日志总数", len(logs)])
        writer.writerow([])
        writer.writerow([
            "序号", "操作", "资源类型", "资源ID", "操作人", "详情", "时间"
        ])
        
        for idx, log in enumerate(logs, 1):
            timestamp = log.timestamp.strftime('%Y-%m-%d %H:%M:%S') if log.timestamp else ""
            details = str(log.details) if log.details else ""
            writer.writerow([
                idx, log.operation, log.resource_type, log.resource_id or "",
                log.user or "", details, timestamp
            ])
        
        return output.getvalue()

    def export_risk_summary(self, check_results: List[CheckResult]) -> str:
        output = StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["风险汇总报告"])
        writer.writerow(["生成时间", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])
        
        critical = sum(1 for c in check_results if not c.passed and c.risk_level == "critical")
        high = sum(1 for c in check_results if not c.passed and c.risk_level == "high")
        medium = sum(1 for c in check_results if not c.passed and c.risk_level == "medium")
        low = sum(1 for c in check_results if not c.passed and c.risk_level == "low")
        passed = sum(1 for c in check_results if c.passed)
        
        writer.writerow(["风险等级统计"])
        writer.writerow(["风险等级", "数量"])
        writer.writerow(["致命", critical])
        writer.writerow(["高", high])
        writer.writerow(["中", medium])
        writer.writerow(["低", low])
        writer.writerow(["通过", passed])
        writer.writerow([])
        
        if critical > 0 or high > 0:
            writer.writerow(["高/致命风险详情"])
            writer.writerow([
                "检查类型", "风险等级", "问题描述", "详细信息"
            ])
            
            high_risk_results = [c for c in check_results 
                                if not c.passed and c.risk_level in ["high", "critical"]]
            
            for r in high_risk_results:
                risk_level = self._format_risk_level(r.risk_level)
                details = str(r.details) if r.details else ""
                writer.writerow([r.check_type, risk_level, r.message, details])
        
        return output.getvalue()

    def _format_risk_level(self, risk_level: str) -> str:
        risk_names = {
            "low": "低风险",
            "medium": "中风险",
            "high": "高风险",
            "critical": "致命风险"
        }
        return risk_names.get(risk_level, risk_level)
