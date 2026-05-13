"""历史记录管理器"""
import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import DisablePlan, OwnerMark


class HistoryManager:
    """历史记录管理器"""
    
    def __init__(self, history_file: str):
        self.history_file = Path(history_file)
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """确保历史文件存在"""
        self.history_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.history_file.exists():
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'owner_marks': [],
                    'disable_plans': [],
                }, f, ensure_ascii=False, indent=2)
    
    def _load(self) -> Dict[str, Any]:
        """加载历史数据"""
        with open(self.history_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save(self, data: Dict[str, Any]):
        """保存历史数据"""
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=self._serialize)
    
    def _serialize(self, obj: Any) -> Any:
        """序列化对象"""
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if hasattr(obj, 'dict'):
            return obj.dict()
        raise TypeError(f"无法序列化类型: {type(obj)}")
    
    def _parse_datetime(self, value: str) -> datetime:
        """解析日期时间"""
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.strptime(value, '%Y-%m-%dT%H:%M:%S')
    
    def _parse_date(self, value: str) -> date:
        """解析日期"""
        try:
            return date.fromisoformat(value)
        except ValueError:
            return datetime.strptime(value, '%Y-%m-%d').date()
    
    # OwnerMark 相关方法
    def add_owner_mark(self, mark: OwnerMark):
        """添加认领记录"""
        data = self._load()
        data['owner_marks'].append(mark.dict())
        self._save(data)
    
    def get_owner_marks(self, account_id: Optional[str] = None) -> List[OwnerMark]:
        """获取认领记录"""
        data = self._load()
        marks = []
        for item in data.get('owner_marks', []):
            if account_id and item.get('account_id') != account_id:
                continue
            
            mark_data = {
                'account_id': item['account_id'],
                'marked_by': item['marked_by'],
                'marked_at': self._parse_datetime(item['marked_at']),
                'reason': item['reason'],
            }
            if 'owner_employee_id' in item:
                mark_data['owner_employee_id'] = item['owner_employee_id']
            if 'is_exemption' in item:
                mark_data['is_exemption'] = item['is_exemption']
            if 'exemption_expiry' in item and item['exemption_expiry']:
                mark_data['exemption_expiry'] = self._parse_date(item['exemption_expiry'])
            
            marks.append(OwnerMark(**mark_data))
        
        return marks
    
    # DisablePlan 相关方法
    def add_disable_plan(self, plan: DisablePlan):
        """添加禁用计划"""
        data = self._load()
        data['disable_plans'].append(plan.dict())
        self._save(data)
    
    def get_disable_plans(self, account_id: Optional[str] = None, status: Optional[str] = None) -> List[DisablePlan]:
        """获取禁用计划"""
        data = self._load()
        plans = []
        for item in data.get('disable_plans', []):
            if account_id and item.get('account_id') != account_id:
                continue
            if status and item.get('status') != status:
                continue
            
            plan_data = {
                'account_id': item['account_id'],
                'planned_date': self._parse_date(item['planned_date']),
                'created_by': item['created_by'],
                'created_at': self._parse_datetime(item['created_at']),
                'reason': item['reason'],
                'status': item.get('status', 'pending'),
            }
            if 'risk_assessment' in item and item['risk_assessment']:
                plan_data['risk_assessment'] = item['risk_assessment']
            
            plans.append(DisablePlan(**plan_data))
        
        return plans
    
    def update_plan_status(self, plan_index: int, new_status: str):
        """更新禁用计划状态"""
        data = self._load()
        if 0 <= plan_index < len(data.get('disable_plans', [])):
            data['disable_plans'][plan_index]['status'] = new_status
            data['disable_plans'][plan_index]['updated_at'] = datetime.now().isoformat()
            self._save(data)
