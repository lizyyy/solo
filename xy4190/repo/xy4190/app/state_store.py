"""状态存储模块 - 本地保存复核结果、配置和审计信息"""

import json
import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import asdict, is_dataclass
from enum import Enum
from collections import defaultdict

from .rules_engine import AnomalySegment, AnomalyType, AnomalySeverity


class EnhancedJSONEncoder(json.JSONEncoder):
    """增强JSON编码器 - 支持更多类型"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if isinstance(obj, Path):
            return str(obj)
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, set):
            return list(obj)
        return super().default(obj)


class StateStore:
    """状态存储管理器"""
    
    def __init__(self, storage_dir: str = None):
        if storage_dir is None:
            self.storage_dir = Path.home() / ".temperature_monitor" / "state"
        else:
            self.storage_dir = Path(storage_dir)
        
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.reviews_dir = self.storage_dir / "reviews"
        self.reviews_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_dir = self.storage_dir / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        self.audit_dir = self.storage_dir / "audit"
        self.audit_dir.mkdir(parents=True, exist_ok=True)
        
        self.session_dir = self.storage_dir / "sessions"
        self.session_dir.mkdir(parents=True, exist_ok=True)
    
    def save_review(
        self,
        anomaly_id: str,
        review_data: Dict[str, Any],
        session_id: str = None
    ) -> str:
        """保存复核记录"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        review_record = {
            'anomaly_id': anomaly_id,
            'review_timestamp': timestamp,
            'review_datetime': datetime.now(),
            'review_reason': review_data.get('review_reason', ''),
            'review_notes': review_data.get('review_notes', ''),
            'reviewed_by': review_data.get('reviewed_by', ''),
            'session_id': session_id,
            'anomaly_snapshot': review_data.get('anomaly_snapshot', {})
        }
        
        filename = f"{anomaly_id}_{timestamp}.json"
        file_path = self.reviews_dir / filename
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(review_record, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        self._append_audit_log('review_save', {
            'anomaly_id': anomaly_id,
            'review_reason': review_data.get('review_reason', ''),
            'file': str(file_path)
        })
        
        return str(file_path)
    
    def get_reviews(self, anomaly_id: str = None) -> List[Dict]:
        """获取复核记录"""
        reviews = []
        
        for file_path in self.reviews_dir.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    review = json.load(f)
                
                if 'review_datetime' in review:
                    review['review_datetime'] = datetime.fromisoformat(review['review_datetime'])
                
                if anomaly_id is None or review.get('anomaly_id') == anomaly_id:
                    reviews.append(review)
            except Exception:
                continue
        
        reviews.sort(key=lambda x: x.get('review_datetime', datetime.min), reverse=True)
        return reviews
    
    def get_latest_review(self, anomaly_id: str) -> Optional[Dict]:
        """获取最新的复核记录"""
        reviews = self.get_reviews(anomaly_id)
        return reviews[0] if reviews else None
    
    def save_config(self, config_name: str, config_data: Dict[str, Any]) -> str:
        """保存配置"""
        filename = f"{config_name}.json"
        file_path = self.config_dir / filename
        
        config_record = {
            'config_name': config_name,
            'saved_at': datetime.now(),
            'config': config_data
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config_record, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        self._append_audit_log('config_save', {
            'config_name': config_name,
            'file': str(file_path)
        })
        
        return str(file_path)
    
    def load_config(self, config_name: str) -> Optional[Dict]:
        """加载配置"""
        filename = f"{config_name}.json"
        file_path = self.config_dir / filename
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                config_record = json.load(f)
            
            if 'saved_at' in config_record:
                config_record['saved_at'] = datetime.fromisoformat(config_record['saved_at'])
            
            return config_record
        except Exception:
            return None
    
    def list_configs(self) -> List[str]:
        """列出所有保存的配置"""
        configs = []
        for file_path in self.config_dir.glob("*.json"):
            configs.append(file_path.stem)
        return configs
    
    def save_session(
        self,
        session_id: str,
        session_data: Dict[str, Any]
    ) -> str:
        """保存会话数据"""
        filename = f"{session_id}.json"
        file_path = self.session_dir / filename
        
        session_record = {
            'session_id': session_id,
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'data': session_data
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(session_record, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        return str(file_path)
    
    def load_session(self, session_id: str) -> Optional[Dict]:
        """加载会话数据"""
        filename = f"{session_id}.json"
        file_path = self.session_dir / filename
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                session_record = json.load(f)
            
            for key in ['created_at', 'updated_at']:
                if key in session_record:
                    session_record[key] = datetime.fromisoformat(session_record[key])
            
            return session_record
        except Exception:
            return None
    
    def update_session(
        self,
        session_id: str,
        updates: Dict[str, Any]
    ) -> Optional[str]:
        """更新会话数据"""
        session = self.load_session(session_id)
        if session is None:
            return None
        
        session_data = session.get('data', {})
        session_data.update(updates)
        session['data'] = session_data
        session['updated_at'] = datetime.now()
        
        return self.save_session(session_id, session_data)
    
    def _append_audit_log(
        self,
        action: str,
        details: Dict[str, Any]
    ):
        """追加审计日志"""
        timestamp = datetime.now().strftime("%Y%m%d")
        log_file = self.audit_dir / f"audit_{timestamp}.log"
        
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'details': details
        }
        
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
    
    def get_audit_logs(
        self,
        start_date: datetime = None,
        end_date: datetime = None,
        action: str = None
    ) -> List[Dict]:
        """获取审计日志"""
        logs = []
        
        if start_date is None:
            start_date = datetime.now() - timedelta(days=7)
        if end_date is None:
            end_date = datetime.now()
        
        current = start_date
        while current <= end_date:
            timestamp = current.strftime("%Y%m%d")
            log_file = self.audit_dir / f"audit_{timestamp}.log"
            
            if log_file.exists():
                with open(log_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            entry = json.loads(line.strip())
                            
                            if action and entry.get('action') != action:
                                continue
                            
                            logs.append(entry)
                        except Exception:
                            continue
            
            current += timedelta(days=1)
        
        return logs
    
    def export_audit_package(
        self,
        output_path: str,
        include_reviews: bool = True,
        include_configs: bool = True,
        include_logs: bool = True
    ) -> str:
        """导出审计包"""
        output = Path(output_path)
        
        package = {
            'export_time': datetime.now(),
            'version': '1.0',
            'contents': {}
        }
        
        if include_reviews:
            reviews = self.get_reviews()
            package['contents']['reviews'] = reviews
            package['contents']['review_count'] = len(reviews)
        
        if include_configs:
            configs = {}
            for config_name in self.list_configs():
                config = self.load_config(config_name)
                if config:
                    configs[config_name] = config
            package['contents']['configs'] = configs
            package['contents']['config_count'] = len(configs)
        
        if include_logs:
            logs = self.get_audit_logs()
            package['contents']['audit_logs'] = logs
            package['contents']['log_count'] = len(logs)
        
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(package, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
        
        self._append_audit_log('audit_export', {
            'output_path': str(output),
            'include_reviews': include_reviews,
            'include_configs': include_configs,
            'include_logs': include_logs
        })
        
        return str(output)
    
    def generate_data_hash(self, data: Any) -> str:
        """生成数据哈希用于验证"""
        json_str = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(json_str.encode('utf-8')).hexdigest()
    
    def clear_old_data(self, days: int = 90):
        """清理旧数据"""
        cutoff = datetime.now() - timedelta(days=days)
        
        for file_path in self.reviews_dir.glob("*.json"):
            try:
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff:
                    file_path.unlink()
            except Exception:
                pass
        
        for file_path in self.session_dir.glob("*.json"):
            try:
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff:
                    file_path.unlink()
            except Exception:
                pass
        
        for file_path in self.audit_dir.glob("audit_*.log"):
            try:
                file_date_str = file_path.stem.replace('audit_', '')
                file_date = datetime.strptime(file_date_str, "%Y%m%d")
                if file_date < cutoff:
                    file_path.unlink()
            except Exception:
                pass
