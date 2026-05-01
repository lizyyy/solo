"""
规则管理模块
负责加载门店规则JSON和巡检清单CSV
"""
import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from .config import StoreRule, InspectionItem


class RuleManager:
    """规则管理器"""
    
    def __init__(self):
        self.store_rules: Dict[str, StoreRule] = {}
        self.inspection_items: List[InspectionItem] = []
        self.inspection_items_by_store: Dict[str, List[InspectionItem]] = {}
    
    def load_store_rules(self, rules_file: str) -> List[StoreRule]:
        """从JSON文件加载门店规则"""
        rules_path = Path(rules_file)
        if not rules_path.exists():
            raise ValueError(f"门店规则文件不存在: {rules_file}")
        
        with open(rules_path, 'r', encoding='utf-8') as f:
            rules_data = json.load(f)
        
        # 支持两种格式：直接是列表，或者包含 stores 字段
        stores_data = rules_data.get('stores', rules_data) if isinstance(rules_data, dict) else rules_data
        
        for store_data in stores_data:
            store_rule = StoreRule(
                store_code=store_data.get('store_code', '').upper(),
                store_name=store_data.get('store_name', ''),
                checkpoints=store_data.get('checkpoints', []),
                time_window=store_data.get('time_window', {
                    'start': '09:00',
                    'end': '21:00'
                }),
                photo_patterns=store_data.get('photo_patterns', []),
                checkpoint_patterns=store_data.get('checkpoint_patterns', {}),
            )
            self.store_rules[store_rule.store_code] = store_rule
        
        return list(self.store_rules.values())
    
    def load_inspection_list(self, csv_file: str) -> List[InspectionItem]:
        """从CSV文件加载巡检清单"""
        csv_path = Path(csv_file)
        if not csv_path.exists():
            raise ValueError(f"巡检清单文件不存在: {csv_file}")
        
        self.inspection_items = []
        self.inspection_items_by_store = {}
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                # 尝试不同的列名
                store_code = row.get('门店编码', row.get('store_code', row.get('store', ''))).strip().upper()
                checkpoint = row.get('点位', row.get('checkpoint', row.get('location', ''))).strip()
                required = row.get('是否必填', row.get('required', '是')).strip().lower() in ['是', 'yes', 'true', '1']
                deadline = row.get('截止时间', row.get('deadline', '')).strip() or None
                
                if store_code and checkpoint:
                    item = InspectionItem(
                        store_code=store_code,
                        checkpoint=checkpoint,
                        required=required,
                        deadline=deadline,
                    )
                    self.inspection_items.append(item)
                    
                    if store_code not in self.inspection_items_by_store:
                        self.inspection_items_by_store[store_code] = []
                    self.inspection_items_by_store[store_code].append(item)
        
        return self.inspection_items
    
    def get_store_rule(self, store_code: str) -> Optional[StoreRule]:
        """获取指定门店的规则"""
        return self.store_rules.get(store_code.upper())
    
    def get_checkpoints_for_store(self, store_code: str) -> List[str]:
        """获取指定门店的所有巡检点位"""
        rule = self.get_store_rule(store_code)
        if rule:
            return rule.checkpoints
        
        # 如果没有规则，从巡检清单中获取
        items = self.inspection_items_by_store.get(store_code.upper(), [])
        return [item.checkpoint for item in items]
    
    def get_required_checkpoints(self, store_code: str) -> List[str]:
        """获取指定门店的必检点位"""
        items = self.inspection_items_by_store.get(store_code.upper(), [])
        return [item.checkpoint for item in items if item.required]
    
    def is_time_in_window(self, store_code: str, check_time: str) -> bool:
        """检查时间是否在门店的巡检时间窗口内"""
        rule = self.get_store_rule(store_code)
        if not rule:
            # 如果没有规则，默认所有时间都有效
            return True
        
        time_window = rule.time_window
        start_time = time_window.get('start', '00:00')
        end_time = time_window.get('end', '23:59')
        
        try:
            # 解析检查时间
            check_dt = self._parse_time(check_time)
            if not check_dt:
                return True
            
            # 解析时间窗口
            start_dt = self._parse_time_str(start_time)
            end_dt = self._parse_time_str(end_time)
            
            # 提取时分进行比较
            check_time_only = check_dt.time()
            start_time_only = start_dt.time()
            end_time_only = end_dt.time()
            
            # 处理跨午夜的情况（如 22:00 - 02:00）
            if start_time_only <= end_time_only:
                return start_time_only <= check_time_only <= end_time_only
            else:
                # 跨午夜：检查时间 >= 开始时间 或 <= 结束时间
                return check_time_only >= start_time_only or check_time_only <= end_time_only
        except Exception:
            return True
    
    def _parse_time(self, time_str: str) -> Optional[datetime]:
        """解析时间字符串"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%H:%M:%S",
            "%H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue
        return None
    
    def _parse_time_str(self, time_str: str) -> datetime:
        """解析仅时间的字符串（如 "09:00"）"""
        try:
            return datetime.strptime(time_str, "%H:%M")
        except ValueError:
            try:
                return datetime.strptime(time_str, "%H:%M:%S")
            except ValueError:
                return datetime.strptime("00:00", "%H:%M")
    
    def get_time_deviation_minutes(self, store_code: str, check_time: str) -> Optional[int]:
        """
        计算时间偏差（分钟）
        返回: 负数表示早于开始时间，正数表示晚于结束时间，0表示在窗口内
        """
        rule = self.get_store_rule(store_code)
        if not rule:
            return None
        
        time_window = rule.time_window
        start_time = time_window.get('start', '00:00')
        end_time = time_window.get('end', '23:59')
        
        try:
            check_dt = self._parse_time(check_time)
            if not check_dt:
                return None
            
            start_dt = self._parse_time_str(start_time)
            end_dt = self._parse_time_str(end_time)
            
            # 提取时分
            check_time_only = check_dt.time()
            start_time_only = start_dt.time()
            end_time_only = end_dt.time()
            
            # 转换为分钟数进行计算
            check_minutes = check_time_only.hour * 60 + check_time_only.minute
            start_minutes = start_time_only.hour * 60 + start_time_only.minute
            end_minutes = end_time_only.hour * 60 + end_time_only.minute
            
            # 处理跨午夜
            if start_minutes <= end_minutes:
                if check_minutes < start_minutes:
                    return check_minutes - start_minutes
                elif check_minutes > end_minutes:
                    return check_minutes - end_minutes
                else:
                    return 0
            else:
                # 跨午夜窗口
                if end_minutes < check_minutes < start_minutes:
                    # 在窗口外
                    if check_minutes - start_minutes < end_minutes + 1440 - check_minutes:
                        return check_minutes - start_minutes
                    else:
                        return check_minutes - end_minutes
                else:
                    return 0
        except Exception:
            return None
    
    def get_all_store_codes(self) -> List[str]:
        """获取所有门店编码"""
        codes = set(self.store_rules.keys())
        codes.update(self.inspection_items_by_store.keys())
        return sorted(codes)
    
    def validate(self) -> List[str]:
        """验证规则和清单的一致性"""
        issues = []
        
        # 检查巡检清单中的门店是否有规则
        for store_code in self.inspection_items_by_store.keys():
            if store_code not in self.store_rules:
                issues.append(f"门店 {store_code} 在巡检清单中但没有规则定义")
        
        # 检查规则中的门店是否在巡检清单中
        for store_code in self.store_rules.keys():
            if store_code not in self.inspection_items_by_store:
                issues.append(f"门店 {store_code} 有规则定义但不在巡检清单中")
        
        return issues
