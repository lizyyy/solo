"""数据验证器"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from nickel_plating_calculator.models.data_models import (
    TitrationData,
    TankRecord,
    ProductionRecord,
    ChemicalInventory,
    ProcessParameters,
)


class ValidationError(Exception):
    """验证错误"""
    def __init__(self, field: str, message: str, value: Any = None):
        self.field = field
        self.message = message
        self.value = value
        super().__init__(f"{field}: {message}" + (f" (值: {value})" if value is not None else ""))


class ValidationResult:
    """验证结果"""
    
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0
    
    def add_error(self, field: str, message: str, value: Any = None):
        self.errors.append(ValidationError(field, message, value))
    
    def add_warning(self, message: str):
        self.warnings.append(message)
    
    def raise_if_invalid(self):
        if not self.is_valid:
            raise ValueError(f"数据验证失败: {[str(e) for e in self.errors]}")


class TitrationValidator:
    """滴定数据验证器"""
    
    EDTA_VOLUME_MIN = 0.0
    EDTA_VOLUME_MAX = 50.0
    PH_MIN = 0.0
    PH_MAX = 14.0
    SAMPLE_VOLUME_MIN = 0.1
    SAMPLE_VOLUME_MAX = 100.0
    
    @classmethod
    def validate(cls, data: TitrationData, params: Optional[ProcessParameters] = None) -> ValidationResult:
        result = ValidationResult()
        
        if not data.batch_id or data.batch_id.strip() == "":
            result.add_error("batch_id", "批次ID不能为空")
        
        if not data.operator or data.operator.strip() == "":
            result.add_error("operator", "操作员不能为空")
        
        if data.timestamp > datetime.now():
            result.add_error("timestamp", "时间戳不能是未来时间", data.timestamp)
        
        if not (cls.EDTA_VOLUME_MIN < data.nickel_sulfate_edta_volume <= cls.EDTA_VOLUME_MAX):
            result.add_error(
                "nickel_sulfate_edta_volume",
                f"EDTA体积应在{cls.EDTA_VOLUME_MIN}-{cls.EDTA_VOLUME_MAX}mL之间",
                data.nickel_sulfate_edta_volume
            )
        
        if not (cls.EDTA_VOLUME_MIN < data.nickel_chloride_edta_volume <= cls.EDTA_VOLUME_MAX):
            result.add_error(
                "nickel_chloride_edta_volume",
                f"EDTA体积应在{cls.EDTA_VOLUME_MIN}-{cls.EDTA_VOLUME_MAX}mL之间",
                data.nickel_chloride_edta_volume
            )
        
        if not (cls.EDTA_VOLUME_MIN < data.boric_titrant_volume <= cls.EDTA_VOLUME_MAX):
            result.add_error(
                "boric_titrant_volume",
                f"滴定剂体积应在{cls.EDTA_VOLUME_MIN}-{cls.EDTA_VOLUME_MAX}mL之间",
                data.boric_titrant_volume
            )
        
        if not (cls.PH_MIN <= data.ph_value <= cls.PH_MAX):
            result.add_error(
                "ph_value",
                f"pH值应在{cls.PH_MIN}-{cls.PH_MAX}之间",
                data.ph_value
            )
        
        if not (cls.SAMPLE_VOLUME_MIN <= data.sample_volume <= cls.SAMPLE_VOLUME_MAX):
            result.add_error(
                "sample_volume",
                f"样品体积应在{cls.SAMPLE_VOLUME_MIN}-{cls.SAMPLE_VOLUME_MAX}mL之间",
                data.sample_volume
            )
        
        if params:
            cls._check_ph_range_warning(result, data.ph_value, params)
        
        return result
    
    @staticmethod
    def _check_ph_range_warning(result: ValidationResult, ph: float, params: ProcessParameters):
        """检查pH范围警告"""
        if ph < params.ph_min or ph > params.ph_max:
            result.add_warning(
                f"pH值 {ph:.2f} 超出工艺范围 ({params.ph_min:.1f}-{params.ph_max:.1f})"
            )


class TankRecordValidator:
    """槽液记录验证器"""
    
    VOLUME_MIN_L = 10.0
    VOLUME_MAX_L = 10000.0
    TEMP_MIN_C = 10.0
    TEMP_MAX_C = 90.0
    PH_MIN = 0.0
    PH_MAX = 14.0
    
    @classmethod
    def validate(cls, data: TankRecord, params: Optional[ProcessParameters] = None) -> ValidationResult:
        result = ValidationResult()
        
        if not data.tank_id or data.tank_id.strip() == "":
            result.add_error("tank_id", "槽号不能为空")
        
        if not data.batch_id or data.batch_id.strip() == "":
            result.add_error("batch_id", "批次ID不能为空")
        
        if not data.operator or data.operator.strip() == "":
            result.add_error("operator", "操作员不能为空")
        
        if data.timestamp > datetime.now():
            result.add_error("timestamp", "时间戳不能是未来时间", data.timestamp)
        
        if not (cls.VOLUME_MIN_L <= data.volume_liters <= cls.VOLUME_MAX_L):
            result.add_error(
                "volume_liters",
                f"槽液体积应在{cls.VOLUME_MIN_L}-{cls.VOLUME_MAX_L}L之间",
                data.volume_liters
            )
        
        if not (cls.TEMP_MIN_C <= data.temperature_celsius <= cls.TEMP_MAX_C):
            result.add_error(
                "temperature_celsius",
                f"温度应在{cls.TEMP_MIN_C}-{cls.TEMP_MAX_C}°C之间",
                data.temperature_celsius
            )
        
        if not (cls.PH_MIN <= data.current_ph <= cls.PH_MAX):
            result.add_error(
                "current_ph",
                f"pH值应在{cls.PH_MIN}-{cls.PH_MAX}之间",
                data.current_ph
            )
        
        if params:
            cls._check_temperature_range_warning(result, data.temperature_celsius, params)
            cls._check_ph_range_warning(result, data.current_ph, params)
        
        return result
    
    @staticmethod
    def _check_temperature_range_warning(result: ValidationResult, temp: float, params: ProcessParameters):
        """检查温度范围警告"""
        if temp < params.temperature_min_c or temp > params.temperature_max_c:
            result.add_warning(
                f"温度 {temp:.1f}°C 超出工艺范围 ({params.temperature_min_c:.0f}-{params.temperature_max_c:.0f}°C)"
            )
    
    @staticmethod
    def _check_ph_range_warning(result: ValidationResult, ph: float, params: ProcessParameters):
        """检查pH范围警告"""
        if ph < params.ph_min or ph > params.ph_max:
            result.add_warning(
                f"pH值 {ph:.2f} 超出工艺范围 ({params.ph_min:.1f}-{params.ph_max:.1f})"
            )


class ProductionRecordValidator:
    """生产记录验证器"""
    
    AREA_MIN_DM2 = 0.0
    AREA_MAX_DM2 = 100000.0
    PARTS_MIN = 0
    PARTS_MAX = 100000
    TIME_MIN_MINUTES = 0.0
    TIME_MAX_MINUTES = 1440.0
    
    @classmethod
    def validate(cls, data: ProductionRecord) -> ValidationResult:
        result = ValidationResult()
        
        if not data.batch_id or data.batch_id.strip() == "":
            result.add_error("batch_id", "批次ID不能为空")
        
        if not data.operator or data.operator.strip() == "":
            result.add_error("operator", "操作员不能为空")
        
        if data.timestamp > datetime.now():
            result.add_error("timestamp", "时间戳不能是未来时间", data.timestamp)
        
        if not (cls.AREA_MIN_DM2 <= data.total_area_dm2 <= cls.AREA_MAX_DM2):
            result.add_error(
                "total_area_dm2",
                f"生产面积应在{cls.AREA_MIN_DM2}-{cls.AREA_MAX_DM2}dm²之间",
                data.total_area_dm2
            )
        
        if data.total_area_dm2 == 0:
            result.add_warning("生产面积为0，请确认数据是否正确")
        
        if not (cls.PARTS_MIN <= data.parts_count <= cls.PARTS_MAX):
            result.add_error(
                "parts_count",
                f"工件数量应在{cls.PARTS_MIN}-{cls.PARTS_MAX}之间",
                data.parts_count
            )
        
        if not (cls.TIME_MIN_MINUTES <= data.plating_time_minutes <= cls.TIME_MAX_MINUTES):
            result.add_error(
                "plating_time_minutes",
                f"电镀时间应在{cls.TIME_MIN_MINUTES}-{cls.TIME_MAX_MINUTES}分钟之间",
                data.plating_time_minutes
            )
        
        if data.estimated_nickel_consumption_g is not None and data.estimated_nickel_consumption_g < 0:
            result.add_error(
                "estimated_nickel_consumption_g",
                "估算镍消耗量不能为负数",
                data.estimated_nickel_consumption_g
            )
        
        if data.estimated_acid_consumption_ml is not None and data.estimated_acid_consumption_ml < 0:
            result.add_error(
                "estimated_acid_consumption_ml",
                "估算酸消耗量不能为负数",
                data.estimated_acid_consumption_ml
            )
        
        return result


class InventoryValidator:
    """库存验证器"""
    
    QUANTITY_MIN_KG = 0.0
    QUANTITY_MAX_KG = 100000.0
    
    VALID_CHEMICALS = [
        "硫酸镍", "氯化镍", "硼酸",
        "sulfuric acid", "nickel sulfate", "nickel chloride", "boric acid"
    ]
    
    @classmethod
    def validate(cls, inventory: ChemicalInventory) -> ValidationResult:
        result = ValidationResult()
        
        if not inventory.chemical_name or inventory.chemical_name.strip() == "":
            result.add_error("chemical_name", "药剂名称不能为空")
        
        if not inventory.batch_id or inventory.batch_id.strip() == "":
            result.add_error("batch_id", "批次ID不能为空")
        
        if not inventory.operator or inventory.operator.strip() == "":
            result.add_error("operator", "操作员不能为空")
        
        if inventory.timestamp > datetime.now():
            result.add_error("timestamp", "时间戳不能是未来时间", inventory.timestamp)
        
        if not (cls.QUANTITY_MIN_KG <= inventory.current_quantity_kg <= cls.QUANTITY_MAX_KG):
            result.add_error(
                "current_quantity_kg",
                f"当前库存应在{cls.QUANTITY_MIN_KG}-{cls.QUANTITY_MAX_KG}kg之间",
                inventory.current_quantity_kg
            )
        
        if not (cls.QUANTITY_MIN_KG <= inventory.minimum_stock_kg <= cls.QUANTITY_MAX_KG):
            result.add_error(
                "minimum_stock_kg",
                f"最低库存应在{cls.QUANTITY_MIN_KG}-{cls.QUANTITY_MAX_KG}kg之间",
                inventory.minimum_stock_kg
            )
        
        if inventory.current_quantity_kg <= inventory.minimum_stock_kg:
            result.add_warning(
                f"{inventory.chemical_name} 库存 {inventory.current_quantity_kg:.2f}kg 低于最低库存 {inventory.minimum_stock_kg:.2f}kg"
            )
        
        if inventory.unit_price_per_kg is not None and inventory.unit_price_per_kg < 0:
            result.add_error(
                "unit_price_per_kg",
                "单价不能为负数",
                inventory.unit_price_per_kg
            )
        
        return result
    
    @classmethod
    def validate_multiple(cls, inventories: List[ChemicalInventory]) -> Dict[str, ValidationResult]:
        """验证多条库存记录"""
        results = {}
        for inv in inventories:
            key = inv.chemical_name
            results[key] = cls.validate(inv)
        return results


def validate_titration(data: TitrationData, params: Optional[ProcessParameters] = None) -> ValidationResult:
    """便捷函数：验证滴定数据"""
    return TitrationValidator.validate(data, params)


def validate_tank_record(data: TankRecord, params: Optional[ProcessParameters] = None) -> ValidationResult:
    """便捷函数：验证槽液记录"""
    return TankRecordValidator.validate(data, params)


def validate_production(data: ProductionRecord) -> ValidationResult:
    """便捷函数：验证生产记录"""
    return ProductionRecordValidator.validate(data)


def validate_inventory(data: ChemicalInventory) -> ValidationResult:
    """便捷函数：验证库存记录"""
    return InventoryValidator.validate(data)
