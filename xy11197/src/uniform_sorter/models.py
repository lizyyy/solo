from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum


class OrderStatus(Enum):
    NORMAL = "正常"
    SIZE_CHANGE = "换码"
    OUT_OF_STOCK = "缺货"
    DUPLICATE_NAME = "同名学生"


@dataclass
class OrderRecord:
    file_name: str
    line_number: int
    school_name: str
    grade: str
    class_name: str
    student_name: str
    student_id: str
    gender: str
    uniform_type: str
    size: str
    quantity: int
    status: OrderStatus = OrderStatus.NORMAL
    original_size: Optional[str] = None
    remark: str = ""


@dataclass
class ProcessingError:
    file_name: str
    line_number: int
    error_type: str
    message: str
    raw_data: str = ""


@dataclass
class SortResult:
    normal_orders: Dict[str, List[OrderRecord]] = field(default_factory=dict)
    size_change_orders: List[OrderRecord] = field(default_factory=list)
    out_of_stock_orders: List[OrderRecord] = field(default_factory=list)
    duplicate_name_orders: List[OrderRecord] = field(default_factory=list)
    errors: List[ProcessingError] = field(default_factory=list)
