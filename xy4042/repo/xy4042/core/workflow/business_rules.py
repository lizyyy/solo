from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from models.order import Order
from models.measurement import Measurement
from models.attachment import Attachment
from models.fitting_record import FittingRecord
from models.rework_record import ReworkRecord


@dataclass
class RuleCheckResult:
    passed: bool
    rule_name: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


class BusinessRules:
    @staticmethod
    def check_measurements_for_design(
        order: Order,
        measurements: List[Measurement]
    ) -> RuleCheckResult:
        if not measurements:
            return RuleCheckResult(
                passed=False,
                rule_name="尺寸版本检查",
                message="订单没有尺寸版本，无法进入设计阶段",
                details={"order_id": order.id, "status": order.status}
            )
        return RuleCheckResult(
            passed=True,
            rule_name="尺寸版本检查",
            message=f"订单有 {len(measurements)} 个尺寸版本",
            details={"measurement_count": len(measurements)}
        )
    
    @staticmethod
    def check_visuals_for_production(
        order: Order,
        attachments: List[Attachment]
    ) -> RuleCheckResult:
        has_images = any(a.is_image() for a in attachments)
        has_scans = any(a.is_scan() for a in attachments)
        
        if not has_images and not has_scans:
            return RuleCheckResult(
                passed=False,
                rule_name="视觉参考检查",
                message="订单没有扫描文件或取模照片，无法进入制作阶段",
                details={"order_id": order.id, "has_images": False, "has_scans": False}
            )
        
        return RuleCheckResult(
            passed=True,
            rule_name="视觉参考检查",
            message="订单有视觉参考资料",
            details={"has_images": has_images, "has_scans": has_scans}
        )
    
    @staticmethod
    def check_rework_requires_fitting(
        order: Order,
        fitting_records: List[FittingRecord],
        rework_record: Optional[ReworkRecord] = None
    ) -> RuleCheckResult:
        if not fitting_records:
            return RuleCheckResult(
                passed=False,
                rule_name="返修关联检查",
                message="返修必须关联一次试穿记录",
                details={"order_id": order.id, "fitting_count": 0}
            )
        
        if rework_record and rework_record.fitting_record_id:
            fitting_exists = any(
                f.id == rework_record.fitting_record_id for f in fitting_records
            )
            if not fitting_exists:
                return RuleCheckResult(
                    passed=False,
                    rule_name="返修关联检查",
                    message="指定的试穿记录不存在",
                    details={"fitting_record_id": rework_record.fitting_record_id}
                )
        
        return RuleCheckResult(
            passed=True,
            rule_name="返修关联检查",
            message=f"订单有 {len(fitting_records)} 条试穿记录",
            details={"fitting_count": len(fitting_records)}
        )
    
    @staticmethod
    def check_final_list_before_delivery(
        order: Order,
        has_final_list: bool = False
    ) -> RuleCheckResult:
        if not has_final_list:
            return RuleCheckResult(
                passed=False,
                rule_name="最终清单检查",
                message="交付前建议生成最终清单",
                details={"order_id": order.id, "has_final_list": False}
            )
        return RuleCheckResult(
            passed=True,
            rule_name="最终清单检查",
            message="已生成最终清单",
            details={"has_final_list": True}
        )
    
    @staticmethod
    def check_side_consistency(
        order: Order,
        measurements: List[Measurement]
    ) -> List[RuleCheckResult]:
        results = []
        
        for measurement in measurements:
            dims = measurement.get_dimensions_dict()
            if order.side == "左侧":
                if any("右" in key for key in dims.keys()):
                    results.append(RuleCheckResult(
                        passed=False,
                        rule_name="左右侧一致性检查",
                        message=f"订单为左侧，但尺寸版本 {measurement.version} 包含右侧尺寸",
                        details={"version": measurement.version}
                    ))
            elif order.side == "右侧":
                if any("左" in key for key in dims.keys()):
                    results.append(RuleCheckResult(
                        passed=False,
                        rule_name="左右侧一致性检查",
                        message=f"订单为右侧，但尺寸版本 {measurement.version} 包含左侧尺寸",
                        details={"version": measurement.version}
                    ))
        
        if not results:
            results.append(RuleCheckResult(
                passed=True,
                rule_name="左右侧一致性检查",
                message="所有尺寸版本与订单左右侧一致",
                details={}
            ))
        
        return results
