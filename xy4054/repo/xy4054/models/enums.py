from enum import Enum, auto
from typing import List


class MealType(Enum):
    BREAKFAST = "早餐"
    LUNCH = "午餐"
    DINNER = "晚餐"
    
    @classmethod
    def list(cls) -> List[str]:
        return [e.value for e in cls]
    
    @classmethod
    def from_string(cls, value: str) -> 'MealType':
        for e in cls:
            if e.value == value:
                return e
        raise ValueError(f"无效的餐次类型: {value}")


class ChronicDisease(Enum):
    DIABETES = "糖尿病"
    HYPERTENSION = "高血压"
    HYPERLIPIDEMIA = "高血脂"
    GOUT = "痛风"
    KIDNEY_DISEASE = "肾病"
    NORMAL = "普通"
    
    @classmethod
    def list(cls) -> List[str]:
        return [e.value for e in cls]
    
    @classmethod
    def get_restrictions(cls, disease: str) -> List[str]:
        restrictions = {
            "糖尿病": ["需控糖", "低糖饮食"],
            "高血压": ["需限钠", "低盐饮食"],
            "高血脂": ["需低脂", "低油饮食"],
            "痛风": ["需低嘌呤", "限海鲜肉类"],
            "肾病": ["需优质低蛋白", "限蛋白摄入"],
            "普通": ["无特殊要求"]
        }
        return restrictions.get(disease, ["无特殊要求"])


class NutritionType(Enum):
    ENERGY = "能量"
    PROTEIN = "蛋白质"
    FAT = "脂肪"
    CARBS = "碳水化合物"
    SODIUM = "钠"
    FIBER = "膳食纤维"
    
    @classmethod
    def list(cls) -> List[str]:
        return [e.value for e in cls]
    
    @classmethod
    def get_unit(cls, nutrition: str) -> str:
        units = {
            "能量": "kcal",
            "蛋白质": "g",
            "脂肪": "g",
            "碳水化合物": "g",
            "钠": "mg",
            "膳食纤维": "g"
        }
        return units.get(nutrition, "g")
    
    @classmethod
    def get_daily_reference(cls, nutrition: str) -> float:
        refs = {
            "能量": 1800.0,
            "蛋白质": 60.0,
            "脂肪": 60.0,
            "碳水化合物": 250.0,
            "钠": 2000.0,
            "膳食纤维": 25.0
        }
        return refs.get(nutrition, 0.0)


class ValidationSeverity(Enum):
    ERROR = "错误"
    WARNING = "警告"
    INFO = "信息"


class DataSource(Enum):
    ORDER = "订餐数据"
    SERVING = "打餐数据"
    WASTE = "剩余数据"
    ELDERLY = "老人信息"
    DISH = "菜品信息"
