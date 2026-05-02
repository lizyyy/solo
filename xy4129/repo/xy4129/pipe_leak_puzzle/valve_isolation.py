# -*- coding: utf-8 -*-
"""
阀门隔离模块 - 漏点定位、关阀计划、影响范围评估
"""

import json
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, asdict, field
from collections import defaultdict, deque


@dataclass
class IsolationResult:
    """隔离结果"""
    suspected_leaks: List[Dict] = field(default_factory=list)
    valves_to_close: List[Dict] = field(default_factory=list)
    affected_users: List[Dict] = field(default_factory=list)
    strategy: str = "minimal"
    network_summary: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "IsolationResult":
        return cls(**data)
    
    def save(self, filepath: str):
        """保存到JSON文件"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2, default=str)
    
    @classmethod
    def load(cls, filepath: str) -> "IsolationResult":
        """从JSON文件加载"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)


class IsolationPlanner:
    """隔离规划器"""
    
    def __init__(self, network: Any):
        self.network = network
        self.isolation_strategy = "minimal"  # minimal, conservative, aggressive
    
    def locate_leak_points(self,
                           filtered_anomalies: List[Dict],
                           propagation_delays: List[Dict]) -> List[Dict]:
        """
        漏点定位
        
        基于时序分析结果定位疑似漏点区段
        
        定位策略：
        1. 高置信度异常事件优先
        2. 结合压力异常和声纹异常
        3. 利用传播延迟分析结果
        """
        suspected_leaks = []
        
        if not filtered_anomalies:
            return suspected_leaks
        
        # 按置信度排序
        sorted_anomalies = sorted(
            filtered_anomalies,
            key=lambda x: x.get("combined_confidence", 0),
            reverse=True
        )
        
        for i, anomaly in enumerate(sorted_anomalies):
            # 确定疑似漏点的位置
            section_id, confidence = self._estimate_leak_section(anomaly)
            
            if confidence > 0.1:  # 最低置信度阈值
                leak_info = {
                    "leak_id": f"LEAK_{i+1:03d}",
                    "section_id": section_id,
                    "confidence": confidence,
                    "timestamp": anomaly.get("event_timestamp"),
                    "has_pressure_anomaly": anomaly.get("has_pressure_anomaly", False),
                    "has_acoustic_anomaly": anomaly.get("has_acoustic_anomaly", False),
                    "combined_confidence": anomaly.get("combined_confidence", 0),
                    "pressure_confidence": anomaly.get("pressure_confidence", 0),
                    "acoustic_confidence": anomaly.get("acoustic_confidence", 0),
                    "estimated_location": self._get_section_info(section_id),
                    "anomaly_data": anomaly
                }
                
                suspected_leaks.append(leak_info)
        
        # 去重：合并同一管段的多个疑似漏点
        unique_leaks = self._deduplicate_leaks(suspected_leaks)
        
        return unique_leaks
    
    def _estimate_leak_section(self, anomaly: Dict) -> tuple:
        """估计漏点所在管段"""
        section_id = None
        confidence = 0.0
        
        # 从异常数据中提取位置信息
        primary_data = anomaly.get("primary_data", {})
        all_anomalies = anomaly.get("all_anomalies", [])
        
        # 尝试从声纹数据获取位置
        for item in all_anomalies:
            if item.get("type") == "acoustic":
                data = item.get("data", {})
                location = data.get("location")
                if location:
                    # 尝试匹配管段ID
                    matched_section = self._match_section_by_location(location)
                    if matched_section:
                        section_id = matched_section
                        confidence = item.get("confidence", 0.5) * 0.8
                        break
        
        # 如果没有从声纹数据获取到，尝试从压力数据推断
        if not section_id:
            for item in all_anomalies:
                if item.get("type") == "pressure":
                    data = item.get("data", {})
                    sensor_id = data.get("sensor_id")
                    if sensor_id:
                        # 从传感器位置推断管段
                        inferred_section = self._infer_section_from_sensor(sensor_id)
                        if inferred_section:
                            section_id = inferred_section
                            confidence = item.get("confidence", 0.5) * 0.6
                            break
        
        # 如果仍然没有，使用默认位置
        if not section_id:
            # 返回第一个管段作为默认（如果有管网模型）
            if self.network and hasattr(self.network, "sections") and self.network.sections:
                first_section = next(iter(self.network.sections.values()))
                section_id = first_section.section_id
                confidence = 0.1  # 低置信度
        
        return section_id, confidence
    
    def _match_section_by_location(self, location: str) -> Optional[str]:
        """根据位置描述匹配管段"""
        if not self.network or not hasattr(self.network, "sections"):
            return None
        
        location_lower = location.lower()
        
        for section_id, section in self.network.sections.items():
            # 检查管段ID、名称、位置
            if section_id.lower() in location_lower:
                return section_id
            if section.name and section.name.lower() in location_lower:
                return section_id
        
        return None
    
    def _infer_section_from_sensor(self, sensor_id: str) -> Optional[str]:
        """从传感器位置推断管段"""
        if not self.network or not hasattr(self.network, "sensors"):
            return None
        
        sensor = self.network.sensors.get(sensor_id)
        if not sensor:
            return None
        
        # 如果传感器有关联管段，直接返回
        if sensor.section_id:
            return sensor.section_id
        
        # 否则，根据节点推断
        if sensor.node_id and hasattr(self.network, "nodes"):
            node = self.network.nodes.get(sensor.node_id)
            if node and node.connected_sections:
                return node.connected_sections[0] if node.connected_sections else None
        
        return None
    
    def _get_section_info(self, section_id: str) -> Dict:
        """获取管段信息"""
        if not section_id:
            return {"section_id": None, "name": "未知", "from_node": None, "to_node": None}
        
        if not self.network or not hasattr(self.network, "sections"):
            return {"section_id": section_id, "name": section_id}
        
        section = self.network.sections.get(section_id)
        if not section:
            return {"section_id": section_id, "name": section_id}
        
        return {
            "section_id": section.section_id,
            "name": section.name,
            "from_node": section.from_node,
            "to_node": section.to_node,
            "length": section.length,
            "diameter": section.diameter,
            "material": section.material
        }
    
    def _deduplicate_leaks(self, leaks: List[Dict]) -> List[Dict]:
        """去重漏点"""
        if not leaks:
            return []
        
        # 按管段分组
        section_groups = defaultdict(list)
        for leak in leaks:
            section_id = leak.get("section_id")
            if section_id:
                section_groups[section_id].append(leak)
        
        unique_leaks = []
        for section_id, group in section_groups.items():
            # 取置信度最高的
            best_leak = max(group, key=lambda x: x.get("confidence", 0))
            unique_leaks.append(best_leak)
        
        # 按置信度排序
        unique_leaks.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        
        return unique_leaks
    
    def plan_valve_closure(self, suspected_leaks: List[Dict]) -> List[Dict]:
        """
        制定关阀计划
        
        根据疑似漏点位置，确定需要关闭的阀门
        
        策略：
        - minimal: 最小化影响范围，只关闭必要的阀门
        - conservative: 保守策略，关闭更多阀门以确保隔离
        - aggressive: 激进策略，关闭所有相关阀门
        """
        valves_to_close = []
        
        if not suspected_leaks:
            return valves_to_close
        
        # 收集所有涉及的管段
        affected_sections = set()
        for leak in suspected_leaks:
            section_id = leak.get("section_id")
            if section_id:
                affected_sections.add(section_id)
        
        # 根据策略确定需要关闭的阀门
        for section_id in affected_sections:
            section_valves = self._get_valves_for_section(section_id)
            
            if self.isolation_strategy == "minimal":
                # 最小策略：只关闭管段两端的阀门
                valves_to_close.extend(section_valves[:2])  # 最多两个
            elif self.isolation_strategy == "conservative":
                # 保守策略：关闭管段上的所有阀门，加上相邻管段的部分阀门
                valves_to_close.extend(section_valves)
                # 添加相邻管段的入口阀门
                adjacent_valves = self._get_adjacent_valves(section_id)
                valves_to_close.extend(adjacent_valves)
            else:  # aggressive
                # 激进策略：关闭所有相关阀门
                valves_to_close.extend(section_valves)
                # 加上所有相邻管段的阀门
                all_adjacent_valves = self._get_all_adjacent_valves(section_id)
                valves_to_close.extend(all_adjacent_valves)
        
        # 去重并排序
        valves_to_close = self._deduplicate_and_sort_valves(valves_to_close)
        
        return valves_to_close
    
    def _get_valves_for_section(self, section_id: str) -> List[Dict]:
        """获取管段上的阀门"""
        valves = []
        
        if not self.network or not hasattr(self.network, "sections"):
            return valves
        
        section = self.network.sections.get(section_id)
        if not section:
            return valves
        
        if not hasattr(self.network, "valves"):
            return valves
        
        # 获取管段上的阀门
        for valve_id in section.valves:
            valve = self.network.valves.get(valve_id)
            if valve:
                valves.append({
                    "valve_id": valve.valve_id,
                    "name": valve.name,
                    "location": valve.location,
                    "section_id": valve.section_id,
                    "from_node": valve.from_node,
                    "to_node": valve.to_node,
                    "diameter": valve.diameter,
                    "status": valve.status.value if hasattr(valve.status, "value") else str(valve.status),
                    "priority": valve.operation_priority,
                    "x": valve.x,
                    "y": valve.y
                })
        
        # 如果管段上没有明确的阀门，根据节点查找
        if not valves:
            # 查找两端节点的阀门
            for node_id in [section.from_node, section.to_node]:
                if node_id:
                    node_valves = self._find_valves_near_node(node_id, section_id)
                    valves.extend(node_valves)
        
        return valves
    
    def _find_valves_near_node(self, node_id: str, section_id: str) -> List[Dict]:
        """查找节点附近的阀门"""
        valves = []
        
        if not self.network or not hasattr(self.network, "valves"):
            return valves
        
        for valve_id, valve in self.network.valves.items():
            if valve.from_node == node_id or valve.to_node == node_id:
                if valve.section_id == section_id or not valve.section_id:
                    valves.append({
                        "valve_id": valve.valve_id,
                        "name": valve.name,
                        "location": valve.location,
                        "section_id": valve.section_id,
                        "from_node": valve.from_node,
                        "to_node": valve.to_node,
                        "diameter": valve.diameter,
                        "status": valve.status.value if hasattr(valve.status, "value") else str(valve.status),
                        "priority": valve.operation_priority,
                        "x": valve.x,
                        "y": valve.y
                    })
        
        return valves
    
    def _get_adjacent_valves(self, section_id: str) -> List[Dict]:
        """获取相邻管段的入口阀门"""
        valves = []
        
        if not self.network or not hasattr(self.network, "sections"):
            return valves
        
        section = self.network.sections.get(section_id)
        if not section:
            return valves
        
        # 获取相邻管段
        adjacent_sections = set()
        
        # 通过节点查找相邻管段
        for node_id in [section.from_node, section.to_node]:
            if node_id and hasattr(self.network, "nodes"):
                node = self.network.nodes.get(node_id)
                if node:
                    for connected_section in node.connected_sections:
                        if connected_section != section_id:
                            adjacent_sections.add(connected_section)
        
        # 获取相邻管段的阀门（只取每个管段的一个阀门）
        for adj_section_id in list(adjacent_sections)[:2]:  # 限制数量
            adj_valves = self._get_valves_for_section(adj_section_id)
            if adj_valves:
                valves.append(adj_valves[0])  # 只取第一个
        
        return valves
    
    def _get_all_adjacent_valves(self, section_id: str) -> List[Dict]:
        """获取所有相邻管段的所有阀门"""
        valves = []
        
        if not self.network or not hasattr(self.network, "sections"):
            return valves
        
        section = self.network.sections.get(section_id)
        if not section:
            return valves
        
        # 通过BFS查找所有相连的管段
        visited = set()
        queue = deque([section_id])
        
        while queue:
            current = queue.popleft()
            if current in visited:
                continue
            visited.add(current)
            
            current_section = self.network.sections.get(current)
            if not current_section:
                continue
            
            # 查找相邻节点
            for node_id in [current_section.from_node, current_section.to_node]:
                if node_id and hasattr(self.network, "nodes"):
                    node = self.network.nodes.get(node_id)
                    if node:
                        for connected in node.connected_sections:
                            if connected not in visited:
                                queue.append(connected)
        
        # 获取所有相关管段的阀门
        for sec_id in visited:
            if sec_id != section_id:  # 排除自身
                sec_valves = self._get_valves_for_section(sec_id)
                valves.extend(sec_valves)
        
        return valves
    
    def _deduplicate_and_sort_valves(self, valves: List[Dict]) -> List[Dict]:
        """去重并按优先级排序阀门"""
        if not valves:
            return []
        
        # 按阀门ID去重
        seen = set()
        unique_valves = []
        for valve in valves:
            valve_id = valve.get("valve_id")
            if valve_id and valve_id not in seen:
                seen.add(valve_id)
                unique_valves.append(valve)
        
        # 按优先级排序（优先级数字越小越优先）
        unique_valves.sort(key=lambda x: x.get("priority", 999))
        
        return unique_valves
    
    def estimate_affected_users(self, valves_to_close: List[Dict]) -> List[Dict]:
        """
        估算受影响用户
        
        根据需要关闭的阀门，计算受影响的用户
        """
        affected_users = []
        
        if not valves_to_close:
            return affected_users
        
        if not self.network or not hasattr(self.network, "sections"):
            return affected_users
        
        # 收集被隔离的管段
        isolated_sections = set()
        for valve in valves_to_close:
            section_id = valve.get("section_id")
            if section_id:
                isolated_sections.add(section_id)
        
        # 扩展：找到所有被隔离的管段（通过连通性分析）
        isolated_sections = self._expand_isolated_sections(isolated_sections, valves_to_close)
        
        # 收集受影响用户
        for section_id in isolated_sections:
            section = self.network.sections.get(section_id)
            if not section:
                continue
            
            # 从管段获取用户
            if hasattr(self.network, "users"):
                for user_id in section.connected_users:
                    user = self.network.users.get(user_id)
                    if user:
                        affected_users.append({
                            "user_id": user.user_id,
                            "name": user.name,
                            "address": user.address,
                            "node_id": user.node_id,
                            "section_id": user.section_id,
                            "avg_demand": user.avg_demand,
                            "peak_demand": user.peak_demand,
                            "user_type": user.user_type,
                            "x": user.x,
                            "y": user.y
                        })
            
            # 也可以从节点获取用户
            for node_id in [section.from_node, section.to_node]:
                if node_id and hasattr(self.network, "nodes"):
                    node = self.network.nodes.get(node_id)
                    if node:
                        # 查找关联此节点的用户
                        if hasattr(self.network, "users"):
                            for user_id, user in self.network.users.items():
                                if user.node_id == node_id:
                                    # 检查是否已添加
                                    if not any(u.get("user_id") == user_id for u in affected_users):
                                        affected_users.append({
                                            "user_id": user.user_id,
                                            "name": user.name,
                                            "address": user.address,
                                            "node_id": user.node_id,
                                            "section_id": user.section_id,
                                            "avg_demand": user.avg_demand,
                                            "peak_demand": user.peak_demand,
                                            "user_type": user.user_type,
                                            "x": user.x,
                                            "y": user.y
                                        })
        
        # 去重
        seen_users = set()
        unique_users = []
        for user in affected_users:
            user_id = user.get("user_id")
            if user_id and user_id not in seen_users:
                seen_users.add(user_id)
                unique_users.append(user)
        
        # 按用户类型排序（公共设施优先）
        type_priority = {"公共": 1, "商业": 2, "居民": 3}
        unique_users.sort(key=lambda x: type_priority.get(x.get("user_type", "居民"), 999))
        
        return unique_users
    
    def _expand_isolated_sections(self, initial_sections: Set[str], 
                                    valves_to_close: List[Dict]) -> Set[str]:
        """扩展被隔离的管段"""
        if not self.network or not hasattr(self.network, "sections"):
            return initial_sections
        
        # 收集被关闭阀门阻断的连接
        blocked_connections = set()
        for valve in valves_to_close:
            from_node = valve.get("from_node")
            to_node = valve.get("to_node")
            if from_node and to_node:
                blocked_connections.add((from_node, to_node))
                blocked_connections.add((to_node, from_node))
        
        # 从水源开始BFS，找到所有可达的管段
        # 不可达的即为被隔离的
        source_nodes = self._find_source_nodes()
        
        if not source_nodes:
            # 如果找不到水源，假设所有管段都被隔离
            return set(self.network.sections.keys())
        
        # BFS找到可达的管段
        reachable_sections = set()
        visited_nodes = set()
        queue = deque(source_nodes)
        
        while queue:
            current_node = queue.popleft()
            if current_node in visited_nodes:
                continue
            visited_nodes.add(current_node)
            
            # 获取此节点连接的管段
            node = self.network.nodes.get(current_node)
            if not node:
                continue
            
            for section_id in node.connected_sections:
                section = self.network.sections.get(section_id)
                if not section:
                    continue
                
                reachable_sections.add(section_id)
                
                # 检查是否可以通过此管段到达另一端
                other_node = None
                if section.from_node == current_node:
                    other_node = section.to_node
                elif section.to_node == current_node:
                    other_node = section.from_node
                
                if other_node and other_node not in visited_nodes:
                    # 检查连接是否被阻断
                    connection = (current_node, other_node)
                    if connection not in blocked_connections:
                        queue.append(other_node)
        
        # 被隔离的管段 = 所有管段 - 可达管段
        all_sections = set(self.network.sections.keys())
        isolated_sections = all_sections - reachable_sections
        
        # 也包括初始指定的管段
        isolated_sections.update(initial_sections)
        
        return isolated_sections
    
    def _find_source_nodes(self) -> List[str]:
        """查找水源节点"""
        source_nodes = []
        
        if not self.network or not hasattr(self.network, "nodes"):
            return source_nodes
        
        for node_id, node in self.network.nodes.items():
            # 检查节点类型
            if hasattr(node, "node_type"):
                node_type = node.node_type
                if hasattr(node_type, "value"):
                    type_value = node_type.value
                else:
                    type_value = str(node_type)
                
                if "水源" in type_value or "SOURCE" in type_value or "水库" in type_value:
                    source_nodes.append(node_id)
        
        # 如果没有找到明确的水源，选择没有上游的节点
        if not source_nodes:
            # 简单选择第一个节点
            if self.network.nodes:
                first_node = next(iter(self.network.nodes.keys()))
                source_nodes.append(first_node)
        
        return source_nodes
