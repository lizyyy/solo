"""
水质模拟计算引擎：模拟鱼缸水质变化
"""
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from .models import (
    Scenario, Fish, WaterChange, AddFish, WaterQuality,
    FishSize, FiltrationLevel
)


@dataclass
class SimulationState:
    """模拟状态"""
    day: int
    ammonia: float
    nitrite: float
    nitrate: float
    ph: float
    fish_list: List[Fish]
    feeding_amount: float


class WaterSimulator:
    """水质模拟器"""

    # 硝化细菌效率系数
    NITRIFICATION_RATE = {
        FiltrationLevel.LOW: 0.4,
        FiltrationLevel.MEDIUM: 0.7,
        FiltrationLevel.HIGH: 0.95
    }

    # 鱼的代谢系数（每单位生物负载产生的氨氮，单位：mg/L/天）
    AMMONIA_PER_BIOLOAD = 0.008

    # 未被食用的食物分解产生的氨氮比例
    UNEATEN_FOOD_RATIO = 0.15

    # 氨氮转化为亚硝酸盐的系数
    NH3_TO_NO2 = 0.85

    # 亚硝酸盐转化为硝酸盐的系数
    NO2_TO_NO3 = 0.8

    # 硝酸盐自然衰减系数
    NITRATE_DECAY = 0.01

    # 每克喂食产生的氨氮系数
    FEEDING_AMMONIA_RATE = 0.02

    def __init__(self, scenario: Scenario):
        self.scenario = scenario
        self._state: SimulationState = None
        self._water_change_map: Dict[int, List[float]] = {}
        self._add_fish_map: Dict[int, List[AddFish]] = {}
        self._init_maps()

    def _init_maps(self):
        """初始化换水和加鱼计划的映射"""
        for wc in self.scenario.water_changes:
            if wc.day not in self._water_change_map:
                self._water_change_map[wc.day] = []
            self._water_change_map[wc.day].append(wc.percentage)

        for af in self.scenario.add_fish:
            if af.day not in self._add_fish_map:
                self._add_fish_map[af.day] = []
            self._add_fish_map[af.day].append(af)

    def simulate(self) -> List[WaterQuality]:
        """
        执行模拟
        
        Returns:
            每天的水质数据列表
        """
        results = []

        self._state = SimulationState(
            day=0,
            ammonia=self.scenario.initial_ammonia,
            nitrite=self.scenario.initial_nitrite,
            nitrate=self.scenario.initial_nitrate,
            ph=self.scenario.initial_ph,
            fish_list=[Fish(f.size, f.quantity) for f in self.scenario.fish],
            feeding_amount=self.scenario.daily_feeding_amount
        )

        results.append(WaterQuality(
            day=0,
            ammonia=self._state.ammonia,
            nitrite=self._state.nitrite,
            nitrate=self._state.nitrate,
            ph=self._state.ph
        ))

        for day in range(1, self.scenario.simulation_days + 1):
            self._state.day = day

            self._process_add_fish()
            self._process_feeding()
            self._process_nitrification()
            self._process_water_change()
            self._adjust_ph()

            results.append(WaterQuality(
                day=day,
                ammonia=round(self._state.ammonia, 4),
                nitrite=round(self._state.nitrite, 4),
                nitrate=round(self._state.nitrate, 4),
                ph=round(self._state.ph, 2)
            ))

        return results

    def _process_add_fish(self):
        """处理加鱼"""
        if self._state.day in self._add_fish_map:
            for af in self._add_fish_map[self._state.day]:
                found = False
                for fish in self._state.fish_list:
                    if fish.size == af.size:
                        fish.quantity += af.quantity
                        found = True
                        break
                if not found:
                    self._state.fish_list.append(Fish(af.size, af.quantity))

    def _process_feeding(self):
        """处理喂食和代谢产生氨氮"""
        bioload = self._calculate_bioload()

        ammonia_from_metabolism = bioload * self.AMMONIA_PER_BIOLOAD

        uneaten_ammonia = self._state.feeding_amount * self.FEEDING_AMMONIA_RATE * self.UNEATEN_FOOD_RATIO

        total_ammonia_added = ammonia_from_metabolism + uneaten_ammonia
        self._state.ammonia += total_ammonia_added

    def _process_nitrification(self):
        """处理硝化作用"""
        nitrification_rate = self.NITRIFICATION_RATE[self.scenario.filtration_level]

        ammonia_to_convert = self._state.ammonia * nitrification_rate * self.NH3_TO_NO2
        self._state.ammonia -= ammonia_to_convert
        self._state.nitrite += ammonia_to_convert

        nitrite_to_convert = self._state.nitrite * nitrification_rate * self.NO2_TO_NO3
        self._state.nitrite -= nitrite_to_convert
        self._state.nitrate += nitrite_to_convert

        self._state.nitrate *= (1 - self.NITRATE_DECAY)

        self._state.ammonia = max(0, self._state.ammonia)
        self._state.nitrite = max(0, self._state.nitrite)
        self._state.nitrate = max(0, self._state.nitrate)

    def _process_water_change(self):
        """处理换水"""
        if self._state.day in self._water_change_map:
            total_percentage = sum(self._water_change_map[self._state.day])
            if total_percentage >= 100:
                self._state.ammonia = 0
                self._state.nitrite = 0
                self._state.nitrate = 0
            else:
                factor = (100 - total_percentage) / 100
                self._state.ammonia *= factor
                self._state.nitrite *= factor
                self._state.nitrate *= factor

    def _adjust_ph(self):
        """调整 pH（简化模型）"""
        target_ph = 7.0 + (self._state.nitrate / 200) * 0.5
        target_ph = min(8.5, max(5.5, target_ph))

        ph_diff = target_ph - self._state.ph
        self._state.ph += ph_diff * 0.1

    def _calculate_bioload(self) -> float:
        """计算当前生物负载"""
        load = 0.0
        for fish in self._state.fish_list:
            if fish.size == FishSize.SMALL:
                load += fish.quantity * 1.0
            elif fish.size == FishSize.MEDIUM:
                load += fish.quantity * 3.0
            elif fish.size == FishSize.LARGE:
                load += fish.quantity * 8.0
        return load


def run_simulation(scenario: Scenario) -> Tuple[List[WaterQuality], Dict[str, Any]]:
    """
    运行模拟并返回结果
    
    Args:
        scenario: 场景对象
        
    Returns:
        Tuple[水质数据列表, 摘要信息]
    """
    simulator = WaterSimulator(scenario)
    daily_quality = simulator.simulate()

    summary = _calculate_summary(daily_quality, scenario)

    return daily_quality, summary


def _calculate_summary(daily_quality: List[WaterQuality], scenario: Scenario) -> Dict[str, Any]:
    """计算摘要信息"""
    if not daily_quality:
        return {}

    initial = daily_quality[0]
    final = daily_quality[-1]

    max_ammonia = max(q.ammonia for q in daily_quality)
    max_nitrite = max(q.nitrite for q in daily_quality)
    max_nitrate = max(q.nitrate for q in daily_quality)

    ammonia_trend = "上升" if final.ammonia > initial.ammonia else "下降" if final.ammonia < initial.ammonia else "稳定"
    nitrite_trend = "上升" if final.nitrite > initial.nitrite else "下降" if final.nitrite < initial.nitrite else "稳定"
    nitrate_trend = "上升" if final.nitrate > initial.nitrate else "下降" if final.nitrate < initial.nitrate else "稳定"

    ammonia_danger_days = sum(1 for q in daily_quality if q.ammonia > 0.5)
    nitrite_danger_days = sum(1 for q in daily_quality if q.nitrite > 0.3)
    nitrate_danger_days = sum(1 for q in daily_quality if q.nitrate > 80)

    ph_stable = all(abs(q.ph - initial.ph) < 0.5 for q in daily_quality)

    return {
        'initial_ammonia': initial.ammonia,
        'initial_nitrite': initial.nitrite,
        'initial_nitrate': initial.nitrate,
        'initial_ph': initial.ph,
        'final_ammonia': final.ammonia,
        'final_nitrite': final.nitrite,
        'final_nitrate': final.nitrate,
        'final_ph': final.ph,
        'max_ammonia': max_ammonia,
        'max_nitrite': max_nitrite,
        'max_nitrate': max_nitrate,
        'ammonia_trend': ammonia_trend,
        'nitrite_trend': nitrite_trend,
        'nitrate_trend': nitrate_trend,
        'ammonia_danger_days': ammonia_danger_days,
        'nitrite_danger_days': nitrite_danger_days,
        'nitrate_danger_days': nitrate_danger_days,
        'ph_stable': ph_stable,
        'simulation_days': len(daily_quality) - 1
    }
