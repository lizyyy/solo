"""路书CSV解析器"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Optional

from ..models import RouteBook, RouteNode, RoutePhase
from .base import ParserResult, ValidationError
from .utils import parse_timestamp, generate_record_id


class RouteCSVParser:
    """路书CSV解析器"""
    
    EXPECTED_HEADERS = [
        ["node_order", "序号", "顺序", "节点顺序", "节点编号"],
        ["location", "地点", "位置", "节点名称", "名称"],
        ["phase", "阶段", "运输阶段", "节点类型"],
        ["planned_start", "计划开始", "计划开始时间"],
        ["planned_end", "计划结束", "计划结束时间"],
        ["actual_start", "实际开始", "实际开始时间"],
        ["actual_end", "实际结束", "实际结束时间"],
        ["description", "描述", "节点描述", "备注"],
        ["contact_person", "联系人", "负责人"],
        ["contact_phone", "联系电话"],
        ["required_photos", "需要照片", "要求照片"],
        ["evidence_required", "需要证据", "交接证据"],
    ]
    
    def __init__(self):
        self.header_mapping: dict[str, str] = {}
    
    def parse(self, file_path: str | Path, shipment_id: str | None = None) -> ParserResult[RouteBook]:
        """解析路书CSV文件"""
        file_path = Path(file_path)
        result = ParserResult[RouteBook](source_file=str(file_path))
        
        nodes: list[RouteNode] = []
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                
                if not reader.fieldnames:
                    result.errors.append(ValidationError(
                        message="无法读取CSV表头",
                        source_file=str(file_path),
                    ))
                    return result
                
                self._map_headers(reader.fieldnames)
                
                for row_idx, row in enumerate(reader, start=2):
                    result.total_rows += 1
                    
                    try:
                        node = self._parse_row(row, row_idx, str(file_path))
                        nodes.append(node)
                        result.valid_rows += 1
                    except ValidationError as e:
                        result.errors.append(e)
                    except Exception as e:
                        result.errors.append(ValidationError(
                            message=f"解析行失败: {str(e)}",
                            line_number=row_idx,
                            source_file=str(file_path),
                        ))
        
        except FileNotFoundError:
            result.errors.append(ValidationError(
                message=f"文件不存在: {file_path}",
                source_file=str(file_path),
            ))
        except Exception as e:
            result.errors.append(ValidationError(
                message=f"读取文件失败: {str(e)}",
                source_file=str(file_path),
            ))
        
        if result.valid_rows > 0 and not result.has_errors:
            nodes.sort(key=lambda n: n.node_order)
            
            route_book = RouteBook(
                route_id=generate_record_id("ROUTE", 1),
                shipment_id=shipment_id or "UNKNOWN",
                origin=nodes[0].location if nodes else "",
                destination=nodes[-1].location if nodes else "",
                nodes=nodes,
            )
            result.data = [route_book]
        
        return result
    
    def _map_headers(self, fieldnames: list[str]):
        """映射CSV表头到标准字段名"""
        fieldnames_lower = [fn.strip().lower() for fn in fieldnames]
        
        for expected_group in self.EXPECTED_HEADERS:
            standard_name = expected_group[0]
            for alt in expected_group:
                alt_lower = alt.lower()
                if alt_lower in fieldnames_lower:
                    idx = fieldnames_lower.index(alt_lower)
                    self.header_mapping[standard_name] = fieldnames[idx]
                    break
    
    def _get_field(self, row: dict[str, str], field_name: str) -> str:
        """从行中获取字段值"""
        csv_field = self.header_mapping.get(field_name, field_name)
        value = row.get(csv_field, row.get(field_name, ""))
        if value is None:
            return ""
        return str(value).strip()
    
    def _parse_row(
        self,
        row: dict[str, str],
        line_number: int,
        source_file: str,
    ) -> RouteNode:
        """解析单行数据"""
        node_order_str = self._get_field(row, "node_order")
        if not node_order_str:
            raise ValidationError(
                message="节点序号不能为空",
                field="node_order",
                line_number=line_number,
                source_file=source_file,
            )
        
        try:
            node_order = int(node_order_str)
        except ValueError:
            raise ValidationError(
                message=f"无效的节点序号格式: {node_order_str}",
                field="node_order",
                value=node_order_str,
                line_number=line_number,
                source_file=source_file,
            )
        
        location = self._get_field(row, "location")
        if not location:
            raise ValidationError(
                message="地点不能为空",
                field="location",
                line_number=line_number,
                source_file=source_file,
            )
        
        phase_str = self._get_field(row, "phase")
        phase = self._parse_phase(phase_str)
        
        planned_start_str = self._get_field(row, "planned_start")
        if not planned_start_str:
            raise ValidationError(
                message="计划开始时间不能为空",
                field="planned_start",
                line_number=line_number,
                source_file=source_file,
            )
        
        try:
            planned_start = parse_timestamp(planned_start_str)
        except ValueError:
            raise ValidationError(
                message=f"无效的计划开始时间格式: {planned_start_str}",
                field="planned_start",
                value=planned_start_str,
                line_number=line_number,
                source_file=source_file,
            )
        
        planned_end_str = self._get_field(row, "planned_end")
        if not planned_end_str:
            raise ValidationError(
                message="计划结束时间不能为空",
                field="planned_end",
                line_number=line_number,
                source_file=source_file,
            )
        
        try:
            planned_end = parse_timestamp(planned_end_str)
        except ValueError:
            raise ValidationError(
                message=f"无效的计划结束时间格式: {planned_end_str}",
                field="planned_end",
                value=planned_end_str,
                line_number=line_number,
                source_file=source_file,
            )
        
        actual_start_str = self._get_field(row, "actual_start")
        actual_start = None
        if actual_start_str:
            try:
                actual_start = parse_timestamp(actual_start_str)
            except ValueError:
                raise ValidationError(
                    message=f"无效的实际开始时间格式: {actual_start_str}",
                    field="actual_start",
                    value=actual_start_str,
                    line_number=line_number,
                    source_file=source_file,
                )
        
        actual_end_str = self._get_field(row, "actual_end")
        actual_end = None
        if actual_end_str:
            try:
                actual_end = parse_timestamp(actual_end_str)
            except ValueError:
                raise ValidationError(
                    message=f"无效的实际结束时间格式: {actual_end_str}",
                    field="actual_end",
                    value=actual_end_str,
                    line_number=line_number,
                    source_file=source_file,
                )
        
        required_photos_str = self._get_field(row, "required_photos")
        required_photos = []
        if required_photos_str:
            required_photos = [p.strip() for p in required_photos_str.split(",") if p.strip()]
        
        evidence_required_str = self._get_field(row, "evidence_required")
        evidence_required = []
        if evidence_required_str:
            evidence_required = [e.strip() for e in evidence_required_str.split(",") if e.strip()]
        
        node_id = generate_record_id("NODE", node_order)
        
        return RouteNode(
            node_id=node_id,
            node_order=node_order,
            location=location,
            phase=phase,
            planned_start_time=planned_start,
            planned_end_time=planned_end,
            actual_start_time=actual_start,
            actual_end_time=actual_end,
            description=self._get_field(row, "description") or None,
            contact_person=self._get_field(row, "contact_person") or None,
            contact_phone=self._get_field(row, "contact_phone") or None,
            required_photos=required_photos,
            evidence_required=evidence_required,
        )
    
    def _parse_phase(self, value: str) -> RoutePhase:
        """解析阶段类型"""
        mapping = {
            "departure": RoutePhase.DEPARTURE,
            "出发": RoutePhase.DEPARTURE,
            "始发": RoutePhase.DEPARTURE,
            "transit": RoutePhase.TRANSIT,
            "运输": RoutePhase.TRANSIT,
            "途中": RoutePhase.TRANSIT,
            "stopover": RoutePhase.STOPOVER,
            "经停": RoutePhase.STOPOVER,
            "停留": RoutePhase.STOPOVER,
            "arrival": RoutePhase.ARRIVAL,
            "到达": RoutePhase.ARRIVAL,
            "抵达": RoutePhase.ARRIVAL,
            "checkpoint": RoutePhase.CHECKPOINT,
            "检查点": RoutePhase.CHECKPOINT,
            "节点": RoutePhase.CHECKPOINT,
        }
        return mapping.get(value.lower(), RoutePhase.TRANSIT)


def parse_route_csv(
    file_path: str | Path,
    shipment_id: str | None = None,
) -> ParserResult[RouteBook]:
    """便捷函数：解析路书CSV文件"""
    parser = RouteCSVParser()
    return parser.parse(file_path, shipment_id)
