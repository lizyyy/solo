from datetime import datetime, timedelta
from typing import Optional, Tuple, List, Dict, Any
from app.models import LifecycleRule, StorageObject
import logging

logger = logging.getLogger(__name__)


class LifecycleMatcher:
    def __init__(self, rule: LifecycleRule):
        self.rule = rule

    def match_prefix(self, obj: StorageObject) -> Tuple[bool, Optional[str]]:
        if not self.rule.prefix:
            return True, None
        if obj.key.startswith(self.rule.prefix):
            return True, f"前缀匹配: {self.rule.prefix}"
        return False, None

    def match_tags(self, obj: StorageObject) -> Tuple[bool, Optional[str]]:
        if not self.rule.tag_filters:
            return True, None

        obj_tags = obj.tags or {}
        matched_reasons = []

        for tag_filter in self.rule.tag_filters:
            tag_key = tag_filter.get("key")
            tag_value = tag_filter.get("value")

            if not tag_key:
                continue

            if tag_key not in obj_tags:
                return False, None

            if tag_value and obj_tags[tag_key] != tag_value:
                return False, None

            matched_reasons.append(f"标签匹配: {tag_key}={tag_value or '*'}")

        return True, "; ".join(matched_reasons) if matched_reasons else None

    def check_expiration_time(self, obj: StorageObject, preview_time: Optional[datetime] = None) -> Tuple[bool, Optional[str], Optional[datetime]]:
        if preview_time is None:
            preview_time = datetime.utcnow()

        expiration_date = None
        reasons = []

        if self.rule.expiration_date:
            if preview_time >= self.rule.expiration_date:
                expiration_date = self.rule.expiration_date
                reasons.append(f"到达过期日期: {self.rule.expiration_date.isoformat()}")
            else:
                return False, None, None

        if self.rule.days_after_modification is not None and obj.last_modified:
            threshold_date = obj.last_modified + timedelta(days=self.rule.days_after_modification)
            if preview_time >= threshold_date:
                expiration_date = threshold_date
                reasons.append(f"修改后超过 {self.rule.days_after_modification} 天")
            else:
                return False, None, None

        if self.rule.days_after_creation is not None and obj.creation_date:
            threshold_date = obj.creation_date + timedelta(days=self.rule.days_after_creation)
            if preview_time >= threshold_date:
                expiration_date = threshold_date
                reasons.append(f"创建后超过 {self.rule.days_after_creation} 天")
            else:
                return False, None, None

        if not reasons and self.rule.prefix:
            return True, "仅前缀匹配", preview_time

        if reasons:
            return True, "; ".join(reasons), expiration_date

        return False, None, None

    def check_noncurrent_version(self, obj: StorageObject, preview_time: Optional[datetime] = None) -> Tuple[bool, Optional[str], Optional[datetime]]:
        if preview_time is None:
            preview_time = datetime.utcnow()

        if self.rule.noncurrent_version_days is None:
            return False, None, None

        if obj.is_latest:
            return False, None, None

        threshold_date = obj.last_modified + timedelta(days=self.rule.noncurrent_version_days)
        if preview_time >= threshold_date:
            return True, f"非当前版本超过 {self.rule.noncurrent_version_days} 天", threshold_date

        return False, None, None

    def match_object(self, obj: StorageObject, preview_time: Optional[datetime] = None) -> Tuple[bool, Optional[str], Optional[datetime]]:
        if preview_time is None:
            preview_time = datetime.utcnow()

        prefix_match, prefix_reason = self.match_prefix(obj)
        if not prefix_match:
            return False, None, None

        tag_match, tag_reason = self.match_tags(obj)
        if not tag_match:
            return False, None, None

        time_match, time_reason, expiration_date = self.check_expiration_time(obj, preview_time)
        noncurrent_match, noncurrent_reason, noncurrent_date = self.check_noncurrent_version(obj, preview_time)

        if not time_match and not noncurrent_match:
            return False, None, None

        all_reasons = []
        if prefix_reason:
            all_reasons.append(prefix_reason)
        if tag_reason:
            all_reasons.append(tag_reason)
        if time_reason:
            all_reasons.append(time_reason)
        if noncurrent_reason:
            all_reasons.append(noncurrent_reason)

        final_expiration = expiration_date or noncurrent_date
        final_reason = "; ".join(all_reasons)

        return True, final_reason, final_expiration

    @staticmethod
    def validate_rule(rule: LifecycleRule) -> Tuple[bool, Optional[str]]:
        has_condition = any([
            rule.prefix,
            rule.tag_filters,
            rule.days_after_modification is not None,
            rule.days_after_creation is not None,
            rule.expiration_date is not None,
            rule.noncurrent_version_days is not None
        ])

        if not has_condition:
            return False, "规则至少需要一个条件（前缀、标签、时间或非当前版本）"

        if rule.days_after_modification is not None and rule.days_after_modification < 0:
            return False, "修改后天数不能为负数"

        if rule.days_after_creation is not None and rule.days_after_creation < 0:
            return False, "创建后天数不能为负数"

        if rule.noncurrent_version_days is not None and rule.noncurrent_version_days < 0:
            return False, "非当前版本天数不能为负数"

        return True, None
