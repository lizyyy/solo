from typing import List, Dict, Any, Optional
from datetime import datetime
import math
from app.models import (
    PCBData, BOMItem, RuleSet, Rule, Issue, IssueLocation,
    IssueSeverity, IssueStatus, Statistics, Summary, Layer, ComponentType
)

class RuleEngine:
    def __init__(self, pcb_data: PCBData, rule_set: RuleSet, bom_items: List[BOMItem]):
        self.pcb_data = pcb_data
        self.rule_set = rule_set
        self.bom_items = bom_items
        self.issues: List[Dict[str, Any]] = []
        self.issue_counter = 0

    def _get_next_issue_id(self) -> str:
        self.issue_counter += 1
        return f"ISS-{self.issue_counter:05d}"

    def _create_issue(
        self,
        rule_id: str,
        rule_name: str,
        category: str,
        severity: IssueSeverity,
        title: str,
        description: str,
        suggestion: str,
        location: Optional[IssueLocation] = None
    ) -> Dict[str, Any]:
        if location is None:
            location = IssueLocation()
        
        return {
            "id": self._get_next_issue_id(),
            "rule_id": rule_id,
            "rule_name": rule_name,
            "category": category,
            "severity": severity.value,
            "status": IssueStatus.OPEN.value,
            "title": title,
            "description": description,
            "suggestion": suggestion,
            "location": location.model_dump(),
            "created_at": datetime.now().isoformat(),
            "notes": []
        }

    def _get_rule(self, rule_id: str) -> Optional[Rule]:
        for rule in self.rule_set.rules:
            if rule.id == rule_id:
                return rule
        return None

    def check_trace_width(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("trace_width")
        
        if not rule or not rule.enabled:
            return issues
        
        min_width = rule.parameters.get("min_width", 0.15)
        critical_nets = rule.parameters.get("critical_nets", {})
        
        for track in self.pcb_data.tracks:
            if not track.is_trace:
                continue
            
            current_min = min_width
            if track.net_name in critical_nets:
                current_min = critical_nets.get(track.net_name, min_width)
            
            if track.width < current_min:
                location = IssueLocation(
                    x=(track.start_x + track.end_x) / 2,
                    y=(track.start_y + track.end_y) / 2,
                    layer=track.layer.value,
                    net_name=track.net_name,
                    affected_elements=[track.id]
                )
                
                issue = self._create_issue(
                    rule_id="trace_width",
                    rule_name=rule.name,
                    category="electrical",
                    severity=rule.severity,
                    title="走线宽度不足",
                    description=f"走线 {track.id} 宽度为 {track.width}mm，小于最小要求 {current_min}mm",
                    suggestion=f"增加走线宽度至至少 {current_min}mm，或调整规则阈值",
                    location=location
                )
                issues.append(issue)
        
        return issues

    def check_clearance(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("clearance")
        
        if not rule or not rule.enabled:
            return issues
        
        min_clearance = rule.parameters.get("min_clearance", 0.15)
        pad_to_pad = rule.parameters.get("pad_to_pad", 0.2)
        pad_to_trace = rule.parameters.get("pad_to_trace", 0.15)
        trace_to_trace = rule.parameters.get("trace_to_trace", 0.15)
        via_to_any = rule.parameters.get("via_to_any", 0.15)
        
        for i, track1 in enumerate(self.pcb_data.tracks):
            for track2 in self.pcb_data.tracks[i+1:]:
                if track1.layer != track2.layer:
                    continue
                
                distance = self._calculate_line_distance(
                    track1.start_x, track1.start_y, track1.end_x, track1.end_y,
                    track2.start_x, track2.start_y, track2.end_x, track2.end_y
                )
                
                if distance < trace_to_trace:
                    location = IssueLocation(
                        x=(track1.start_x + track1.end_x + track2.start_x + track2.end_x) / 4,
                        y=(track1.start_y + track1.end_y + track2.start_y + track2.end_y) / 4,
                        layer=track1.layer.value,
                        affected_elements=[track1.id, track2.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="clearance",
                        rule_name=rule.name,
                        category="electrical",
                        severity=rule.severity,
                        title="走线间距不足",
                        description=f"走线 {track1.id} 和 {track2.id} 间距为 {distance:.3f}mm，小于最小要求 {trace_to_trace}mm",
                        suggestion=f"增加走线间距至至少 {trace_to_trace}mm，或调整规则阈值",
                        location=location
                    )
                    issues.append(issue)
        
        for i, pad1 in enumerate(self.pcb_data.pads):
            for pad2 in self.pcb_data.pads[i+1:]:
                if pad1.layer != pad2.layer:
                    continue
                
                distance = self._calculate_pad_distance(pad1, pad2)
                
                if distance < pad_to_pad:
                    location = IssueLocation(
                        x=(pad1.x + pad2.x) / 2,
                        y=(pad1.y + pad2.y) / 2,
                        layer=pad1.layer.value,
                        affected_elements=[pad1.id, pad2.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="clearance",
                        rule_name=rule.name,
                        category="electrical",
                        severity=rule.severity,
                        title="焊盘间距不足",
                        description=f"焊盘 {pad1.id} 和 {pad2.id} 间距为 {distance:.3f}mm，小于最小要求 {pad_to_pad}mm",
                        suggestion=f"增加焊盘间距至至少 {pad_to_pad}mm，或调整规则阈值",
                        location=location
                    )
                    issues.append(issue)
        
        for via in self.pcb_data.vias:
            for track in self.pcb_data.tracks:
                if track.layer not in [Layer.TOP, Layer.BOTTOM]:
                    continue
                
                distance = self._calculate_point_to_line_distance(
                    via.x, via.y,
                    track.start_x, track.start_y, track.end_x, track.end_y
                ) - via.pad_diameter / 2
                
                if distance < via_to_any:
                    location = IssueLocation(
                        x=via.x,
                        y=via.y,
                        affected_elements=[via.id, track.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="clearance",
                        rule_name=rule.name,
                        category="electrical",
                        severity=rule.severity,
                        title="过孔与走线间距不足",
                        description=f"过孔 {via.id} 与走线 {track.id} 间距为 {distance:.3f}mm，小于最小要求 {via_to_any}mm",
                        suggestion=f"增加间距至至少 {via_to_any}mm，或调整规则阈值",
                        location=location
                    )
                    issues.append(issue)
        
        return issues

    def check_via_size(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("via_size")
        
        if not rule or not rule.enabled:
            return issues
        
        min_drill = rule.parameters.get("min_drill", 0.3)
        max_drill = rule.parameters.get("max_drill", 6.0)
        min_annular_ring = rule.parameters.get("min_annular_ring", 0.15)
        
        for via in self.pcb_data.vias:
            annular_ring = (via.pad_diameter - via.drill_diameter) / 2
            
            if via.drill_diameter < min_drill:
                location = IssueLocation(
                    x=via.x,
                    y=via.y,
                    affected_elements=[via.id]
                )
                
                issue = self._create_issue(
                    rule_id="via_size",
                    rule_name=rule.name,
                    category="manufacturing",
                    severity=rule.severity,
                    title="过孔钻孔直径过小",
                    description=f"过孔 {via.id} 钻孔直径为 {via.drill_diameter}mm，小于最小要求 {min_drill}mm",
                    suggestion=f"增加钻孔直径至至少 {min_drill}mm，或调整规则阈值",
                    location=location
                )
                issues.append(issue)
            
            if via.drill_diameter > max_drill:
                location = IssueLocation(
                    x=via.x,
                    y=via.y,
                    affected_elements=[via.id]
                )
                
                issue = self._create_issue(
                    rule_id="via_size",
                    rule_name=rule.name,
                    category="manufacturing",
                    severity=rule.severity,
                    title="过孔钻孔直径过大",
                    description=f"过孔 {via.id} 钻孔直径为 {via.drill_diameter}mm，大于最大要求 {max_drill}mm",
                    suggestion=f"减小钻孔直径至最多 {max_drill}mm，或调整规则阈值",
                    location=location
                )
                issues.append(issue)
            
            if annular_ring < min_annular_ring:
                location = IssueLocation(
                    x=via.x,
                    y=via.y,
                    affected_elements=[via.id]
                )
                
                issue = self._create_issue(
                    rule_id="via_size",
                    rule_name=rule.name,
                    category="manufacturing",
                    severity=rule.severity,
                    title="过孔环形焊盘宽度不足",
                    description=f"过孔 {via.id} 环形焊盘宽度为 {annular_ring:.3f}mm，小于最小要求 {min_annular_ring}mm",
                    suggestion=f"增加环形焊盘宽度至至少 {min_annular_ring}mm，可通过增大焊盘直径或减小钻孔直径实现",
                    location=location
                )
                issues.append(issue)
        
        return issues

    def check_component_to_edge(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("component_to_edge")
        
        if not rule or not rule.enabled:
            return issues
        
        min_distance = rule.parameters.get("min_distance", 2.0)
        connectors_extra = rule.parameters.get("connectors_extra", 3.0)
        
        board_width = self.pcb_data.board_outline.width
        board_height = self.pcb_data.board_outline.height
        
        for component in self.pcb_data.components:
            required_distance = min_distance
            
            if component.component_type == ComponentType.CONNECTOR:
                required_distance += connectors_extra
            
            component_bounds = self._get_component_bounds(component)
            
            distances = [
                component_bounds["x"],
                board_width - (component_bounds["x"] + component_bounds["width"]),
                component_bounds["y"],
                board_height - (component_bounds["y"] + component_bounds["height"])
            ]
            
            min_actual = min(distances)
            
            if min_actual < required_distance:
                location = IssueLocation(
                    x=component.x,
                    y=component.y,
                    layer=component.layer.value,
                    reference=component.reference,
                    affected_elements=[component.id]
                )
                
                issue = self._create_issue(
                    rule_id="component_to_edge",
                    rule_name=rule.name,
                    category="assembly",
                    severity=rule.severity,
                    title="器件距离板边过近",
                    description=f"器件 {component.reference} ({component.id}) 距离板边最小距离为 {min_actual:.3f}mm，小于要求的 {required_distance}mm",
                    suggestion=f"将器件向板内移动至少 {required_distance - min_actual:.3f}mm",
                    location=location
                )
                issues.append(issue)
        
        return issues

    def check_silkscreen_over_pad(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("silkscreen_over_pad")
        
        if not rule or not rule.enabled:
            return issues
        
        min_clearance = rule.parameters.get("min_clearance", 0.1)
        
        for silk in self.pcb_data.silk_screen:
            for pad in self.pcb_data.pads:
                if silk.layer != pad.layer:
                    continue
                
                distance = self._calculate_silk_to_pad_distance(silk, pad)
                
                if distance < min_clearance:
                    location = IssueLocation(
                        x=pad.x,
                        y=pad.y,
                        layer=pad.layer.value,
                        affected_elements=[silk.id, pad.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="silkscreen_over_pad",
                        rule_name=rule.name,
                        category="manufacturing",
                        severity=rule.severity,
                        title="丝印压到焊盘",
                        description=f"丝印 {silk.id} 与焊盘 {pad.id} 间距为 {distance:.3f}mm，小于要求的 {min_clearance}mm",
                        suggestion=f"移动丝印或调整位置，确保与焊盘间距至少 {min_clearance}mm",
                        location=location
                    )
                    issues.append(issue)
        
        return issues

    def check_bom_availability(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("bom_availability")
        
        if not rule or not rule.enabled:
            return issues
        
        require_alternate = rule.parameters.get("require_alternate", False)
        critical_components = rule.parameters.get("critical_components", [])
        
        bom_dict = {item.reference: item for item in self.bom_items}
        
        for component in self.pcb_data.components:
            bom_item = bom_dict.get(component.reference)
            
            if not bom_item:
                location = IssueLocation(
                    x=component.x,
                    y=component.y,
                    reference=component.reference,
                    affected_elements=[component.id]
                )
                
                issue = self._create_issue(
                    rule_id="bom_availability",
                    rule_name=rule.name,
                    category="bom",
                    severity=IssueSeverity.CRITICAL,
                    title="BOM中缺少器件",
                    description=f"器件 {component.reference} 在PCB上存在，但在BOM中未找到",
                    suggestion=f"在BOM中添加器件 {component.reference} 的信息",
                    location=location
                )
                issues.append(issue)
                continue
            
            if not bom_item.is_available:
                location = IssueLocation(
                    x=component.x,
                    y=component.y,
                    reference=component.reference,
                    affected_elements=[component.id]
                )
                
                severity = rule.severity
                if component.reference in critical_components or bom_item.part_number in critical_components:
                    severity = IssueSeverity.CRITICAL
                
                issue = self._create_issue(
                    rule_id="bom_availability",
                    rule_name=rule.name,
                    category="bom",
                    severity=severity,
                    title="BOM器件缺货",
                    description=f"器件 {component.reference} (PN: {bom_item.part_number}) 标记为不可用/缺货",
                    suggestion=f"查找替代料号或联系供应商确认交货期",
                    location=location
                )
                issues.append(issue)
            
            if require_alternate and not bom_item.alternate_part_numbers:
                if component.component_type in [ComponentType.IC, ComponentType.CONNECTOR, ComponentType.DIODE]:
                    location = IssueLocation(
                        x=component.x,
                        y=component.y,
                        reference=component.reference,
                        affected_elements=[component.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="bom_availability",
                        rule_name=rule.name,
                        category="bom",
                        severity=IssueSeverity.INFO,
                        title="BOM缺少替代料号",
                        description=f"关键器件 {component.reference} 在BOM中未提供替代料号",
                        suggestion=f"考虑添加替代料号以降低供应链风险",
                        location=location
                    )
                    issues.append(issue)
        
        return issues

    def check_footprint_match(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("footprint_match")
        
        if not rule or not rule.enabled:
            return issues
        
        bom_dict = {item.reference: item for item in self.bom_items}
        
        for component in self.pcb_data.components:
            bom_item = bom_dict.get(component.reference)
            
            if not bom_item:
                continue
            
            pcb_footprint = component.footprint.lower().replace("-", "").replace("_", "")
            bom_footprint = bom_item.footprint.lower().replace("-", "").replace("_", "")
            
            if pcb_footprint and bom_footprint and pcb_footprint != bom_footprint:
                location = IssueLocation(
                    x=component.x,
                    y=component.y,
                    reference=component.reference,
                    affected_elements=[component.id]
                )
                
                issue = self._create_issue(
                    rule_id="footprint_match",
                    rule_name=rule.name,
                    category="bom",
                    severity=rule.severity,
                    title="封装不匹配",
                    description=f"器件 {component.reference} 的PCB封装为 {component.footprint}，但BOM中指定为 {bom_item.footprint}",
                    suggestion=f"确认正确的封装并同步PCB和BOM",
                    location=location
                )
                issues.append(issue)
        
        return issues

    def check_polarity_direction(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("polarity_direction")
        
        if not rule or not rule.enabled:
            return issues
        
        allowed_rotations = rule.parameters.get("allowed_rotations", [0, 90, 180, 270])
        check_diode_alignment = rule.parameters.get("check_diode_alignment", True)
        
        for component in self.pcb_data.components:
            if not component.is_polar:
                continue
            
            rotation = component.rotation % 360
            if rotation not in allowed_rotations:
                location = IssueLocation(
                    x=component.x,
                    y=component.y,
                    reference=component.reference,
                    affected_elements=[component.id]
                )
                
                issue = self._create_issue(
                    rule_id="polarity_direction",
                    rule_name=rule.name,
                    category="assembly",
                    severity=rule.severity,
                    title="极性器件方向异常",
                    description=f"极性器件 {component.reference} 的旋转角度为 {rotation}°，不在允许的角度列表中",
                    suggestion=f"将器件旋转至 {allowed_rotations} 中的一个角度",
                    location=location
                )
                issues.append(issue)
            
            if check_diode_alignment and component.component_type in [ComponentType.DIODE, ComponentType.LED]:
                if rotation in [180, 270]:
                    location = IssueLocation(
                        x=component.x,
                        y=component.y,
                        reference=component.reference,
                        affected_elements=[component.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="polarity_direction",
                        rule_name=rule.name,
                        category="assembly",
                        severity=IssueSeverity.WARNING,
                        title="二极管/LED方向可能错误",
                        description=f"器件 {component.reference} 旋转角度为 {rotation}°，可能导致极性方向错误",
                        suggestion=f"确认器件极性方向是否正确，丝印标记是否与焊盘对应",
                        location=location
                    )
                    issues.append(issue)
        
        return issues

    def check_connector_orientation(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("connector_orientation")
        
        if not rule or not rule.enabled:
            return issues
        
        edge_connectors_outward = rule.parameters.get("edge_connectors_outward", True)
        pin1_location = rule.parameters.get("pin1_location", "left")
        
        for component in self.pcb_data.components:
            if component.component_type != ComponentType.CONNECTOR:
                continue
            
            board_width = self.pcb_data.board_outline.width
            board_height = self.pcb_data.board_outline.height
            
            is_edge = False
            edge_side = None
            
            if component.x < 5.0:
                is_edge = True
                edge_side = "left"
            elif component.x > board_width - 5.0:
                is_edge = True
                edge_side = "right"
            elif component.y < 5.0:
                is_edge = True
                edge_side = "bottom"
            elif component.y > board_height - 5.0:
                is_edge = True
                edge_side = "top"
            
            if is_edge and edge_connectors_outward:
                rotation = component.rotation % 360
                
                expected_rotations = {
                    "left": [0, 360],
                    "right": [180],
                    "bottom": [90],
                    "top": [270]
                }
                
                if rotation not in expected_rotations.get(edge_side, []):
                    location = IssueLocation(
                        x=component.x,
                        y=component.y,
                        reference=component.reference,
                        affected_elements=[component.id]
                    )
                    
                    issue = self._create_issue(
                        rule_id="connector_orientation",
                        rule_name=rule.name,
                        category="assembly",
                        severity=rule.severity,
                        title="连接器朝向可能错误",
                        description=f"连接器 {component.reference} 位于 {edge_side} 边缘，但旋转角度为 {rotation}°，可能朝向不正确",
                        suggestion=f"确认连接器是否朝向外边缘，需要时调整旋转角度",
                        location=location
                    )
                    issues.append(issue)
        
        return issues

    def check_thermal_margin(self) -> List[Dict[str, Any]]:
        issues = []
        rule = self._get_rule("thermal_margin")
        
        if not rule or not rule.enabled:
            return issues
        
        high_power_threshold = rule.parameters.get("high_power_threshold", 0.5)
        min_clearance = rule.parameters.get("min_clearance", 1.0)
        thermal_vias_required = rule.parameters.get("thermal_vias_required", True)
        via_count_min = rule.parameters.get("via_count_min", 4)
        
        for component in self.pcb_data.components:
            power = component.power_dissipation or 0.0
            
            if power >= high_power_threshold:
                location = IssueLocation(
                    x=component.x,
                    y=component.y,
                    reference=component.reference,
                    affected_elements=[component.id]
                )
                
                nearby_components = []
                for other in self.pcb_data.components:
                    if other.id == component.id:
                        continue
                    
                    distance = math.sqrt(
                        (component.x - other.x) ** 2 +
                        (component.y - other.y) ** 2
                    )
                    
                    if distance < min_clearance:
                        nearby_components.append(other.reference)
                
                if nearby_components:
                    issue = self._create_issue(
                        rule_id="thermal_margin",
                        rule_name=rule.name,
                        category="thermal",
                        severity=rule.severity,
                        title="高功耗器件散热余量不足",
                        description=f"高功耗器件 {component.reference} ({power}W) 附近有器件 {', '.join(nearby_components)} 距离小于 {min_clearance}mm",
                        suggestion=f"增加器件间距至至少 {min_clearance}mm，或考虑添加散热措施",
                        location=location
                    )
                    issues.append(issue)
                
                if thermal_vias_required:
                    via_count = 0
                    for via in self.pcb_data.vias:
                        distance = math.sqrt(
                            (component.x - via.x) ** 2 +
                            (component.y - via.y) ** 2
                        )
                        if distance < 5.0:
                            via_count += 1
                    
                    if via_count < via_count_min:
                        issue = self._create_issue(
                            rule_id="thermal_margin",
                            rule_name=rule.name,
                            category="thermal",
                            severity=IssueSeverity.WARNING,
                            title="高功耗器件散热过孔不足",
                            description=f"高功耗器件 {component.reference} ({power}W) 附近仅发现 {via_count} 个过孔，建议至少 {via_count_min} 个",
                            suggestion=f"在器件下方或附近添加更多散热过孔",
                            location=location
                        )
                        issues.append(issue)
        
        return issues

    def _calculate_line_distance(
        self, x1: float, y1: float, x2: float, y2: float,
        x3: float, y3: float, x4: float, y4: float
    ) -> float:
        def point_to_segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
            vx = bx - ax
            vy = by - ay
            wx = px - ax
            wy = py - ay
            
            c1 = wx * vx + wy * vy
            if c1 <= 0:
                return math.sqrt(wx * wx + wy * wy)
            
            c2 = vx * vx + vy * vy
            if c2 <= c1:
                dx = px - bx
                dy = py - by
                return math.sqrt(dx * dx + dy * dy)
            
            b = c1 / c2
            bx = ax + b * vx
            by = ay + b * vy
            dx = px - bx
            dy = py - by
            return math.sqrt(dx * dx + dy * dy)
        
        distances = [
            point_to_segment_distance(x1, y1, x3, y3, x4, y4),
            point_to_segment_distance(x2, y2, x3, y3, x4, y4),
            point_to_segment_distance(x3, y3, x1, y1, x2, y2),
            point_to_segment_distance(x4, y4, x1, y1, x2, y2)
        ]
        
        return min(distances)

    def _calculate_pad_distance(self, pad1, pad2) -> float:
        center_distance = math.sqrt(
            (pad1.x - pad2.x) ** 2 +
            (pad1.y - pad2.y) ** 2
        )
        
        radius1 = max(pad1.width, pad1.height) / 2
        radius2 = max(pad2.width, pad2.height) / 2
        
        edge_distance = center_distance - radius1 - radius2
        
        return max(edge_distance, 0.0)

    def _calculate_point_to_line_distance(
        self, px: float, py: float,
        x1: float, y1: float, x2: float, y2: float
    ) -> float:
        numerator = abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1)
        denominator = math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2)
        
        if denominator == 0:
            return math.sqrt((px - x1) ** 2 + (py - y1) ** 2)
        
        return numerator / denominator

    def _calculate_silk_to_pad_distance(self, silk, pad) -> float:
        silk_bounds = {
            "x": silk.x - (silk.width or 1.0) / 2,
            "y": silk.y - (silk.height or 0.5) / 2,
            "width": silk.width or 1.0,
            "height": silk.height or 0.5
        }
        
        pad_bounds = {
            "x": pad.x - pad.width / 2,
            "y": pad.y - pad.height / 2,
            "width": pad.width,
            "height": pad.height
        }
        
        overlap = not (
            silk_bounds["x"] + silk_bounds["width"] < pad_bounds["x"] or
            pad_bounds["x"] + pad_bounds["width"] < silk_bounds["x"] or
            silk_bounds["y"] + silk_bounds["height"] < pad_bounds["y"] or
            pad_bounds["y"] + pad_bounds["height"] < silk_bounds["y"]
        )
        
        if overlap:
            return 0.0
        
        dx = max(pad_bounds["x"] - (silk_bounds["x"] + silk_bounds["width"]),
                 silk_bounds["x"] - (pad_bounds["x"] + pad_bounds["width"]),
                 0)
        dy = max(pad_bounds["y"] - (silk_bounds["y"] + silk_bounds["height"]),
                 silk_bounds["y"] - (pad_bounds["y"] + pad_bounds["height"]),
                 0)
        
        return math.sqrt(dx * dx + dy * dy)

    def _get_component_bounds(self, component) -> Dict[str, float]:
        min_x = component.x
        max_x = component.x
        min_y = component.y
        max_y = component.y
        
        for pad in component.pads:
            pad_min_x = pad.x - pad.width / 2
            pad_max_x = pad.x + pad.width / 2
            pad_min_y = pad.y - pad.height / 2
            pad_max_y = pad.y + pad.height / 2
            
            min_x = min(min_x, pad_min_x)
            max_x = max(max_x, pad_max_x)
            min_y = min(min_y, pad_min_y)
            max_y = max(max_y, pad_max_y)
        
        if not component.pads:
            min_x = component.x - 2.0
            max_x = component.x + 2.0
            min_y = component.y - 1.0
            max_y = component.y + 1.0
        
        return {
            "x": min_x,
            "y": min_y,
            "width": max_x - min_x,
            "height": max_y - min_y
        }

    def run_all_checks(self) -> Dict[str, Any]:
        self.issues = []
        self.issue_counter = 0
        
        check_functions = [
            ("trace_width", self.check_trace_width),
            ("clearance", self.check_clearance),
            ("via_size", self.check_via_size),
            ("component_to_edge", self.check_component_to_edge),
            ("silkscreen_over_pad", self.check_silkscreen_over_pad),
            ("bom_availability", self.check_bom_availability),
            ("footprint_match", self.check_footprint_match),
            ("polarity_direction", self.check_polarity_direction),
            ("connector_orientation", self.check_connector_orientation),
            ("thermal_margin", self.check_thermal_margin),
        ]
        
        for rule_id, check_func in check_functions:
            try:
                issues = check_func()
                self.issues.extend(issues)
            except Exception as e:
                print(f"检查 {rule_id} 时出错: {e}")
        
        stats = Statistics()
        for issue in self.issues:
            stats.total += 1
            if issue["severity"] == IssueSeverity.CRITICAL.value:
                stats.critical += 1
            elif issue["severity"] == IssueSeverity.WARNING.value:
                stats.warning += 1
            elif issue["severity"] == IssueSeverity.INFO.value:
                stats.info += 1
            
            if issue["status"] == IssueStatus.OPEN.value:
                stats.open += 1
            elif issue["status"] == IssueStatus.CONFIRMED.value:
                stats.confirmed += 1
            elif issue["status"] == IssueStatus.FALSE_POSITIVE.value:
                stats.false_positive += 1
            elif issue["status"] == IssueStatus.RESOLVED.value:
                stats.resolved += 1
        
        enabled_rules = [r for r in self.rule_set.rules if r.enabled]
        failed_rule_ids = set(issue["rule_id"] for issue in self.issues)
        passed_rules = [r for r in enabled_rules if r.id not in failed_rule_ids]
        
        summary = Summary(
            board_name=self.pcb_data.name,
            check_timestamp=datetime.now().isoformat(),
            components_checked=len(self.pcb_data.components),
            nets_checked=len(self.pcb_data.net_list),
            rules_applied=len(enabled_rules),
            rules_passed=len(passed_rules),
            rules_failed=len(enabled_rules) - len(passed_rules)
        )
        
        return {
            "issues": self.issues,
            "statistics": stats.model_dump(),
            "summary": summary.model_dump()
        }
