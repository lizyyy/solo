"""校验服务 - 整合规则引擎进行处方校验"""

import uuid
from datetime import datetime
from typing import Optional

from ..models.config import StoreConfig
from ..models.frame import Frame
from ..models.lens import LensInventory
from ..models.prescription import Prescription
from ..models.validation import (
    BatchValidationResult as ModelBatchResult,
    ValidationResult,
)
from ..rules.base import RuleContext, RuleEngine, get_default_rules


class BatchValidationResult:
    """批量校验结果"""
    
    def __init__(self, batch_id: str, total_orders: int):
        self.batch_id = batch_id
        self.total_orders = total_orders
        self.results: list[ValidationResult] = []
        self.started_at = datetime.now()
        self.completed_at: Optional[datetime] = None
    
    @property
    def passed_count(self) -> int:
        return sum(1 for r in self.results if r.passed)
    
    @property
    def failed_count(self) -> int:
        return sum(1 for r in self.results if not r.passed)
    
    @property
    def total_errors(self) -> int:
        return sum(r.error_count for r in self.results)
    
    @property
    def total_warnings(self) -> int:
        return sum(r.warning_count for r in self.results)
    
    def add_result(self, result: ValidationResult) -> None:
        self.results.append(result)
    
    def complete(self) -> None:
        self.completed_at = datetime.now()
    
    def get_summary(self) -> dict:
        return {
            "batch_id": self.batch_id,
            "total_orders": self.total_orders,
            "passed_count": self.passed_count,
            "failed_count": self.failed_count,
            "total_errors": self.total_errors,
            "total_warnings": self.total_warnings,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
    
    def get_failed_orders(self) -> list[ValidationResult]:
        return [r for r in self.results if not r.passed]


class ValidationService:
    """校验服务"""
    
    def __init__(self, store_config: StoreConfig):
        self.store_config = store_config
        self.rule_engine = RuleEngine(get_default_rules())
        self._existing_orders: list[dict] = []
    
    def set_existing_orders(self, orders: list[dict]) -> None:
        """设置已有订单列表（用于重复订单检测）"""
        self._existing_orders = orders
    
    def validate_prescription(
        self,
        prescription: Prescription,
        frame: Optional[Frame] = None,
        inventory: Optional[LensInventory] = None,
    ) -> ValidationResult:
        """校验单个处方
        
        Args:
            prescription: 处方数据
            frame: 镜架数据（可选）
            inventory: 镜片库存（可选）
            
        Returns:
            校验结果
        """
        context = RuleContext(
            prescription=prescription,
            frame=frame,
            inventory=inventory,
            store_config=self.store_config,
            existing_orders=self._existing_orders,
        )
        
        all_passed, rule_results = self.rule_engine.execute_all(context)
        
        result = ValidationResult(
            order_id=prescription.prescription_id,
            prescription_id=prescription.prescription_id,
            passed=all_passed,
        )
        
        for rule_result in rule_results:
            for issue in rule_result.issues:
                result.add_issue(issue)
        
        stats = {
            "rules_executed": len(rule_results),
            "rules_passed": sum(1 for r in rule_results if r.passed),
            "rules_failed": sum(1 for r in rule_results if not r.passed),
            "rule_details": [
                {
                    "rule_id": r.rule_id,
                    "rule_name": r.rule_name,
                    "passed": r.passed,
                    "issue_count": len(r.issues),
                    "execution_time_ms": r.execution_time_ms,
                }
                for r in rule_results
            ],
        }
        result.stats = stats
        
        return result
    
    def validate_batch(
        self,
        prescriptions: list[Prescription],
        frames: Optional[dict[str, Frame]] = None,
        inventory: Optional[LensInventory] = None,
    ) -> BatchValidationResult:
        """批量校验处方
        
        Args:
            prescriptions: 处方列表
            frames: 镜架字典（键为处方ID）
            inventory: 镜片库存
            
        Returns:
            批量校验结果
        """
        batch_id = f"BATCH-{uuid.uuid4().hex[:8]}"
        batch_result = BatchValidationResult(
            batch_id=batch_id,
            total_orders=len(prescriptions),
        )
        
        for rx in prescriptions:
            frame = None
            if frames:
                frame = frames.get(rx.prescription_id)
            
            result = self.validate_prescription(
                prescription=rx,
                frame=frame,
                inventory=inventory,
            )
            
            batch_result.add_result(result)
        
        batch_result.complete()
        return batch_result
    
    def validate_with_specific_rules(
        self,
        prescription: Prescription,
        rule_ids: list[str],
        frame: Optional[Frame] = None,
        inventory: Optional[LensInventory] = None,
    ) -> ValidationResult:
        """使用指定规则校验处方
        
        Args:
            prescription: 处方数据
            rule_ids: 要执行的规则ID列表
            frame: 镜架数据
            inventory: 镜片库存
            
        Returns:
            校验结果
        """
        context = RuleContext(
            prescription=prescription,
            frame=frame,
            inventory=inventory,
            store_config=self.store_config,
            existing_orders=self._existing_orders,
        )
        
        rule_results = self.rule_engine.execute(context, rule_ids=rule_ids)
        
        all_passed = all(r.passed for r in rule_results)
        
        result = ValidationResult(
            order_id=prescription.prescription_id,
            prescription_id=prescription.prescription_id,
            passed=all_passed,
        )
        
        for rule_result in rule_results:
            for issue in rule_result.issues:
                result.add_issue(issue)
        
        return result
    
    def get_available_rules(self) -> list[dict]:
        """获取可用规则列表"""
        return [
            {
                "rule_id": rule.rule_id,
                "rule_name": rule.rule_name,
                "rule_description": rule.rule_description,
            }
            for rule in self.rule_engine.rules
        ]
