import json
from datetime import datetime
from celery_app import celery
from app import db
from app.models import Interview, InterviewVersion, InterviewSummary, AuditLog
from app.services import AnonymizationService, SummaryService

@celery.task(bind=True)
def process_interview_anonymization(self, interview_id: int):
    """
    异步处理访谈脱敏任务
    """
    try:
        # 获取访谈数据
        interview = Interview.query.get(interview_id)
        if not interview:
            return {
                'status': 'failed',
                'error': f'Interview with id {interview_id} not found'
            }
        
        # 更新状态为处理中
        interview.status = 'processing'
        db.session.commit()
        
        # 初始化服务
        anonymization_service = AnonymizationService()
        summary_service = SummaryService()
        
        # 1. 执行脱敏处理
        original_content = interview.original_content
        
        # 尝试识别敏感信息
        sensitive_info = anonymization_service.identify_sensitive_info(original_content)
        
        # 执行脱敏
        anonymized_content, replacement_map = anonymization_service.anonymize_text(
            original_content, sensitive_info
        )
        
        # 2. 保存当前版本（用于回滚）
        # 首先检查是否已有版本，如果有则递增版本号
        latest_version = InterviewVersion.query.filter_by(
            interview_id=interview_id
        ).order_by(InterviewVersion.version_number.desc()).first()
        
        next_version = 1 if not latest_version else latest_version.version_number + 1
        
        # 保存原始内容作为第一个版本
        if next_version == 1:
            original_version = InterviewVersion(
                interview_id=interview_id,
                version_number=1,
                content=original_content
            )
            db.session.add(original_version)
            next_version = 2
        
        # 保存脱敏后的内容作为新版本
        anonymized_version = InterviewVersion(
            interview_id=interview_id,
            version_number=next_version,
            content=anonymized_content
        )
        db.session.add(anonymized_version)
        
        # 3. 生成摘要
        summary_data = summary_service.generate_searchable_summary(anonymized_content)
        
        # 检查是否已有摘要
        existing_summary = InterviewSummary.query.filter_by(interview_id=interview_id).first()
        
        if existing_summary:
            existing_summary.summary_content = summary_data['summary_content']
            existing_summary.keywords = json.dumps(summary_data['keywords'], ensure_ascii=False)
        else:
            new_summary = InterviewSummary(
                interview_id=interview_id,
                summary_content=summary_data['summary_content'],
                keywords=json.dumps(summary_data['keywords'], ensure_ascii=False)
            )
            db.session.add(new_summary)
        
        # 4. 更新访谈记录
        interview.anonymized_content = anonymized_content
        interview.status = 'completed'
        interview.updated_at = datetime.utcnow()
        
        # 5. 记录审计日志
        audit_log = AuditLog(
            interview_id=interview_id,
            action='anonymize',
            user='system',  # 可以后续扩展为当前用户
            description=f'自动脱敏处理完成，替换了 {sum(len(v) for v in replacement_map.values())} 个敏感信息',
            created_at=datetime.utcnow()
        )
        db.session.add(audit_log)
        
        # 提交所有更改
        db.session.commit()
        
        return {
            'status': 'success',
            'interview_id': interview_id,
            'replacement_count': sum(len(v) for v in replacement_map.values()),
            'replacement_map': replacement_map,
            'version_number': next_version
        }
        
    except Exception as e:
        # 发生错误时回滚
        db.session.rollback()
        
        # 更新访谈状态为失败
        if interview:
            interview.status = 'failed'
            db.session.commit()
        
        # 记录错误审计日志
        try:
            error_log = AuditLog(
                interview_id=interview_id if 'interview_id' in locals() else None,
                action='anonymize_error',
                user='system',
                description=f'脱敏处理失败: {str(e)}',
                created_at=datetime.utcnow()
            )
            db.session.add(error_log)
            db.session.commit()
        except:
            pass
        
        return {
            'status': 'failed',
            'error': str(e)
        }

@celery.task(bind=True)
def batch_process_interviews(self, interview_ids: list):
    """
    批量处理多个访谈的脱敏任务
    """
    results = []
    
    for interview_id in interview_ids:
        try:
            result = process_interview_anonymization(interview_id)
            results.append(result)
        except Exception as e:
            results.append({
                'interview_id': interview_id,
                'status': 'failed',
                'error': str(e)
            })
    
    return results
