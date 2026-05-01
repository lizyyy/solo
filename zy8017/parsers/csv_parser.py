"""CSV 订单解析器"""

import csv
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime


class CSVParser:
    """CSV 文件解析器，用于解析订单数据"""
    
    REQUIRED_FIELDS = [
        "order_id",
        "operation_type",
        "show_time",
        "original_seats",
        "new_seats",
        "ticket_price",
        "request_time"
    ]
    
    def parse(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        解析 CSV 文件，返回订单列表
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            订单数据列表，每个订单是一个字典
            
        Raises:
            FileNotFoundError: 文件不存在
            ValueError: CSV 格式错误或缺少必要字段
        """
        if not file_path.exists():
            raise FileNotFoundError(f"订单文件不存在: {file_path}")
        
        orders = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            # 检查必要字段
            missing_fields = set(self.REQUIRED_FIELDS) - set(reader.fieldnames)
            if missing_fields:
                raise ValueError(
                    f"CSV 文件缺少必要字段: {', '.join(missing_fields)}\n"
                    f"必需字段: {', '.join(self.REQUIRED_FIELDS)}"
                )
            
            for row in reader:
                order = self._parse_row(row)
                orders.append(order)
        
        return orders
    
    def _parse_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        """解析单行数据"""
        order = {
            "order_id": row["order_id"].strip(),
            "operation_type": row["operation_type"].strip().lower(),
            "show_time": self._parse_datetime(row["show_time"]),
            "original_seats": self._parse_seats(row["original_seats"]),
            "new_seats": self._parse_seats(row["new_seats"]) if row["new_seats"].strip() else [],
            "ticket_price": self._parse_price(row["ticket_price"]),
            "request_time": self._parse_datetime(row["request_time"]),
        }
        
        # 可选字段
        if "customer_name" in row:
            order["customer_name"] = row["customer_name"].strip()
        if "ticket_category" in row:
            order["ticket_category"] = row["ticket_category"].strip()
        if "notes" in row:
            order["notes"] = row["notes"].strip()
        
        return order
    
    def _parse_datetime(self, datetime_str: str) -> datetime:
        """解析日期时间字符串"""
        datetime_str = datetime_str.strip()
        
        # 尝试多种格式
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(datetime_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期时间格式: {datetime_str}")
    
    def _parse_seats(self, seats_str: str) -> List[Dict[str, Any]]:
        """解析座位字符串，支持多种格式"""
        seats_str = seats_str.strip()
        if not seats_str:
            return []
        
        seats = []
        
        # 支持的分隔符: 逗号、分号、空格
        seat_items = []
        if ',' in seats_str:
            seat_items = [s.strip() for s in seats_str.split(',')]
        elif ';' in seats_str:
            seat_items = [s.strip() for s in seats_str.split(';')]
        else:
            seat_items = [s.strip() for s in seats_str.split()]
        
        for seat_item in seat_items:
            if not seat_item:
                continue
            
            # 解析格式: 区域-排-号 或 区域排号
            seat = self._parse_single_seat(seat_item)
            if seat:
                seats.append(seat)
        
        return seats
    
    def _parse_single_seat(self, seat_str: str) -> Dict[str, Any]:
        """解析单个座位"""
        seat_str = seat_str.strip()
        
        # 格式1: 区域-排-号 (如: A区-5-12)
        if '-' in seat_str:
            parts = seat_str.split('-')
            if len(parts) >= 3:
                return {
                    "section": parts[0].strip(),
                    "row": parts[1].strip(),
                    "number": parts[2].strip(),
                    "raw": seat_str
                }
            elif len(parts) == 2:
                return {
                    "section": "",
                    "row": parts[0].strip(),
                    "number": parts[1].strip(),
                    "raw": seat_str
                }
        
        # 格式2: 区域排号 (如: A区5排12号 或 5排12号)
        import re
        
        # 匹配: 区域+排+号
        match = re.match(r'^(.+?)区?(\d+)排?(\d+)号?$', seat_str)
        if match:
            return {
                "section": match.group(1).strip() + "区" if match.group(1).strip() else "",
                "row": match.group(2).strip(),
                "number": match.group(3).strip(),
                "raw": seat_str
            }
        
        # 匹配: 排+号
        match = re.match(r'^(\d+)排?(\d+)号?$', seat_str)
        if match:
            return {
                "section": "",
                "row": match.group(1).strip(),
                "number": match.group(2).strip(),
                "raw": seat_str
            }
        
        # 默认返回
        return {
            "section": "",
            "row": "",
            "number": "",
            "raw": seat_str
        }
    
    def _parse_price(self, price_str: str) -> float:
        """解析价格字符串"""
        price_str = price_str.strip()
        
        # 移除货币符号
        price_str = price_str.replace('¥', '').replace('￥', '').replace('$', '')
        
        try:
            return float(price_str)
        except ValueError:
            raise ValueError(f"无法解析价格: {price_str}")
