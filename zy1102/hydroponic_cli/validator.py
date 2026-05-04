"""数据校验模块 - 对解析后的数据进行完整性和有效性校验"""
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, date, timedelta

from .models import (
    Reservoir, Crop, CropStageInfo, Recipe, Reading,
    NutrientInventory, DataBundle, ValidationResult,
    ValidationError, ValidationWarning, CropStage, RecipeType
)
from .units import (
    VALID_EC_UNITS, VALID_VOLUME_UNITS,
    validate_ph, validate_ec, validate_volume,
    convert_ec, normalize_ec_to_ms
)


class DataValidator:
    """数据校验器"""
    
    def __init__(self):
        self.errors: List[ValidationError] = []
        self.warnings: List[ValidationWarning] = []
        self.info: List[str] = []
    
    def validate_all(self, data: DataBundle) -> ValidationResult:
        """校验所有数据"""
        self.errors = []
        self.warnings = []
        self.info = []
        
        self._validate_reservoirs(data.reservoirs)
        self._validate_crops(data.crops)
        self._validate_recipes(data.recipes)
        self._validate_readings(data.readings, data.reservoirs)
        self._validate_inventory(data.inventory, data.recipes)
        self._validate_cross_references(data)
        
        return ValidationResult(
            valid=len(self.errors) == 0,
            errors=self.errors.copy(),
            warnings=self.warnings.copy(),
            info=self.info.copy()
        )
    
    def _validate_reservoirs(self, reservoirs: Dict[str, Reservoir]):
        """校验储液桶数据"""
        if not reservoirs:
            self.warnings.append(ValidationWarning(
                field="reservoirs",
                value=None,
                message="未找到储液桶数据，部分功能可能不可用",
                severity="warning"
            ))
            return
        
        for res_id, reservoir in reservoirs.items():
            source_file = "reservoirs.json"
            
            if not reservoir.id.strip():
                self.errors.append(ValidationError(
                    field="id",
                    value=reservoir.id,
                    message="储液桶 ID 不能为空",
                    source_file=source_file
                ))
            
            if not reservoir.name.strip():
                self.errors.append(ValidationError(
                    field="name",
                    value=reservoir.name,
                    message=f"储液桶 '{res_id}' 名称不能为空",
                    source_file=source_file
                ))
            
            if reservoir.max_capacity <= 0:
                self.errors.append(ValidationError(
                    field="max_capacity",
                    value=reservoir.max_capacity,
                    message=f"储液桶 '{res_id}' 容量必须大于 0",
                    source_file=source_file
                ))
            
            if reservoir.capacity_unit not in VALID_VOLUME_UNITS:
                self.errors.append(ValidationError(
                    field="capacity_unit",
                    value=reservoir.capacity_unit,
                    message=f"储液桶 '{res_id}' 容量单位 '{reservoir.capacity_unit}' 无效，有效单位: {VALID_VOLUME_UNITS}",
                    source_file=source_file
                ))
            
            if reservoir.max_capacity_liters > 1000:
                self.warnings.append(ValidationWarning(
                    field="max_capacity",
                    value=reservoir.max_capacity,
                    message=f"储液桶 '{reservoir.name}' 容量 ({reservoir.max_capacity_liters:.1f} L) 较大，请注意管理",
                    source_file=source_file
                ))
    
    def _validate_crops(self, crops: Dict[str, Crop]):
        """校验作物数据"""
        if not crops:
            self.warnings.append(ValidationWarning(
                field="crops",
                value=None,
                message="未找到作物数据，部分功能可能不可用",
                severity="warning"
            ))
            return
        
        valid_stages = {s.value for s in CropStage}
        
        for crop_id, crop in crops.items():
            source_file = "crops.csv"
            
            if not crop.stages:
                self.errors.append(ValidationError(
                    field="stages",
                    value=crop.stages,
                    message=f"作物 '{crop.name}' (ID: {crop_id}) 没有定义生长阶段",
                    source_file=source_file
                ))
                continue
            
            for stage_name, stage_info in crop.stages.items():
                self._validate_crop_stage(crop_id, crop.name, stage_name, stage_info, valid_stages)
    
    def _validate_crop_stage(
        self,
        crop_id: str,
        crop_name: str,
        stage_name: str,
        stage_info: CropStageInfo,
        valid_stages: set
    ):
        """校验作物阶段"""
        source_file = "crops.csv"
        
        if stage_name.lower() not in valid_stages:
            self.warnings.append(ValidationWarning(
                field="stage",
                value=stage_name,
                message=f"作物 '{crop_name}' 的阶段 '{stage_name}' 不是标准值，标准阶段: {sorted(valid_stages)}",
                source_file=source_file
            ))
        
        if stage_info.target_ec_min < 0:
            self.errors.append(ValidationError(
                field="ec_min",
                value=stage_info.target_ec_min,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的 EC 最小值不能为负",
                source_file=source_file
            ))
        
        if stage_info.target_ec_max < stage_info.target_ec_min:
            self.errors.append(ValidationError(
                field="ec_max",
                value=stage_info.target_ec_max,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的 EC 最大值 ({stage_info.target_ec_max}) 小于最小值 ({stage_info.target_ec_min})",
                source_file=source_file
            ))
        
        ec_valid, ec_msg = validate_ec(stage_info.target_ec_min, stage_info.target_ec_unit)
        if not ec_valid and ec_msg:
            self.warnings.append(ValidationWarning(
                field="ec_min",
                value=stage_info.target_ec_min,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}': {ec_msg}",
                source_file=source_file
            ))
        
        if stage_info.target_ec_unit not in VALID_EC_UNITS:
            self.errors.append(ValidationError(
                field="ec_unit",
                value=stage_info.target_ec_unit,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的 EC 单位 '{stage_info.target_ec_unit}' 无效，有效单位: {VALID_EC_UNITS}",
                source_file=source_file
            ))
            return
        
        ph_valid, ph_msg = validate_ph(stage_info.target_ph_min)
        if not ph_valid and ph_msg:
            self.errors.append(ValidationError(
                field="ph_min",
                value=stage_info.target_ph_min,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}': {ph_msg}",
                source_file=source_file
            ))
        
        ph_valid, ph_msg = validate_ph(stage_info.target_ph_max)
        if not ph_valid and ph_msg:
            self.errors.append(ValidationError(
                field="ph_max",
                value=stage_info.target_ph_max,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}': {ph_msg}",
                source_file=source_file
            ))
        
        if stage_info.target_ph_max < stage_info.target_ph_min:
            self.errors.append(ValidationError(
                field="ph_max",
                value=stage_info.target_ph_max,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的 pH 最大值 ({stage_info.target_ph_max}) 小于最小值 ({stage_info.target_ph_min})",
                source_file=source_file
            ))
        
        ec_range = stage_info.target_ec_max - stage_info.target_ec_min
        if ec_range > 2.0:
            self.warnings.append(ValidationWarning(
                field="ec_range",
                value=f"{ec_range:.2f}",
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的 EC 范围 ({ec_range:.2f} mS/cm) 较宽，请注意精准控制",
                source_file=source_file
            ))
        
        if stage_info.target_ec_optimal < 0.5:
            self.warnings.append(ValidationWarning(
                field="target_ec_optimal",
                value=stage_info.target_ec_optimal,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的目标 EC ({stage_info.target_ec_optimal:.2f} mS/cm) 较低，可能需要特殊配方",
                source_file=source_file
            ))
        
        if stage_info.target_ec_optimal > 3.5:
            self.warnings.append(ValidationWarning(
                field="target_ec_optimal",
                value=stage_info.target_ec_optimal,
                message=f"作物 '{crop_name}' 阶段 '{stage_name}' 的目标 EC ({stage_info.target_ec_optimal:.2f} mS/cm) 较高，请注意防止烧根",
                source_file=source_file
            ))
    
    def _validate_recipes(self, recipes: Dict[str, Recipe]):
        """校验配方数据"""
        if not recipes:
            self.warnings.append(ValidationWarning(
                field="recipes",
                value=None,
                message="未找到配方数据，部分功能可能不可用",
                severity="warning"
            ))
            return
        
        valid_types = {t.value for t in RecipeType}
        
        for recipe_id, recipe in recipes.items():
            source_file = "recipes.json"
            
            if not recipe.name.strip():
                self.errors.append(ValidationError(
                    field="name",
                    value=recipe.name,
                    message=f"配方 '{recipe_id}' 名称不能为空",
                    source_file=source_file
                ))
            
            if recipe.type.lower() not in valid_types:
                self.warnings.append(ValidationWarning(
                    field="type",
                    value=recipe.type,
                    message=f"配方 '{recipe.name}' 的类型 '{recipe.type}' 不是标准值，标准类型: {sorted(valid_types)}",
                    source_file=source_file
                ))
            
            self._validate_solution_info(recipe_id, recipe.name, "A液", recipe.a_solution, source_file)
            self._validate_solution_info(recipe_id, recipe.name, "B液", recipe.b_solution, source_file)
            
            if recipe.mixing_ratio <= 0:
                self.errors.append(ValidationError(
                    field="mixing_ratio",
                    value=recipe.mixing_ratio,
                    message=f"配方 '{recipe.name}' 的混合比例必须大于 0",
                    source_file=source_file
                ))
            
            if not math.isclose(recipe.mixing_ratio, 1.0, abs_tol=0.01):
                self.warnings.append(ValidationWarning(
                    field="mixing_ratio",
                    value=recipe.mixing_ratio,
                    message=f"配方 '{recipe.name}' 的 A/B 液比例不是 1:1，请仔细核对混合要求",
                    source_file=source_file
                ))
            
            if recipe.incompatibility_notes:
                self.info.append(f"配方 '{recipe.name}' 有混配禁忌说明: {recipe.incompatibility_notes[:50]}...")
    
    def _validate_solution_info(
        self,
        recipe_id: str,
        recipe_name: str,
        solution_name: str,
        solution_info: Any,
        source_file: str
    ):
        """校验溶液信息"""
        if solution_info.ec_per_ml_per_liter <= 0:
            self.errors.append(ValidationError(
                field=f"{solution_name}.ec_per_ml_per_liter",
                value=solution_info.ec_per_ml_per_liter,
                message=f"配方 '{recipe_name}' 的 {solution_name} EC 贡献值必须大于 0",
                source_file=source_file
            ))
        
        if solution_info.concentration_per_ml <= 0:
            self.errors.append(ValidationError(
                field=f"{solution_name}.concentration_per_ml",
                value=solution_info.concentration_per_ml,
                message=f"配方 '{recipe_name}' 的 {solution_name} 浓度必须大于 0",
                source_file=source_file
            ))
        
        if solution_info.ec_per_ml_per_liter > 0.5:
            self.warnings.append(ValidationWarning(
                field=f"{solution_name}.ec_per_ml_per_liter",
                value=solution_info.ec_per_ml_per_liter,
                message=f"配方 '{recipe_name}' 的 {solution_name} EC 贡献值 ({solution_info.ec_per_ml_per_liter}) 较高，请注意稀释",
                source_file=source_file
            ))
    
    def _validate_readings(self, readings: List[Reading], reservoirs: Dict[str, Reservoir]):
        """校验读数数据"""
        if not readings:
            self.warnings.append(ValidationWarning(
                field="readings",
                value=None,
                message="未找到读数数据，模拟功能需要手动输入当前状态",
                severity="warning"
            ))
            return
        
        reservoir_ids = set(reservoirs.keys())
        duplicate_check: Dict[Tuple[str, datetime], int] = {}
        
        for i, reading in enumerate(readings):
            source_file = "readings.csv"
            row_num = i + 2
            
            key = (reading.reservoir_id, reading.timestamp)
            if key in duplicate_check:
                self.warnings.append(ValidationWarning(
                    field="timestamp",
                    value=reading.timestamp,
                    message=f"第 {row_num} 行: 储液桶 '{reading.reservoir_id}' 在同一时间点有多个读数",
                    source_file=source_file,
                    row_index=row_num
                ))
            duplicate_check[key] = row_num
            
            if reading.reservoir_id not in reservoir_ids:
                self.warnings.append(ValidationWarning(
                    field="reservoir_id",
                    value=reading.reservoir_id,
                    message=f"第 {row_num} 行: 储液桶 ID '{reading.reservoir_id}' 在 reservoirs.json 中未定义",
                    source_file=source_file,
                    row_index=row_num
                ))
            
            ec_valid, ec_msg = validate_ec(reading.ec_value, reading.ec_unit)
            if not ec_valid and ec_msg:
                self.errors.append(ValidationError(
                    field="ec_value",
                    value=reading.ec_value,
                    message=f"第 {row_num} 行: {ec_msg}",
                    source_file=source_file,
                    row_index=row_num
                ))
            
            ph_valid, ph_msg = validate_ph(reading.ph_value)
            if not ph_valid and ph_msg:
                self.errors.append(ValidationError(
                    field="ph_value",
                    value=reading.ph_value,
                    message=f"第 {row_num} 行: {ph_msg}",
                    source_file=source_file,
                    row_index=row_num
                ))
            
            if reading.volume is not None:
                vol_valid, vol_msg = validate_volume(reading.volume, reading.volume_unit)
                if not vol_valid and vol_msg:
                    self.errors.append(ValidationError(
                        field="volume",
                        value=reading.volume,
                        message=f"第 {row_num} 行: {vol_msg}",
                        source_file=source_file,
                        row_index=row_num
                    ))
                
                if reservoirs and reading.reservoir_id in reservoirs:
                    reservoir = reservoirs[reading.reservoir_id]
                    if reading.volume_liters and reading.volume_liters > reservoir.max_capacity_liters:
                        self.warnings.append(ValidationWarning(
                            field="volume",
                            value=reading.volume,
                            message=f"第 {row_num} 行: 体积 ({reading.volume_liters:.1f} L) 超过储液桶容量 ({reservoir.max_capacity_liters:.1f} L)",
                            source_file=source_file,
                            row_index=row_num
                        ))
            
            ec_ms = reading.ec_value_ms
            if ec_ms < 0.3:
                self.warnings.append(ValidationWarning(
                    field="ec_value",
                    value=reading.ec_value,
                    message=f"第 {row_num} 行: EC 值 ({ec_ms:.2f} mS/cm) 较低，可能需要补充营养液",
                    source_file=source_file,
                    row_index=row_num
                ))
            elif ec_ms > 4.0:
                self.warnings.append(ValidationWarning(
                    field="ec_value",
                    value=reading.ec_value,
                    message=f"第 {row_num} 行: EC 值 ({ec_ms:.2f} mS/cm) 较高，可能需要稀释",
                    source_file=source_file,
                    row_index=row_num
                ))
            
            if reading.ph_value < 5.0:
                self.warnings.append(ValidationWarning(
                    field="ph_value",
                    value=reading.ph_value,
                    message=f"第 {row_num} 行: pH 值 ({reading.ph_value:.1f}) 偏低，大多数作物偏好 5.5-6.5",
                    source_file=source_file,
                    row_index=row_num
                ))
            elif reading.ph_value > 7.0:
                self.warnings.append(ValidationWarning(
                    field="ph_value",
                    value=reading.ph_value,
                    message=f"第 {row_num} 行: pH 值 ({reading.ph_value:.1f}) 偏高，大多数作物偏好 5.5-6.5",
                    source_file=source_file,
                    row_index=row_num
                ))
    
    def _validate_inventory(self, inventory: Dict[str, NutrientInventory], recipes: Dict[str, Recipe]):
        """校验库存数据"""
        if not inventory:
            self.warnings.append(ValidationWarning(
                field="inventory",
                value=None,
                message="未找到库存数据，库存检查功能将不可用",
                severity="warning"
            ))
            return
        
        recipe_ids = set(recipes.keys())
        
        for inv_id, item in inventory.items():
            source_file = "inventory.json"
            
            if item.recipe_id not in recipe_ids:
                self.warnings.append(ValidationWarning(
                    field="recipe_id",
                    value=item.recipe_id,
                    message=f"库存项 '{inv_id}' 引用的配方 ID '{item.recipe_id}' 未定义",
                    source_file=source_file
                ))
            
            if item.current_volume < 0:
                self.errors.append(ValidationError(
                    field="current_volume",
                    value=item.current_volume,
                    message=f"库存项 '{inv_id}' 的当前体积不能为负",
                    source_file=source_file
                ))
            
            if item.volume_unit not in VALID_VOLUME_UNITS:
                self.errors.append(ValidationError(
                    field="volume_unit",
                    value=item.volume_unit,
                    message=f"库存项 '{inv_id}' 的体积单位 '{item.volume_unit}' 无效，有效单位: {VALID_VOLUME_UNITS}",
                    source_file=source_file
                ))
                continue
            
            try:
                if item.current_volume_ml <= item.minimum_threshold:
                    self.warnings.append(ValidationWarning(
                        field="current_volume",
                        value=item.current_volume,
                        message=f"库存项 '{inv_id}' (配方 {item.recipe_id} {item.solution_type}) 已接近或低于最低库存阈值",
                        source_file=source_file
                    ))
            except Exception as e:
                self.warnings.append(ValidationWarning(
                    field="current_volume",
                    value=item.current_volume,
                    message=f"库存项 '{inv_id}' 体积计算时出错: {e}",
                    source_file=source_file
                ))
            
            if item.expiration_date:
                today = date.today()
                days_until_expiry = (item.expiration_date - today).days
                
                if days_until_expiry < 0:
                    self.errors.append(ValidationError(
                        field="expiration_date",
                        value=item.expiration_date,
                        message=f"库存项 '{inv_id}' 已过期 {abs(days_until_expiry)} 天",
                        source_file=source_file
                    ))
                elif days_until_expiry < 30:
                    self.warnings.append(ValidationWarning(
                        field="expiration_date",
                        value=item.expiration_date,
                        message=f"库存项 '{inv_id}' 将在 {days_until_expiry} 天后过期",
                        source_file=source_file
                    ))
    
    def _validate_cross_references(self, data: DataBundle):
        """校验跨数据引用"""
        if not data.crops or not data.readings:
            return
        
        reading_reservoirs = {r.reservoir_id for r in data.readings}
        for res_id in reading_reservoirs:
            res_readings = [r for r in data.readings if r.reservoir_id == res_id]
            if len(res_readings) >= 2:
                first_reading = res_readings[0]
                last_reading = res_readings[-1]
                ec_change = last_reading.ec_value_ms - first_reading.ec_value_ms
                days_between = (last_reading.timestamp - first_reading.timestamp).days
                
                if days_between > 0:
                    ec_change_per_day = ec_change / days_between
                    if abs(ec_change_per_day) > 0.5:
                        reservoir_name = data.reservoirs.get(res_id, Reservoir(id=res_id, name=res_id, max_capacity=0)).name
                        direction = "上升" if ec_change_per_day > 0 else "下降"
                        self.warnings.append(ValidationWarning(
                            field="ec_trend",
                            value=f"{ec_change_per_day:.2f}/天",
                            message=f"储液桶 '{reservoir_name}' 的 EC {direction}速度较快 ({ec_change_per_day:.2f} mS/cm/天)，建议增加检测频率",
                            source_file="readings.csv"
                        ))
        
        if data.inventory and data.recipes:
            for recipe_id in data.recipes:
                has_a = any(inv.recipe_id == recipe_id and inv.solution_type.upper() == 'A' for inv in data.inventory.values())
                has_b = any(inv.recipe_id == recipe_id and inv.solution_type.upper() == 'B' for inv in data.inventory.values())
                
                if not has_a or not has_b:
                    recipe_name = data.recipes[recipe_id].name
                    missing = []
                    if not has_a:
                        missing.append("A液")
                    if not has_b:
                        missing.append("B液")
                    self.warnings.append(ValidationWarning(
                        field="inventory",
                        value=recipe_id,
                        message=f"配方 '{recipe_name}' 的库存不完整，缺少: {', '.join(missing)}",
                        source_file="inventory.json"
                    ))


import math
