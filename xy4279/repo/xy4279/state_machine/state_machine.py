from typing import Dict, List, Any, Optional
from enum import Enum
from datetime import datetime
from config import (
    Operation, OperationStatus, SimulationLog,
    SettingVersion, SettingValue, PlateStatus, PlateState,
    CheckResult
)


class StateEventType(str, Enum):
    CREATE = "create"
    IMPORT = "import"
    COMPARE = "compare"
    CHECK = "check"
    APPROVE = "approve"
    SIMULATE = "simulate"
    ISSUE = "issue"
    ROLLBACK = "rollback"
    CANCEL = "cancel"


class StateTransition:
    def __init__(self):
        self.transitions = {
            OperationStatus.DRAFT: {
                StateEventType.IMPORT: OperationStatus.IMPORTED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.IMPORTED: {
                StateEventType.COMPARE: OperationStatus.COMPARED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.COMPARED: {
                StateEventType.CHECK: OperationStatus.CHECKED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.CHECKED: {
                StateEventType.APPROVE: OperationStatus.APPROVED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.APPROVED: {
                StateEventType.SIMULATE: OperationStatus.SIMULATED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.SIMULATED: {
                StateEventType.ISSUE: OperationStatus.ISSUED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.ISSUED: {
                StateEventType.ROLLBACK: OperationStatus.ROLLED_BACK
            },
            OperationStatus.ROLLED_BACK: {
                StateEventType.SIMULATE: OperationStatus.SIMULATED,
                StateEventType.CANCEL: OperationStatus.CANCELLED
            },
            OperationStatus.CANCELLED: {}
        }

    def can_transition(self, current_status: OperationStatus, event: StateEventType) -> bool:
        if current_status not in self.transitions:
            return False
        return event in self.transitions[current_status]

    def get_next_status(self, current_status: OperationStatus, event: StateEventType) -> Optional[OperationStatus]:
        if self.can_transition(current_status, event):
            return self.transitions[current_status][event]
        return None

    def get_valid_events(self, current_status: OperationStatus) -> List[StateEventType]:
        if current_status not in self.transitions:
            return []
        return list(self.transitions[current_status].keys())


class OperationStateMachine:
    def __init__(self, db_session):
        self.db_session = db_session
        self.transition = StateTransition()

    def trigger_event(self, operation: Operation, event: StateEventType, 
                       details: Optional[Dict[str, Any]] = None) -> Operation:
        if not self.transition.can_transition(operation.status, event):
            valid_events = self.transition.get_valid_events(operation.status)
            raise ValueError(
                f"无法从状态 {operation.status.value} 触发事件 {event.value}。"
                f"有效事件: {[e.value for e in valid_events]}"
            )
        
        next_status = self.transition.get_next_status(operation.status, event)
        if next_status:
            operation.status = next_status
            operation.updated_at = datetime.utcnow()
            self.db_session.commit()
        
        return operation

    def simulate_issue(self, operation: Operation) -> List[SimulationLog]:
        logs = []
        step = 1
        
        if operation.target_version_id:
            target_ver = self.db_session.query(SettingVersion).filter(
                SettingVersion.id == operation.target_version_id
            ).first()
            if target_ver:
                values = self.db_session.query(SettingValue).filter(
                    SettingValue.version_id == target_ver.id
                ).all()
                
                for val in values:
                    logs.append(SimulationLog(
                        operation_id=operation.id,
                        step=step,
                        action="SETTING_UPDATE",
                        target=val.name,
                        result="SUCCESS",
                        message=f"定值 {val.name} = {val.value} {val.unit or ''}",
                        timestamp=datetime.utcnow()
                    ))
                    step += 1
        
        if operation.plate_status_id:
            plate_status = self.db_session.query(PlateStatus).filter(
                PlateStatus.id == operation.plate_status_id
            ).first()
            if plate_status:
                plates = self.db_session.query(PlateState).filter(
                    PlateState.plate_status_id == plate_status.id
                ).order_by(PlateState.sequence).all()
                
                for plate in plates:
                    if plate.target_state and plate.target_state != plate.current_state:
                        action = "PLATE_IN" if plate.target_state == "投入" else "PLATE_OUT"
                        logs.append(SimulationLog(
                            operation_id=operation.id,
                            step=step,
                            action=action,
                            target=plate.plate_name,
                            result="SUCCESS",
                            message=f"压板 {plate.plate_name} 从 {plate.current_state} 切换到 {plate.target_state}",
                            timestamp=datetime.utcnow()
                        ))
                        step += 1
        
        for log in logs:
            self.db_session.add(log)
        self.db_session.commit()
        
        return logs

    def rollback_operation(self, operation: Operation) -> List[SimulationLog]:
        logs = []
        step = 1
        
        if operation.current_version_id:
            current_ver = self.db_session.query(SettingVersion).filter(
                SettingVersion.id == operation.current_version_id
            ).first()
            if current_ver:
                values = self.db_session.query(SettingValue).filter(
                    SettingValue.version_id == current_ver.id
                ).all()
                
                for val in values:
                    logs.append(SimulationLog(
                        operation_id=operation.id,
                        step=step,
                        action="SETTING_ROLLBACK",
                        target=val.name,
                        result="SUCCESS",
                        message=f"定值恢复 {val.name} = {val.value} {val.unit or ''}",
                        timestamp=datetime.utcnow()
                    ))
                    step += 1
        
        if operation.plate_status_id:
            plate_status = self.db_session.query(PlateStatus).filter(
                PlateStatus.id == operation.plate_status_id
            ).first()
            if plate_status:
                plates = self.db_session.query(PlateState).filter(
                    PlateState.plate_status_id == plate_status.id
                ).order_by(PlateState.sequence.desc()).all()
                
                for plate in plates:
                    if plate.target_state and plate.target_state != plate.current_state:
                        action = "PLATE_OUT" if plate.target_state == "投入" else "PLATE_IN"
                        logs.append(SimulationLog(
                            operation_id=operation.id,
                            step=step,
                            action=action,
                            target=plate.plate_name,
                            result="SUCCESS",
                            message=f"压板恢复 {plate.plate_name} 到 {plate.current_state}",
                            timestamp=datetime.utcnow()
                        ))
                        step += 1
        
        for log in logs:
            self.db_session.add(log)
        self.db_session.commit()
        
        return logs

    def get_operation_state_summary(self, operation: Operation) -> Dict[str, Any]:
        check_results = self.db_session.query(CheckResult).filter(
            CheckResult.operation_id == operation.id
        ).all()
        
        simulation_logs = self.db_session.query(SimulationLog).filter(
            SimulationLog.operation_id == operation.id
        ).order_by(SimulationLog.step).all()
        
        passed_checks = [c for c in check_results if c.passed]
        failed_checks = [c for c in check_results if not c.passed]
        high_risk_checks = [c for c in check_results if c.risk_level in ["high", "critical"] and not c.passed]
        
        return {
            "operation_id": operation.id,
            "operation_name": operation.name,
            "current_status": operation.status.value,
            "bay_id": operation.bay_id,
            "bay_name": operation.bay_name,
            "check_summary": {
                "total": len(check_results),
                "passed": len(passed_checks),
                "failed": len(failed_checks),
                "high_risk_issues": len(high_risk_checks)
            },
            "simulation_summary": {
                "total_steps": len(simulation_logs),
                "success_steps": len([l for l in simulation_logs if l.result == "SUCCESS"]),
                "failed_steps": len([l for l in simulation_logs if l.result == "FAILED"])
            },
            "can_issue": (
                operation.status == OperationStatus.SIMULATED and
                len(failed_checks) == 0 and
                len(high_risk_checks) == 0
            ),
            "valid_next_events": [e.value for e in self.transition.get_valid_events(operation.status)]
        }
