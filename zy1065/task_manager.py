from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import json


@dataclass
class FlexibleTask:
    """
    可挪动的用电任务数据类
    
    例如：
    - 洗衣：1.2度，可在20:00-08:00之间安排，最多延迟10小时
    """
    id: str
    name: str
    energy_kwh: float  # 用电量（度）
    duration_hours: float = 1.0  # 持续时间（小时）
    
    # 时间窗口约束
    preferred_start_hour: Optional[int] = None  # 偏好开始小时（如果有）
    window_start_hour: int = 0  # 可安排窗口开始小时
    window_end_hour: int = 23  # 可安排窗口结束小时
    max_delay_hours: float = 24.0  # 最大延迟小时数
    
    # 状态
    is_enabled: bool = True
    notes: str = ""
    
    # 优化后的结果（由优化器填充）
    optimized_start_hour: Optional[int] = None
    optimized_cost: Optional[float] = None
    original_cost: Optional[float] = None
    savings: Optional[float] = None
    
    def get_available_hours(self) -> List[int]:
        """
        获取所有可用的小时列表
        
        考虑时间窗口和持续时间
        """
        window_hours = self._get_window_hours()
        
        # 如果有持续时间，需要确保任务能完整完成
        if self.duration_hours <= 1:
            return window_hours
        
        # 对于持续时间超过1小时的任务，需要检查连续的小时块
        available_starts = []
        for start_hour in window_hours:
            # 检查从 start_hour 开始的连续 duration_hours 小时是否都在窗口内
            can_fit = True
            for i in range(int(self.duration_hours)):
                check_hour = (start_hour + i) % 24
                if check_hour not in window_hours:
                    can_fit = False
                    break
            
            if can_fit:
                available_starts.append(start_hour)
        
        return available_starts
    
    def _get_window_hours(self) -> List[int]:
        """获取时间窗口内的所有小时"""
        if self.window_start_hour <= self.window_end_hour:
            return list(range(self.window_start_hour, self.window_end_hour + 1))
        else:
            # 跨天的情况，如 22:00 - 08:00
            return list(range(self.window_start_hour, 24)) + list(range(0, self.window_end_hour + 1))
    
    def is_hour_available(self, hour: int) -> bool:
        """检查指定小时是否在可用窗口内"""
        window_hours = self._get_window_hours()
        return hour in window_hours
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'energy_kwh': self.energy_kwh,
            'duration_hours': self.duration_hours,
            'preferred_start_hour': self.preferred_start_hour,
            'window_start_hour': self.window_start_hour,
            'window_end_hour': self.window_end_hour,
            'max_delay_hours': self.max_delay_hours,
            'is_enabled': self.is_enabled,
            'notes': self.notes,
            'optimized_start_hour': self.optimized_start_hour,
            'optimized_cost': self.optimized_cost,
            'original_cost': self.original_cost,
            'savings': self.savings
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'FlexibleTask':
        """从字典创建任务"""
        return cls(
            id=data.get('id', ''),
            name=data.get('name', ''),
            energy_kwh=data.get('energy_kwh', 0.0),
            duration_hours=data.get('duration_hours', 1.0),
            preferred_start_hour=data.get('preferred_start_hour'),
            window_start_hour=data.get('window_start_hour', 0),
            window_end_hour=data.get('window_end_hour', 23),
            max_delay_hours=data.get('max_delay_hours', 24.0),
            is_enabled=data.get('is_enabled', True),
            notes=data.get('notes', ''),
            optimized_start_hour=data.get('optimized_start_hour'),
            optimized_cost=data.get('optimized_cost'),
            original_cost=data.get('original_cost'),
            savings=data.get('savings')
        )


class TaskManager:
    """用电任务管理模块"""
    
    # 默认的预设任务
    DEFAULT_PRESETS = [
        {
            'id': 'laundry',
            'name': '洗衣机',
            'energy_kwh': 1.2,
            'duration_hours': 1.5,
            'window_start_hour': 22,
            'window_end_hour': 7,
            'max_delay_hours': 10.0,
            'notes': '洗衣程序，建议在谷时段运行'
        },
        {
            'id': 'dryer',
            'name': '烘干机',
            'energy_kwh': 2.5,
            'duration_hours': 1.0,
            'window_start_hour': 22,
            'window_end_hour': 7,
            'max_delay_hours': 10.0,
            'notes': '烘干程序，用电量较大'
        },
        {
            'id': 'water_heater',
            'name': '热水器',
            'energy_kwh': 3.0,
            'duration_hours': 2.0,
            'window_start_hour': 22,
            'window_end_hour': 7,
            'max_delay_hours': 8.0,
            'notes': '电热水器加热，可在谷时段预热'
        },
        {
            'id': 'ev_charging',
            'name': '电动车充电',
            'energy_kwh': 30.0,
            'duration_hours': 6.0,
            'window_start_hour': 22,
            'window_end_hour': 7,
            'max_delay_hours': 12.0,
            'notes': '电动汽车夜间充电'
        },
        {
            'id': 'dishwasher',
            'name': '洗碗机',
            'energy_kwh': 0.8,
            'duration_hours': 1.5,
            'window_start_hour': 20,
            'window_end_hour': 8,
            'max_delay_hours': 12.0,
            'notes': '洗碗程序，可延迟到谷时段'
        }
    ]
    
    def __init__(self):
        self.tasks: Dict[str, FlexibleTask] = {}
        self._next_id = 1
        self._load_default_presets()
    
    def _load_default_presets(self):
        """加载默认预设任务"""
        for preset in self.DEFAULT_PRESETS:
            task = FlexibleTask.from_dict(preset)
            self.tasks[task.id] = task
        
        # 更新下一个ID
        self._next_id = len(self.tasks) + 1
    
    def add_task(self, name: str, energy_kwh: float, 
                 duration_hours: float = 1.0,
                 window_start_hour: int = 0,
                 window_end_hour: int = 23,
                 max_delay_hours: float = 24.0,
                 preferred_start_hour: Optional[int] = None,
                 notes: str = "") -> Tuple[bool, str, Optional[FlexibleTask]]:
        """
        添加新任务
        
        Returns:
            (成功与否, 消息, 任务对象或None)
        """
        # 验证输入
        if not name.strip():
            return False, "任务名称不能为空", None
        
        if energy_kwh <= 0:
            return False, "用电量必须大于0", None
        
        if duration_hours <= 0:
            return False, "持续时间必须大于0", None
        
        if not (0 <= window_start_hour <= 23):
            return False, "窗口开始小时必须在0-23之间", None
        
        if not (0 <= window_end_hour <= 23):
            return False, "窗口结束小时必须在0-23之间", None
        
        if max_delay_hours < 0:
            return False, "最大延迟时间不能为负数", None
        
        # 创建任务
        task_id = f"task_{self._next_id}"
        self._next_id += 1
        
        task = FlexibleTask(
            id=task_id,
            name=name.strip(),
            energy_kwh=energy_kwh,
            duration_hours=duration_hours,
            window_start_hour=window_start_hour,
            window_end_hour=window_end_hour,
            max_delay_hours=max_delay_hours,
            preferred_start_hour=preferred_start_hour,
            notes=notes
        )
        
        self.tasks[task_id] = task
        
        return True, f"任务 '{name}' 添加成功", task
    
    def update_task(self, task_id: str, **kwargs) -> Tuple[bool, str]:
        """
        更新任务属性
        
        支持的参数: name, energy_kwh, duration_hours, 
                    window_start_hour, window_end_hour, 
                    max_delay_hours, preferred_start_hour, 
                    is_enabled, notes
        """
        if task_id not in self.tasks:
            return False, f"任务 ID '{task_id}' 不存在"
        
        task = self.tasks[task_id]
        
        # 验证并更新每个参数
        valid_params = [
            'name', 'energy_kwh', 'duration_hours',
            'window_start_hour', 'window_end_hour',
            'max_delay_hours', 'preferred_start_hour',
            'is_enabled', 'notes'
        ]
        
        for key, value in kwargs.items():
            if key not in valid_params:
                continue
            
            # 特殊验证
            if key == 'name' and not value.strip():
                return False, "任务名称不能为空"
            
            if key == 'energy_kwh' and value <= 0:
                return False, "用电量必须大于0"
            
            if key == 'duration_hours' and value <= 0:
                return False, "持续时间必须大于0"
            
            if key in ['window_start_hour', 'window_end_hour']:
                if not (0 <= value <= 23):
                    return False, f"{key} 必须在0-23之间"
            
            if key == 'max_delay_hours' and value < 0:
                return False, "最大延迟时间不能为负数"
            
            setattr(task, key, value)
        
        return True, "任务更新成功"
    
    def delete_task(self, task_id: str) -> Tuple[bool, str]:
        """删除任务"""
        if task_id not in self.tasks:
            return False, f"任务 ID '{task_id}' 不存在"
        
        task_name = self.tasks[task_id].name
        del self.tasks[task_id]
        
        return True, f"任务 '{task_name}' 已删除"
    
    def get_task(self, task_id: str) -> Optional[FlexibleTask]:
        """获取指定任务"""
        return self.tasks.get(task_id)
    
    def get_all_tasks(self, include_disabled: bool = True) -> List[FlexibleTask]:
        """
        获取所有任务
        
        Args:
            include_disabled: 是否包含已禁用的任务
        """
        tasks = list(self.tasks.values())
        
        if not include_disabled:
            tasks = [t for t in tasks if t.is_enabled]
        
        return tasks
    
    def get_enabled_tasks(self) -> List[FlexibleTask]:
        """获取所有启用的任务"""
        return [t for t in self.tasks.values() if t.is_enabled]
    
    def toggle_task(self, task_id: str) -> Tuple[bool, str]:
        """切换任务启用/禁用状态"""
        if task_id not in self.tasks:
            return False, f"任务 ID '{task_id}' 不存在"
        
        task = self.tasks[task_id]
        task.is_enabled = not task.is_enabled
        
        status = "已启用" if task.is_enabled else "已禁用"
        return True, f"任务 '{task.name}' {status}"
    
    def clear_optimization_results(self):
        """清除所有任务的优化结果"""
        for task in self.tasks.values():
            task.optimized_start_hour = None
            task.optimized_cost = None
            task.original_cost = None
            task.savings = None
    
    def to_dict(self) -> Dict:
        """转换为字典（用于保存）"""
        return {
            'tasks': [task.to_dict() for task in self.tasks.values()],
            'next_id': self._next_id
        }
    
    def from_dict(self, data: Dict) -> Tuple[bool, str]:
        """从字典加载任务"""
        try:
            self.tasks.clear()
            
            for task_data in data.get('tasks', []):
                task = FlexibleTask.from_dict(task_data)
                self.tasks[task.id] = task
            
            self._next_id = data.get('next_id', len(self.tasks) + 1)
            
            return True, "任务加载成功"
            
        except Exception as e:
            return False, f"加载任务失败: {str(e)}"
    
    def to_json(self) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)
    
    def from_json(self, json_str: str) -> Tuple[bool, str]:
        """从JSON字符串加载任务"""
        try:
            data = json.loads(json_str)
            return self.from_dict(data)
        except Exception as e:
            return False, f"解析JSON失败: {str(e)}"
    
    def get_total_potential_savings(self) -> Dict:
        """
        获取所有启用任务的潜在节省估算
        
        这是一个简化的估算，实际节省需要结合电价配置计算
        """
        enabled_tasks = self.get_enabled_tasks()
        
        total_energy = sum(t.energy_kwh for t in enabled_tasks)
        
        return {
            '启用任务数': len(enabled_tasks),
            '总用电量(kWh)': round(total_energy, 2),
            '任务列表': [t.name for t in enabled_tasks]
        }
