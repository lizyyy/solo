"""
豁免管理模块

管理人工豁免，支持添加豁免和过期检查。
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from .risk_analyzer import Risk, RiskType, RiskLevel


@dataclass
class Waiver:
    """豁免记录"""
    risk_hash: str
    risk_type: RiskType
    script_version: str
    reason: str
    approved_by: str
    created_at: str
    expires_at: str
    is_active: bool = True
    
    def to_dict(self) -> Dict:
        return {
            'risk_hash': self.risk_hash,
            'risk_type': self.risk_type.value if hasattr(self.risk_type, 'value') else self.risk_type,
            'script_version': self.script_version,
            'reason': self.reason,
            'approved_by': self.approved_by,
            'created_at': self.created_at,
            'expires_at': self.expires_at,
            'is_active': self.is_active
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Waiver':
        return cls(
            risk_hash=data['risk_hash'],
            risk_type=RiskType(data['risk_type']) if isinstance(data['risk_type'], str) else data['risk_type'],
            script_version=data['script_version'],
            reason=data['reason'],
            approved_by=data['approved_by'],
            created_at=data['created_at'],
            expires_at=data['expires_at'],
            is_active=data.get('is_active', True)
        )
    
    def is_expired(self) -> bool:
        """检查是否已过期"""
        try:
            expires_at = datetime.fromisoformat(self.expires_at)
            return datetime.now() > expires_at
        except (ValueError, TypeError):
            return False


class WaiverManager:
    """豁免管理器"""
    
    def __init__(self, waiver_file: str = None):
        self.waiver_file = waiver_file or os.path.join(os.getcwd(), '.migration_waivers.json')
        self.waivers: Dict[str, Waiver] = {}
        self._load_waivers()
    
    def _load_waivers(self) -> None:
        """加载豁免记录"""
        if not os.path.exists(self.waiver_file):
            return
        
        try:
            with open(self.waiver_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            for waiver_data in data.get('waivers', []):
                waiver = Waiver.from_dict(waiver_data)
                # 检查是否过期，如果过期则标记为非活跃
                if waiver.is_expired():
                    waiver.is_active = False
                self.waivers[waiver.risk_hash] = waiver
                
            # 保存更新后的状态
            self._save_waivers()
        except (json.JSONDecodeError, IOError) as e:
            print(f"警告: 无法加载豁免文件 {self.waiver_file}: {e}")
    
    def _save_waivers(self) -> None:
        """保存豁免记录"""
        data = {
            'version': '1.0',
            'updated_at': datetime.now().isoformat(),
            'waivers': [w.to_dict() for w in self.waivers.values()]
        }
        
        try:
            dir_path = os.path.dirname(self.waiver_file)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            with open(self.waiver_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except IOError as e:
            print(f"错误: 无法保存豁免文件 {self.waiver_file}: {e}")
    
    def add_waiver(
        self, 
        risk: Risk, 
        reason: str, 
        approved_by: str, 
        days_valid: int = 7
    ) -> Waiver:
        """添加豁免"""
        now = datetime.now()
        expires_at = now + timedelta(days=days_valid)
        
        waiver = Waiver(
            risk_hash=risk.hash,
            risk_type=risk.risk_type,
            script_version=risk.script_version,
            reason=reason,
            approved_by=approved_by,
            created_at=now.isoformat(),
            expires_at=expires_at.isoformat(),
            is_active=True
        )
        
        self.waivers[risk.hash] = waiver
        self._save_waivers()
        return waiver
    
    def get_waiver(self, risk_hash: str) -> Optional[Waiver]:
        """获取豁免"""
        return self.waivers.get(risk_hash)
    
    def is_waived(self, risk: Risk) -> bool:
        """检查风险是否被豁免"""
        waiver = self.waivers.get(risk.hash)
        if not waiver:
            return False
        
        # 如果豁免已过期，返回 False 并提示
        if waiver.is_expired():
            return False
        
        return waiver.is_active
    
    def get_expired_waivers(self) -> List[Waiver]:
        """获取已过期的豁免"""
        return [w for w in self.waivers.values() if w.is_expired()]
    
    def remove_waiver(self, risk_hash: str) -> bool:
        """移除豁免"""
        if risk_hash in self.waivers:
            del self.waivers[risk_hash]
            self._save_waivers()
            return True
        return False
    
    def filter_risks(self, risks: List[Risk]) -> Dict[str, List[Risk]]:
        """过滤风险，返回豁免和未豁免的"""
        waived = []
        expired = []
        not_waived = []
        
        for risk in risks:
            waiver = self.waivers.get(risk.hash)
            if waiver:
                if waiver.is_expired():
                    expired.append(risk)
                else:
                    waived.append(risk)
            else:
                not_waived.append(risk)
        
        return {
            'waived': waived,
            'expired': expired,
            'not_waived': not_waived
        }
    
    def get_all_waivers(self) -> List[Waiver]:
        """获取所有豁免"""
        return list(self.waivers.values())
