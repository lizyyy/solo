"""
状态机模块 - 用于按节点还原状态机
"""
from typing import Dict, List, Any, Optional, Callable, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict


@dataclass
class StateTransition:
    """状态转换记录"""
    timestamp: float
    from_state: str
    to_state: str
    trigger: str  # 触发转换的事件/消息
    node_id: str
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NodeState:
    """节点状态"""
    node_id: str
    current_state: str
    timestamp: float
    state_history: List[StateTransition] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)  # 状态上下文数据
    
    def transition_to(self, new_state: str, timestamp: float, trigger: str, data: Dict[str, Any] = None):
        """
        执行状态转换
        
        Args:
            new_state: 目标状态
            timestamp: 转换时间戳
            trigger: 触发转换的事件
            data: 附加数据
        """
        transition = StateTransition(
            timestamp=timestamp,
            from_state=self.current_state,
            to_state=new_state,
            trigger=trigger,
            node_id=self.node_id,
            data=data or {}
        )
        
        self.state_history.append(transition)
        self.current_state = new_state
        self.timestamp = timestamp


class StateMachineDefinition:
    """状态机定义"""
    
    def __init__(self, node_id: str):
        """
        初始化状态机定义
        
        Args:
            node_id: 节点ID
        """
        self.node_id = node_id
        self.states: Dict[str, Dict[str, Any]] = {}  # 状态定义
        self.transitions: Dict[str, List[Dict[str, Any]]] = defaultdict(list)  # 状态转换规则
        self.initial_state: Optional[str] = None
        
    def add_state(self, state_name: str, is_initial: bool = False, description: str = ""):
        """
        添加状态
        
        Args:
            state_name: 状态名称
            is_initial: 是否为初始状态
            description: 状态描述
        """
        self.states[state_name] = {
            "name": state_name,
            "description": description,
            "is_initial": is_initial
        }
        
        if is_initial:
            self.initial_state = state_name
    
    def add_transition(self, from_state: str, to_state: str, trigger: str, 
                       condition: Optional[Callable[[Dict[str, Any]], bool]] = None,
                       description: str = ""):
        """
        添加状态转换规则
        
        Args:
            from_state: 源状态
            to_state: 目标状态
            trigger: 触发条件
            condition: 额外的条件函数
            description: 转换描述
        """
        self.transitions[from_state].append({
            "from": from_state,
            "to": to_state,
            "trigger": trigger,
            "condition": condition,
            "description": description
        })


class NodeStateMachine:
    """节点状态机"""
    
    def __init__(self, definition: StateMachineDefinition):
        """
        初始化节点状态机
        
        Args:
            definition: 状态机定义
        """
        self.definition = definition
        self.node_id = definition.node_id
        
        # 初始化状态
        if definition.initial_state:
            self.current_state = NodeState(
                node_id=self.node_id,
                current_state=definition.initial_state,
                timestamp=0.0
            )
        else:
            # 如果没有定义初始状态，使用第一个状态
            first_state = next(iter(definition.states.keys())) if definition.states else "unknown"
            self.current_state = NodeState(
                node_id=self.node_id,
                current_state=first_state,
                timestamp=0.0
            )
        
        self.context: Dict[str, Any] = {}  # 全局上下文
        
    def process_event(self, event: str, timestamp: float, data: Dict[str, Any] = None) -> bool:
        """
        处理事件，可能触发状态转换
        
        Args:
            event: 事件名称
            timestamp: 事件时间戳
            data: 事件数据
            
        Returns:
            是否发生了状态转换
        """
        current_state_name = self.current_state.current_state
        
        # 获取当前状态的所有可能转换
        possible_transitions = self.definition.transitions.get(current_state_name, [])
        
        for transition in possible_transitions:
            # 检查触发条件
            if transition["trigger"] == event:
                # 检查额外条件
                condition = transition.get("condition")
                if condition is not None:
                    # 合并上下文和事件数据
                    context_data = {**self.context, **(data or {})}
                    if not condition(context_data):
                        continue
                
                # 执行状态转换
                self.current_state.transition_to(
                    new_state=transition["to"],
                    timestamp=timestamp,
                    trigger=event,
                    data=data
                )
                
                # 更新上下文
                if data:
                    self.context.update(data)
                
                return True
        
        return False  # 没有匹配的转换
    
    def get_state_at_time(self, timestamp: float) -> str:
        """
        获取指定时间点的状态
        
        Args:
            timestamp: 时间戳
            
        Returns:
            该时间点的状态
        """
        # 遍历状态历史，找到最接近指定时间的状态
        history = self.current_state.state_history
        
        if not history:
            return self.current_state.current_state
        
        # 找到最后一个在指定时间之前或等于的状态转换
        for i in range(len(history) - 1, -1, -1):
            if history[i].timestamp <= timestamp:
                return history[i].to_state
        
        # 如果所有转换都在指定时间之后，返回初始状态
        return history[0].from_state if history else self.current_state.current_state
    
    def get_transitions_in_range(self, start_time: float, end_time: float) -> List[StateTransition]:
        """
        获取指定时间范围内的所有状态转换
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            
        Returns:
            状态转换列表
        """
        return [
            transition for transition in self.current_state.state_history
            if start_time <= transition.timestamp <= end_time
        ]


class StateMachineManager:
    """状态机管理器"""
    
    def __init__(self):
        """初始化状态机管理器"""
        self.definitions: Dict[str, StateMachineDefinition] = {}
        self.machines: Dict[str, NodeStateMachine] = {}
        
        # 预定义一些常见的无人车节点状态机
        self._define_default_machines()
    
    def _define_default_machines(self):
        """定义默认的状态机"""
        # 动力系统状态机
        powertrain_def = StateMachineDefinition("powertrain")
        powertrain_def.add_state("idle", is_initial=True, description="怠速状态")
        powertrain_def.add_state("forward", description="前进状态")
        powertrain_def.add_state("reverse", description="倒车状态")
        powertrain_def.add_state("braking", description="制动状态")
        powertrain_def.add_state("error", description="错误状态")
        
        powertrain_def.add_transition("idle", "forward", "accelerate_forward")
        powertrain_def.add_transition("idle", "reverse", "accelerate_reverse")
        powertrain_def.add_transition("forward", "braking", "brake")
        powertrain_def.add_transition("reverse", "braking", "brake")
        powertrain_def.add_transition("braking", "idle", "brake_release")
        powertrain_def.add_transition("forward", "idle", "throttle_release")
        powertrain_def.add_transition("reverse", "idle", "throttle_release")
        powertrain_def.add_transition("*", "error", "system_error")
        
        self.add_definition(powertrain_def)
        
        # 转向系统状态机
        steering_def = StateMachineDefinition("steering")
        steering_def.add_state("straight", is_initial=True, description="直行状态")
        steering_def.add_state("turning_left", description="左转状态")
        steering_def.add_state("turning_right", description="右转状态")
        steering_def.add_state("error", description="错误状态")
        
        steering_def.add_transition("straight", "turning_left", "steer_left")
        steering_def.add_transition("straight", "turning_right", "steer_right")
        steering_def.add_transition("turning_left", "straight", "steer_center")
        steering_def.add_transition("turning_right", "straight", "steer_center")
        steering_def.add_transition("turning_left", "turning_right", "steer_right")
        steering_def.add_transition("turning_right", "turning_left", "steer_left")
        steering_def.add_transition("*", "error", "system_error")
        
        self.add_definition(steering_def)
        
        # 感知系统状态机
        perception_def = StateMachineDefinition("perception")
        perception_def.add_state("inactive", is_initial=True, description="未激活状态")
        perception_def.add_state("active", description="激活状态")
        perception_def.add_state("degraded", description="降级状态")
        perception_def.add_state("error", description="错误状态")
        
        perception_def.add_transition("inactive", "active", "activate")
        perception_def.add_transition("active", "degraded", "performance_drop")
        perception_def.add_transition("degraded", "active", "performance_recover")
        perception_def.add_transition("*", "error", "system_error")
        perception_def.add_transition("active", "inactive", "deactivate")
        perception_def.add_transition("degraded", "inactive", "deactivate")
        
        self.add_definition(perception_def)
        
        # 导航系统状态机
        navigation_def = StateMachineDefinition("navigation")
        navigation_def.add_state("idle", is_initial=True, description="空闲状态")
        navigation_def.add_state("planning", description="路径规划中")
        navigation_def.add_state("navigating", description="导航中")
        navigation_def.add_state("paused", description="暂停状态")
        navigation_def.add_state("completed", description="完成状态")
        navigation_def.add_state("error", description="错误状态")
        
        navigation_def.add_transition("idle", "planning", "start_navigation")
        navigation_def.add_transition("planning", "navigating", "plan_ready")
        navigation_def.add_transition("navigating", "paused", "pause")
        navigation_def.add_transition("paused", "navigating", "resume")
        navigation_def.add_transition("navigating", "completed", "reach_destination")
        navigation_def.add_transition("*", "error", "system_error")
        navigation_def.add_transition("*", "idle", "reset")
        
        self.add_definition(navigation_def)
    
    def add_definition(self, definition: StateMachineDefinition):
        """
        添加状态机定义
        
        Args:
            definition: 状态机定义
        """
        self.definitions[definition.node_id] = definition
    
    def create_machine(self, node_id: str) -> NodeStateMachine:
        """
        创建节点状态机实例
        
        Args:
            node_id: 节点ID
            
        Returns:
            状态机实例
        """
        if node_id not in self.definitions:
            raise ValueError(f"未知的节点类型: {node_id}")
        
        definition = self.definitions[node_id]
        machine = NodeStateMachine(definition)
        self.machines[node_id] = machine
        
        return machine
    
    def get_machine(self, node_id: str) -> Optional[NodeStateMachine]:
        """
        获取节点状态机
        
        Args:
            node_id: 节点ID
            
        Returns:
            状态机实例，如果不存在则返回None
        """
        return self.machines.get(node_id)
    
    def process_can_frame(self, can_id: int, data: List[int], timestamp: float) -> Dict[str, Any]:
        """
        处理CAN帧，更新相关状态机
        
        Args:
            can_id: CAN ID
            data: 数据字节
            timestamp: 时间戳
            
        Returns:
            处理结果，包含发生状态转换的节点
        """
        # 将CAN ID和数据映射到事件
        event_info = self._map_can_to_event(can_id, data)
        
        if not event_info:
            return {"transitions": [], "processed": False}
        
        transitions_occurred = []
        
        for node_id, event in event_info.items():
            machine = self.get_machine(node_id)
            if machine:
                # 准备事件数据
                event_data = {
                    "can_id": can_id,
                    "data": data,
                    "timestamp": timestamp
                }
                
                # 处理事件
                if machine.process_event(event, timestamp, event_data):
                    transitions_occurred.append({
                        "node_id": node_id,
                        "event": event,
                        "from_state": machine.current_state.state_history[-1].from_state if machine.current_state.state_history else None,
                        "to_state": machine.current_state.current_state,
                        "timestamp": timestamp
                    })
        
        return {
            "transitions": transitions_occurred,
            "processed": len(transitions_occurred) > 0
        }
    
    def _map_can_to_event(self, can_id: int, data: List[int]) -> Dict[str, str]:
        """
        将CAN帧映射到事件
        
        Args:
            can_id: CAN ID
            data: 数据字节
            
        Returns:
            节点ID到事件的映射
        """
        events = {}
        
        # 这里是一个简化的映射示例
        # 实际项目中应该根据具体的CAN协议定义
        
        # 动力系统相关CAN ID (示例)
        if can_id == 0x100:  # 油门控制
            if data and len(data) > 0:
                throttle_value = data[0]
                if throttle_value > 50:
                    events["powertrain"] = "accelerate_forward"
                elif throttle_value > 20:
                    # 轻微加速，保持当前状态
                    pass
                else:
                    events["powertrain"] = "throttle_release"
        
        elif can_id == 0x101:  # 制动控制
            if data and len(data) > 0:
                brake_value = data[0]
                if brake_value > 20:
                    events["powertrain"] = "brake"
                else:
                    events["powertrain"] = "brake_release"
        
        elif can_id == 0x102:  # 换挡控制
            if data and len(data) > 0:
                gear = data[0]
                if gear == 0:  # 空挡
                    events["powertrain"] = "throttle_release"
                elif gear == 1:  # 前进挡
                    events["powertrain"] = "accelerate_forward"
                elif gear == 2:  # 倒挡
                    events["powertrain"] = "accelerate_reverse"
        
        # 转向系统相关CAN ID
        elif can_id == 0x200:  # 转向角度
            if data and len(data) > 1:
                # 假设转向角度是有符号的16位整数
                steering_angle = (data[0] << 8) | data[1]
                if steering_angle > 1000:  # 左转阈值
                    events["steering"] = "steer_left"
                elif steering_angle < -1000:  # 右转阈值
                    events["steering"] = "steer_right"
                else:  # 直行
                    events["steering"] = "steer_center"
        
        # 感知系统相关CAN ID
        elif can_id == 0x300:  # 感知状态
            if data and len(data) > 0:
                status = data[0]
                if status == 0x01:
                    events["perception"] = "activate"
                elif status == 0x00:
                    events["perception"] = "deactivate"
                elif status == 0x02:
                    events["perception"] = "performance_drop"
                elif status == 0x03:
                    events["perception"] = "system_error"
        
        # 导航系统相关CAN ID
        elif can_id == 0x400:  # 导航命令
            if data and len(data) > 0:
                cmd = data[0]
                if cmd == 0x01:
                    events["navigation"] = "start_navigation"
                elif cmd == 0x02:
                    events["navigation"] = "pause"
                elif cmd == 0x03:
                    events["navigation"] = "resume"
                elif cmd == 0x04:
                    events["navigation"] = "reset"
                elif cmd == 0x05:
                    events["navigation"] = "reach_destination"
        
        return events
    
    def get_all_states(self) -> Dict[str, str]:
        """
        获取所有节点的当前状态
        
        Returns:
            节点ID到状态的映射
        """
        return {
            node_id: machine.current_state.current_state
            for node_id, machine in self.machines.items()
        }
    
    def get_state_history(self, node_id: str) -> List[StateTransition]:
        """
        获取指定节点的状态历史
        
        Args:
            node_id: 节点ID
            
        Returns:
            状态转换历史列表
        """
        machine = self.get_machine(node_id)
        if machine:
            return machine.current_state.state_history
        return []
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取状态机统计信息
        
        Returns:
            统计信息字典
        """
        stats = {
            "total_nodes": len(self.machines),
            "nodes": {},
            "total_transitions": 0
        }
        
        for node_id, machine in self.machines.items():
            history = machine.current_state.state_history
            stats["nodes"][node_id] = {
                "current_state": machine.current_state.current_state,
                "transition_count": len(history),
                "states_visited": list(set(
                    [t.from_state for t in history] + [t.to_state for t in history]
                )) if history else [machine.current_state.current_state]
            }
            stats["total_transitions"] += len(history)
        
        return stats
