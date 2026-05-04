#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
安全检查服务
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple
from enum import Enum

from config import get_config
from database import get_db, DatabaseContext


class CheckResultType(Enum):
    PASSED = "通过"
    WARNING = "警告"
    BLOCKED = "阻断"


@dataclass
class SafetyCheckResult:
    """安全检查结果"""
    check_type: str
    result: CheckResultType
    message: str
    details: str = ""
    blocking: bool = False
    
    def is_blocking(self) -> bool:
        return self.result == CheckResultType.BLOCKED
    
    def has_warning(self) -> bool:
        return self.result == CheckResultType.WARNING or self.result == CheckResultType.BLOCKED


class SafetyService:
    """安全检查服务"""
    
    def __init__(self):
        self.config = get_config()
        self.db = get_db()
    
    def check_all_safety(self, booking_id: int) -> Tuple[List[SafetyCheckResult], bool]:
        """
        执行所有安全检查
        
        Args:
            booking_id: 预约ID
            
        Returns:
            (检查结果列表, 是否全部通过)
        """
        results = []
        
        # 1. 检查库存数量
        result = self.check_quantity(booking_id)
        results.append(result)
        
        # 2. 检查有效期
        result = self.check_expiry(booking_id)
        results.append(result)
        
        # 3. 检查相容性
        result = self.check_compatibility(booking_id)
        results.append(result)
        
        # 4. 检查重复领用
        result = self.check_duplicate_collection(booking_id)
        results.append(result)
        
        # 5. 检查危险等级
        result = self.check_danger_level(booking_id)
        results.append(result)
        
        # 记录检查日志
        self._log_safety_checks(booking_id, results)
        
        # 判断是否全部通过
        all_passed = all(r.result == CheckResultType.PASSED for r in results)
        
        return results, all_passed
    
    def check_quantity(self, booking_id: int) -> SafetyCheckResult:
        """检查库存数量是否充足"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.id, r.name, r.available_quantity, r.unit, r.minimum_quantity,
                   bi.requested_quantity
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ?
        ''', (booking_id,))
        
        items = cursor.fetchall()
        
        insufficient = []
        below_minimum = []
        
        for item in items:
            available = item['available_quantity']
            requested = item['requested_quantity']
            minimum = item['minimum_quantity'] or 0
            
            if available < requested:
                insufficient.append(
                    f"{item['name']}: 需{requested}{item['unit']}，库存{available}{item['unit']}"
                )
            
            if available - requested < minimum:
                below_minimum.append(
                    f"{item['name']}: 领用后剩余{available - requested}{item['unit']}，低于安全库存{minimum}{item['unit']}"
                )
        
        if insufficient:
            return SafetyCheckResult(
                check_type="库存数量检查",
                result=CheckResultType.BLOCKED,
                message="部分试剂库存不足",
                details="\n".join(insufficient),
                blocking=True
            )
        
        if below_minimum:
            return SafetyCheckResult(
                check_type="库存数量检查",
                result=CheckResultType.WARNING,
                message="部分试剂领用后将低于安全库存",
                details="\n".join(below_minimum),
                blocking=False
            )
        
        return SafetyCheckResult(
            check_type="库存数量检查",
            result=CheckResultType.PASSED,
            message="所有试剂库存充足",
            blocking=False
        )
    
    def check_expiry(self, booking_id: int) -> SafetyCheckResult:
        """检查有效期"""
        cursor = self.db.cursor()
        today = date.today()
        
        cursor.execute('''
            SELECT r.id, r.name, r.expiry_date
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ?
        ''', (booking_id,))
        
        items = cursor.fetchall()
        
        expired = []
        near_expiry = []
        
        for item in items:
            if not item['expiry_date']:
                continue
            
            expiry_date = item['expiry_date']
            if isinstance(expiry_date, str):
                try:
                    expiry_date = datetime.strptime(expiry_date, "%Y-%m-%d").date()
                except:
                    continue
            
            days_remaining = (expiry_date - today).days
            
            if days_remaining < 0:
                expired.append(
                    f"{item['name']}: 已过期(有效期:{item['expiry_date']})"
                )
            elif days_remaining < 30:
                near_expiry.append(
                    f"{item['name']}: 剩余{days_remaining}天到期(有效期:{item['expiry_date']})"
                )
        
        if expired:
            return SafetyCheckResult(
                check_type="有效期检查",
                result=CheckResultType.BLOCKED,
                message="部分试剂已过期",
                details="\n".join(expired),
                blocking=True
            )
        
        if near_expiry:
            return SafetyCheckResult(
                check_type="有效期检查",
                result=CheckResultType.WARNING,
                message="部分试剂即将过期",
                details="\n".join(near_expiry),
                blocking=False
            )
        
        return SafetyCheckResult(
            check_type="有效期检查",
            result=CheckResultType.PASSED,
            message="所有试剂有效期正常",
            blocking=False
        )
    
    def check_compatibility(self, booking_id: int) -> SafetyCheckResult:
        """检查试剂相容性（酸碱混放等）"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.id, r.name, r.category
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ?
        ''', (booking_id,))
        
        items = cursor.fetchall()
        
        if len(items) < 2:
            return SafetyCheckResult(
                check_type="相容性检查",
                result=CheckResultType.PASSED,
                message="单种试剂无需相容性检查",
                blocking=False
            )
        
        categories = self.config.reagent_categories
        incompatible_pairs = []
        
        # 检查每一对组合
        for i, item1 in enumerate(items):
            cat1 = item1['category']
            if cat1 not in categories:
                continue
            
            for j, item2 in enumerate(items):
                if i >= j:
                    continue
                
                cat2 = item2['category']
                if cat2 not in categories:
                    continue
                
                # 检查是否不相容
                if cat2 in categories[cat1]['incompatible']:
                    name1 = categories[cat1]['name']
                    name2 = categories[cat2]['name']
                    incompatible_pairs.append(
                        f"[{item1['name']}]({name1}) 与 [{item2['name']}]({name2}) 不相容"
                    )
        
        if incompatible_pairs:
            return SafetyCheckResult(
                check_type="相容性检查",
                result=CheckResultType.WARNING,
                message="发现不相容试剂组合",
                details="\n".join(incompatible_pairs) + 
                        "\n\n注意：不相容试剂不能混放，领用和实验时需分开操作",
                blocking=False
            )
        
        return SafetyCheckResult(
            check_type="相容性检查",
            result=CheckResultType.PASSED,
            message="所有试剂组合相容",
            blocking=False
        )
    
    def check_duplicate_collection(self, booking_id: int) -> SafetyCheckResult:
        """检查是否有重复领用（同一时间段同一危险品被多个预约领用）"""
        cursor = self.db.cursor()
        
        # 获取当前预约的信息
        cursor.execute('''
            SELECT b.id, b.experiment_date, b.class_id
            FROM bookings b
            WHERE b.id = ?
        ''', (booking_id,))
        
        booking = cursor.fetchone()
        if not booking:
            return SafetyCheckResult(
                check_type="重复领用检查",
                result=CheckResultType.PASSED,
                message="预约不存在",
                blocking=False
            )
        
        experiment_date = booking['experiment_date']
        
        # 获取当前预约的高危险试剂
        cursor.execute('''
            SELECT DISTINCT r.id, r.name
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ? AND r.danger_level = 1
        ''', (booking_id,))
        
        high_risk_reagents = cursor.fetchall()
        
        if not high_risk_reagents:
            return SafetyCheckResult(
                check_type="重复领用检查",
                result=CheckResultType.PASSED,
                message="无高危险试剂",
                blocking=False
            )
        
        duplicate_warnings = []
        
        for reagent in high_risk_reagents:
            reagent_id = reagent['id']
            reagent_name = reagent['name']
            
            # 检查同一天其他已通过/已领用的预约是否也需要该试剂
            cursor.execute('''
                SELECT DISTINCT b.id, b.experiment_name, 
                       c.grade || c.class_number as class_name,
                       b.status
                FROM booking_items bi
                JOIN bookings b ON bi.booking_id = b.id
                JOIN classes c ON b.class_id = c.id
                WHERE bi.reagent_id = ? 
                  AND bi.booking_id != ?
                  AND b.experiment_date = ?
                  AND b.status IN ('approved', 'collected')
            ''', (reagent_id, booking_id, experiment_date))
            
            other_bookings = cursor.fetchall()
            
            for ob in other_bookings:
                status_name = self.config.booking_status.get(ob['status'], {}).get('name', ob['status'])
                duplicate_warnings.append(
                    f"[{reagent_name}] 已被 [{ob['class_name']} - {ob['experiment_name']}] 预约(状态:{status_name})"
                )
        
        if duplicate_warnings:
            return SafetyCheckResult(
                check_type="重复领用检查",
                result=CheckResultType.WARNING,
                message="发现高危险试剂重复预约",
                details="\n".join(duplicate_warnings) + 
                        "\n\n注意：高危险试剂同一天被多个班级预约，请确认是否同时段使用，必要时调整安排",
                blocking=False
            )
        
        return SafetyCheckResult(
            check_type="重复领用检查",
            result=CheckResultType.PASSED,
            message="无重复领用风险",
            blocking=False
        )
    
    def check_danger_level(self, booking_id: int) -> SafetyCheckResult:
        """检查危险等级，提供提醒"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.id, r.name, r.danger_level
            FROM booking_items bi
            JOIN reagents r ON bi.reagent_id = r.id
            WHERE bi.booking_id = ?
        ''', (booking_id,))
        
        items = cursor.fetchall()
        
        high_risk = []
        medium_risk = []
        
        for item in items:
            level = item['danger_level']
            level_info = self.config.danger_levels.get(level, {})
            level_name = level_info.get('name', f'等级{level}')
            
            if level == 1:
                high_risk.append(f"{item['name']}: {level_name}")
            elif level == 2:
                medium_risk.append(f"{item['name']}: {level_name}")
        
        messages = []
        if high_risk:
            messages.append("【重要提醒】本次领用包含高危险试剂：")
            messages.extend(high_risk)
            messages.append("\n高危险试剂管理要求：")
            messages.append("- 双人双锁管理")
            messages.append("- 详细记录领用和归还")
            messages.append("- 使用时需有老师在场")
        
        if medium_risk:
            if high_risk:
                messages.append("")
            messages.append("本次领用包含中危险试剂：")
            messages.extend(medium_risk)
        
        if messages:
            return SafetyCheckResult(
                check_type="危险等级检查",
                result=CheckResultType.WARNING,
                message="本次领用包含危险试剂",
                details="\n".join(messages),
                blocking=False
            )
        
        return SafetyCheckResult(
            check_type="危险等级检查",
            result=CheckResultType.PASSED,
            message="无特殊危险等级试剂",
            blocking=False
        )
    
    def _log_safety_checks(self, booking_id: int, results: List[SafetyCheckResult]):
        """记录安全检查日志"""
        cursor = self.db.cursor()
        
        for result in results:
            cursor.execute('''
                INSERT INTO safety_checks 
                (booking_id, check_type, result, details, blocking)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                booking_id,
                result.check_type,
                result.result.value,
                result.details,
                result.blocking
            ))
        
        self.db.commit()
    
    def get_reagent_safety_info(self, reagent_id: int) -> Dict:
        """获取试剂的安全信息"""
        cursor = self.db.cursor()
        
        cursor.execute('''
            SELECT r.*
            FROM reagents r
            WHERE r.id = ?
        ''', (reagent_id,))
        
        reagent = cursor.fetchone()
        if not reagent:
            return {}
        
        level_info = self.config.danger_levels.get(
            reagent['danger_level'], 
            {'name': '未知', 'description': ''}
        )
        category_info = self.config.reagent_categories.get(
            reagent['category'],
            {'name': '未知', 'incompatible': []}
        )
        
        return {
            'name': reagent['name'],
            'danger_level': reagent['danger_level'],
            'danger_level_name': level_info['name'],
            'danger_description': level_info['description'],
            'category': reagent['category'],
            'category_name': category_info['name'],
            'incompatible_categories': category_info['incompatible'],
            'expiry_date': reagent['expiry_date'],
            'location': reagent['location'],
            'shelf': reagent['shelf'],
            'available_quantity': reagent['available_quantity'],
            'unit': reagent['unit'],
        }
