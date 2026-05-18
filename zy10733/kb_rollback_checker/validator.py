from datetime import datetime
from typing import List
from .models import ArticleRollbackRecord, RollbackStatus, CheckResult


class RollbackValidator:
    def __init__(self, continue_on_error: bool = True):
        self.continue_on_error = continue_on_error
    
    def validate(self, records: List[ArticleRollbackRecord]) -> CheckResult:
        result = CheckResult()
        result.start_time = datetime.now()
        
        for record in records:
            try:
                validated_record = self._validate_single(record)
                result.add_record(validated_record)
            except Exception as e:
                if not self.continue_on_error:
                    raise
                record.status = RollbackStatus.FAILED
                record.error_message = f"校验异常: {str(e)}"
                record.processing_log.append(f"[{datetime.now()}] 校验中断: {str(e)}")
                result.add_record(record)
        
        result.end_time = datetime.now()
        return result
    
    def _validate_single(self, record: ArticleRollbackRecord) -> ArticleRollbackRecord:
        self._check_cache_status(record)
        
        record.processing_log.append(f"[{datetime.now()}] 开始校验文章: {record.article_title} ({record.article_id})")
        
        self._check_version_consistency(record)
        self._check_attachments(record)
        self._check_index_status(record)
        self._determine_final_status(record)
        
        record.processing_log.append(f"[{datetime.now()}] 校验完成，最终状态: {record.status.value}")
        return record
    
    def _check_version_consistency(self, record: ArticleRollbackRecord) -> None:
        if not record.rollback_version or not record.previous_version:
            record.processing_log.append(f"[{datetime.now()}] ⚠ 版本信息不完整")
            return
        
        if record.rollback_version == record.previous_version:
            record.processing_log.append(f"[{datetime.now()}] ✅ 版本回滚正确: {record.previous_version}")
        else:
            record.processing_log.append(f"[{datetime.now()}] ⚠ 版本不一致: 预期 {record.previous_version}, 实际 {record.rollback_version}")
    
    def _check_attachments(self, record: ArticleRollbackRecord) -> None:
        if not record.attachments:
            record.processing_log.append(f"[{datetime.now()}] ℹ 文章无附件")
            return
        
        expected = len(record.attachments)
        actual = len(record.rolled_back_attachments)
        missing = set(record.attachments) - set(record.rolled_back_attachments)
        
        if expected == actual:
            record.processing_log.append(f"[{datetime.now()}] ✅ 所有 {expected} 个附件已回滚")
        else:
            record.status = RollbackStatus.ATTACHMENT_NOT_ROLLED_BACK
            record.error_message = f"附件未完全回滚: 缺失 {len(missing)} 个 ({', '.join(missing)})"
            record.processing_log.append(f"[{datetime.now()}] ❌ 附件回滚不完整: 预期 {expected} 个，实际 {actual} 个")
            record.processing_log.append(f"[{datetime.now()}]    缺失附件: {', '.join(missing)}")
    
    def _check_index_status(self, record: ArticleRollbackRecord) -> None:
        time_diff = (datetime.now() - record.rollback_time).total_seconds()
        
        if time_diff < 300:
            record.status = RollbackStatus.INDEX_DELAY
            record.error_message = f"索引可能存在延迟: 回滚仅完成 {int(time_diff)} 秒，建议 5 分钟后再次核验"
            record.processing_log.append(f"[{datetime.now()}] ⏳ 索引延迟警告: 回滚时间距现在仅 {int(time_diff)} 秒")
    
    def _check_cache_status(self, record: ArticleRollbackRecord) -> None:
        if any("cache_hit" in log.lower() for log in record.processing_log):
            record.status = RollbackStatus.CACHE_HIT
            record.error_message = "检测到缓存命中，回滚内容可能尚未完全生效"
            record.processing_log.append(f"[{datetime.now()}] 💾 缓存命中警告: 内容可能存在延迟")
    
    def _determine_final_status(self, record: ArticleRollbackRecord) -> None:
        if record.status in [RollbackStatus.INDEX_DELAY, RollbackStatus.ATTACHMENT_NOT_ROLLED_BACK, RollbackStatus.CACHE_HIT]:
            return
        
        if record.is_complete:
            record.status = RollbackStatus.SUCCESS
            record.error_message = None
        else:
            record.status = RollbackStatus.PARTIAL_ROLLBACK
            record.error_message = "回滚不完整"
