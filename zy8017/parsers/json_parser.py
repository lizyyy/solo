"""JSON 座位图解析器"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional


class JSONParser:
    """JSON 文件解析器，用于解析座位图数据"""
    
    def parse(self, file_path: Path) -> Dict[str, Any]:
        """
        解析 JSON 文件，返回座位图数据
        
        Args:
            file_path: JSON 文件路径
            
        Returns:
            座位图数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
            json.JSONDecodeError: JSON 格式错误
        """
        if not file_path.exists():
            raise FileNotFoundError(f"座位图文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._normalize_seating_data(data)
    
    def _normalize_seating_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化座位图数据格式"""
        normalized = {
            "sections": {},
            "metadata": data.get("metadata", {})
        }
        
        # 处理 sections 格式
        if "sections" in data:
            sections = data["sections"]
            if isinstance(sections, dict):
                for section_id, section_data in sections.items():
                    normalized["sections"][section_id] = self._normalize_section(section_id, section_data)
            elif isinstance(sections, list):
                for section_data in sections:
                    section_id = section_data.get("id", section_data.get("name", ""))
                    normalized["sections"][section_id] = self._normalize_section(section_id, section_data)
        
        # 兼容旧格式：顶级就是区域
        elif "rows" in data or "seats" in data:
            section_id = data.get("id", data.get("name", "main"))
            normalized["sections"][section_id] = self._normalize_section(section_id, data)
        
        # 处理无障碍座位标记
        self._mark_accessible_seats(normalized)
        
        return normalized
    
    def _normalize_section(self, section_id: str, section_data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化单个区域数据"""
        normalized = {
            "id": section_id,
            "name": section_data.get("name", section_id),
            "rows": {}
        }
        
        # 处理行数据
        rows_data = section_data.get("rows", [])
        
        if isinstance(rows_data, dict):
            for row_id, row_data in rows_data.items():
                normalized["rows"][row_id] = self._normalize_row(row_id, row_data)
        elif isinstance(rows_data, list):
            for row_data in rows_data:
                row_id = row_data.get("id", row_data.get("name", ""))
                normalized["rows"][row_id] = self._normalize_row(row_id, row_data)
        
        return normalized
    
    def _normalize_row(self, row_id: str, row_data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化单行数据"""
        normalized = {
            "id": row_id,
            "name": row_data.get("name", row_id),
            "seats": {}
        }
        
        # 处理座位数据
        seats_data = row_data.get("seats", [])
        
        if isinstance(seats_data, dict):
            for seat_num, seat_data in seats_data.items():
                normalized["seats"][seat_num] = self._normalize_seat(seat_num, seat_data)
        elif isinstance(seats_data, list):
            for seat_data in seats_data:
                seat_num = seat_data.get("number", seat_data.get("id", ""))
                normalized["seats"][seat_num] = self._normalize_seat(seat_num, seat_data)
        
        return normalized
    
    def _normalize_seat(self, seat_num: str, seat_data: Any) -> Dict[str, Any]:
        """标准化单个座位数据"""
        if isinstance(seat_data, dict):
            return {
                "number": seat_num,
                "is_available": seat_data.get("is_available", seat_data.get("available", True)),
                "is_accessible": seat_data.get("is_accessible", seat_data.get("accessible", False)),
                "category": seat_data.get("category", seat_data.get("ticket_category", "")),
                "price": seat_data.get("price", 0.0)
            }
        else:
            return {
                "number": seat_num,
                "is_available": True,
                "is_accessible": False,
                "category": "",
                "price": 0.0
            }
    
    def _mark_accessible_seats(self, normalized: Dict[str, Any]) -> None:
        """根据规则标记无障碍座位"""
        # 如果有 accessible_sections 配置，标记整个区域为无障碍
        accessible_sections = normalized.get("metadata", {}).get("accessible_sections", [])
        for section_id in accessible_sections:
            if section_id in normalized["sections"]:
                section = normalized["sections"][section_id]
                for row_id, row in section.get("rows", {}).items():
                    for seat_num, seat in row.get("seats", {}).items():
                        seat["is_accessible"] = True
        
        # 如果有 accessible_rows 配置，标记行为无障碍
        accessible_rows = normalized.get("metadata", {}).get("accessible_rows", {})
        for section_id, rows in accessible_rows.items():
            if section_id in normalized["sections"]:
                section = normalized["sections"][section_id]
                for row_id in rows:
                    if row_id in section.get("rows", {}):
                        row = section["rows"][row_id]
                        for seat_num, seat in row.get("seats", {}).items():
                            seat["is_accessible"] = True
    
    def get_seat_info(self, seating_data: Dict[str, Any], section: str, row: str, number: str) -> Optional[Dict[str, Any]]:
        """
        获取指定座位的信息
        
        Args:
            seating_data: 标准化的座位图数据
            section: 区域ID
            row: 行号
            number: 座位号
            
        Returns:
            座位信息字典，如果不存在则返回 None
        """
        sections = seating_data.get("sections", {})
        
        # 尝试精确匹配
        if section in sections:
            section_data = sections[section]
            rows = section_data.get("rows", {})
            if row in rows:
                row_data = rows[row]
                seats = row_data.get("seats", {})
                if number in seats:
                    return seats[number]
        
        # 尝试模糊匹配（不带"区"字）
        for sec_id, sec_data in sections.items():
            if section and section.rstrip("区") == sec_id.rstrip("区"):
                rows = sec_data.get("rows", {})
                if row in rows:
                    seats = rows[row].get("seats", {})
                    if number in seats:
                        return seats[number]
        
        return None
    
    def get_section_ids(self, seating_data: Dict[str, Any]) -> List[str]:
        """获取所有区域ID列表"""
        return list(seating_data.get("sections", {}).keys())
    
    def is_valid_section(self, seating_data: Optional[Dict[str, Any]], section: str) -> bool:
        """检查区域是否存在"""
        if not section:
            return False
        
        sections = seating_data.get("sections", {})
        
        # 精确匹配
        if section in sections:
            return True
        
        # 模糊匹配
        for sec_id in sections.keys():
            if section.rstrip("区") == sec_id.rstrip("区"):
                return True
        
        return False
