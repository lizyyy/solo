import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .config import ApprovalConfig, ExportTask, StrategyConfig


class Storage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.strategies_dir = self.base_dir / 'strategies'
        self.approvals_dir = self.base_dir / 'approvals'
        self.tasks_dir = self.base_dir / 'tasks'
        self.exports_dir = self.base_dir / 'exports'
        self.audit_dir = self.base_dir / 'audit'
        
        for directory in [self.strategies_dir, self.approvals_dir, self.tasks_dir, self.exports_dir, self.audit_dir]:
            directory.mkdir(parents=True, exist_ok=True)

    def generate_task_id(self, tenant_id: str, data_type: str, start_date: str, end_date: str) -> str:
        task_hash = hashlib.sha256(
            f"{tenant_id}:{data_type}:{start_date}:{end_date}".encode()
        ).hexdigest()[:16]
        return f"task_{task_hash}"

    def save_strategy(self, strategy: StrategyConfig) -> str:
        file_name = f"{strategy.tenant_id}_{strategy.data_type}_{strategy.version}.json"
        file_path = self.strategies_dir / file_name
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(strategy.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        return str(file_path)

    def load_strategy(self, tenant_id: str, data_type: str, version: Optional[str] = None) -> Optional[StrategyConfig]:
        if version:
            file_name = f"{tenant_id}_{data_type}_{version}.json"
            file_path = self.strategies_dir / file_name
            if file_path.exists():
                return self._load_strategy_file(file_path)
            return None
        
        pattern = f"{tenant_id}_{data_type}_*.json"
        files = list(self.strategies_dir.glob(pattern))
        if not files:
            return None
        
        latest = max(files, key=lambda f: f.stat().st_mtime)
        return self._load_strategy_file(latest)

    def _load_strategy_file(self, file_path: Path) -> StrategyConfig:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return StrategyConfig.model_validate(data)

    def list_strategies(self, tenant_id: Optional[str] = None, data_type: Optional[str] = None) -> List[str]:
        patterns = []
        if tenant_id and data_type:
            patterns.append(f"{tenant_id}_{data_type}_*.json")
        elif tenant_id:
            patterns.append(f"{tenant_id}_*.json")
        elif data_type:
            patterns.append(f"*_{data_type}_*.json")
        else:
            patterns.append("*.json")
        
        files = []
        for pattern in patterns:
            files.extend(self.strategies_dir.glob(pattern))
        
        return [str(f) for f in files]

    def save_approval(self, approval: ApprovalConfig) -> str:
        file_name = f"{approval.approval_id}.json"
        file_path = self.approvals_dir / file_name
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(approval.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        return str(file_path)

    def load_approval(self, approval_id: str) -> Optional[ApprovalConfig]:
        file_path = self.approvals_dir / f"{approval_id}.json"
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return ApprovalConfig.model_validate(data)

    def check_duplicate_task(self, task_id: str) -> bool:
        file_path = self.tasks_dir / f"{task_id}.json"
        return file_path.exists()

    def save_task(self, task: ExportTask) -> str:
        file_name = f"{task.task_id}.json"
        file_path = self.tasks_dir / file_name
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(task.model_dump(mode='json'), f, ensure_ascii=False, indent=2)
        
        return str(file_path)

    def load_task(self, task_id: str) -> Optional[ExportTask]:
        file_path = self.tasks_dir / f"{task_id}.json"
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return ExportTask.model_validate(data)

    def list_tasks(self, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        tasks = []
        for file_path in self.tasks_dir.glob("*.json"):
            with open(file_path, 'r', encoding='utf-8') as f:
                task_data = json.load(f)
            
            if tenant_id and task_data.get('tenant_id') != tenant_id:
                continue
            
            tasks.append(task_data)
        
        tasks.sort(key=lambda t: t.get('created_at', ''), reverse=True)
        return tasks

    def get_last_task_for_tenant(self, tenant_id: str, data_type: str) -> Optional[ExportTask]:
        tasks = self.list_tasks(tenant_id)
        for task_data in tasks:
            if task_data.get('data_type') == data_type and task_data.get('status') == 'completed':
                return ExportTask.model_validate(task_data)
        return None

    def save_audit_report(self, task_id: str, report: Dict[str, Any]) -> str:
        file_name = f"{task_id}_audit.json"
        file_path = self.audit_dir / file_name
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        return str(file_path)

    def load_audit_report(self, task_id: str) -> Optional[Dict[str, Any]]:
        file_path = self.audit_dir / f"{task_id}_audit.json"
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
