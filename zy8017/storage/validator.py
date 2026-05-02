"""数据验证器"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from collections import Counter


@dataclass
class ValidationError:
    """验证错误信息"""
    message: str
    severity: str = "error"  # error, warning
    field: Optional[str] = None
    order_id: Optional[str] = None


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    
    def add_error(self, error: ValidationError):
        """添加错误"""
        self.errors.append(error)
        if error.severity == "error":
            self.is_valid = False
    
    def add_warning(self, error: ValidationError):
        """添加警告"""
        error.severity = "warning"
        self.warnings.append(error)


class DataValidator:
    """数据验证器"""
    
    def validate_all(self, orders: List[Dict], seating: Dict, rules: Dict) -> ValidationResult:
        """
        验证所有数据
        
        Args:
            orders: 订单列表
            seating: 座位图数据
            rules: 规则数据
            
        Returns:
            验证结果
        """
        result = ValidationResult()
        
        # 验证订单数据
        order_errors = self.validate_orders(orders)
        for error in order_errors:
            result.add_error(error)
        
        # 验证座位图数据
        seating_errors = self.validate_seating(seating)
        for error in seating_errors:
            result.add_error(error)
        
        # 验证规则数据
        rule_errors = self.validate_rules(rules)
        for error in rule_errors:
            result.add_error(error)
        
        # 跨数据验证
        cross_errors = self.validate_cross_reference(orders, seating, rules)
        for error in cross_errors:
            result.add_error(error)
        
        return result
    
    def validate_orders(self, orders: List[Dict]) -> List[ValidationError]:
        """验证订单数据"""
        errors = []
        
        if not orders:
            errors.append(ValidationError(
                message="订单数据为空",
                severity="warning"
            ))
            return errors
        
        # 检查重复订单号
        order_ids = [order.get("order_id", "") for order in orders]
        duplicate_ids = [oid for oid, count in Counter(order_ids).items() if count > 1]
        
        for dup_id in duplicate_ids:
            errors.append(ValidationError(
                message=f"检测到重复订单号: {dup_id}",
                severity="error",
                field="order_id",
                order_id=dup_id
            ))
        
        # 检查每个订单的必要字段
        for order in orders:
            order_errors = self._validate_single_order(order)
            errors.extend(order_errors)
        
        return errors
    
    def _validate_single_order(self, order: Dict) -> List[ValidationError]:
        """验证单个订单"""
        errors = []
        order_id = order.get("order_id", "")
        
        # 检查操作类型
        operation_type = order.get("operation_type", "")
        valid_operations = ["refund", "exchange", "换座", "退票"]
        if operation_type not in valid_operations and operation_type.lower() not in [v.lower() for v in valid_operations]:
            errors.append(ValidationError(
                message=f"未知的操作类型: {operation_type} (订单号: {order_id})",
                severity="error",
                field="operation_type",
                order_id=order_id
            ))
        
        # 检查换座操作是否有新座位
        if operation_type.lower() in ["exchange", "换座"]:
            new_seats = order.get("new_seats", [])
            if not new_seats:
                errors.append(ValidationError(
                    message=f"换座操作缺少新座位信息 (订单号: {order_id})",
                    severity="error",
                    field="new_seats",
                    order_id=order_id
                ))
        
        # 检查价格是否为正数
        price = order.get("ticket_price", 0)
        if price <= 0:
            errors.append(ValidationError(
                message=f"票价必须为正数: {price} (订单号: {order_id})",
                severity="warning",
                field="ticket_price",
                order_id=order_id
            ))
        
        return errors
    
    def validate_seating(self, seating: Dict) -> List[ValidationError]:
        """验证座位图数据"""
        errors = []
        
        sections = seating.get("sections", {})
        
        if not sections:
            errors.append(ValidationError(
                message="座位图中未定义任何区域",
                severity="error"
            ))
            return errors
        
        # 检查每个区域
        for section_id, section_data in sections.items():
            rows = section_data.get("rows", {})
            
            if not rows:
                errors.append(ValidationError(
                    message=f"区域 '{section_id}' 缺少座位定义",
                    severity="warning",
                    field="sections"
                ))
            
            # 检查每行
            for row_id, row_data in rows.items():
                seats = row_data.get("seats", {})
                if not seats:
                    errors.append(ValidationError(
                        message=f"区域 '{section_id}' 行 '{row_id}' 没有座位",
                        severity="warning"
                    ))
        
        return errors
    
    def validate_rules(self, rules: Dict) -> List[ValidationError]:
        """验证规则数据"""
        errors = []
        
        # 检查票档配置
        categories = rules.get("ticket_categories", {})
        if not categories:
            errors.append(ValidationError(
                message="未定义任何票档",
                severity="warning"
            ))
        
        # 检查每个票档
        for cat_id, cat_data in categories.items():
            price = cat_data.get("price", 0)
            if price <= 0:
                errors.append(ValidationError(
                    message=f"票档 '{cat_id}' 的价格必须为正数: {price}",
                    severity="warning"
                ))
        
        return errors
    
    def validate_cross_reference(
        self, 
        orders: List[Dict], 
        seating: Dict, 
        rules: Dict
    ) -> List[ValidationError]:
        """跨数据验证"""
        errors = []
        
        sections = seating.get("sections", {})
        section_ids = set(sections.keys())
        
        for order in orders:
            order_id = order.get("order_id", "")
            
            # 验证原座位
            original_seats = order.get("original_seats", [])
            for seat in original_seats:
                section = seat.get("section", "")
                if section and section not in section_ids:
                    # 尝试模糊匹配
                    matched = False
                    for sec_id in section_ids:
                        if section.rstrip("区") == sec_id.rstrip("区"):
                            matched = True
                            break
                    
                    if not matched:
                        errors.append(ValidationError(
                            message=f"订单 {order_id} 中的座位区域 '{section}' 在座位图中不存在",
                            severity="warning",
                            order_id=order_id,
                            field="original_seats"
                        ))
            
            # 验证新座位
            new_seats = order.get("new_seats", [])
            for seat in new_seats:
                section = seat.get("section", "")
                if section and section not in section_ids:
                    matched = False
                    for sec_id in section_ids:
                        if section.rstrip("区") == sec_id.rstrip("区"):
                            matched = True
                            break
                    
                    if not matched:
                        errors.append(ValidationError(
                            message=f"订单 {order_id} 中的新座位区域 '{section}' 在座位图中不存在",
                            severity="warning",
                            order_id=order_id,
                            field="new_seats"
                        ))
        
        return errors
    
    def check_missing_sections(self, seating: Dict, required_sections: List[str]) -> List[ValidationError]:
        """
        检查座位图是否缺少必要的区域
        
        Args:
            seating: 座位图数据
            required_sections: 必需的区域列表
            
        Returns:
            错误列表
        """
        errors = []
        sections = set(seating.get("sections", {}).keys())
        
        for required in required_sections:
            matched = False
            for sec_id in sections:
                if required.rstrip("区") == sec_id.rstrip("区"):
                    matched = True
                    break
            
            if not matched and required not in sections:
                errors.append(ValidationError(
                    message=f"座位图缺少必要区域: {required}",
                    severity="error"
                ))
        
        return errors
