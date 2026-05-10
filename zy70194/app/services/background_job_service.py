from datetime import datetime, timedelta
import uuid
from typing import Dict, Any, Optional, List
import json

from app import db
from app.models import (
    BackgroundJob, BackgroundJobStatus,
    Inquiry, Quote
)
from app.services.comparison_service import ComparisonService
from app.services.export_service import ExportService
from app.services.expiry_service import ExpiryService

class BackgroundJobService:
    JOB_TYPE_COMPARE = 'generate_comparison'
    JOB_TYPE_EXPORT = 'export_comparison'
    JOB_TYPE_EXPIRY_CHECK = 'check_expiry'
    JOB_TYPE_BATCH_PROCESS = 'batch_process'
    
    @staticmethod
    def create_job(
        job_type: str,
        operation_by: str,
        inquiry_id: Optional[int] = None,
        quote_id: Optional[int] = None,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3
    ) -> BackgroundJob:
        job = BackgroundJob(
            job_id=str(uuid.uuid4()),
            job_type=job_type,
            inquiry_id=inquiry_id,
            quote_id=quote_id,
            status=BackgroundJobStatus.PENDING,
            params=params or {},
            retry_count=0,
            max_retries=max_retries
        )
        db.session.add(job)
        db.session.commit()
        return job
    
    @staticmethod
    def execute_job(job_id: str) -> Dict[str, Any]:
        job = BackgroundJob.query.filter_by(job_id=job_id).first()
        if not job:
            return {
                'success': False,
                'error': '任务不存在',
                'error_code': 'job_not_found'
            }
        
        if job.status in [BackgroundJobStatus.COMPLETED, BackgroundJobStatus.CANCELLED]:
            return {
                'success': False,
                'error': f'任务已处于 {job.status.value} 状态',
                'error_code': 'invalid_job_status'
            }
        
        try:
            job.status = BackgroundJobStatus.RUNNING
            job.started_at = datetime.utcnow()
            job.retry_count += 1
            db.session.commit()
            
            result = BackgroundJobService._execute_job_logic(job)
            
            job.status = BackgroundJobStatus.COMPLETED
            job.result = result
            job.completed_at = datetime.utcnow()
            db.session.commit()
            
            return {
                'success': True,
                'data': result
            }
        except Exception as e:
            db.session.rollback()
            
            error_msg = str(e)
            
            if job.retry_count < job.max_retries:
                job.status = BackgroundJobStatus.RETRYING
                job.error_message = error_msg
                job.next_retry_at = datetime.utcnow() + timedelta(seconds=60 * job.retry_count)
                db.session.commit()
                
                return {
                    'success': False,
                    'error': f'任务执行失败，将在 {job.retry_count} 分钟后重试: {error_msg}',
                    'error_code': 'job_retry_scheduled',
                    'retry_count': job.retry_count,
                    'next_retry_at': job.next_retry_at.isoformat()
                }
            else:
                job.status = BackgroundJobStatus.FAILED
                job.error_message = error_msg
                job.completed_at = datetime.utcnow()
                db.session.commit()
                
                return {
                    'success': False,
                    'error': f'任务执行失败，已达到最大重试次数: {error_msg}',
                    'error_code': 'job_failed'
                }
    
    @staticmethod
    def _execute_job_logic(job: BackgroundJob) -> Dict[str, Any]:
        if job.job_type == BackgroundJobService.JOB_TYPE_COMPARE:
            return BackgroundJobService._execute_comparison_job(job)
        elif job.job_type == BackgroundJobService.JOB_TYPE_EXPORT:
            return BackgroundJobService._execute_export_job(job)
        elif job.job_type == BackgroundJobService.JOB_TYPE_EXPIRY_CHECK:
            return BackgroundJobService._execute_expiry_job(job)
        else:
            raise ValueError(f'未知的任务类型: {job.job_type}')
    
    @staticmethod
    def _execute_comparison_job(job: BackgroundJob) -> Dict[str, Any]:
        if not job.inquiry_id:
            raise ValueError('比价任务需要指定询价单ID')
        
        result = ComparisonService.generate_comparison(
            inquiry_id=job.inquiry_id,
            operation_by=job.params.get('operation_by', 'system')
        )
        
        if not result['success']:
            raise Exception(result.get('error', '比价生成失败'))
        
        return {
            'comparison_id': result['data']['id'],
            'comparison_no': result['data']['comparison_no'],
            'inquiry_id': job.inquiry_id
        }
    
    @staticmethod
    def _execute_export_job(job: BackgroundJob) -> Dict[str, Any]:
        if not job.inquiry_id:
            raise ValueError('导出任务需要指定询价单ID')
        
        result = ExportService.export_comparison_to_excel(
            inquiry_id=job.inquiry_id,
            export_type=job.params.get('export_type', 'all')
        )
        
        if not result['success']:
            raise Exception(result.get('error', '导出失败'))
        
        return {
            'file_path': result['data']['file_path'],
            'inquiry_id': job.inquiry_id
        }
    
    @staticmethod
    def _execute_expiry_job(job: BackgroundJob) -> Dict[str, Any]:
        result = ExpiryService.check_all_expiry()
        
        return {
            'checked_inquiries': result['data']['inquiries_checked'],
            'expired_inquiries': result['data']['expired_inquiries'],
            'checked_quotes': result['data']['quotes_checked'],
            'expired_quotes': result['data']['expired_quotes']
        }
    
    @staticmethod
    def retry_job(job_id: str) -> Dict[str, Any]:
        job = BackgroundJob.query.filter_by(job_id=job_id).first()
        if not job:
            return {
                'success': False,
                'error': '任务不存在',
                'error_code': 'job_not_found'
            }
        
        if job.status != BackgroundJobStatus.FAILED:
            return {
                'success': False,
                'error': f'只有失败的任务才能重试，当前状态: {job.status.value}',
                'error_code': 'invalid_job_status'
            }
        
        job.status = BackgroundJobStatus.PENDING
        job.retry_count = 0
        job.next_retry_at = None
        db.session.commit()
        
        return BackgroundJobService.execute_job(job_id)
    
    @staticmethod
    def get_job(job_id: str) -> Dict[str, Any]:
        job = BackgroundJob.query.filter_by(job_id=job_id).first()
        if not job:
            return {
                'success': False,
                'error': '任务不存在',
                'error_code': 'job_not_found'
            }
        
        return {
            'success': True,
            'data': job.to_dict()
        }
    
    @staticmethod
    def list_jobs(
        job_type: str = None,
        status: str = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict[str, Any]:
        query = BackgroundJob.query
        
        if job_type:
            query = query.filter_by(job_type=job_type)
        if status:
            try:
                query = query.filter_by(status=BackgroundJobStatus(status))
            except ValueError:
                pass
        
        query = query.order_by(BackgroundJob.created_at.desc())
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'success': True,
            'data': {
                'items': [job.to_dict() for job in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        }
    
    @staticmethod
    def get_failed_jobs(page: int = 1, per_page: int = 20) -> Dict[str, Any]:
        query = BackgroundJob.query.filter_by(
            status=BackgroundJobStatus.FAILED
        ).order_by(BackgroundJob.completed_at.desc())
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'success': True,
            'data': {
                'items': [job.to_dict() for job in pagination.items],
                'total': pagination.total,
                'page': page,
                'per_page': per_page,
                'pages': pagination.pages
            }
        }
    
    @staticmethod
    def get_pending_jobs() -> List[BackgroundJob]:
        return BackgroundJob.query.filter(
            BackgroundJob.status.in_([BackgroundJobStatus.PENDING, BackgroundJobStatus.RETRYING])
        ).order_by(BackgroundJob.created_at.asc()).all()
