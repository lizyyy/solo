from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
import json

from .calculator import CalculationResult


@dataclass
class PricingRecord:
    record_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_name: str = ""
    source_type: str = ""  
    imported_at: datetime = field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None
    
    production_cost: float = 0.0
    production_cost_unit: str = "CNY"
    expected_attendance: float = 0.0
    attendance_unit: str = "person"
    profit_margin: float = 0.0
    days_to_show: int = 0
    ticket_sold_rate: float = 0.0
    weekend_factor: int = 0
    
    manual_notes: str = ""
    
    calculation_result: Optional[CalculationResult] = None
    process_status: str = "pending"  
    failure_reason: str = ""
    needs_review: bool = False
    review_notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.calculation_result:
            data["calculation_result"] = {
                "success": self.calculation_result.success,
                "base_price": self.calculation_result.base_price,
                "dynamic_multiplier": self.calculation_result.dynamic_multiplier,
                "final_price": self.calculation_result.final_price,
                "tier": self.calculation_result.tier,
                "tier_color": self.calculation_result.tier_color,
                "error_message": self.calculation_result.error_message,
                "processed_at": self.calculation_result.processed_at.isoformat() if self.calculation_result.processed_at else None,
                "warnings": [w.message for w in self.calculation_result.warnings],
                "errors": [e.message for e in self.calculation_result.errors],
                "conflicts": [(c.item, c.lecture_says, c.data_says, c.suggestion) for c in self.calculation_result.conflicts],
                "steps": [
                    {
                        "name": s.formula_name,
                        "source": s.formula_source,
                        "expression": s.formula_expression,
                        "result": s.result,
                        "result_unit": s.result_unit
                    } for s in self.calculation_result.steps
                ]
            }
        data["imported_at"] = self.imported_at.isoformat()
        data["processed_at"] = self.processed_at.isoformat() if self.processed_at else None
        return data
    
    def to_export_row(self) -> Dict[str, Any]:
        row = {
            "record_id": self.record_id,
            "source_name": self.source_name,
            "source_type": self.source_type,
            "imported_at": self.imported_at.strftime("%Y-%m-%d %H:%M:%S"),
            "processed_at": self.processed_at.strftime("%Y-%m-%d %H:%M:%S") if self.processed_at else "",
            "production_cost": self.production_cost,
            "production_cost_unit": self.production_cost_unit,
            "expected_attendance": self.expected_attendance,
            "attendance_unit": self.attendance_unit,
            "profit_margin": self.profit_margin,
            "days_to_show": self.days_to_show,
            "ticket_sold_rate": self.ticket_sold_rate,
            "weekend_factor": self.weekend_factor,
            "manual_notes": self.manual_notes,
            "process_status": self.process_status,
            "needs_review": "是" if self.needs_review else "否",
            "review_notes": self.review_notes,
        }
        
        if self.calculation_result:
            row.update({
                "calculation_success": "是" if self.calculation_result.success else "否",
                "base_price": self.calculation_result.base_price,
                "dynamic_multiplier": self.calculation_result.dynamic_multiplier,
                "final_price": self.calculation_result.final_price,
                "tier": self.calculation_result.tier,
                "tier_color": self.calculation_result.tier_color,
                "error_message": self.calculation_result.error_message or "",
                "warnings": "; ".join([w.message for w in self.calculation_result.warnings]),
                "errors": "; ".join([e.message for e in self.calculation_result.errors]),
                "conflict_count": len(self.calculation_result.conflicts),
                "conflicts_details": "; ".join([f"{c.item}: {c.suggestion}" for c in self.calculation_result.conflicts]),
            })
        else:
            row.update({
                "calculation_success": "",
                "base_price": "",
                "dynamic_multiplier": "",
                "final_price": "",
                "tier": "",
                "tier_color": "",
                "error_message": self.failure_reason,
                "warnings": "",
                "errors": "",
                "conflict_count": "",
                "conflicts_details": "",
            })
        
        return row


class RecordManager:
    def __init__(self):
        self.records: List[PricingRecord] = []
    
    def add_record(self, record: PricingRecord) -> None:
        self.records.append(record)
    
    def get_record(self, record_id: str) -> Optional[PricingRecord]:
        for r in self.records:
            if r.record_id == record_id:
                return r
        return None
    
    def get_records_by_status(self, status: str) -> List[PricingRecord]:
        return [r for r in self.records if r.process_status == status]
    
    def get_records_needing_review(self) -> List[PricingRecord]:
        return [r for r in self.records if r.needs_review]
    
    def get_failed_records(self) -> List[PricingRecord]:
        return [r for r in self.records if r.process_status == "failed"]
    
    def get_statistics(self) -> Dict[str, Any]:
        total = len(self.records)
        success = len([r for r in self.records if r.process_status == "success"])
        failed = len([r for r in self.records if r.process_status == "failed"])
        pending = len([r for r in self.records if r.process_status == "pending"])
        needs_review = len([r for r in self.records if r.needs_review])
        
        tiers_count = {}
        for r in self.records:
            if r.calculation_result and r.calculation_result.tier:
                tier = r.calculation_result.tier
                tiers_count[tier] = tiers_count.get(tier, 0) + 1
        
        return {
            "total_records": total,
            "success_count": success,
            "failed_count": failed,
            "pending_count": pending,
            "needs_review_count": needs_review,
            "success_rate": (success / total * 100) if total > 0 else 0,
            "tiers_distribution": tiers_count
        }
    
    def batch_process(self, calculator) -> None:
        for record in self.records:
            if record.process_status == "pending":
                try:
                    result = calculator.calculate(
                        production_cost=record.production_cost,
                        production_cost_unit=record.production_cost_unit,
                        expected_attendance=record.expected_attendance,
                        attendance_unit=record.attendance_unit,
                        profit_margin=record.profit_margin,
                        days_to_show=record.days_to_show,
                        ticket_sold_rate=record.ticket_sold_rate,
                        weekend_factor=record.weekend_factor
                    )
                    record.calculation_result = result
                    record.processed_at = datetime.now()
                    
                    if result.success:
                        record.process_status = "success"
                        if result.warnings or result.conflicts:
                            record.needs_review = True
                            record.review_notes = "存在警告或与讲义冲突，需人工确认"
                    else:
                        record.process_status = "failed"
                        record.failure_reason = result.error_message or "计算失败"
                        record.needs_review = True
                except Exception as e:
                    record.process_status = "failed"
                    record.failure_reason = f"处理异常: {str(e)}"
                    record.needs_review = True
    
    def to_json(self, filepath: str) -> None:
        data = [r.to_dict() for r in self.records]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def from_json(self, filepath: str) -> None:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self.records = []
        for item in data:
            record = PricingRecord(
                record_id=item.get("record_id", str(uuid.uuid4())),
                source_name=item.get("source_name", ""),
                source_type=item.get("source_type", ""),
                production_cost=item.get("production_cost", 0),
                production_cost_unit=item.get("production_cost_unit", "CNY"),
                expected_attendance=item.get("expected_attendance", 0),
                attendance_unit=item.get("attendance_unit", "person"),
                profit_margin=item.get("profit_margin", 0),
                days_to_show=item.get("days_to_show", 0),
                ticket_sold_rate=item.get("ticket_sold_rate", 0),
                weekend_factor=item.get("weekend_factor", 0),
                manual_notes=item.get("manual_notes", ""),
                process_status=item.get("process_status", "pending"),
                needs_review=item.get("needs_review", False),
                review_notes=item.get("review_notes", "")
            )
            self.records.append(record)
