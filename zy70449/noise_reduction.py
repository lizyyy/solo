import re
from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from models import RuleVersion, Batch, InquiryForm
from schemas import InquiryFormCreate

class RiskType:
    PRICE_ABNORMAL = "价格异常"
    QUANTITY_ABNORMAL = "数量异常"
    SUPPLIER_MISSING = "供应商缺失"
    MATERIAL_INVALID = "物料编码无效"
    CONTACT_INVALID = "联系方式无效"
    SPEC_INCOMPLETE = "规格不完整"
    SWALLOWED_RECORD = "脏行被吞"
    CURRENCY_MISMATCH = "币种异常"
    DELIVERY_TOO_LONG = "交付周期过长"

class RiskLevel:
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"
    CRITICAL = "严重风险"

DEFAULT_RULES_V1 = {
    "version": "v1.0",
    "description": "初始版本 - 基础数据校验规则",
    "rules": {
        "price_validation": {
            "enabled": True,
            "min_price": 0.01,
            "max_price": 1000000,
            "risk_type": RiskType.PRICE_ABNORMAL,
            "risk_level": RiskLevel.HIGH
        },
        "quantity_validation": {
            "enabled": True,
            "min_quantity": 1,
            "max_quantity": 100000,
            "risk_type": RiskType.QUANTITY_ABNORMAL,
            "risk_level": RiskLevel.MEDIUM
        },
        "supplier_validation": {
            "enabled": True,
            "min_length": 2,
            "risk_type": RiskType.SUPPLIER_MISSING,
            "risk_level": RiskLevel.HIGH
        },
        "material_validation": {
            "enabled": True,
            "pattern": r"^MAT-\d{3}$",
            "risk_type": RiskType.MATERIAL_INVALID,
            "risk_level": RiskLevel.MEDIUM
        },
        "contact_validation": {
            "enabled": True,
            "phone_pattern": r"^1[3-9]\d{9}$",
            "risk_type": RiskType.CONTACT_INVALID,
            "risk_level": RiskLevel.LOW
        },
        "swallow_detection": {
            "enabled": True,
            "trigger_pattern": r"^SWALLOW-",
            "risk_type": RiskType.SWALLOWED_RECORD,
            "risk_level": RiskLevel.CRITICAL
        }
    }
}

DEFAULT_RULES_V2 = {
    "version": "v2.0",
    "description": "增强版本 - 增加规格完整性校验和交付周期检查",
    "rules": {
        **DEFAULT_RULES_V1["rules"],
        "spec_validation": {
            "enabled": True,
            "min_length": 5,
            "risk_type": RiskType.SPEC_INCOMPLETE,
            "risk_level": RiskLevel.LOW
        },
        "delivery_validation": {
            "enabled": True,
            "max_days": 60,
            "risk_type": RiskType.DELIVERY_TOO_LONG,
            "risk_level": RiskLevel.MEDIUM
        }
    }
}

class NoiseReductionEngine:
    def __init__(self, db: Session):
        self.db = db
        self.active_rule = None
    
    def initialize_default_rules(self):
        existing = self.db.query(RuleVersion).filter(RuleVersion.version == "v1.0").first()
        if not existing:
            rule_v1 = RuleVersion(
                version="v1.0",
                rule_content=DEFAULT_RULES_V1,
                description=DEFAULT_RULES_V1["description"],
                created_by="system",
                is_active=True
            )
            self.db.add(rule_v1)
            
            rule_v2 = RuleVersion(
                version="v2.0",
                rule_content=DEFAULT_RULES_V2,
                description=DEFAULT_RULES_V2["description"],
                created_by="system",
                is_active=False
            )
            self.db.add(rule_v2)
            self.db.commit()
    
    def get_active_rule(self) -> Dict[str, Any]:
        if self.active_rule:
            return self.active_rule
        
        active = self.db.query(RuleVersion).filter(RuleVersion.is_active == True).first()
        if active:
            self.active_rule = active.rule_content
            return self.active_rule
        
        return DEFAULT_RULES_V1
    
    def set_active_rule_version(self, version: str) -> bool:
        rule = self.db.query(RuleVersion).filter(RuleVersion.version == version).first()
        if not rule:
            return False
        
        self.db.query(RuleVersion).update({RuleVersion.is_active: False})
        rule.is_active = True
        self.db.commit()
        self.active_rule = rule.rule_content
        return True
    
    def validate_price(self, price: float, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        if price < rules["min_price"] or price > rules["max_price"]:
            return False, rules["risk_type"], rules["risk_level"]
        return True, None, None
    
    def validate_quantity(self, quantity: float, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        if quantity < rules["min_quantity"] or quantity > rules["max_quantity"]:
            return False, rules["risk_type"], rules["risk_level"]
        return True, None, None
    
    def validate_supplier(self, supplier: str, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        if not supplier or len(supplier.strip()) < rules["min_length"]:
            return False, rules["risk_type"], rules["risk_level"]
        return True, None, None
    
    def validate_material_code(self, code: str, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        pattern = rules["pattern"]
        if not re.match(pattern, code):
            return False, rules["risk_type"], rules["risk_level"]
        return True, None, None
    
    def validate_contact(self, phone: str, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        pattern = rules["phone_pattern"]
        if not phone or not re.match(pattern, phone):
            return False, rules["risk_type"], rules["risk_level"]
        return True, None, None
    
    def check_swallow(self, material_code: str, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return False, None, None
        
        pattern = rules["trigger_pattern"]
        if re.match(pattern, material_code):
            return True, rules["risk_type"], rules["risk_level"]
        return False, None, None
    
    def validate_spec(self, spec: str, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        if not spec or len(spec.strip()) < rules["min_length"]:
            return False, rules["risk_type"], rules["risk_level"]
        return True, None, None
    
    def validate_delivery(self, delivery: str, rules: Dict[str, Any]) -> Tuple[bool, str, str]:
        if not rules.get("enabled", True):
            return True, None, None
        
        try:
            days = int(re.search(r"\d+", delivery).group())
            if days > rules["max_days"]:
                return False, rules["risk_type"], rules["risk_level"]
        except:
            pass
        return True, None, None
    
    def process_form(self, form_data: InquiryFormCreate, rule_version_id: int = None) -> Dict[str, Any]:
        rules = self.get_active_rule()["rules"]
        
        risks = []
        is_valid = True
        is_swallowed = False
        swallow_reason = None
        
        swallowed, risk_type, risk_level = self.check_swallow(
            form_data.material_code, 
            rules.get("swallow_detection", {})
        )
        if swallowed:
            is_swallowed = True
            is_valid = False
            swallow_reason = f"检测到脏行标记: {form_data.material_code}，记录被吞掉"
            risks.append({
                "type": risk_type,
                "level": risk_level,
                "description": swallow_reason
            })
        
        if not is_swallowed:
            valid, risk_type, risk_level = self.validate_price(
                form_data.quoted_price, 
                rules.get("price_validation", {})
            )
            if not valid:
                is_valid = False
                risks.append({
                    "type": risk_type,
                    "level": risk_level,
                    "description": f"价格 {form_data.quoted_price} 超出有效范围"
                })
            
            valid, risk_type, risk_level = self.validate_quantity(
                form_data.quantity, 
                rules.get("quantity_validation", {})
            )
            if not valid:
                is_valid = False
                risks.append({
                    "type": risk_type,
                    "level": risk_level,
                    "description": f"数量 {form_data.quantity} 超出有效范围"
                })
            
            valid, risk_type, risk_level = self.validate_supplier(
                form_data.supplier_name, 
                rules.get("supplier_validation", {})
            )
            if not valid:
                is_valid = False
                risks.append({
                    "type": risk_type,
                    "level": risk_level,
                    "description": "供应商名称无效或缺失"
                })
            
            valid, risk_type, risk_level = self.validate_material_code(
                form_data.material_code, 
                rules.get("material_validation", {})
            )
            if not valid:
                is_valid = False
                risks.append({
                    "type": risk_type,
                    "level": risk_level,
                    "description": f"物料编码 {form_data.material_code} 格式无效"
                })
            
            valid, risk_type, risk_level = self.validate_contact(
                form_data.contact_phone, 
                rules.get("contact_validation", {})
            )
            if not valid:
                is_valid = False
                risks.append({
                    "type": risk_type,
                    "level": risk_level,
                    "description": f"联系电话 {form_data.contact_phone} 格式无效"
                })
            
            if "spec_validation" in rules:
                valid, risk_type, risk_level = self.validate_spec(
                    form_data.specification, 
                    rules["spec_validation"]
                )
                if not valid:
                    is_valid = False
                    risks.append({
                        "type": risk_type,
                        "level": risk_level,
                        "description": "规格描述不完整"
                    })
            
            if "delivery_validation" in rules and form_data.delivery_period:
                valid, risk_type, risk_level = self.validate_delivery(
                    form_data.delivery_period, 
                    rules["delivery_validation"]
                )
                if not valid:
                    is_valid = False
                    risks.append({
                        "type": risk_type,
                        "level": risk_level,
                        "description": f"交付周期 {form_data.delivery_period} 过长"
                    })
        
        return {
            "is_valid": is_valid,
            "is_swallowed": is_swallowed,
            "swallow_reason": swallow_reason,
            "risks": risks,
            "primary_risk_type": risks[0]["type"] if risks else None,
            "primary_risk_level": risks[0]["level"] if risks else None,
            "risk_description": " | ".join([r["description"] for r in risks]) if risks else None,
            "processing_result": "通过" if is_valid and not is_swallowed else ("被吞" if is_swallowed else "异常"),
            "processing_message": f"检测到 {len(risks)} 个风险点" if risks else "校验通过"
        }
