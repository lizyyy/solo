from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import json


@dataclass
class TimeSlot:
    """时间段数据类"""
    name: str
    start_hour: int
    end_hour: int
    price: float
    
    def contains(self, hour: int) -> bool:
        """检查给定小时是否在该时段内"""
        if self.start_hour <= self.end_hour:
            return self.start_hour <= hour <= self.end_hour
        else:
            return hour >= self.start_hour or hour <= self.end_hour
    
    def get_hours_list(self) -> List[int]:
        """获取该时段包含的所有小时列表"""
        if self.start_hour <= self.end_hour:
            return list(range(self.start_hour, self.end_hour + 1))
        else:
            return list(range(self.start_hour, 24)) + list(range(0, self.end_hour + 1))
    
    def overlaps_with(self, other: 'TimeSlot') -> bool:
        """检查与另一个时段是否重叠"""
        self_hours = set(self.get_hours_list())
        other_hours = set(other.get_hours_list())
        return len(self_hours & other_hours) > 0


class PricingConfig:
    """电价配置模块"""
    
    # 默认的峰平谷电价配置（以上海居民阶梯电价为例）
    DEFAULT_PEAK_PRICE = 0.977
    DEFAULT_FLAT_PRICE = 0.617
    DEFAULT_VALLEY_PRICE = 0.307
    
    def __init__(self):
        self.time_slots: Dict[str, TimeSlot] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []
        
        # 初始化默认配置
        self._init_default_config()
    
    def _init_default_config(self):
        """初始化默认的峰平谷电价配置"""
        # 峰时段：8:00-22:00
        self.time_slots['峰'] = TimeSlot(
            name='峰',
            start_hour=8,
            end_hour=21,
            price=self.DEFAULT_PEAK_PRICE
        )
        
        # 谷时段：22:00-8:00（次日）
        self.time_slots['谷'] = TimeSlot(
            name='谷',
            start_hour=22,
            end_hour=7,
            price=self.DEFAULT_VALLEY_PRICE
        )
        
        # 注意：默认配置没有平时段，如果需要可以添加
    
    def set_time_slot(self, name: str, start_hour: int, end_hour: int, price: float) -> bool:
        """
        设置或更新一个时段
        
        Args:
            name: 时段名称（峰、平、谷等）
            start_hour: 开始小时（0-23）
            end_hour: 结束小时（0-23）
            price: 电价（元/kWh）
            
        Returns:
            是否成功
        """
        self.errors = []
        self.warnings = []
        
        # 校验输入
        if not self._validate_time_slot_input(start_hour, end_hour, price):
            return False
        
        # 创建临时时段用于检查重叠
        temp_slot = TimeSlot(name=name, start_hour=start_hour, end_hour=end_hour, price=price)
        
        # 检查与其他时段的重叠
        if self._check_overlap(temp_slot, exclude_name=name):
            return False
        
        # 更新时段
        self.time_slots[name] = temp_slot
        
        return True
    
    def _validate_time_slot_input(self, start_hour: int, end_hour: int, price: float) -> bool:
        """校验时段输入参数"""
        valid = True
        
        # 检查小时范围
        if not (0 <= start_hour <= 23):
            self.errors.append(f"开始小时 {start_hour} 超出有效范围（0-23）")
            valid = False
        
        if not (0 <= end_hour <= 23):
            self.errors.append(f"结束小时 {end_hour} 超出有效范围（0-23）")
            valid = False
        
        # 检查电价
        if price < 0:
            self.errors.append(f"电价 {price} 不能为负数")
            valid = False
        elif price == 0:
            self.warnings.append(f"电价设置为 0，这可能不是您想要的")
        
        return valid
    
    def _check_overlap(self, new_slot: TimeSlot, exclude_name: str = None) -> bool:
        """
        检查新时段是否与已有时段重叠
        
        Args:
            new_slot: 新时段
            exclude_name: 排除检查的时段名称（用于更新时段时）
            
        Returns:
            是否存在重叠
        """
        for name, slot in self.time_slots.items():
            if exclude_name and name == exclude_name:
                continue
            
            if new_slot.overlaps_with(slot):
                # 获取重叠的小时
                new_hours = set(new_slot.get_hours_list())
                existing_hours = set(slot.get_hours_list())
                overlap_hours = sorted(list(new_hours & existing_hours))
                
                self.errors.append(
                    f"时段 '{new_slot.name}' ({new_slot.start_hour}:00-{new_slot.end_hour}:00) "
                    f"与时段 '{name}' ({slot.start_hour}:00-{slot.end_hour}:00) 重叠。\n"
                    f"重叠的小时: {', '.join([f'{h}:00' for h in overlap_hours])}\n"
                    f"请调整时段设置，确保各时段不重叠且覆盖全天24小时。"
                )
                return True
        
        return False
    
    def validate_coverage(self) -> Tuple[bool, List[int]]:
        """
        检查所有时段是否覆盖了全天24小时
        
        Returns:
            (是否全覆盖, 未覆盖的小时列表)
        """
        covered_hours = set()
        
        for slot in self.time_slots.values():
            covered_hours.update(slot.get_hours_list())
        
        all_hours = set(range(24))
        uncovered_hours = sorted(list(all_hours - covered_hours))
        
        return len(uncovered_hours) == 0, uncovered_hours
    
    def get_price_for_hour(self, hour: int) -> Tuple[Optional[float], Optional[str]]:
        """
        获取指定小时的电价和时段名称
        
        Args:
            hour: 小时（0-23）
            
        Returns:
            (电价, 时段名称)，如果没有匹配的时段则返回 (None, None)
        """
        for name, slot in self.time_slots.items():
            if slot.contains(hour):
                return slot.price, name
        
        return None, None
    
    def get_time_slot_by_name(self, name: str) -> Optional[TimeSlot]:
        """根据名称获取时段"""
        return self.time_slots.get(name)
    
    def get_all_time_slots(self) -> Dict[str, TimeSlot]:
        """获取所有时段配置"""
        return self.time_slots.copy()
    
    def get_time_slots_as_list(self) -> List[Dict]:
        """获取时段配置列表形式（用于UI显示）"""
        return [
            {
                'name': slot.name,
                'start_hour': slot.start_hour,
                'end_hour': slot.end_hour,
                'price': slot.price,
                'hours': slot.get_hours_list()
            }
            for slot in self.time_slots.values()
        ]
    
    def remove_time_slot(self, name: str) -> bool:
        """删除指定时段"""
        if name in self.time_slots:
            del self.time_slots[name]
            return True
        return False
    
    def reset_to_default(self):
        """重置为默认配置"""
        self.time_slots.clear()
        self._init_default_config()
        self.errors = []
        self.warnings = []
    
    def get_errors(self) -> List[str]:
        """获取错误列表"""
        return self.errors
    
    def get_warnings(self) -> List[str]:
        """获取警告列表"""
        return self.warnings
    
    def to_dict(self) -> Dict:
        """转换为字典（用于保存配置）"""
        return {
            name: {
                'start_hour': slot.start_hour,
                'end_hour': slot.end_hour,
                'price': slot.price
            }
            for name, slot in self.time_slots.items()
        }
    
    def from_dict(self, config_dict: Dict) -> bool:
        """从字典加载配置"""
        temp_slots = {}
        
        for name, config in config_dict.items():
            try:
                start_hour = int(config['start_hour'])
                end_hour = int(config['end_hour'])
                price = float(config['price'])
                
                temp_slot = TimeSlot(
                    name=name,
                    start_hour=start_hour,
                    end_hour=end_hour,
                    price=price
                )
                
                # 检查是否与已加载的时段重叠
                for existing_name, existing_slot in temp_slots.items():
                    if temp_slot.overlaps_with(existing_slot):
                        self.errors.append(
                            f"加载配置失败：时段 '{name}' 与时段 '{existing_name}' 重叠"
                        )
                        return False
                
                temp_slots[name] = temp_slot
                
            except Exception as e:
                self.errors.append(f"加载时段 '{name}' 配置失败: {str(e)}")
                return False
        
        # 所有配置验证通过后，更新当前配置
        self.time_slots = temp_slots
        return True
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)
    
    def from_json(self, json_str: str) -> bool:
        """从JSON字符串加载配置"""
        try:
            config_dict = json.loads(json_str)
            return self.from_dict(config_dict)
        except Exception as e:
            self.errors.append(f"解析JSON配置失败: {str(e)}")
            return False
