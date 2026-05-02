from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import hashlib
from app.models import AuditLog, Dataset


class AuditService:
    """审计日志服务"""
    
    def __init__(self):
        pass
    
    def create_log(self,
                   db: Session,
                   dataset_id: int,
                   query_type: str,
                   query_parameters: Dict[str, Any],
                   epsilon_used: float,
                   status: str = "success",
                   error_message: str = None,
                   result: Dict[str, Any] = None,
                   client_info: str = None) -> AuditLog:
        """
        创建审计日志记录
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            query_type: 查询类型: 'count', 'sum', 'avg', 'aggregate'
            query_parameters: 查询参数字典
            epsilon_used: 消耗的epsilon
            status: 状态: 'success', 'failed', 'rejected'
            error_message: 错误消息
            result: 查询结果（用于生成哈希）
            client_info: 客户端信息
            
        Returns:
            创建的审计日志记录
        """
        # 序列化查询参数
        query_params_json = json.dumps(query_parameters, ensure_ascii=False, default=str)
        
        # 计算结果哈希
        result_hash = None
        if result:
            result_json = json.dumps(result, ensure_ascii=False, default=str, sort_keys=True)
            result_hash = hashlib.sha256(result_json.encode('utf-8')).hexdigest()
        
        # 创建日志
        audit_log = AuditLog(
            dataset_id=dataset_id,
            query_type=query_type,
            query_parameters=query_params_json,
            epsilon_used=epsilon_used,
            result_hash=result_hash,
            client_info=client_info,
            status=status,
            error_message=error_message
        )
        
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        
        return audit_log
    
    def get_logs(self,
                 db: Session,
                 dataset_id: int = None,
                 status: str = None,
                 query_type: str = None,
                 limit: int = 100,
                 offset: int = 0) -> List[AuditLog]:
        """
        获取审计日志
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID（可选）
            status: 状态筛选（可选）
            query_type: 查询类型筛选（可选）
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            审计日志列表
        """
        query = db.query(AuditLog)
        
        if dataset_id is not None:
            query = query.filter(AuditLog.dataset_id == dataset_id)
        
        if status is not None:
            query = query.filter(AuditLog.status == status)
        
        if query_type is not None:
            query = query.filter(AuditLog.query_type == query_type)
        
        return query.order_by(
            AuditLog.created_at.desc()
        ).offset(offset).limit(limit).all()
    
    def get_log_by_id(self,
                      db: Session,
                      log_id: int) -> Optional[AuditLog]:
        """
        根据ID获取审计日志
        
        Args:
            db: 数据库会话
            log_id: 日志ID
            
        Returns:
            审计日志或None
        """
        return db.query(AuditLog).filter(AuditLog.id == log_id).first()
    
    def update_log_status(self,
                          db: Session,
                          log_id: int,
                          status: str,
                          error_message: str = None,
                          result: Dict[str, Any] = None) -> Optional[AuditLog]:
        """
        更新审计日志状态
        
        Args:
            db: 数据库会话
            log_id: 日志ID
            status: 新状态
            error_message: 错误消息
            result: 查询结果
            
        Returns:
            更新后的审计日志或None
        """
        try:
            audit_log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
            
            if not audit_log:
                return None
            
            # 更新状态
            audit_log.status = status
            if error_message:
                audit_log.error_message = error_message
            
            # 更新结果哈希
            if result:
                result_json = json.dumps(result, ensure_ascii=False, default=str, sort_keys=True)
                audit_log.result_hash = hashlib.sha256(result_json.encode('utf-8')).hexdigest()
            
            db.commit()
            db.refresh(audit_log)
            
            return audit_log
            
        except SQLAlchemyError as e:
            db.rollback()
            raise e
    
    def get_statistics(self,
                        db: Session,
                        dataset_id: int = None,
                        start_time: datetime = None,
                        end_time: datetime = None) -> Dict[str, Any]:
        """
        获取审计统计信息
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID（可选）
            start_time: 开始时间（可选）
            end_time: 结束时间（可选）
            
        Returns:
            统计信息字典
        """
        query = db.query(AuditLog)
        
        if dataset_id is not None:
            query = query.filter(AuditLog.dataset_id == dataset_id)
        
        if start_time:
            query = query.filter(AuditLog.created_at >= start_time)
        
        if end_time:
            query = query.filter(AuditLog.created_at <= end_time)
        
        # 获取所有日志
        logs = query.all()
        
        # 计算统计
        total_count = len(logs)
        success_count = sum(1 for log in logs if log.status == 'success')
        failed_count = sum(1 for log in logs if log.status == 'failed')
        rejected_count = sum(1 for log in logs if log.status == 'rejected')
        
        # 计算总epsilon消耗
        total_epsilon = sum(log.epsilon_used for log in logs)
        
        # 按查询类型统计
        query_type_stats = {}
        for log in logs:
            qt = log.query_type
            if qt not in query_type_stats:
                query_type_stats[qt] = {
                    'count': 0,
                    'total_epsilon': 0
                }
            query_type_stats[qt]['count'] += 1
            query_type_stats[qt]['total_epsilon'] += log.epsilon_used
        
        return {
            'total_queries': total_count,
            'success_count': success_count,
            'failed_count': failed_count,
            'rejected_count': rejected_count,
            'total_epsilon_consumed': total_epsilon,
            'average_epsilon_per_query': total_epsilon / total_count if total_count > 0 else 0,
            'query_type_statistics': query_type_stats
        }
    
    def parse_query_parameters(self, log: AuditLog) -> Dict[str, Any]:
        """
        解析审计日志中的查询参数
        
        Args:
            log: 审计日志对象
            
        Returns:
            解析后的参数字典
        """
        try:
            return json.loads(log.query_parameters)
        except (json.JSONDecodeError, TypeError):
            return {}


audit_service = AuditService()
