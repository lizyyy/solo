import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from config import (
    Operation, OperationStatus, SettingVersion, SettingValue,
    PlateStatus, PlateState, ApprovalTicket, ApprovalSignature,
    CheckResult, SimulationLog, AuditLog
)


class JSONExporter:
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
        
        result = {
            "export_type": "operation_audit",
            "export_time": datetime.now().isoformat(),
            "operation": self._operation_to_dict(operation),
            "current_version": self._version_to_dict(current_version, current_values) if current_version else None,
            "target_version": self._version_to_dict(target_version, target_values) if target_version else None,
            "version_comparison": None,
            "plate_status": self._plate_status_to_dict(plate_status, plates) if plate_status else None,
            "approval_ticket": self._approval_ticket_to_dict(approval_ticket, signatures) if approval_ticket else None,
            "check_results": [self._check_result_to_dict(r) for r in check_results] if check_results else [],
            "simulation_logs": [self._simulation_log_to_dict(l) for l in simulation_logs] if simulation_logs else [],
            "summary": {}
        }
        
        if current_version and target_version and current_values and target_values:
            result["version_comparison"] = self._compare_versions(
                current_version, target_version, current_values, target_values
            )
        
        if check_results:
            result["summary"]["check_summary"] = self._get_check_summary(check_results)
        
        if simulation_logs:
            result["summary"]["simulation_summary"] = self._get_simulation_summary(simulation_logs)
        
        return json.dumps(result, ensure_ascii=False, indent=2, default=str)

    def export_check_results(self, check_results: List[CheckResult], operation: Operation = None) -> str:
        result = {
            "export_type": "check_results",
            "export_time": datetime.now().isoformat(),
            "operation": self._operation_to_dict(operation) if operation else None,
            "summary": self._get_check_summary(check_results),
            "results": [self._check_result_to_dict(r) for r in check_results]
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2, default=str)

    def export_audit_logs(self, audit_logs: List[AuditLog]) -> str:
        result = {
            "export_type": "audit_logs",
            "export_time": datetime.now().isoformat(),
            "total_count": len(audit_logs),
            "logs": [self._audit_log_to_dict(log) for log in audit_logs]
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2, default=str)

    def export_version_comparison(self,
                                   current_version: SettingVersion,
                                   target_version: SettingVersion,
                                   current_values: List[SettingValue],
                                   target_values: List[SettingValue]) -> str:
        
        comparison = self._compare_versions(
            current_version, target_version, current_values, target_values
        )
        
        result = {
            "export_type": "version_comparison",
            "export_time": datetime.now().isoformat(),
            "current_version": self._version_info_to_dict(current_version),
            "target_version": self._version_info_to_dict(target_version),
            "comparison": comparison
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2, default=str)

    def export_risk_summary(self, check_results: List[CheckResult]) -> str:
        summary = self._get_check_summary(check_results)
        
        high_risk_results = [
            self._check_result_to_dict(r) for r in check_results
            if not r.passed and r.risk_level in ["high", "critical"]
        ]
        
        result = {
            "export_type": "risk_summary",
            "export_time": datetime.now().isoformat(),
            "summary": summary,
            "high_risk_issues": high_risk_results
        }
        
        return json.dumps(result, ensure_ascii=False, indent=2, default=str)

    def _operation_to_dict(self, operation: Operation) -> Dict[str, Any]:
        return {
            "id": operation.id,
            "name": operation.name,
            "description": operation.description,
            "status": operation.status.value if operation.status else None,
            "bay_id": operation.bay_id,
            "bay_name": operation.bay_name,
            "current_version_id": operation.current_version_id,
            "target_version_id": operation.target_version_id,
            "topology_id": operation.topology_id,
            "plate_status_id": operation.plate_status_id,
            "approval_ticket_id": operation.approval_ticket_id,
            "created_at": operation.created_at.isoformat() if operation.created_at else None,
            "updated_at": operation.updated_at.isoformat() if operation.updated_at else None
        }

    def _version_to_dict(self, version: SettingVersion, values: List[SettingValue]) -> Dict[str, Any]:
        return {
            **self._version_info_to_dict(version),
            "values": [self._setting_value_to_dict(v) for v in values] if values else []
        }

    def _version_info_to_dict(self, version: SettingVersion) -> Dict[str, Any]:
        return {
            "id": version.id,
            "version": version.version,
            "bay_id": version.bay_id,
            "bay_name": version.bay_name,
            "device_type": version.device_type,
            "device_model": version.device_model,
            "manufacturer": version.manufacturer,
            "effective_date": version.effective_date,
            "source_file": version.source_file,
            "source_type": version.source_type,
            "created_at": version.created_at.isoformat() if version.created_at else None
        }

    def _setting_value_to_dict(self, value: SettingValue) -> Dict[str, Any]:
        return {
            "id": value.id,
            "version_id": value.version_id,
            "name": value.name,
            "value": value.value,
            "unit": value.unit,
            "description": value.description,
            "category": value.category,
            "group_name": value.group_name,
            "is_unchanged": value.is_unchanged,
            "old_value": value.old_value
        }

    def _plate_status_to_dict(self, plate_status: PlateStatus, plates: List[PlateState]) -> Dict[str, Any]:
        return {
            "id": plate_status.id,
            "name": plate_status.name,
            "bay_id": plate_status.bay_id,
            "bay_name": plate_status.bay_name,
            "source_file": plate_status.source_file,
            "created_at": plate_status.created_at.isoformat() if plate_status.created_at else None,
            "plates": [self._plate_state_to_dict(p) for p in plates] if plates else []
        }

    def _plate_state_to_dict(self, plate: PlateState) -> Dict[str, Any]:
        return {
            "id": plate.id,
            "plate_status_id": plate.plate_status_id,
            "plate_id": plate.plate_id,
            "plate_name": plate.plate_name,
            "plate_type": plate.plate_type,
            "current_state": plate.current_state,
            "target_state": plate.target_state,
            "sequence": plate.sequence,
            "description": plate.description,
            "bay_id": plate.bay_id
        }

    def _approval_ticket_to_dict(self, ticket: ApprovalTicket, signatures: List[ApprovalSignature]) -> Dict[str, Any]:
        return {
            "id": ticket.id,
            "ticket_no": ticket.ticket_no,
            "title": ticket.title,
            "status": ticket.status,
            "source_file": ticket.source_file,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            "signatures": [self._signature_to_dict(s) for s in signatures] if signatures else []
        }

    def _signature_to_dict(self, signature: ApprovalSignature) -> Dict[str, Any]:
        return {
            "id": signature.id,
            "ticket_id": signature.ticket_id,
            "role": signature.role,
            "signatory": signature.signatory,
            "signed": signature.signed,
            "signed_at": signature.signed_at,
            "comment": signature.comment,
            "sequence": signature.sequence
        }

    def _check_result_to_dict(self, result: CheckResult) -> Dict[str, Any]:
        return {
            "id": result.id,
            "operation_id": result.operation_id,
            "check_type": result.check_type,
            "passed": result.passed,
            "message": result.message,
            "details": result.details,
            "risk_level": result.risk_level,
            "created_at": result.created_at.isoformat() if result.created_at else None
        }

    def _simulation_log_to_dict(self, log: SimulationLog) -> Dict[str, Any]:
        return {
            "id": log.id,
            "operation_id": log.operation_id,
            "step": log.step,
            "action": log.action,
            "target": log.target,
            "result": log.result,
            "message": log.message,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None
        }

    def _audit_log_to_dict(self, log: AuditLog) -> Dict[str, Any]:
        return {
            "id": log.id,
            "operation": log.operation,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "user": log.user
        }

    def _compare_versions(self,
                          current_version: SettingVersion,
                          target_version: SettingVersion,
                          current_values: List[SettingValue],
                          target_values: List[SettingValue]) -> Dict[str, Any]:
        
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
                        "old_unit": curr.unit,
                        "new_value": targ.value,
                        "new_unit": targ.unit,
                        "category": curr.category or targ.category
                    })
                else:
                    unchanged.append({
                        "name": name,
                        "value": curr.value,
                        "unit": curr.unit,
                        "category": curr.category
                    })
            elif targ and not curr:
                additions.append({
                    "name": name,
                    "value": targ.value,
                    "unit": targ.unit,
                    "category": targ.category
                })
            elif curr and not targ:
                removals.append({
                    "name": name,
                    "value": curr.value,
                    "unit": curr.unit,
                    "category": curr.category
                })
        
        return {
            "version_current": current_version.version,
            "version_target": target_version.version,
            "bay_id": current_version.bay_id,
            "bay_name": current_version.bay_name,
            "total_values": len(all_names),
            "changed_values": len(changes),
            "unchanged_values": len(unchanged),
            "added_values": len(additions),
            "removed_values": len(removals),
            "changes": changes,
            "additions": additions,
            "removals": removals,
            "unchanged": unchanged
        }

    def _get_check_summary(self, check_results: List[CheckResult]) -> Dict[str, Any]:
        passed = sum(1 for c in check_results if c.passed)
        failed = len(check_results) - passed
        
        risk_counts = {
            "critical": sum(1 for c in check_results if not c.passed and c.risk_level == "critical"),
            "high": sum(1 for c in check_results if not c.passed and c.risk_level == "high"),
            "medium": sum(1 for c in check_results if not c.passed and c.risk_level == "medium"),
            "low": sum(1 for c in check_results if not c.passed and c.risk_level == "low")
        }
        
        return {
            "total": len(check_results),
            "passed": passed,
            "failed": failed,
            "risk_counts": risk_counts,
            "can_issue": failed == 0 and risk_counts["critical"] == 0 and risk_counts["high"] == 0
        }

    def _get_simulation_summary(self, logs: List[SimulationLog]) -> Dict[str, Any]:
        success = sum(1 for l in logs if l.result == "SUCCESS")
        failed = len(logs) - success
        
        return {
            "total_steps": len(logs),
            "success_steps": success,
            "failed_steps": failed
        }
