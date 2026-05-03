#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据模型定义
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, List
from enum import Enum


class ChemicalCategory(Enum):
    """化学试剂类别"""
    ACID = "酸类"
    BASE = "碱类"
    ORGANIC = "有机溶剂"
    OXIDIZING = "氧化剂"
    REDUCING = "还原剂"
    TOXIC = "有毒物质"
    CORROSIVE = "腐蚀性物质"
    EXPLOSIVE = "易爆物"
    OTHER = "其他"


@dataclass
class Reagent:
    """试剂信息"""
    id: Optional[int]
    bottle_number: str  # 瓶号
    name: str  # 试剂名称
    category: ChemicalCategory  # 类别
    purity: str  # 纯度
    specification: str  # 规格
    manufacturer: str  # 生产厂家
    production_date: date  # 生产日期
    expiration_date: date  # 有效期至
    cabinet_id: Optional[int]  # 所在柜位ID
    quantity: float  # 当前数量
    unit: str  # 单位
    min_quantity: float  # 最低库存预警值
    responsible_person_id: Optional[int]  # 责任人ID
    purchase_date: Optional[date]  # 购入日期
    notes: Optional[str]  # 备注
    created_at: datetime
    updated_at: datetime


@dataclass
class Cabinet:
    """柜位信息"""
    id: Optional[int]
    name: str  # 柜位名称
    location: str  # 位置
    description: Optional[str]  # 描述
    responsible_person_id: Optional[int]  # 责任人ID
    capacity: Optional[int]  # 容量
    created_at: datetime
    updated_at: datetime


@dataclass
class ResponsiblePerson:
    """责任人信息"""
    id: Optional[int]
    name: str  # 姓名
    employee_id: str  # 工号
    department: str  # 部门
    phone: Optional[str]  # 电话
    email: Optional[str]  # 邮箱
    created_at: datetime
    updated_at: datetime


@dataclass
class UsageRecord:
    """领用/归还记录"""
    id: Optional[int]
    reagent_id: int  # 试剂ID
    bottle_number: str  # 瓶号（冗余字段，方便查询）
    operation_type: str  # 操作类型：'领用' 或 '归还'
    quantity: float  # 数量
    unit: str  # 单位
    operator_id: int  # 操作人ID
    expected_return_date: Optional[date]  # 预计归还日期
    actual_return_date: Optional[date]  # 实际归还日期
    purpose: Optional[str]  # 用途
    notes: Optional[str]  # 备注
    created_at: datetime
    updated_at: datetime


@dataclass
class InventoryCheck:
    """盘点记录"""
    id: Optional[int]
    reagent_id: int  # 试剂ID
    bottle_number: str  # 瓶号
    check_date: date  # 盘点日期
    checker_id: int  # 盘点人ID
    expected_quantity: float  # 系统记录数量
    actual_quantity: float  # 实际盘点数量
    difference: float  # 差异
    difference_reason: Optional[str]  # 差异原因
    status: str  # 状态：'正常' 或 '异常'
    notes: Optional[str]  # 备注
    created_at: datetime


@dataclass
class InspectionRecord:
    """巡检记录"""
    id: Optional[int]
    inspection_date: date  # 巡检日期
    inspector_id: int  # 巡检人ID
    total_reagents: int  # 试剂总数
    expired_count: int  # 过期数量
    low_stock_count: int  # 库存不足数量
    incompatible_count: int  # 禁配数量
    overdue_return_count: int  # 超期未归还数量
    status: str  # 状态：'完成' 或 '部分完成'
    report_path: Optional[str]  # 报告路径
    csv_path: Optional[str]  # CSV 路径
    notes: Optional[str]  # 备注
    created_at: datetime
    updated_at: datetime


class AlertType(Enum):
    """预警类型"""
    EXPIRED = "过期预警"
    EXPIRING_SOON = "即将过期"
    LOW_STOCK = "库存不足"
    OVERDUE_RETURN = "超期未归还"
    INCOMPATIBLE = "禁配警告"


@dataclass
class Alert:
    """预警信息"""
    id: Optional[int]
    alert_type: AlertType
    reagent_id: int
    bottle_number: str
    reagent_name: str
    message: str
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime]
