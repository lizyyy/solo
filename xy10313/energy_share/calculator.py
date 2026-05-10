from datetime import datetime, date
from calendar import monthrange
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from .models import (
    House, OccupancyStatus, CommonMeterBill, Reduction, 
    BillDetail, DataIssue, RecordStatus
)


class DataValidator:
    """数据验证器"""
    
    def __init__(self, session: Session, billing_month: str):
        self.session = session
        self.billing_month = billing_month
        self.issues: List[DataIssue] = []
    
    def _add_issue(self, issue_type: str, entity: str, key: str, description: str):
        issue = DataIssue(
            billing_month=self.billing_month,
            issue_type=issue_type,
            related_entity=entity,
            related_key=key,
            description=description
        )
        self.issues.append(issue)
        return issue
    
    def _get_month_dates(self, month_str: str) -> Tuple[date, date]:
        year, month = map(int, month_str.split('-'))
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])
        return first_day, last_day
    
    def validate_house_areas(self):
        houses = self.session.query(House).all()
        for house in houses:
            if house.area is None or house.area <= 0:
                self._add_issue(
                    "面积缺失",
                    "House",
                    house.room_number,
                    f"房屋 {house.room_number} 的面积缺失或无效"
                )
        return self.issues
    
    def validate_vacant_periods(self):
        month_start, month_end = self._get_month_dates(self.billing_month)
        houses = self.session.query(House).all()
        
        for house in houses:
            for status in house.occupancy_statuses:
                if not status.is_vacant:
                    continue
                
                start = status.start_date
                end = status.end_date or month_end
                
                if start < month_start or end > month_end:
                    self._add_issue(
                        "空置日期跨月",
                        "OccupancyStatus",
                        house.room_number,
                        f"房屋 {house.room_number} 的空置期 ({start} 至 {end}) 跨月，可能影响计算准确性"
                    )
        return self.issues
    
    def validate_reductions(self):
        houses = self.session.query(House).all()
        for house in houses:
            for red in house.reductions:
                if red.billing_month and red.billing_month != self.billing_month:
                    continue
                
                if red.reduction_percent is not None:
                    if red.reduction_percent < 0 or red.reduction_percent > 100:
                        self._add_issue(
                            "减免比例异常",
                            "Reduction",
                            house.room_number,
                            f"房屋 {house.room_number} 的减免比例 {red.reduction_percent}% 超出合理范围 [0, 100]"
                        )
                
                if red.reduction_amount is not None and red.reduction_amount < 0:
                    self._add_issue(
                        "减免金额异常",
                        "Reduction",
                        house.room_number,
                        f"房屋 {house.room_number} 的减免金额 {red.reduction_amount} 为负数"
                    )
        
        return self.issues
    
    def validate_all(self) -> List[DataIssue]:
        self.issues = []
        self.validate_house_areas()
        self.validate_vacant_periods()
        self.validate_reductions()
        return self.issues


class EnergyShareCalculator:
    """能耗分摊计算器"""
    
    def __init__(self, session: Session, billing_month: str):
        self.session = session
        self.billing_month = billing_month
        self.month_start, self.month_end = self._get_month_dates(billing_month)
        self.month_total_days = monthrange(self.month_start.year, self.month_start.month)[1]
    
    def _get_month_dates(self, month_str: str) -> Tuple[date, date]:
        year, month = map(int, month_str.split('-'))
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])
        return first_day, last_day
    
    def _is_fully_vacant(self, house: House) -> bool:
        for status in house.occupancy_statuses:
            if status.is_vacant:
                if status.start_date <= self.month_start:
                    if status.end_date is None or status.end_date >= self.month_end:
                        return True
        return False
    
    def _get_vacant_days(self, house: House) -> int:
        vacant_days = 0
        for status in house.occupancy_statuses:
            if not status.is_vacant:
                continue
            
            actual_start = max(status.start_date, self.month_start)
            actual_end = min(status.end_date or self.month_end, self.month_end)
            
            if actual_start <= actual_end:
                vacant_days += (actual_end - actual_start).days + 1
        
        return min(vacant_days, self.month_total_days)
    
    def _get_valid_houses(self) -> List[House]:
        return [h for h in self.session.query(House).all() if h.area and h.area > 0]
    
    def _calculate_effective_area(self, house: House) -> float:
        if self._is_fully_vacant(house):
            return 0
        vacant_days = self._get_vacant_days(house)
        vacant_ratio = vacant_days / self.month_total_days
        return house.area * (1 - vacant_ratio)
    
    def _get_reductions(self, house: House) -> List[Reduction]:
        result = []
        for red in house.reductions:
            if red.billing_month == self.billing_month:
                result.append(red)
            elif not red.billing_month:
                if red.valid_from or red.valid_to:
                    valid = True
                    if red.valid_from and red.valid_from > self.month_end:
                        valid = False
                    if red.valid_to and red.valid_to < self.month_start:
                        valid = False
                    if valid:
                        result.append(red)
                else:
                    result.append(red)
        return result
    
    def _calculate_reduction(self, original_amount: float, reductions: List[Reduction]) -> Tuple[float, List[Dict]]:
        total_reduction = 0.0
        details = []
        current = original_amount
        
        for red in reductions:
            if red.reduction_percent is not None and red.reduction_percent > 0:
                amount = current * (red.reduction_percent / 100)
                total_reduction += amount
                details.append({
                    "type": red.reduction_type or "比例减免",
                    "percent": red.reduction_percent,
                    "amount": amount,
                    "reason": red.reason
                })
                current -= amount
            elif red.reduction_amount is not None and red.reduction_amount > 0:
                amount = min(red.reduction_amount, current)
                total_reduction += amount
                details.append({
                    "type": red.reduction_type or "定额减免",
                    "amount": amount,
                    "reason": red.reason
                })
                current -= amount
        
        return total_reduction, details
    
    def calculate(self) -> Dict:
        bill = self.session.query(CommonMeterBill).filter(
            CommonMeterBill.billing_month == self.billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {self.billing_month} 的公区账单")
        
        valid_houses = self._get_valid_houses()
        if not valid_houses:
            raise ValueError("没有有效的房屋数据")
        
        total_effective_area = sum(self._calculate_effective_area(h) for h in valid_houses)
        if total_effective_area <= 0:
            raise ValueError("所有房屋均为空置，无法计算分摊")
        
        results = []
        grand_total = 0.0
        
        for house in valid_houses:
            effective_area = self._calculate_effective_area(house)
            area_weight = effective_area / total_effective_area if total_effective_area > 0 else 0
            
            original_share = bill.total_amount * area_weight
            vacant_days = self._get_vacant_days(house)
            vacant_ratio = vacant_days / self.month_total_days
            
            reductions = self._get_reductions(house)
            reduction_amount, reduction_details = self._calculate_reduction(original_share, reductions)
            
            final_amount = max(0, original_share - reduction_amount)
            grand_total += final_amount
            
            calculation_note = self._build_calculation_note(
                bill, house, area_weight, original_share, vacant_days, reduction_details, final_amount
            )
            
            results.append({
                "house_id": house.id,
                "room_number": house.room_number,
                "owner_name": house.owner_name,
                "area": house.area,
                "effective_area": effective_area,
                "area_weight": area_weight,
                "is_vacant": self._is_fully_vacant(house),
                "vacant_days": vacant_days,
                "vacant_ratio": vacant_ratio,
                "original_share_amount": original_share,
                "reduction_amount": reduction_amount,
                "reduction_details": reduction_details,
                "final_amount": final_amount,
                "calculation_note": calculation_note
            })
        
        return {
            "billing_month": self.billing_month,
            "total_bill_amount": bill.total_amount,
            "electricity_kwh": bill.electricity_kwh,
            "water_tons": bill.water_tons,
            "total_effective_area": total_effective_area,
            "house_count": len(results),
            "results": results,
            "grand_total": grand_total
        }
    
    def _build_calculation_note(
        self, bill: CommonMeterBill, house: House, weight: float, 
        original: float, vacant_days: int, reductions: List[Dict], final: float
    ) -> str:
        note_parts = [
            f"公区总费用: {bill.total_amount:.2f} 元",
            f"房屋面积: {house.area:.2f} ㎡",
        ]
        
        if vacant_days > 0:
            note_parts.append(f"本月空置 {vacant_days} 天，有效面积已扣除")
        
        note_parts.append(f"分摊权重: {weight * 100:.4f}%")
        note_parts.append(f"分摊金额: {original:.2f} 元 = {bill.total_amount:.2f} × {weight * 100:.4f}%")
        
        if reductions:
            for rd in reductions:
                if "percent" in rd:
                    note_parts.append(f"减免: {rd['type']} {rd['percent']:.1f}%，减免 {rd['amount']:.2f} 元")
                else:
                    note_parts.append(f"减免: {rd['type']} {rd['amount']:.2f} 元")
            note_parts.append(f"最终应缴: {final:.2f} 元")
        else:
            note_parts.append(f"最终应缴: {original:.2f} 元")
        
        return "；".join(note_parts)
