import json
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from config import config


class RollbackStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


@dataclass
class RollbackOperation:
    operation: str
    item_type: str
    source_path: str
    target_path: str
    status: str = "pending"
    error_message: Optional[str] = None


class RollbackManager:
    """回滚管理器 - 回滚最近一次归档操作"""
    
    def __init__(self, archive_root: Optional[str] = None):
        self.archive_root = Path(archive_root) if archive_root else Path(config.ARCHIVE_ROOT)
        self.rollback_log_path = self.archive_root / config.ROLLBACK_LOG
        self.manifest_path = self.archive_root / config.MANIFEST_FILE
        
        self.rollback_history: List[Dict[str, Any]] = []
        self.latest_archive: Optional[Dict[str, Any]] = None
    
    def load_rollback_history(self) -> bool:
        """加载回滚历史"""
        if not self.rollback_log_path.exists():
            return False
        
        try:
            with open(self.rollback_log_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    self.rollback_history = data
                else:
                    self.rollback_history = [data]
            
            if self.rollback_history:
                self.latest_archive = self.rollback_history[-1]
            
            return True
        except (json.JSONDecodeError, IOError) as e:
            print(f"加载回滚历史失败: {e}")
            return False
    
    def get_latest_archive_info(self) -> Optional[Dict[str, Any]]:
        """获取最近一次归档的信息"""
        if not self.rollback_history:
            self.load_rollback_history()
        
        if not self.latest_archive:
            return None
        
        operations = self.latest_archive.get('operations', [])
        
        summary = {
            'plan_id': self.latest_archive.get('plan_id'),
            'archive_time': self.latest_archive.get('archive_time'),
            'total_operations': len(operations),
            'by_type': {}
        }
        
        for op in operations:
            op_type = op.get('item_type', 'unknown')
            summary['by_type'][op_type] = summary['by_type'].get(op_type, 0) + 1
        
        return summary
    
    def can_rollback(self) -> Tuple[bool, str]:
        """检查是否可以回滚"""
        if not self.rollback_log_path.exists():
            return False, "未找到回滚日志文件"
        
        if not self.load_rollback_history():
            return False, "无法加载回滚历史"
        
        if not self.latest_archive:
            return False, "没有归档历史记录"
        
        return True, "可以回滚"
    
    def execute_rollback(self, dry_run: bool = False) -> Dict[str, Any]:
        """执行回滚操作"""
        can_rollback, message = self.can_rollback()
        if not can_rollback:
            return {
                'status': RollbackStatus.FAILED.value,
                'message': message,
                'operations': []
            }
        
        operations = self.latest_archive.get('operations', [])
        if not operations:
            return {
                'status': RollbackStatus.COMPLETED.value,
                'message': "没有需要回滚的操作",
                'operations': []
            }
        
        results = {
            'plan_id': self.latest_archive.get('plan_id'),
            'archive_time': self.latest_archive.get('archive_time'),
            'rollback_time': datetime.now().isoformat(),
            'dry_run': dry_run,
            'status': RollbackStatus.PENDING.value,
            'total_operations': len(operations),
            'success_count': 0,
            'failed_count': 0,
            'operations': []
        }
        
        if dry_run:
            results['status'] = RollbackStatus.PENDING.value
            results['message'] = "这是一次试运行，不会实际删除文件"
            for op in operations:
                results['operations'].append({
                    'operation': op.get('operation'),
                    'item_type': op.get('item_type'),
                    'target_path': op.get('target_path'),
                    'status': 'would_delete' if Path(op.get('target_path', '')).exists() else 'not_found',
                    'action': 'delete'
                })
            return results
        
        for op in operations:
            op_result = self._execute_single_rollback(op)
            results['operations'].append(op_result)
            
            if op_result['status'] == 'success':
                results['success_count'] += 1
            else:
                results['failed_count'] += 1
        
        if results['failed_count'] == 0:
            results['status'] = RollbackStatus.COMPLETED.value
            self._remove_from_history()
        elif results['success_count'] > 0:
            results['status'] = RollbackStatus.PARTIAL.value
        else:
            results['status'] = RollbackStatus.FAILED.value
        
        return results
    
    def _execute_single_rollback(self, operation: Dict[str, Any]) -> Dict[str, Any]:
        """执行单个回滚操作"""
        result = {
            'operation': operation.get('operation'),
            'item_type': operation.get('item_type'),
            'source_path': operation.get('source_path'),
            'target_path': operation.get('target_path'),
            'status': 'pending',
            'error_message': None
        }
        
        target_path = Path(operation.get('target_path', ''))
        
        if operation.get('operation') == 'copy':
            if not target_path.exists():
                result['status'] = 'not_found'
                result['error_message'] = f"目标文件不存在: {target_path}"
                return result
            
            try:
                if target_path.is_file():
                    target_path.unlink()
                elif target_path.is_dir():
                    shutil.rmtree(target_path)
                
                result['status'] = 'success'
            except Exception as e:
                result['status'] = 'failed'
                result['error_message'] = str(e)
        
        return result
    
    def _remove_from_history(self):
        """从历史记录中移除已回滚的归档"""
        if not self.rollback_history:
            return
        
        if len(self.rollback_history) > 0:
            self.rollback_history = self.rollback_history[:-1]
        
        try:
            if self.rollback_history:
                with open(self.rollback_log_path, 'w', encoding='utf-8') as f:
                    json.dump(self.rollback_history, f, ensure_ascii=False, indent=2, default=str)
            else:
                if self.rollback_log_path.exists():
                    self.rollback_log_path.unlink()
        except IOError as e:
            print(f"更新回滚历史失败: {e}")
    
    def preview_rollback(self) -> Dict[str, Any]:
        """预览回滚操作"""
        return self.execute_rollback(dry_run=True)
    
    def get_archive_history(self) -> List[Dict[str, Any]]:
        """获取归档历史"""
        if not self.load_rollback_history():
            return []
        
        history = []
        for i, archive in enumerate(reversed(self.rollback_history)):
            operations = archive.get('operations', [])
            by_type = {}
            for op in operations:
                op_type = op.get('item_type', 'unknown')
                by_type[op_type] = by_type.get(op_type, 0) + 1
            
            history.append({
                'index': i,
                'plan_id': archive.get('plan_id'),
                'archive_time': archive.get('archive_time'),
                'total_operations': len(operations),
                'by_type': by_type,
                'is_latest': i == 0
            })
        
        return history
    
    def clean_empty_directories(self):
        """清理空目录"""
        if not self.archive_root.exists():
            return
        
        for root, dirs, files in os.walk(self.archive_root, topdown=False):
            for dir_name in dirs:
                dir_path = Path(root) / dir_name
                try:
                    if not any(dir_path.iterdir()):
                        dir_path.rmdir()
                except (OSError, PermissionError):
                    continue
