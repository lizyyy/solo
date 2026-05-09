import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from alert_reducer.models import Alert, FailureLog


class AlertImporter:
    """告警导入器"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def _parse_datetime(self, dt_str: str) -> datetime:
        """解析时间字符串"""
        if not dt_str:
            return None
        
        # 尝试多种时间格式
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f"
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        # 最后尝试dateutil
        try:
            from dateutil import parser
            return parser.parse(dt_str)
        except:
            raise ValueError(f"无法解析时间: {dt_str}")
    
    def _generate_alert_id(self, alert_data: Dict[str, Any]) -> str:
        """生成唯一的告警ID"""
        # 使用关键信息生成哈希
        key_parts = [
            alert_data.get('alertname', ''),
            alert_data.get('severity', ''),
            alert_data.get('job', ''),
            alert_data.get('instance', ''),
            alert_data.get('startsAt', '')
        ]
        key = "|".join(key_parts)
        return str(uuid.uuid5(uuid.NAMESPACE_OID, key))
    
    def _extract_alert_data(self, raw_alert: Dict[str, Any]) -> Dict[str, Any]:
        """从原始告警数据中提取标准化信息"""
        # 支持Prometheus格式和自定义格式
        labels = raw_alert.get('labels', {}) or {}
        annotations = raw_alert.get('annotations', {}) or {}
        
        alert_data = {
            'alertname': labels.get('alertname', raw_alert.get('alertname', 'Unknown')),
            'severity': labels.get('severity', raw_alert.get('severity', 'P3')),
            'job': labels.get('job', raw_alert.get('job', '')),
            'instance': labels.get('instance', raw_alert.get('instance', '')),
            'summary': annotations.get('summary', raw_alert.get('summary', '')),
            'description': annotations.get('description', raw_alert.get('description', '')),
            'labels_json': json.dumps(labels, ensure_ascii=False),
            'starts_at': self._parse_datetime(raw_alert.get('startsAt') or raw_alert.get('starts_at')),
            'ends_at': self._parse_datetime(raw_alert.get('endsAt') or raw_alert.get('ends_at'))
        }
        
        # 生成唯一ID
        alert_data['alert_id'] = self._generate_alert_id(alert_data)
        
        return alert_data
    
    def _log_failure(self, operation: str, error_message: str, 
                     error_type: str = None, stack_trace: str = None,
                     context: Dict = None, alert_id: int = None):
        """记录失败日志"""
        try:
            # 先回滚之前的事务
            try:
                self.session.rollback()
            except:
                pass
            
            failure = FailureLog(
                operation=operation,
                error_type=error_type or type(Exception).__name__,
                error_message=str(error_message),
                stack_trace=stack_trace,
                context_json=json.dumps(context, ensure_ascii=False) if context else None,
                alert_id=alert_id
            )
            self.session.add(failure)
            self.session.commit()
        except Exception as e:
            print(f"记录失败日志失败: {e}")
    
    def import_alert(self, raw_alert: Dict[str, Any], batch_id: int = None) -> Optional[Alert]:
        """导入单个告警"""
        try:
            alert_data = self._extract_alert_data(raw_alert)
            
            # 检查是否已存在
            existing = self.session.query(Alert).filter(
                Alert.alert_id == alert_data['alert_id']
            ).first()
            
            if existing:
                # 更新现有告警
                existing.status = alert_data.get('status', existing.status)
                existing.ends_at = alert_data['ends_at'] or existing.ends_at
                existing.updated_at = datetime.utcnow()
                self.session.commit()
                return existing
            
            # 创建新告警
            alert = Alert(
                alert_id=alert_data['alert_id'],
                alertname=alert_data['alertname'],
                severity=alert_data['severity'],
                job=alert_data['job'],
                instance=alert_data['instance'],
                summary=alert_data['summary'],
                description=alert_data['description'],
                labels_json=alert_data['labels_json'],
                starts_at=alert_data['starts_at'],
                ends_at=alert_data['ends_at'],
                batch_id=batch_id
            )
            
            self.session.add(alert)
            self.session.commit()
            return alert
            
        except Exception as e:
            import traceback
            self._log_failure(
                operation='import',
                error_message=str(e),
                error_type=type(e).__name__,
                stack_trace=traceback.format_exc(),
                context={'raw_alert': raw_alert}
            )
            self.session.rollback()
            return None
    
    def import_alerts(self, raw_alerts: List[Dict[str, Any]], batch_id: int = None) -> Dict[str, Any]:
        """批量导入告警"""
        results = {
            'success': 0,
            'failed': 0,
            'updated': 0,
            'failed_items': []
        }
        
        for i, raw_alert in enumerate(raw_alerts):
            try:
                alert = self.import_alert(raw_alert, batch_id)
                if alert:
                    # 检查是新创建还是更新
                    if alert.created_at == alert.updated_at:
                        results['success'] += 1
                    else:
                        results['updated'] += 1
                else:
                    results['failed'] += 1
                    results['failed_items'].append({'index': i, 'error': '导入失败'})
            except Exception as e:
                results['failed'] += 1
                results['failed_items'].append({'index': i, 'error': str(e)})
        
        return results
    
    def import_from_file(self, file_path: str, batch_id: int = None) -> Dict[str, Any]:
        """从文件导入告警"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self._log_failure(
                    operation='import_file',
                    error_message=f"JSON解析失败: {e}",
                    error_type='JSONDecodeError',
                    context={'file_path': file_path}
                )
                raise
        
        # 支持单个告警或告警列表
        if isinstance(data, dict):
            # 检查是否是Prometheus格式
            if 'alerts' in data:
                raw_alerts = data['alerts']
            else:
                raw_alerts = [data]
        elif isinstance(data, list):
            raw_alerts = data
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")
        
        return self.import_alerts(raw_alerts, batch_id)
    
    def import_from_directory(self, dir_path: str, batch_id: int = None) -> Dict[str, Any]:
        """从目录批量导入"""
        if not os.path.isdir(dir_path):
            raise NotADirectoryError(f"目录不存在: {dir_path}")
        
        all_results = {
            'success': 0,
            'failed': 0,
            'updated': 0,
            'files': {}
        }
        
        for filename in os.listdir(dir_path):
            if filename.endswith('.json'):
                file_path = os.path.join(dir_path, filename)
                try:
                    result = self.import_from_file(file_path, batch_id)
                    all_results['success'] += result['success']
                    all_results['failed'] += result['failed']
                    all_results['updated'] += result['updated']
                    all_results['files'][filename] = result
                except Exception as e:
                    all_results['failed'] += 1
                    all_results['files'][filename] = {'error': str(e)}
        
        return all_results
