from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

from colorproof_checker.models import ProofTask, ProofStatus, RiskLevel
from colorproof_checker.store import DataStore


@dataclass
class StateTransitionResult:
    success: bool
    from_status: ProofStatus
    to_status: Optional[ProofStatus]
    message: str
    details: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}


class ProofStateMachine:
    VALID_TRANSITIONS = {
        ProofStatus.PENDING: [ProofStatus.CHECKING, ProofStatus.REJECTED],
        ProofStatus.CHECKING: [ProofStatus.APPROVED, ProofStatus.REJECTED],
        ProofStatus.APPROVED: [ProofStatus.RELEASED, ProofStatus.REJECTED],
        ProofStatus.RELEASED: [ProofStatus.ROLLED_BACK],
        ProofStatus.REJECTED: [ProofStatus.PENDING],
        ProofStatus.ROLLED_BACK: [ProofStatus.PENDING, ProofStatus.APPROVED]
    }
    
    def __init__(self, store: DataStore):
        self.store = store
    
    def can_transition(self, proof: ProofTask, target_status: ProofStatus) -> bool:
        valid_targets = self.VALID_TRANSITIONS.get(proof.status, [])
        return target_status in valid_targets
    
    def get_valid_transitions(self, proof: ProofTask) -> List[ProofStatus]:
        return self.VALID_TRANSITIONS.get(proof.status, [])
    
    def _record_history_entry(self, proof: ProofTask, old_status: ProofStatus, 
                          new_status: ProofStatus, reason: Optional[str] = None,
                          operator: Optional[str] = None) -> Dict[str, Any]:
        return {
            'proof_id': proof.id,
            'task_number': proof.task_number,
            'from_status': old_status.value,
            'to_status': new_status.value,
            'timestamp': datetime.now().isoformat(),
            'operator': operator,
            'reason': reason,
            'risk_level': proof.risk_level.value if proof.risk_level else None,
            'risks_count': len(proof.risks) if proof.risks else 0
        }
    
    def start_check(self, proof_id: str, operator: Optional[str] = None) -> StateTransitionResult:
        proof = self.store.get_proof_task(proof_id)
        if not proof:
            return StateTransitionResult(
                success=False,
                from_status=None,
                to_status=None,
                message=f"找不到打样任务: {proof_id}"
            )
        
        old_status = proof.status
        target_status = ProofStatus.CHECKING
        
        if not self.can_transition(proof, target_status):
            valid = [s.value for s in self.get_valid_transitions(proof)]
            return StateTransitionResult(
                success=False,
                from_status=old_status,
                to_status=None,
                message=f"无法从 {old_status.value} 转换到 {target_status.value}，有效状态: {', '.join(valid)}"
            )
        
        proof.status = target_status
        self.store.save_proof_task(proof)
        
        state = self.store.workspace.get_state()
        history_entry = self._record_history_entry(proof, old_status, target_status, operator=operator)
        state.release_history.append(history_entry)
        self.store.workspace._save_state(state)
        
        return StateTransitionResult(
            success=True,
            from_status=old_status,
            to_status=target_status,
            message=f"打样任务 {proof.task_number} 开始检查，状态从 {old_status.value} 变更为 {target_status.value}"
        )
    
    def approve(self, proof_id: str, operator: Optional[str] = None) -> StateTransitionResult:
        proof = self.store.get_proof_task(proof_id)
        if not proof:
            return StateTransitionResult(
                success=False,
                from_status=None,
                to_status=None,
                message=f"找不到打样任务: {proof_id}"
            )
        
        old_status = proof.status
        target_status = ProofStatus.APPROVED
        
        if not self.can_transition(proof, target_status):
            valid = [s.value for s in self.get_valid_transitions(proof)]
            return StateTransitionResult(
                success=False,
                from_status=old_status,
                to_status=None,
                message=f"无法从 {old_status.value} 转换到 {target_status.value}，有效状态: {', '.join(valid)}"
            )
        
        proof.status = target_status
        self.store.save_proof_task(proof)
        
        state = self.store.workspace.get_state()
        history_entry = self._record_history_entry(proof, old_status, target_status, operator=operator)
        state.release_history.append(history_entry)
        self.store.workspace._save_state(state)
        
        return StateTransitionResult(
            success=True,
            from_status=old_status,
            to_status=target_status,
            message=f"打样任务 {proof.task_number} 已审核通过，状态从 {old_status.value} 变更为 {target_status.value}"
        )
    
    def release(self, proof_id: str, operator: Optional[str] = None, 
                force: bool = False) -> StateTransitionResult:
        proof = self.store.get_proof_task(proof_id)
        if not proof:
            return StateTransitionResult(
                success=False,
                from_status=None,
                to_status=None,
                message=f"找不到打样任务: {proof_id}"
            )
        
        old_status = proof.status
        target_status = ProofStatus.RELEASED
        
        if not self.can_transition(proof, target_status):
            valid = [s.value for s in self.get_valid_transitions(proof)]
            return StateTransitionResult(
                success=False,
                from_status=old_status,
                to_status=None,
                message=f"无法从 {old_status.value} 转换到 {target_status.value}，有效状态: {', '.join(valid)}"
            )
        
        if not force:
            if proof.risk_level == RiskLevel.CRITICAL:
                return StateTransitionResult(
                    success=False,
                    from_status=old_status,
                    to_status=None,
                    message=f"打样任务 {proof.task_number} 存在严重风险 (risk_level={proof.risk_level.value})，不能放行！请使用 --force 强制放行",
                    details={'risks': proof.risks}
                )
        
        proof.status = target_status
        proof.release_time = datetime.now()
        proof.released_by = operator
        self.store.save_proof_task(proof)
        
        state = self.store.workspace.get_state()
        reason = "强制放行" if force else "正常放行"
        history_entry = self._record_history_entry(
            proof, old_status, target_status, 
            reason=reason, operator=operator
        )
        state.release_history.append(history_entry)
        self.store.workspace._save_state(state)
        
        return StateTransitionResult(
            success=True,
            from_status=old_status,
            to_status=target_status,
            message=f"打样任务 {proof.task_number} 已放行，状态从 {old_status.value} 变更为 {target_status.value}{' (强制放行)' if force else ''}"
        )
    
    def reject(self, proof_id: str, reason: str, operator: Optional[str] = None) -> StateTransitionResult:
        proof = self.store.get_proof_task(proof_id)
        if not proof:
            return StateTransitionResult(
                success=False,
                from_status=None,
                to_status=None,
                message=f"找不到打样任务: {proof_id}"
            )
        
        old_status = proof.status
        target_status = ProofStatus.REJECTED
        
        if not self.can_transition(proof, target_status):
            valid = [s.value for s in self.get_valid_transitions(proof)]
            if not valid:
                if old_status in [ProofStatus.RELEASED, ProofStatus.ROLLED_BACK]:
                    return StateTransitionResult(
                        success=False,
                        from_status=old_status,
                        to_status=None,
                        message=f"已放行/回滚的任务不能直接驳回"
                    )
            return StateTransitionResult(
                success=False,
                from_status=old_status,
                to_status=None,
                message=f"无法从 {old_status.value} 转换到 {target_status.value}，有效状态: {', '.join(valid)}"
            )
        
        proof.status = target_status
        if proof.notes:
            proof.notes = proof.notes + f"\n驳回原因: {reason}"
        else:
            proof.notes = f"驳回原因: {reason}"
        self.store.save_proof_task(proof)
        
        state = self.store.workspace.get_state()
        history_entry = self._record_history_entry(
            proof, old_status, target_status, 
            reason=reason, operator=operator
        )
        state.release_history.append(history_entry)
        self.store.workspace._save_state(state)
        
        return StateTransitionResult(
            success=True,
            from_status=old_status,
            to_status=target_status,
            message=f"打样任务 {proof.task_number} 已驳回，状态从 {old_status.value} 变更为 {target_status.value}，原因: {reason}"
        )
    
    def rollback(self, proof_id: str, reason: str, operator: Optional[str] = None) -> StateTransitionResult:
        proof = self.store.get_proof_task(proof_id)
        if not proof:
            return StateTransitionResult(
                success=False,
                from_status=None,
                to_status=None,
                message=f"找不到打样任务: {proof_id}"
            )
        
        old_status = proof.status
        target_status = ProofStatus.ROLLED_BACK
        
        if not self.can_transition(proof, target_status):
            valid = [s.value for s in self.get_valid_transitions(proof)]
            return StateTransitionResult(
                success=False,
                from_status=old_status,
                to_status=None,
                message=f"无法从 {old_status.value} 转换到 {target_status.value}，有效状态: {', '.join(valid)}"
            )
        
        proof.status = target_status
        proof.rollback_time = datetime.now()
        proof.rolled_back_by = operator
        proof.rollback_reason = reason
        self.store.save_proof_task(proof)
        
        state = self.store.workspace.get_state()
        history_entry = self._record_history_entry(
            proof, old_status, target_status, 
            reason=reason, operator=operator
        )
        state.release_history.append(history_entry)
        self.store.workspace._save_state(state)
        
        return StateTransitionResult(
            success=True,
            from_status=old_status,
            to_status=target_status,
            message=f"打样任务 {proof.task_number} 已回滚，状态从 {old_status.value} 变更为 {target_status.value}，原因: {reason}"
        )
    
    def reset_to_pending(self, proof_id: str, operator: Optional[str] = None) -> StateTransitionResult:
        proof = self.store.get_proof_task(proof_id)
        if not proof:
            return StateTransitionResult(
                success=False,
                from_status=None,
                to_status=None,
                message=f"找不到打样任务: {proof_id}"
            )
        
        old_status = proof.status
        target_status = ProofStatus.PENDING
        
        if not self.can_transition(proof, target_status):
            valid = [s.value for s in self.get_valid_transitions(proof)]
            return StateTransitionResult(
                success=False,
                from_status=old_status,
                to_status=None,
                message=f"无法从 {old_status.value} 转换到 {target_status.value}，有效状态: {', '.join(valid)}"
            )
        
        proof.status = target_status
        self.store.save_proof_task(proof)
        
        state = self.store.workspace.get_state()
        history_entry = self._record_history_entry(
            proof, old_status, target_status, 
            reason="重置为待处理", operator=operator
        )
        state.release_history.append(history_entry)
        self.store.workspace._save_state(state)
        
        return StateTransitionResult(
            success=True,
            from_status=old_status,
            to_status=target_status,
            message=f"打样任务 {proof.task_number} 已重置，状态从 {old_status.value} 变更为 {target_status.value}"
        )
    
    def get_release_history(self, proof_id: Optional[str] = None) -> List[Dict[str, Any]]:
        state = self.store.workspace.get_state()
        history = state.release_history
        
        if proof_id:
            history = [h for h in history if h.get('proof_id') == proof_id]
        
        return history
    
    def get_status_summary(self) -> Dict[str, int]:
        proofs = self.store.list_proof_tasks()
        summary = {status.value: 0 for status in ProofStatus}
        
        for proof in proofs:
            summary[proof.status.value] += 1
        
        return summary
