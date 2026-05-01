"""YAML 规则解析器"""

from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import timedelta

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


class YAMLParser:
    """YAML 文件解析器，用于解析票档和退改规则"""
    
    def __init__(self):
        if not HAS_YAML:
            raise ImportError(
                "PyYAML 库未安装，请运行: pip install pyyaml"
            )
    
    def parse(self, file_path: Path) -> Dict[str, Any]:
        """
        解析 YAML 文件，返回规则数据
        
        Args:
            file_path: YAML 文件路径
            
        Returns:
            规则数据字典
            
        Raises:
            FileNotFoundError: 文件不存在
            yaml.YAMLError: YAML 格式错误
        """
        if not file_path.exists():
            raise FileNotFoundError(f"规则文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        return self._normalize_rules(data)
    
    def _normalize_rules(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化规则数据格式"""
        normalized = {
            "ticket_categories": {},
            "refund_rules": {},
            "exchange_rules": {},
            "general_rules": {}
        }
        
        # 处理票档配置
        if "ticket_categories" in data:
            for cat_id, cat_data in data["ticket_categories"].items():
                normalized["ticket_categories"][cat_id] = self._normalize_category(cat_id, cat_data)
        
        # 兼容旧格式
        elif "categories" in data:
            for cat_id, cat_data in data["categories"].items():
                normalized["ticket_categories"][cat_id] = self._normalize_category(cat_id, cat_data)
        
        # 处理退票规则
        if "refund_rules" in data:
            normalized["refund_rules"] = self._normalize_refund_rules(data["refund_rules"])
        
        # 处理换座规则
        if "exchange_rules" in data:
            normalized["exchange_rules"] = self._normalize_exchange_rules(data["exchange_rules"])
        
        # 处理通用规则
        if "general_rules" in data:
            normalized["general_rules"] = data["general_rules"]
        
        return normalized
    
    def _normalize_category(self, cat_id: str, cat_data: Any) -> Dict[str, Any]:
        """标准化票档数据"""
        if isinstance(cat_data, dict):
            return {
                "id": cat_id,
                "name": cat_data.get("name", cat_id),
                "price": cat_data.get("price", 0.0),
                "refund_allowed": cat_data.get("refund_allowed", True),
                "exchange_allowed": cat_data.get("exchange_allowed", True),
                "refund_fee_rate": cat_data.get("refund_fee_rate", 0.0),
                "exchange_fee_rate": cat_data.get("exchange_fee_rate", 0.0),
                "sections": cat_data.get("sections", []),
                "description": cat_data.get("description", "")
            }
        else:
            return {
                "id": cat_id,
                "name": cat_id,
                "price": float(cat_data) if cat_data else 0.0,
                "refund_allowed": True,
                "exchange_allowed": True,
                "refund_fee_rate": 0.0,
                "exchange_fee_rate": 0.0,
                "sections": [],
                "description": ""
            }
    
    def _normalize_refund_rules(self, rules_data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化退票规则"""
        normalized = {
            "enabled": rules_data.get("enabled", True),
            "deadline_minutes": rules_data.get("deadline_minutes", 0),
            "deadline_hours": rules_data.get("deadline_hours", 0),
            "tiered_fees": [],
            "forbidden_reasons": rules_data.get("forbidden_reasons", [])
        }
        
        # 计算总截止时间（分钟）
        total_minutes = normalized["deadline_minutes"] + normalized["deadline_hours"] * 60
        normalized["total_deadline_minutes"] = total_minutes
        
        # 处理分级手续费
        if "tiered_fees" in rules_data:
            for tier in rules_data["tiered_fees"]:
                normalized_tier = {
                    "threshold_minutes": tier.get("threshold_minutes", 0),
                    "threshold_hours": tier.get("threshold_hours", 0),
                    "fee_rate": tier.get("fee_rate", 0.0),
                    "fee_amount": tier.get("fee_amount", 0.0)
                }
                normalized_tier["total_threshold_minutes"] = (
                    normalized_tier["threshold_minutes"] + 
                    normalized_tier["threshold_hours"] * 60
                )
                normalized["tiered_fees"].append(normalized_tier)
        
        # 按阈值排序
        normalized["tiered_fees"].sort(
            key=lambda x: x["total_threshold_minutes"],
            reverse=True
        )
        
        return normalized
    
    def _normalize_exchange_rules(self, rules_data: Dict[str, Any]) -> Dict[str, Any]:
        """标准化换座规则"""
        normalized = {
            "enabled": rules_data.get("enabled", True),
            "deadline_minutes": rules_data.get("deadline_minutes", 0),
            "deadline_hours": rules_data.get("deadline_hours", 0),
            "allow_cross_section": rules_data.get("allow_cross_section", True),
            "allow_cross_category": rules_data.get("allow_cross_category", True),
            "price_difference_policy": rules_data.get("price_difference_policy", "customer_pays"),
            "exchange_fee_rate": rules_data.get("exchange_fee_rate", 0.0),
            "exchange_fee_amount": rules_data.get("exchange_fee_amount", 0.0),
            "forbidden_reasons": rules_data.get("forbidden_reasons", [])
        }
        
        # 计算总截止时间
        total_minutes = normalized["deadline_minutes"] + normalized["deadline_hours"] * 60
        normalized["total_deadline_minutes"] = total_minutes
        
        return normalized
    
    def get_category_by_price(self, rules: Dict[str, Any], price: float) -> Optional[Dict[str, Any]]:
        """
        根据价格查找对应的票档
        
        Args:
            rules: 标准化的规则数据
            price: 票价
            
        Returns:
            票档信息，如果找不到则返回 None
        """
        categories = rules.get("ticket_categories", {})
        
        # 精确匹配
        for cat_id, cat_data in categories.items():
            if cat_data.get("price") == price:
                return cat_data
        
        # 范围匹配（如果有范围配置）
        for cat_id, cat_data in categories.items():
            min_price = cat_data.get("min_price")
            max_price = cat_data.get("max_price")
            if min_price is not None and max_price is not None:
                if min_price <= price <= max_price:
                    return cat_data
        
        return None
    
    def get_category_by_section(self, rules: Dict[str, Any], section: str) -> Optional[Dict[str, Any]]:
        """
        根据区域查找对应的票档
        
        Args:
            rules: 标准化的规则数据
            section: 区域ID
            
        Returns:
            票档信息，如果找不到则返回 None
        """
        categories = rules.get("ticket_categories", {})
        
        for cat_id, cat_data in categories.items():
            sections = cat_data.get("sections", [])
            if section in sections:
                return cat_data
            # 模糊匹配
            for sec in sections:
                if section.rstrip("区") == sec.rstrip("区"):
                    return cat_data
        
        return None
    
    def calculate_refund_fee(self, rules: Dict[str, Any], price: float, minutes_before_show: int) -> Dict[str, Any]:
        """
        计算退票手续费
        
        Args:
            rules: 标准化的规则数据
            price: 票价
            minutes_before_show: 距离开演的分钟数
            
        Returns:
            包含手续费信息的字典
        """
        refund_rules = rules.get("refund_rules", {})
        
        # 检查是否超过截止时间
        deadline = refund_rules.get("total_deadline_minutes", 0)
        if minutes_before_show < deadline:
            return {
                "can_refund": False,
                "reason": f"距离开演不足 {deadline} 分钟，禁止退票",
                "fee": 0.0,
                "refund_amount": 0.0
            }
        
        # 检查分级手续费
        tiered_fees = refund_rules.get("tiered_fees", [])
        
        for tier in tiered_fees:
            if minutes_before_show >= tier.get("total_threshold_minutes", 0):
                fee_rate = tier.get("fee_rate", 0.0)
                fee_amount = tier.get("fee_amount", 0.0)
                
                fee = max(price * fee_rate, fee_amount)
                refund_amount = price - fee
                
                return {
                    "can_refund": True,
                    "fee_rate": fee_rate,
                    "fee_amount": fee_amount,
                    "fee": fee,
                    "refund_amount": refund_amount,
                    "threshold_minutes": tier.get("total_threshold_minutes", 0)
                }
        
        # 默认手续费
        default_rate = refund_rules.get("default_fee_rate", 0.0)
        fee = price * default_rate
        refund_amount = price - fee
        
        return {
            "can_refund": True,
            "fee_rate": default_rate,
            "fee": fee,
            "refund_amount": refund_amount
        }
