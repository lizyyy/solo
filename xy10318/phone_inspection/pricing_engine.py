from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from enum import Enum


class QualityLevel(Enum):
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"


LEVEL_DESCRIPTIONS = {
    QualityLevel.A_PLUS.value: "准新成色 - 几乎全新，无明显划痕磕碰",
    QualityLevel.A.value: "良好成色 - 轻微使用痕迹，功能完好",
    QualityLevel.B.value: "一般成色 - 有明显划痕或磕碰，功能完好",
    QualityLevel.C.value: "较差成色 - 外观损伤明显或有功能瑕疵",
    QualityLevel.D.value: "故障机 - 功能异常或有严重外观损伤",
}


BASE_PRICES = {
    "iPhone 15 Pro Max": 8500,
    "iPhone 15 Pro": 7000,
    "iPhone 15": 5000,
    "iPhone 14 Pro Max": 6500,
    "iPhone 14 Pro": 5200,
    "iPhone 14": 3800,
    "iPhone 13 Pro Max": 4500,
    "iPhone 13 Pro": 3800,
    "iPhone 13": 3000,
    "华为 Mate 60 Pro": 5800,
    "华为 Mate 60": 4200,
    "华为 P60 Pro": 3500,
    "小米 14 Pro": 3200,
    "小米 14": 2500,
}


DEDUCTION_RULES = {
    "screen": {
        "perfect": {"deduction": 0, "description": "屏幕完好，无划痕无碎裂"},
        "minor_scratch": {"deduction": 0.05, "description": "轻微划痕（3mm以内，不影响显示）"},
        "deep_scratch": {"deduction": 0.15, "description": "明显划痕或多个划痕"},
        "cracked": {"deduction": 0.40, "description": "屏幕碎裂或漏液"},
        "burn_in": {"deduction": 0.20, "description": "屏幕烧屏或亮点"},
    },
    "frame": {
        "perfect": {"deduction": 0, "description": "边框后盖完好"},
        "minor_dent": {"deduction": 0.05, "description": "轻微磕碰或划痕"},
        "major_dent": {"deduction": 0.15, "description": "明显磕碰或变形"},
        "severe_damage": {"deduction": 0.30, "description": "严重变形或后盖碎裂"},
    },
    "camera": {
        "perfect": {"deduction": 0, "description": "摄像头功能完好"},
        "lens_scratch": {"deduction": 0.10, "description": "镜头轻微划痕，不影响成像"},
        "blurry": {"deduction": 0.25, "description": "成像模糊或有黑斑"},
        "non_functional": {"deduction": 0.35, "description": "摄像头无法使用"},
    },
}


BATTERY_HEALTH_DEDUCTION = {
    (95, 100): (0, "电池健康95%-100%，无扣减"),
    (85, 94): (0.02, "电池健康85%-94%，扣减2%"),
    (75, 84): (0.05, "电池健康75%-84%，扣减5%"),
    (60, 74): (0.10, "电池健康60%-74%，扣减10%"),
    (0, 59): (0.15, "电池健康60%以下，扣减15%"),
}


REPAIR_RECORD_DEDUCTION = {
    "none": {"deduction": 0, "description": "无维修记录，官方保修内/过保"},
    "battery_replacement": {"deduction": 0.05, "description": "仅更换电池（官方维修，有记录）"},
    "screen_replacement": {"deduction": 0.15, "description": "更换过屏幕（非官方维修扣减翻倍）"},
    "motherboard_repair": {"deduction": 0.30, "description": "主板维修，严重扣减"},
    "multiple_repairs": {"deduction": 0.40, "description": "多次维修，扣减40%"},
}


FUNCTIONAL_ISSUES = {
    "touch_not_working": {"deduction": 0.25, "description": "触摸失灵"},
    "face_id_broken": {"deduction": 0.20, "description": "面容/指纹识别损坏"},
    "speaker_broken": {"deduction": 0.08, "description": "扬声器/听筒损坏"},
    "charging_issue": {"deduction": 0.10, "description": "充电异常"},
    "wifi_issue": {"deduction": 0.10, "description": "WiFi/蓝牙异常"},
    "signal_issue": {"deduction": 0.15, "description": "信号不稳定或无信号"},
    "water_damage": {"deduction": 0.40, "description": "进水（严重扣减）"},
}


@dataclass
class PhoneInfo:
    imei: str
    model: str
    storage: str
    color: str
    purchase_date: str
    warranty_status: str


@dataclass
class InspectionResult:
    screen_condition: str
    frame_condition: str
    camera_condition: str
    battery_health: int
    repair_history: str
    repair_proof: bool
    functional_issues: List[str]
    notes: str = ""


@dataclass
class DeductionItem:
    category: str
    item: str
    description: str
    deduction_percent: float
    deduction_amount: float


@dataclass
class PricingResult:
    phone_info: PhoneInfo
    inspection: InspectionResult
    base_price: float
    total_deduction_percent: float
    total_deduction_amount: float
    final_price: float
    quality_level: str
    level_description: str
    deductions: List[DeductionItem] = field(default_factory=list)
    anomalies: List[str] = field(default_factory=list)
    needs_manual_review: bool = False
    is_manual_adjusted: bool = False
    manual_adjustment: float = 0.0
    status: str = "draft"
    confirmed_at: Optional[str] = None
    created_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["phone_info"] = asdict(self.phone_info)
        result["inspection"] = asdict(self.inspection)
        result["quality_level"] = self.quality_level
        return result


class PricingEngine:
    def calculate_price(
        self,
        phone_info: PhoneInfo,
        inspection: InspectionResult,
        manual_adjustment: float = 0.0,
    ) -> PricingResult:
        anomalies = []
        deductions = []
        total_deduction_percent = 0.0
        
        base_price = BASE_PRICES.get(phone_info.model, 3000)
        
        screen_rule = DEDUCTION_RULES["screen"].get(inspection.screen_condition)
        if screen_rule:
            deductions.append(DeductionItem(
                category="屏幕",
                item=inspection.screen_condition,
                description=screen_rule["description"],
                deduction_percent=screen_rule["deduction"],
                deduction_amount=round(base_price * screen_rule["deduction"], 2),
            ))
            total_deduction_percent += screen_rule["deduction"]
        
        frame_rule = DEDUCTION_RULES["frame"].get(inspection.frame_condition)
        if frame_rule:
            deductions.append(DeductionItem(
                category="边框",
                item=inspection.frame_condition,
                description=frame_rule["description"],
                deduction_percent=frame_rule["deduction"],
                deduction_amount=round(base_price * frame_rule["deduction"], 2),
            ))
            total_deduction_percent += frame_rule["deduction"]
        
        camera_rule = DEDUCTION_RULES["camera"].get(inspection.camera_condition)
        if camera_rule:
            deductions.append(DeductionItem(
                category="摄像头",
                item=inspection.camera_condition,
                description=camera_rule["description"],
                deduction_percent=camera_rule["deduction"],
                deduction_amount=round(base_price * camera_rule["deduction"], 2),
            ))
            total_deduction_percent += camera_rule["deduction"]
        
        battery_deduction = 0.0
        battery_desc = ""
        if inspection.battery_health > 100 or inspection.battery_health < 0:
            anomalies.append(f"电池健康值异常：{inspection.battery_health}%（正常范围0-100%）")
        else:
            for (min_h, max_h), (deduct, desc) in BATTERY_HEALTH_DEDUCTION.items():
                if min_h <= inspection.battery_health <= max_h:
                    battery_deduction = deduct
                    battery_desc = desc
                    break
            deductions.append(DeductionItem(
                category="电池健康",
                item=f"{inspection.battery_health}%",
                description=battery_desc,
                deduction_percent=battery_deduction,
                deduction_amount=round(base_price * battery_deduction, 2),
            ))
            total_deduction_percent += battery_deduction
        
        repair_rule = REPAIR_RECORD_DEDUCTION.get(inspection.repair_history)
        if repair_rule:
            repair_deduct = repair_rule["deduction"]
            if inspection.repair_history != "none" and not inspection.repair_proof:
                anomalies.append(f"维修记录 '{inspection.repair_history}' 缺少维修凭证")
                repair_deduct *= 1.5
            deductions.append(DeductionItem(
                category="维修记录",
                item=inspection.repair_history,
                description=repair_rule["description"],
                deduction_percent=repair_deduct,
                deduction_amount=round(base_price * repair_deduct, 2),
            ))
            total_deduction_percent += repair_deduct
        
        functional_deductions = []
        for issue in inspection.functional_issues:
            issue_rule = FUNCTIONAL_ISSUES.get(issue)
            if issue_rule:
                functional_deductions.append(issue_rule["deduction"])
                deductions.append(DeductionItem(
                    category="功能异常",
                    item=issue,
                    description=issue_rule["description"],
                    deduction_percent=issue_rule["deduction"],
                    deduction_amount=round(base_price * issue_rule["deduction"], 2),
                ))
        
        if functional_deductions:
            if "water_damage" in inspection.functional_issues and len(inspection.functional_issues) > 1:
                anomalies.append("功能项矛盾：进水标识触发，建议人工复核")
            if len(functional_deductions) > 2:
                anomalies.append("功能问题超过2项，建议人工复核")
            total_deduction_percent += sum(functional_deductions)
        
        level = self._determine_level(total_deduction_percent, inspection.functional_issues)
        
        total_deduction_amount = round(base_price * total_deduction_percent, 2)
        final_price = round(base_price - total_deduction_amount + manual_adjustment, 2)
        if final_price < 0:
            final_price = 0
        
        needs_review = len(anomalies) > 0 or total_deduction_percent > 0.5
        
        return PricingResult(
            phone_info=phone_info,
            inspection=inspection,
            base_price=base_price,
            total_deduction_percent=round(total_deduction_percent, 4),
            total_deduction_amount=total_deduction_amount,
            final_price=final_price,
            quality_level=level.value,
            level_description=LEVEL_DESCRIPTIONS[level.value],
            deductions=deductions,
            anomalies=anomalies,
            needs_manual_review=needs_review,
            manual_adjustment=manual_adjustment,
            is_manual_adjusted=manual_adjustment != 0,
        )
    
    def _determine_level(self, deduction_percent: float, functional_issues: List[str]) -> QualityLevel:
        if "water_damage" in functional_issues:
            return QualityLevel.D
        if "non_functional" in functional_issues or len(functional_issues) >= 3:
            return QualityLevel.D
        
        if deduction_percent <= 0.05:
            return QualityLevel.A_PLUS
        elif deduction_percent <= 0.15:
            return QualityLevel.A
        elif deduction_percent <= 0.30:
            return QualityLevel.B
        elif deduction_percent <= 0.50:
            return QualityLevel.C
        else:
            return QualityLevel.D
