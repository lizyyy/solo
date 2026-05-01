"""计划生成器模块"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from collections import defaultdict

from .config import Config, Hive
from .store import (
    InspectionRecord, TreatmentRecord, HarvestRecord, DataStore
)


@dataclass
class InspectionReminder:
    """巡检提醒"""
    hive_number: str
    apiary: str
    queen_year: int
    last_inspection_date: Optional[str] = None
    days_since_last_inspection: Optional[int] = None
    recommended_next_inspection: str = ""
    priority: str = "normal"
    reasons: List[str] = field(default_factory=list)


@dataclass
class HarvestRestriction:
    """禁采蜜提醒"""
    hive_number: str
    apiary: str
    restriction_type: str
    drug_name: Optional[str] = None
    treatment_date: Optional[str] = None
    safety_end_date: Optional[str] = None
    days_remaining: Optional[int] = None
    reason: str = ""


@dataclass
class RiskHive:
    """风险蜂箱"""
    hive_number: str
    apiary: str
    risk_level: str
    risk_categories: List[str]
    details: Dict[str, Any]


@dataclass
class PlanResult:
    """计划生成结果"""
    inspection_reminders: List[InspectionReminder]
    harvest_restrictions: List[HarvestRestriction]
    risk_hives: List[RiskHive]
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())


class PlanGenerator:
    """计划生成器"""
    
    RISK_LEVEL_CRITICAL = "critical"
    RISK_LEVEL_HIGH = "high"
    RISK_LEVEL_MEDIUM = "medium"
    RISK_LEVEL_LOW = "low"
    
    PRIORITY_URGENT = "urgent"
    PRIORITY_HIGH = "high"
    PRIORITY_NORMAL = "normal"
    
    def __init__(self, config: Config, data_store: DataStore):
        self.config = config
        self.data_store = data_store
        self.today = datetime.now()
    
    def generate_plan(self) -> PlanResult:
        """生成巡检和采蜜计划"""
        inspection_reminders = self._generate_inspection_reminders()
        harvest_restrictions = self._generate_harvest_restrictions()
        risk_hives = self._identify_risk_hives()
        
        return PlanResult(
            inspection_reminders=inspection_reminders,
            harvest_restrictions=harvest_restrictions,
            risk_hives=risk_hives,
        )
    
    def _generate_inspection_reminders(self) -> List[InspectionReminder]:
        """生成巡检提醒"""
        reminders: List[InspectionReminder] = []
        interval_days = self.config.default_inspection_interval_days
        
        for hive in self.config.hives:
            last_inspection = self._get_last_inspection(hive.hive_number)
            
            reminder = InspectionReminder(
                hive_number=hive.hive_number,
                apiary=hive.apiary,
                queen_year=hive.queen_year,
            )
            
            reasons: List[str] = []
            priority = self.PRIORITY_NORMAL
            
            if last_inspection:
                reminder.last_inspection_date = last_inspection.date
                last_date = datetime.strptime(last_inspection.date, "%Y-%m-%d")
                days_since = (self.today - last_date).days
                reminder.days_since_last_inspection = days_since
                
                next_date = last_date + timedelta(days=interval_days)
                reminder.recommended_next_inspection = next_date.strftime("%Y-%m-%d")
                
                if days_since >= interval_days:
                    reasons.append(f"已超过常规巡检周期 {days_since - interval_days} 天")
                    priority = self.PRIORITY_HIGH
                
                if last_inspection.pests_diseases and "蜂螨" in last_inspection.pests_diseases:
                    reasons.append("上次巡检发现蜂螨，需要密切关注")
                    priority = self.PRIORITY_URGENT
                
                if last_inspection.queen_status in ["停产", "失踪"]:
                    reasons.append(f"蜂王状态异常: {last_inspection.queen_status}")
                    priority = self.PRIORITY_URGENT
                
                if last_inspection.colony_strength == "弱":
                    reasons.append("群势较弱，需要关注")
                    if priority == self.PRIORITY_NORMAL:
                        priority = self.PRIORITY_HIGH
            else:
                reasons.append("尚未有巡检记录，建议首次巡检")
                reminder.recommended_next_inspection = self.today.strftime("%Y-%m-%d")
                priority = self.PRIORITY_HIGH
            
            queen_age = self.today.year - hive.queen_year
            if queen_age >= 2:
                reasons.append(f"蜂王年龄 {queen_age} 年，建议检查产卵情况")
                if priority == self.PRIORITY_NORMAL:
                    priority = self.PRIORITY_HIGH
            
            reminder.priority = priority
            reminder.reasons = reasons
            reminders.append(reminder)
        
        reminders.sort(key=lambda r: {
            self.PRIORITY_URGENT: 0,
            self.PRIORITY_HIGH: 1,
            self.PRIORITY_NORMAL: 2
        }.get(r.priority, 2))
        
        return reminders
    
    def _generate_harvest_restrictions(self) -> List[HarvestRestriction]:
        """生成禁采蜜提醒"""
        restrictions: List[HarvestRestriction] = []
        
        for hive in self.config.hives:
            treatments = self.data_store.get_treatments_by_hive(hive.hive_number)
            
            for treatment in treatments:
                if treatment.treatment_type != "用药":
                    continue
                
                drug = self.config.get_drug(treatment.product_name)
                if not drug:
                    continue
                
                treatment_date = datetime.strptime(treatment.date, "%Y-%m-%d")
                safety_end_date = treatment_date + timedelta(days=drug.safety_interval_days)
                
                if self.today < safety_end_date:
                    days_remaining = (safety_end_date - self.today).days
                    
                    restriction = HarvestRestriction(
                        hive_number=hive.hive_number,
                        apiary=hive.apiary,
                        restriction_type="SAFETY_INTERVAL",
                        drug_name=treatment.product_name,
                        treatment_date=treatment.date,
                        safety_end_date=safety_end_date.strftime("%Y-%m-%d"),
                        days_remaining=days_remaining,
                        reason=f"使用药物 '{treatment.product_name}' (安全间隔 {drug.safety_interval_days} 天), "
                              f"禁采至 {safety_end_date.strftime('%Y-%m-%d')}, 剩余 {days_remaining} 天"
                    )
                    restrictions.append(restriction)
        
        restrictions.sort(key=lambda r: r.days_remaining if r.days_remaining else 0)
        
        return restrictions
    
    def _identify_risk_hives(self) -> List[RiskHive]:
        """识别风险蜂箱"""
        risk_hives: List[RiskHive] = []
        
        for hive in self.config.hives:
            risk_categories: List[str] = []
            details: Dict[str, Any] = {}
            risk_level = self.RISK_LEVEL_LOW
            
            last_inspection = self._get_last_inspection(hive.hive_number)
            
            if last_inspection:
                if last_inspection.pests_diseases:
                    if "蜂螨" in last_inspection.pests_diseases:
                        risk_categories.append("PEST_MITE")
                        details["pest"] = "蜂螨"
                        risk_level = self._upgrade_risk(risk_level, self.RISK_LEVEL_HIGH)
                    
                    if "白垩病" in last_inspection.pests_diseases or "疾病" in last_inspection.pests_diseases:
                        risk_categories.append("DISEASE")
                        details["disease"] = last_inspection.pests_diseases
                        risk_level = self._upgrade_risk(risk_level, self.RISK_LEVEL_CRITICAL)
                
                if last_inspection.queen_status in ["停产", "失踪"]:
                    risk_categories.append("QUEEN_ISSUE")
                    details["queen_status"] = last_inspection.queen_status
                    risk_level = self._upgrade_risk(risk_level, self.RISK_LEVEL_CRITICAL)
                
                if last_inspection.colony_strength == "弱":
                    risk_categories.append("WEAK_COLONY")
                    details["colony_strength"] = "弱"
                    risk_level = self._upgrade_risk(risk_level, self.RISK_LEVEL_MEDIUM)
            
            queen_age = self.today.year - hive.queen_year
            if queen_age >= 3:
                risk_categories.append("OLD_QUEEN")
                details["queen_age"] = queen_age
                risk_level = self._upgrade_risk(risk_level, self.RISK_LEVEL_MEDIUM)
            
            active_restriction = self._has_active_restriction(hive.hive_number)
            if active_restriction:
                risk_categories.append("HARVEST_RESTRICTION")
                details["harvest_restriction"] = active_restriction
                risk_level = self._upgrade_risk(risk_level, self.RISK_LEVEL_HIGH)
            
            if risk_categories:
                risk_hives.append(RiskHive(
                    hive_number=hive.hive_number,
                    apiary=hive.apiary,
                    risk_level=risk_level,
                    risk_categories=risk_categories,
                    details=details,
                ))
        
        risk_order = {
            self.RISK_LEVEL_CRITICAL: 0,
            self.RISK_LEVEL_HIGH: 1,
            self.RISK_LEVEL_MEDIUM: 2,
            self.RISK_LEVEL_LOW: 3,
        }
        risk_hives.sort(key=lambda r: risk_order.get(r.risk_level, 3))
        
        return risk_hives
    
    def _get_last_inspection(self, hive_number: str) -> Optional[InspectionRecord]:
        """获取蜂箱最后一次巡检记录"""
        inspections = self.data_store.get_inspections_by_hive(hive_number)
        if not inspections:
            return None
        
        sorted_inspections = sorted(
            inspections,
            key=lambda r: datetime.strptime(r.date, "%Y-%m-%d"),
            reverse=True
        )
        return sorted_inspections[0]
    
    def _has_active_restriction(self, hive_number: str) -> Optional[Dict[str, Any]]:
        """检查是否有活跃的禁采限制"""
        treatments = self.data_store.get_treatments_by_hive(hive_number)
        
        for treatment in treatments:
            if treatment.treatment_type != "用药":
                continue
            
            drug = self.config.get_drug(treatment.product_name)
            if not drug:
                continue
            
            treatment_date = datetime.strptime(treatment.date, "%Y-%m-%d")
            safety_end_date = treatment_date + timedelta(days=drug.safety_interval_days)
            
            if self.today < safety_end_date:
                return {
                    "drug": treatment.product_name,
                    "treatment_date": treatment.date,
                    "safety_end_date": safety_end_date.strftime("%Y-%m-%d"),
                    "days_remaining": (safety_end_date - self.today).days,
                }
        
        return None
    
    @staticmethod
    def _upgrade_risk(current: str, new_level: str) -> str:
        """升级风险等级"""
        levels = ["low", "medium", "high", "critical"]
        current_idx = levels.index(current) if current in levels else 0
        new_idx = levels.index(new_level) if new_level in levels else 0
        return levels[max(current_idx, new_idx)]


def format_plan_for_display(plan: PlanResult) -> str:
    """格式化计划用于显示"""
    lines = []
    lines.append("=" * 60)
    lines.append("蜂箱巡检批次追溯员 - 巡检与采蜜计划")
    lines.append(f"生成时间: {plan.generated_at}")
    lines.append("=" * 60)
    lines.append("")
    
    if plan.inspection_reminders:
        lines.append("【巡检提醒】")
        lines.append("-" * 60)
        
        priority_labels = {
            "urgent": "紧急",
            "high": "高优先级",
            "normal": "常规",
        }
        
        for reminder in plan.inspection_reminders:
            priority_display = priority_labels.get(reminder.priority, reminder.priority)
            lines.append(f"  箱号: {reminder.hive_number} (蜂场: {reminder.apiary})")
            lines.append(f"  优先级: {priority_display}")
            lines.append(f"  蜂王年份: {reminder.queen_year}")
            
            if reminder.last_inspection_date:
                lines.append(f"  上次巡检: {reminder.last_inspection_date}")
                if reminder.days_since_last_inspection is not None:
                    lines.append(f"  距上次: {reminder.days_since_last_inspection} 天")
            lines.append(f"  建议下次巡检: {reminder.recommended_next_inspection}")
            
            if reminder.reasons:
                lines.append(f"  原因:")
                for reason in reminder.reasons:
                    lines.append(f"    - {reason}")
            lines.append("")
    
    if plan.harvest_restrictions:
        lines.append("【禁采蜜提醒】")
        lines.append("-" * 60)
        
        for restriction in plan.harvest_restrictions:
            lines.append(f"  箱号: {restriction.hive_number} (蜂场: {restriction.apiary})")
            lines.append(f"  药物: {restriction.drug_name}")
            lines.append(f"  用药日期: {restriction.treatment_date}")
            lines.append(f"  禁采至: {restriction.safety_end_date}")
            lines.append(f"  剩余天数: {restriction.days_remaining} 天")
            lines.append(f"  详情: {restriction.reason}")
            lines.append("")
    
    if plan.risk_hives:
        lines.append("【风险蜂箱】")
        lines.append("-" * 60)
        
        risk_labels = {
            "critical": "严重",
            "high": "高风险",
            "medium": "中等风险",
            "low": "低风险",
        }
        
        for risk in plan.risk_hives:
            risk_display = risk_labels.get(risk.risk_level, risk.risk_level)
            lines.append(f"  箱号: {risk.hive_number} (蜂场: {risk.apiary})")
            lines.append(f"  风险等级: {risk_display}")
            lines.append(f"  风险类别: {', '.join(risk.risk_categories)}")
            if risk.details:
                lines.append(f"  详情:")
                for key, value in risk.details.items():
                    lines.append(f"    - {key}: {value}")
            lines.append("")
    
    lines.append("=" * 60)
    return "\n".join(lines)
