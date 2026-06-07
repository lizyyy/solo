from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Any, Optional
from enum import Enum

from ..utils.helpers import generate_id, get_current_time, hash_data


class ResultSource(str, Enum):
    EXPORT = "export"
    PAGE = "page"
    API = "api"


@dataclass
class UnifiedResult:
    """
    统一结果层
    确保导出明细、页面展示、接口返回读取同一份数据
    """
    result_id: str = field(default_factory=lambda: generate_id("res"))
    patch_id: str = ""
    generated_at: datetime = field(default_factory=get_current_time)
    generated_by: str = ""
    data_hash: str = ""
    tier_metrics: Dict[str, Dict] = field(default_factory=dict)
    track_details: List[Dict] = field(default_factory=list)
    issues_summary: Dict = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    version: int = 1

    def __post_init__(self):
        self._recalculate_hash()

    def _recalculate_hash(self):
        """重新计算数据哈希"""
        self.data_hash = hash_data({
            "tier_metrics": self.tier_metrics,
            "track_details": self.track_details,
            "issues_summary": self.issues_summary,
        })

    def update_data(self, tier_metrics: Dict, track_details: List[Dict], issues_summary: Dict):
        """更新数据，确保所有来源共享同一份"""
        self.tier_metrics = tier_metrics
        self.track_details = track_details
        self.issues_summary = issues_summary
        self.generated_at = get_current_time()
        self.version += 1
        self._recalculate_hash()

    def get_for_export(self) -> Dict[str, Any]:
        """获取导出用数据"""
        return {
            "result_id": self.result_id,
            "patch_id": self.patch_id,
            "generated_at": self.generated_at.isoformat(),
            "version": self.version,
            "tier_metrics": self.tier_metrics,
            "track_details": self.track_details,
            "issues_summary": self.issues_summary,
            "data_hash": self.data_hash,
            "source": ResultSource.EXPORT,
        }

    def get_for_page(self) -> Dict[str, Any]:
        """获取页面展示用数据"""
        return {
            "result_id": self.result_id,
            "patch_id": self.patch_id,
            "generated_at": self.generated_at.isoformat(),
            "version": self.version,
            "tier_metrics": self.tier_metrics,
            "track_details": self.track_details,
            "issues_summary": self.issues_summary,
            "data_hash": self.data_hash,
            "source": ResultSource.PAGE,
        }

    def get_for_api(self) -> Dict[str, Any]:
        """获取接口返回用数据"""
        return {
            "result_id": self.result_id,
            "patch_id": self.patch_id,
            "generated_at": self.generated_at.isoformat(),
            "version": self.version,
            "tier_metrics": self.tier_metrics,
            "track_details": self.track_details,
            "issues_summary": self.issues_summary,
            "data_hash": self.data_hash,
            "source": ResultSource.API,
        }

    def verify_consistency(self, other_data: Dict) -> bool:
        """验证数据一致性"""
        other_hash = hash_data({
            "tier_metrics": other_data.get("tier_metrics", {}),
            "track_details": other_data.get("track_details", []),
            "issues_summary": other_data.get("issues_summary", {}),
        })
        return other_hash == self.data_hash
