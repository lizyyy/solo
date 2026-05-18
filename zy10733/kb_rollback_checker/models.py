from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict


class RollbackStatus(Enum):
    SUCCESS = "回滚成功"
    INDEX_DELAY = "索引延迟"
    ATTACHMENT_NOT_ROLLED_BACK = "附件未回滚"
    CACHE_HIT = "缓存命中"
    PARTIAL_ROLLBACK = "部分回滚"
    FAILED = "回滚失败"


@dataclass
class ArticleRollbackRecord:
    article_id: str
    article_title: str
    space_id: str
    space_name: str
    publish_time: datetime
    rollback_time: datetime
    operator: str
    rollback_version: str
    previous_version: str
    status: RollbackStatus
    error_message: Optional[str] = None
    attachments: List[str] = field(default_factory=list)
    rolled_back_attachments: List[str] = field(default_factory=list)
    processing_log: List[str] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        if self.status in [RollbackStatus.INDEX_DELAY, RollbackStatus.ATTACHMENT_NOT_ROLLED_BACK, 
                          RollbackStatus.CACHE_HIT, RollbackStatus.PARTIAL_ROLLBACK, RollbackStatus.FAILED]:
            return False
        if self.status != RollbackStatus.SUCCESS:
            return False
        if len(self.attachments) != len(self.rolled_back_attachments):
            return False
        return True


@dataclass
class CheckResult:
    total_records: int = 0
    complete_rollbacks: int = 0
    incomplete_rollbacks: int = 0
    index_delay_count: int = 0
    attachment_issues_count: int = 0
    cache_hit_count: int = 0
    failed_count: int = 0
    records: List[ArticleRollbackRecord] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    def add_record(self, record: ArticleRollbackRecord) -> None:
        self.records.append(record)
        self.total_records += 1
        
        if record.is_complete:
            self.complete_rollbacks += 1
        else:
            self.incomplete_rollbacks += 1
        
        if record.status == RollbackStatus.INDEX_DELAY:
            self.index_delay_count += 1
        elif record.status == RollbackStatus.ATTACHMENT_NOT_ROLLED_BACK:
            self.attachment_issues_count += 1
        elif record.status == RollbackStatus.CACHE_HIT:
            self.cache_hit_count += 1
        elif record.status == RollbackStatus.FAILED:
            self.failed_count += 1
