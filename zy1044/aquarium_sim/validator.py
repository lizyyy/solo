"""
规则校验模块：验证输入数据的合理性
"""
from typing import List, Dict, Any, Tuple
from .models import (
    Scenario, Fish, WaterChange, AddFish,
    FishSize, FiltrationLevel
)


class ValidationError(Exception):
    """校验错误"""
    pass


class ValidationWarning(Exception):
    """校验警告（不影响运行，但需要注意）"""
    pass


class DataValidator:
    """数据校验器"""

    # 校验规则
    RULES = {
        'tank_volume': {
            'min': 0.1,
            'max': 10000.0,
            'unit': '升',
            'error_msg': '鱼缸体积必须在 {min} 到 {max} {unit} 之间'
        },
        'ph': {
            'min': 0.0,
            'max': 14.0,
            'unit': 'pH',
            'error_msg': 'pH 值必须在 {min} 到 {max} 之间'
        },
        'ammonia': {
            'min': 0.0,
            'max': 10.0,
            'unit': 'mg/L',
            'error_msg': '氨氮必须在 {min} 到 {max} {unit} 之间',
            'warning_high': 2.0,
            'warning_msg': '初始氨氮 {value} {unit} 已达到危险水平，建议先处理水质'
        },
        'nitrite': {
            'min': 0.0,
            'max': 10.0,
            'unit': 'mg/L',
            'error_msg': '亚硝酸盐必须在 {min} 到 {max} {unit} 之间',
            'warning_high': 1.0,
            'warning_msg': '初始亚硝酸盐 {value} {unit} 已达到危险水平，建议先处理水质'
        },
        'nitrate': {
            'min': 0.0,
            'max': 500.0,
            'unit': 'mg/L',
            'error_msg': '硝酸盐必须在 {min} 到 {max} {unit} 之间',
            'warning_high': 100.0,
            'warning_msg': '初始硝酸盐 {value} {unit} 偏高，建议换水降低'
        },
        'daily_feeding': {
            'min': 0.0,
            'max': 100.0,
            'unit': '克',
            'error_msg': '每日喂食量必须在 {min} 到 {max} {unit} 之间'
        },
        'water_change_percentage': {
            'min': 0.0,
            'max': 100.0,
            'unit': '%',
            'error_msg': '换水比例必须在 {min} 到 {max} {unit} 之间',
            'warning_high': 50.0,
            'warning_msg': '单次换水 {value}% 比例过大，可能导致水质急剧波动，建议分多次换水'
        },
        'simulation_days': {
            'min': 1,
            'max': 60,
            'unit': '天',
            'error_msg': '模拟天数必须在 {min} 到 {max} {unit} 之间'
        }
    }

    @staticmethod
    def validate(scenario: Scenario) -> Tuple[bool, List[str], List[str]]:
        """
        校验场景数据
        
        Args:
            scenario: 场景对象
            
        Returns:
            Tuple[是否通过, 错误列表, 警告列表]
        """
        errors = []
        warnings = []
        
        # 校验鱼缸体积
        errors.extend(DataValidator._validate_range(
            'tank_volume', scenario.tank_volume
        ))
        
        # 校验 pH
        errors.extend(DataValidator._validate_range(
            'ph', scenario.initial_ph
        ))
        
        # 校验氨氮
        errors.extend(DataValidator._validate_range(
            'ammonia', scenario.initial_ammonia
        ))
        warnings.extend(DataValidator._validate_warning(
            'ammonia', scenario.initial_ammonia
        ))
        
        # 校验亚硝酸盐
        errors.extend(DataValidator._validate_range(
            'nitrite', scenario.initial_nitrite
        ))
        warnings.extend(DataValidator._validate_warning(
            'nitrite', scenario.initial_nitrite
        ))
        
        # 校验硝酸盐
        errors.extend(DataValidator._validate_range(
            'nitrate', scenario.initial_nitrate
        ))
        warnings.extend(DataValidator._validate_warning(
            'nitrate', scenario.initial_nitrate
        ))
        
        # 校验喂食量
        errors.extend(DataValidator._validate_range(
            'daily_feeding', scenario.daily_feeding_amount
        ))
        
        # 校验模拟天数
        errors.extend(DataValidator._validate_range(
            'simulation_days', scenario.simulation_days
        ))
        
        # 校验鱼的配置
        for i, fish in enumerate(scenario.fish):
            fish_errors = DataValidator._validate_fish(fish, i)
            errors.extend(fish_errors)
        
        # 校验换水计划
        for i, wc in enumerate(scenario.water_changes):
            wc_errors, wc_warnings = DataValidator._validate_water_change(wc, i)
            errors.extend(wc_errors)
            warnings.extend(wc_warnings)
        
        # 校验加鱼计划
        for i, af in enumerate(scenario.add_fish):
            af_errors = DataValidator._validate_add_fish(af, i)
            errors.extend(af_errors)
        
        # 额外逻辑校验
        logic_errors, logic_warnings = DataValidator._validate_logic(scenario)
        errors.extend(logic_errors)
        warnings.extend(logic_warnings)
        
        is_valid = len(errors) == 0
        return is_valid, errors, warnings

    @staticmethod
    def _validate_range(rule_key: str, value: float) -> List[str]:
        """校验数值范围"""
        errors = []
        rule = DataValidator.RULES[rule_key]
        
        if value < rule['min'] or value > rule['max']:
            errors.append(rule['error_msg'].format(
                min=rule['min'],
                max=rule['max'],
                unit=rule['unit'],
                value=value
            ))
        
        return errors

    @staticmethod
    def _validate_warning(rule_key: str, value: float) -> List[str]:
        """校验警告条件"""
        warnings = []
        rule = DataValidator.RULES[rule_key]
        
        if 'warning_high' in rule and value > rule['warning_high']:
            warnings.append(rule['warning_msg'].format(
                value=value,
                unit=rule['unit']
            ))
        
        return warnings

    @staticmethod
    def _validate_fish(fish: Fish, index: int) -> List[str]:
        """校验鱼的配置"""
        errors = []
        
        if fish.quantity <= 0:
            errors.append(f"第 {index + 1} 组鱼的数量必须大于 0")
        
        return errors

    @staticmethod
    def _validate_water_change(wc: WaterChange, index: int) -> Tuple[List[str], List[str]]:
        """校验换水计划"""
        errors = []
        warnings = []
        
        if wc.day < 0:
            errors.append(f"第 {index + 1} 次换水的天数不能为负数")
        
        if wc.percentage < 0 or wc.percentage > 100:
            errors.append(f"第 {index + 1} 次换水比例必须在 0 到 100 之间")
        elif wc.percentage > 50:
            warnings.append(
                f"第 {index + 1} 次换水比例 {wc.percentage}% 过大，"
                f"建议分多次换水，每次不超过 30%"
            )
        
        return errors, warnings

    @staticmethod
    def _validate_add_fish(af: AddFish, index: int) -> List[str]:
        """校验加鱼计划"""
        errors = []
        
        if af.day < 0:
            errors.append(f"第 {index + 1} 次加鱼的天数不能为负数")
        
        if af.quantity <= 0:
            errors.append(f"第 {index + 1} 次加鱼的数量必须大于 0")
        
        return errors

    @staticmethod
    def _validate_logic(scenario: Scenario) -> Tuple[List[str], List[str]]:
        """逻辑校验"""
        errors = []
        warnings = []
        
        total_fish = sum(f.quantity for f in scenario.fish)
        
        if total_fish == 0 and not scenario.add_fish:
            warnings.append(
                "当前鱼缸为空且没有加鱼计划，模拟结果可能没有意义"
            )
        
        if scenario.daily_feeding_amount > 0 and total_fish == 0:
            warnings.append(
                "设置了喂食量但当前没有鱼，可能会导致水质恶化"
            )
        
        bio_load = DataValidator._calculate_bio_load(scenario)
        volume = scenario.tank_volume
        
        if bio_load > volume * 0.5:
            warnings.append(
                f"当前鱼的生物负载 ({bio_load:.1f}) 相对于鱼缸体积 ({volume} 升) 偏高，"
                f"可能需要增加换水频率"
            )
        
        feeding_per_fish = 0.0
        if total_fish > 0:
            feeding_per_fish = scenario.daily_feeding_amount / total_fish
        
        if feeding_per_fish > 0.5:
            warnings.append(
                f"每鱼每天喂食量 ({feeding_per_fish:.2f} 克) 偏高，"
                f"过量喂食会导致水质快速恶化"
            )
        
        days_with_water_change = set()
        for wc in scenario.water_changes:
            if wc.day in days_with_water_change:
                warnings.append(
                    f"第 {wc.day} 天设置了多次换水，这可能不是预期行为"
                )
            days_with_water_change.add(wc.day)
        
        return errors, warnings

    @staticmethod
    def _calculate_bio_load(scenario: Scenario) -> float:
        """计算生物负载（简化版）"""
        load = 0.0
        for fish in scenario.fish:
            if fish.size == FishSize.SMALL:
                load += fish.quantity * 1.0
            elif fish.size == FishSize.MEDIUM:
                load += fish.quantity * 3.0
            elif fish.size == FishSize.LARGE:
                load += fish.quantity * 8.0
        return load
