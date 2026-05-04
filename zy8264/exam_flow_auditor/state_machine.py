"""
状态机模块 - 管理试卷袋流转状态
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional
from enum import Enum


class StateStatus(Enum):
    VALID = "VALID"
    INVALID = "INVALID"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


@dataclass
class StateTransition:
    from_state: str
    to_state: str
    action: str
    teacher_id: str
    scan_id: str
    timestamp: datetime
    valid: bool = True
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_state": self.from_state,
            "to_state": self.to_state,
            "action": self.action,
            "teacher_id": self.teacher_id,
            "scan_id": self.scan_id,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "valid": self.valid,
            "reason": self.reason
        }


@dataclass
class BagState:
    bag_id: str
    bag_type: str
    initial_state: str
    current_state: str
    transitions: List[StateTransition] = field(default_factory=list)
    state_history: List[str] = field(default_factory=list)
    status: StateStatus = StateStatus.IN_PROGRESS

    def __post_init__(self):
        if not self.state_history:
            self.state_history = [self.initial_state]

    def add_transition(self, transition: StateTransition):
        self.transitions.append(transition)
        if transition.valid:
            self.current_state = transition.to_state
            self.state_history.append(transition.to_state)

    def is_completed(self, final_state: str) -> bool:
        return self.current_state == final_state

    def get_missing_states(self, all_states: List[str]) -> List[str]:
        current_idx = -1
        for i, state in enumerate(all_states):
            if state == self.current_state:
                current_idx = i
                break
        
        if current_idx == -1 or current_idx >= len(all_states) - 1:
            return []
        
        return all_states[current_idx + 1:]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bag_id": self.bag_id,
            "bag_type": self.bag_type,
            "initial_state": self.initial_state,
            "current_state": self.current_state,
            "state_history": self.state_history,
            "transitions": [t.to_dict() for t in self.transitions],
            "status": self.status.value
        }


class FlowStateMachine:
    def __init__(self, flow_rules: Dict[str, Any]):
        self.flow_rules = flow_rules
        self.bag_states: Dict[str, BagState] = {}
        self._init_flow_configs()

    def _init_flow_configs(self):
        self.flow_configs: Dict[str, Any] = {}
        
        for flow_type, rule in self.flow_rules.items():
            self.flow_configs[flow_type] = {
                "name": rule.name,
                "states": rule.states,
                "initial_state": rule.states[0] if rule.states else None,
                "final_state": rule.states[-1] if rule.states else None,
                "transition_map": rule.transition_map
            }

    def get_flow_type(self, bag_type: str) -> Optional[str]:
        if bag_type == "备用卷袋":
            return "paper_bag_flow"
        elif bag_type == "答题卡袋":
            return "answer_bag_flow"
        return None

    def create_bag_state(self, bag_id: str, bag_type: str) -> Optional[BagState]:
        flow_type = self.get_flow_type(bag_type)
        if not flow_type or flow_type not in self.flow_configs:
            return None

        config = self.flow_configs[flow_type]
        bag_state = BagState(
            bag_id=bag_id,
            bag_type=bag_type,
            initial_state=config["initial_state"],
            current_state=config["initial_state"]
        )
        self.bag_states[bag_id] = bag_state
        return bag_state

    def process_scan(self, scan: Any, bag_manifest: Any) -> StateTransition:
        bag_id = scan.bag_id
        action = scan.action
        teacher_id = scan.teacher_id
        scan_id = scan.scan_id
        timestamp = scan.dt

        if bag_id not in self.bag_states:
            if not bag_manifest:
                return StateTransition(
                    from_state="UNKNOWN",
                    to_state="UNKNOWN",
                    action=action,
                    teacher_id=teacher_id,
                    scan_id=scan_id,
                    timestamp=timestamp,
                    valid=False,
                    reason=f"无法找到试卷袋 [{bag_id}] 的清单信息"
                )
            self.create_bag_state(bag_id, bag_manifest.bag_type)

        bag_state = self.bag_states[bag_id]
        flow_type = self.get_flow_type(bag_manifest.bag_type)
        config = self.flow_configs.get(flow_type, {})
        transition_map = config.get("transition_map", {})

        current_state = bag_state.current_state
        state_transitions = transition_map.get(current_state, {})

        if action not in state_transitions:
            valid_actions = list(state_transitions.keys())
            return StateTransition(
                from_state=current_state,
                to_state=current_state,
                action=action,
                teacher_id=teacher_id,
                scan_id=scan_id,
                timestamp=timestamp,
                valid=False,
                reason=f"当前状态 [{current_state}] 下无法执行 [{action}] 操作，有效操作: {valid_actions}"
            )

        transition_info = state_transitions[action]
        next_state = transition_info["to"]

        transition = StateTransition(
            from_state=current_state,
            to_state=next_state,
            action=action,
            teacher_id=teacher_id,
            scan_id=scan_id,
            timestamp=timestamp,
            valid=True,
            reason=""
        )

        bag_state.add_transition(transition)

        final_state = config.get("final_state")
        if final_state and bag_state.current_state == final_state:
            bag_state.status = StateStatus.COMPLETED

        return transition

    def process_all_scans(self, scans: List[Any], bag_manifests: Dict[str, Any]) -> Dict[str, Any]:
        results: Dict[str, Any] = {
            "total_scans": 0,
            "valid_transitions": 0,
            "invalid_transitions": 0,
            "bag_states": {},
            "transitions": []
        }

        sorted_scans = sorted(scans, key=lambda x: x.dt)

        for scan in sorted_scans:
            results["total_scans"] += 1
            manifest = bag_manifests.get(scan.bag_id)
            transition = self.process_scan(scan, manifest)
            results["transitions"].append(transition)
            
            if transition.valid:
                results["valid_transitions"] += 1
            else:
                results["invalid_transitions"] += 1

        completed_bags = 0
        in_progress_bags = 0

        for bag_id, bag_state in self.bag_states.items():
            results["bag_states"][bag_id] = bag_state.to_dict()
            
            if bag_state.status == StateStatus.COMPLETED:
                completed_bags += 1
            else:
                in_progress_bags += 1

        results["completed_bags"] = completed_bags
        results["in_progress_bags"] = in_progress_bags

        return results

    def get_bag_state(self, bag_id: str) -> Optional[BagState]:
        return self.bag_states.get(bag_id)

    def get_all_bag_states(self) -> Dict[str, BagState]:
        return self.bag_states

    def generate_audit_trail(self) -> List[Dict[str, Any]]:
        audit_trail = []
        
        for bag_id, bag_state in self.bag_states.items():
            for transition in bag_state.transitions:
                audit_trail.append({
                    "bag_id": bag_id,
                    "bag_type": bag_state.bag_type,
                    **transition.to_dict()
                })

        audit_trail.sort(key=lambda x: x["timestamp"])
        return audit_trail


class StateValidator:
    def __init__(self, flow_rules: Dict[str, Any]):
        self.flow_rules = flow_rules
        self.state_machine = FlowStateMachine(flow_rules)

    def validate_scan_sequence(self, scans: List[Any], bag_manifests: Dict[str, Any]) -> Dict[str, Any]:
        return self.state_machine.process_all_scans(scans, bag_manifests)

    def check_state_consistency(self, bag_state: BagState, flow_type: str) -> Dict[str, Any]:
        issues = []
        
        flow_config = self.state_machine.flow_configs.get(flow_type, {})
        all_states = flow_config.get("states", [])
        
        for i, state in enumerate(bag_state.state_history):
            if state not in all_states:
                issues.append({
                    "type": "unknown_state",
                    "message": f"未知状态 [{state}] 在状态历史中",
                    "position": i
                })

        for i in range(1, len(bag_state.state_history)):
            from_state = bag_state.state_history[i-1]
            to_state = bag_state.state_history[i]
            
            transition_map = flow_config.get("transition_map", {})
            state_transitions = transition_map.get(from_state, {})
            
            valid_transitions = [t["to"] for t in state_transitions.values()]
            
            if to_state not in valid_transitions:
                issues.append({
                    "type": "invalid_transition",
                    "message": f"无效状态转换: [{from_state}] -> [{to_state}]",
                    "from_state": from_state,
                    "to_state": to_state,
                    "valid_transitions": valid_transitions
                })

        final_state = flow_config.get("final_state")
        if final_state and bag_state.current_state != final_state:
            missing = bag_state.get_missing_states(all_states)
            issues.append({
                "type": "incomplete_flow",
                "message": f"流转未完成，当前状态 [{bag_state.current_state}]，目标状态 [{final_state}]",
                "current_state": bag_state.current_state,
                "final_state": final_state,
                "missing_states": missing
            })

        return {
            "bag_id": bag_state.bag_id,
            "bag_type": bag_state.bag_type,
            "current_state": bag_state.current_state,
            "state_history": bag_state.state_history,
            "is_consistent": len(issues) == 0,
            "issues": issues
        }

    def validate_all_bags(self, bag_manifests: Dict[str, Any]) -> Dict[str, Any]:
        results = {
            "total_bags": 0,
            "consistent_bags": 0,
            "inconsistent_bags": 0,
            "bag_validations": {}
        }

        for bag_id, manifest in bag_manifests.items():
            bag_state = self.state_machine.get_bag_state(bag_id)
            if not bag_state:
                flow_type = self.state_machine.get_flow_type(manifest.bag_type)
                flow_config = self.state_machine.flow_configs.get(flow_type, {})
                initial_state = flow_config.get("initial_state", "SEALED")
                
                results["bag_validations"][bag_id] = {
                    "bag_id": bag_id,
                    "bag_type": manifest.bag_type,
                    "current_state": initial_state,
                    "state_history": [initial_state],
                    "is_consistent": True,
                    "has_no_scans": True,
                    "issues": [{
                        "type": "no_scans",
                        "message": f"试卷袋 [{bag_id}] 没有任何扫描记录"
                    }]
                }
                continue

            flow_type = self.state_machine.get_flow_type(manifest.bag_type)
            validation = self.check_state_consistency(bag_state, flow_type)
            
            results["bag_validations"][bag_id] = validation
            
            if validation["is_consistent"]:
                results["consistent_bags"] += 1
            else:
                results["inconsistent_bags"] += 1

        results["total_bags"] = len(bag_manifests)
        return results
