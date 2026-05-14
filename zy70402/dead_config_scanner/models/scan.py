from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
import hashlib
import json


class ScanStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ScanItemStatus(str, Enum):
    UNKNOWN = "unknown"
    VALID = "valid"
    INVALID = "invalid"
    ERROR = "error"
    SKIPPED = "skipped"


class ScanItem(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    id: str = Field(default_factory=lambda: "")
    source: str = Field(description="来源文件或资源标识")
    content: str = Field(description="待检测内容，如URL、配置项等")
    content_hash: str = Field(default="", description="内容摘要，用于去重和查询")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="额外元数据")
    status: ScanItemStatus = ScanItemStatus.UNKNOWN
    error_message: Optional[str] = None
    scan_time: Optional[datetime] = None
    rule_versions: Dict[str, str] = Field(default_factory=dict, description="检测时使用的规则版本")
    
    def model_post_init(self, __context):
        if not self.content_hash:
            self.content_hash = hashlib.sha256(self.content.encode()).hexdigest()[:16]
        if not self.id:
            combined = f"{self.source}:{self.content}"
            self.id = hashlib.md5(combined.encode()).hexdigest()


class ScanBatch(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    batch_id: str
    name: str = Field(default="")
    created_at: datetime = Field(default_factory=datetime.now)
    status: ScanStatus = ScanStatus.PENDING
    items: List[ScanItem] = Field(default_factory=list)
    rule_set_version: str = Field(description="本次扫描使用的规则集版本")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    error_count: int = 0
    success_count: int = 0
    skip_count: int = 0
    
    def get_summary(self) -> Dict[str, Any]:
        counts = {
            "total": len(self.items),
            "valid": 0,
            "invalid": 0,
            "error": 0,
            "skipped": 0,
            "unknown": 0
        }
        for item in self.items:
            counts[item.status.value] += 1
        return {
            "batch_id": self.batch_id,
            "status": self.status,
            "counts": counts,
            "created_at": self.created_at.isoformat(),
            "rule_set_version": self.rule_set_version
        }


class ScanConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    
    timeout: int = Field(default=10, description="请求超时时间(秒)")
    retry_count: int = Field(default=2, description="重试次数")
    concurrent: int = Field(default=5, description="并发数")
    user_agent: str = Field(default="Mozilla/5.0 (compatible; DeadConfigScanner/1.0)")
    follow_redirects: bool = Field(default=True, description="是否跟随重定向")
    verify_ssl: bool = Field(default=True, description="是否验证SSL证书")
    output_dir: str = Field(default="./output")
    save_failures_only: bool = Field(default=False, description="仅保存失败项")


class ScanResult(BaseModel):
    batch_id: str
    status: ScanStatus
    items: List[ScanItem]
    failures: List[ScanItem] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
