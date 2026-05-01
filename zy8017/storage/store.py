"""数据存储"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from collections import defaultdict


@dataclass
class Seat:
    """座位数据模型"""
    section: str
    row: str
    number: str
    is_available: bool = True
    is_accessible: bool = False
    category: str = ""
    price: float = 0.0
    raw: str = ""
    
    def get_id(self) -> str:
        """获取座位唯一标识"""
        return f"{self.section}:{self.row}:{self.number}"
    
    def __str__(self) -> str:
        if self.section:
            return f"{self.section}{self.row}排{self.number}号"
        return f"{self.row}排{self.number}号"


@dataclass
class Order:
    """订单数据模型"""
    order_id: str
    operation_type: str  # refund, exchange
    show_time: datetime
    original_seats: List[Seat]
    new_seats: List[Seat]
    ticket_price: float
    request_time: datetime
    customer_name: str = ""
    ticket_category: str = ""
    notes: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    def is_refund(self) -> bool:
        """是否为退票操作"""
        return self.operation_type.lower() in ["refund", "退票"]
    
    def is_exchange(self) -> bool:
        """是否为换座操作"""
        return self.operation_type.lower() in ["exchange", "换座"]
    
    def get_minutes_before_show(self) -> int:
        """获取距离开演的分钟数"""
        delta = self.show_time - self.request_time
        return int(delta.total_seconds() / 60)
    
    def get_hours_before_show(self) -> float:
        """获取距离开演的小时数"""
        return self.get_minutes_before_show() / 60


@dataclass
class TicketCategory:
    """票档数据模型"""
    id: str
    name: str
    price: float
    refund_allowed: bool = True
    exchange_allowed: bool = True
    refund_fee_rate: float = 0.0
    exchange_fee_rate: float = 0.0
    sections: List[str] = field(default_factory=list)
    description: str = ""


@dataclass
class Section:
    """区域数据模型"""
    id: str
    name: str
    rows: Dict[str, Dict[str, Seat]] = field(default_factory=dict)
    
    def get_seat(self, row: str, number: str) -> Optional[Seat]:
        """获取指定座位"""
        if row in self.rows:
            if number in self.rows[row]:
                return self.rows[row][number]
        return None
    
    def get_all_seats(self) -> List[Seat]:
        """获取所有座位"""
        seats = []
        for row in self.rows.values():
            seats.extend(row.values())
        return seats


class DataStore:
    """数据存储类"""
    
    def __init__(self):
        self._orders: Dict[str, Order] = {}
        self._sections: Dict[str, Section] = {}
        self._categories: Dict[str, TicketCategory] = {}
        self._refund_rules: Dict[str, Any] = {}
        self._exchange_rules: Dict[str, Any] = {}
        self._general_rules: Dict[str, Any] = {}
        
        # 索引
        self._orders_by_id: Dict[str, List[Order]] = defaultdict(list)  # 处理重复订单号
    
    def load_data(
        self,
        orders_data: List[Dict],
        seating_data: Dict,
        rules_data: Dict
    ):
        """
        加载所有数据
        
        Args:
            orders_data: 解析后的订单数据列表
            seating_data: 解析后的座位图数据
            rules_data: 解析后的规则数据
        """
        self._load_orders(orders_data)
        self._load_seating(seating_data)
        self._load_rules(rules_data)
    
    def _load_orders(self, orders_data: List[Dict]):
        """加载订单数据"""
        self._orders.clear()
        self._orders_by_id.clear()
        
        for order_dict in orders_data:
            order = self._create_order(order_dict)
            self._orders[f"{order.order_id}_{id(order)}"] = order
            self._orders_by_id[order.order_id].append(order)
    
    def _create_order(self, order_dict: Dict) -> Order:
        """创建订单对象"""
        original_seats = [
            self._create_seat(seat_dict) 
            for seat_dict in order_dict.get("original_seats", [])
        ]
        new_seats = [
            self._create_seat(seat_dict)
            for seat_dict in order_dict.get("new_seats", [])
        ]
        
        return Order(
            order_id=order_dict.get("order_id", ""),
            operation_type=order_dict.get("operation_type", ""),
            show_time=order_dict.get("show_time"),
            original_seats=original_seats,
            new_seats=new_seats,
            ticket_price=order_dict.get("ticket_price", 0.0),
            request_time=order_dict.get("request_time"),
            customer_name=order_dict.get("customer_name", ""),
            ticket_category=order_dict.get("ticket_category", ""),
            notes=order_dict.get("notes", ""),
            raw_data=order_dict
        )
    
    def _create_seat(self, seat_dict: Dict) -> Seat:
        """创建座位对象"""
        return Seat(
            section=seat_dict.get("section", ""),
            row=seat_dict.get("row", ""),
            number=seat_dict.get("number", ""),
            raw=seat_dict.get("raw", "")
        )
    
    def _load_seating(self, seating_data: Dict):
        """加载座位图数据"""
        self._sections.clear()
        
        sections_data = seating_data.get("sections", {})
        
        for section_id, section_dict in sections_data.items():
            section = Section(
                id=section_id,
                name=section_dict.get("name", section_id)
            )
            
            rows_data = section_dict.get("rows", {})
            
            for row_id, row_dict in rows_data.items():
                section.rows[row_id] = {}
                
                seats_data = row_dict.get("seats", {})
                
                for seat_num, seat_dict in seats_data.items():
                    seat = Seat(
                        section=section_id,
                        row=row_id,
                        number=seat_num,
                        is_available=seat_dict.get("is_available", True),
                        is_accessible=seat_dict.get("is_accessible", False),
                        category=seat_dict.get("category", ""),
                        price=seat_dict.get("price", 0.0)
                    )
                    section.rows[row_id][seat_num] = seat
            
            self._sections[section_id] = section
    
    def _load_rules(self, rules_data: Dict):
        """加载规则数据"""
        self._categories.clear()
        
        # 加载票档
        categories_data = rules_data.get("ticket_categories", {})
        
        for cat_id, cat_dict in categories_data.items():
            category = TicketCategory(
                id=cat_id,
                name=cat_dict.get("name", cat_id),
                price=cat_dict.get("price", 0.0),
                refund_allowed=cat_dict.get("refund_allowed", True),
                exchange_allowed=cat_dict.get("exchange_allowed", True),
                refund_fee_rate=cat_dict.get("refund_fee_rate", 0.0),
                exchange_fee_rate=cat_dict.get("exchange_fee_rate", 0.0),
                sections=cat_dict.get("sections", []),
                description=cat_dict.get("description", "")
            )
            self._categories[cat_id] = category
        
        # 加载退票规则
        self._refund_rules = rules_data.get("refund_rules", {})
        
        # 加载换座规则
        self._exchange_rules = rules_data.get("exchange_rules", {})
        
        # 加载通用规则
        self._general_rules = rules_data.get("general_rules", {})
    
    def get_all_orders(self) -> List[Order]:
        """获取所有订单"""
        return list(self._orders.values())
    
    def get_order_by_id(self, order_id: str) -> Optional[Order]:
        """
        根据订单号获取订单
        
        注意：如果有重复订单号，只返回第一个
        """
        orders = self._orders_by_id.get(order_id, [])
        return orders[0] if orders else None
    
    def get_orders_by_id(self, order_id: str) -> List[Order]:
        """根据订单号获取所有订单（处理重复订单号）"""
        return self._orders_by_id.get(order_id, [])
    
    def has_duplicate_orders(self) -> bool:
        """检查是否有重复订单号"""
        for order_id, orders in self._orders_by_id.items():
            if len(orders) > 1:
                return True
        return False
    
    def get_duplicate_order_ids(self) -> List[str]:
        """获取所有重复的订单号"""
        return [
            order_id for order_id, orders in self._orders_by_id.items()
            if len(orders) > 1
        ]
    
    def get_section(self, section_id: str) -> Optional[Section]:
        """获取区域"""
        # 精确匹配
        if section_id in self._sections:
            return self._sections[section_id]
        
        # 模糊匹配
        for sec_id, section in self._sections.items():
            if section_id.rstrip("区") == sec_id.rstrip("区"):
                return section
        
        return None
    
    def get_all_sections(self) -> List[Section]:
        """获取所有区域"""
        return list(self._sections.values())
    
    def get_section_ids(self) -> List[str]:
        """获取所有区域ID"""
        return list(self._sections.keys())
    
    def get_seat(self, section: str, row: str, number: str) -> Optional[Seat]:
        """获取座位"""
        sec = self.get_section(section)
        if sec:
            return sec.get_seat(row, number)
        return None
    
    def get_category(self, category_id: str) -> Optional[TicketCategory]:
        """获取票档"""
        return self._categories.get(category_id)
    
    def get_category_by_price(self, price: float) -> Optional[TicketCategory]:
        """根据价格获取票档"""
        # 精确匹配
        for category in self._categories.values():
            if category.price == price:
                return category
        
        return None
    
    def get_category_by_section(self, section: str) -> Optional[TicketCategory]:
        """根据区域获取票档"""
        for category in self._categories.values():
            if section in category.sections:
                return category
            # 模糊匹配
            for sec in category.sections:
                if section.rstrip("区") == sec.rstrip("区"):
                    return category
        
        return None
    
    def get_all_categories(self) -> List[TicketCategory]:
        """获取所有票档"""
        return list(self._categories.values())
    
    def get_refund_rules(self) -> Dict[str, Any]:
        """获取退票规则"""
        return self._refund_rules.copy()
    
    def get_exchange_rules(self) -> Dict[str, Any]:
        """获取换座规则"""
        return self._exchange_rules.copy()
    
    def get_general_rules(self) -> Dict[str, Any]:
        """获取通用规则"""
        return self._general_rules.copy()
    
    def get_seat_price(self, seat: Seat) -> float:
        """获取座位价格"""
        # 如果座位本身有价格，使用座位价格
        if seat.price > 0:
            return seat.price
        
        # 否则根据区域查找票档
        category = self.get_category_by_section(seat.section)
        if category:
            return category.price
        
        return 0.0
    
    def is_accessible_seat(self, seat: Seat) -> bool:
        """检查座位是否为无障碍座位"""
        seat_info = self.get_seat(seat.section, seat.row, seat.number)
        if seat_info:
            return seat_info.is_accessible
        return False
