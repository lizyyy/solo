"""
存储模块
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from contract_inspector.config import DEFAULT_TASKS_DIR


class TaskStorage:
    """任务存储管理器"""
    
    def __init__(self, storage_dir: Path = None):
        self.storage_dir = storage_dir or DEFAULT_TASKS_DIR
        self.storage_dir.mkdir(parents=True, exist_ok=True)
    
    def save_task(self, **kwargs) -> Dict[str, Any]:
        """
        保存巡检任务
        
        Args:
            **kwargs: 任务数据，包括：
                - client: 客户名称
                - contract_name: 合同名称
                - old_file: 旧版文件路径
                - new_file: 新版文件路径
                - old_content: 旧版内容
                - new_content: 新版内容
                - old_doc: 旧版解析结果
                - new_doc: 新版解析结果
                - diff_result: 差异结果
                - risk_results: 风险扫描结果
                
        Returns:
            保存的任务数据字典
        """
        task_id = str(uuid.uuid4())[:8]
        created_at = datetime.now().isoformat()
        
        task = {
            'id': task_id,
            'created_at': created_at,
            'client': kwargs.get('client', ''),
            'contract_name': kwargs.get('contract_name', ''),
            'old_file': kwargs.get('old_file', ''),
            'new_file': kwargs.get('new_file', ''),
            'old_content': kwargs.get('old_content', ''),
            'new_content': kwargs.get('new_content', ''),
            'old_doc': kwargs.get('old_doc', {}),
            'new_doc': kwargs.get('new_doc', {}),
            'diff_result': kwargs.get('diff_result', {}),
            'risk_results': kwargs.get('risk_results', {})
        }
        
        task_file = self.storage_dir / f"{task_id}.json"
        task_file.write_text(json.dumps(task, ensure_ascii=False, indent=2), encoding='utf-8')
        
        return task
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        获取任务详情
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务数据字典，不存在则返回None
        """
        task_file = self.storage_dir / f"{task_id}.json"
        
        if not task_file.exists():
            return None
        
        content = task_file.read_text(encoding='utf-8')
        return json.loads(content)
    
    def list_tasks(self, client: str = None, contract_name: str = None, 
                   limit: int = 20) -> List[Dict[str, Any]]:
        """
        列出任务
        
        Args:
            client: 按客户名称筛选
            contract_name: 按合同名称筛选
            limit: 返回数量限制
            
        Returns:
            任务列表（按创建时间倒序）
        """
        tasks = []
        
        for task_file in self.storage_dir.glob('*.json'):
            try:
                content = task_file.read_text(encoding='utf-8')
                task = json.loads(content)
                
                if client and client not in task.get('client', ''):
                    continue
                if contract_name and contract_name not in task.get('contract_name', ''):
                    continue
                
                tasks.append({
                    'id': task.get('id'),
                    'created_at': task.get('created_at'),
                    'client': task.get('client', ''),
                    'contract_name': task.get('contract_name', '')
                })
            except (json.JSONDecodeError, KeyError):
                continue
        
        tasks.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return tasks[:limit]
    
    def delete_task(self, task_id: str) -> bool:
        """
        删除任务
        
        Args:
            task_id: 任务ID
            
        Returns:
            是否成功删除
        """
        task_file = self.storage_dir / f"{task_id}.json"
        
        if task_file.exists():
            task_file.unlink()
            return True
        
        return False
