from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.models import (
    UserPreference, ChangeHistory, SendInterception, AnomalyQueue,
    ChannelType, SourceType, PreferenceStatus, BusinessScene,
    InterceptionStatus, SourcePriority
)
from app.schemas.preference import (
    PreferenceCreate, PreferenceUpdate, ValidationResult, ConflictInfo
)


class PreferenceService:
    SOURCE_PRIORITY_MAP = {
        SourceType.USER_PROFILE: SourcePriority.USER_PROFILE.value,
        SourceType.ADMIN_PANEL: SourcePriority.ADMIN_PANEL.value,
        SourceType.API: SourcePriority.API.value,
        SourceType.MARKETING_CAMPAIGN: SourcePriority.MARKETING_CAMPAIGN.value,
        SourceType.BATCH_IMPORT: SourcePriority.BATCH_IMPORT.value,
    }

    def __init__(self, db: Session):
        self.db = db

    def get_source_priority(self, source: SourceType) -> int:
        return self.SOURCE_PRIORITY_MAP.get(source, 0)

    def find_existing_preference(
        self, user_id: str, channel: ChannelType, business_scene: BusinessScene
    ) -> Optional[UserPreference]:
        return self.db.query(UserPreference).filter(
            and_(
                UserPreference.user_id == user_id,
                UserPreference.channel == channel,
                UserPreference.business_scene == business_scene,
                UserPreference.status != PreferenceStatus.MERGED
            )
        ).first()

    def check_conflict(
        self, preference_data: PreferenceCreate
    ) -> Tuple[bool, Optional[ConflictInfo]]:
        existing = self.find_existing_preference(
            preference_data.user_id,
            preference_data.channel,
            preference_data.business_scene
        )
        
        if not existing:
            return False, None

        new_priority = self.get_source_priority(preference_data.source)
        
        conflict_type = "priority_conflict" if new_priority < existing.source_priority else "value_conflict"
        
        return True, ConflictInfo(
            existing_preference=existing,
            new_preference=preference_data,
            conflict_type=conflict_type
        )

    def create_change_history(
        self,
        preference: UserPreference,
        old_value: Dict[str, Any],
        new_value: Dict[str, Any],
        source: SourceType,
        change_type: str,
        operator: str = "system"
    ):
        snapshot = {
            "id": preference.id,
            "user_id": preference.user_id,
            "channel": preference.channel.value,
            "business_scene": preference.business_scene.value,
            "enabled": preference.enabled,
            "source": preference.source.value,
            "status": preference.status.value,
            "timestamp": datetime.now().isoformat()
        }

        history = ChangeHistory(
            preference_id=preference.id,
            user_id=preference.user_id,
            channel=preference.channel,
            business_scene=preference.business_scene,
            old_value=old_value,
            new_value=new_value,
            source=source,
            operator=operator,
            change_type=change_type,
            snapshot=snapshot
        )
        self.db.add(history)
        self.db.flush()

    def create_preference(
        self, preference_data: PreferenceCreate, operator: str = "system"
    ) -> Tuple[UserPreference, bool]:
        has_conflict, conflict_info = self.check_conflict(preference_data)
        
        source_priority = self.get_source_priority(preference_data.source)
        
        if has_conflict and conflict_info:
            existing = conflict_info.existing_preference
            
            if source_priority < existing.source_priority:
                anomaly = AnomalyQueue(
                    user_id=preference_data.user_id,
                    channel=preference_data.channel,
                    business_scene=preference_data.business_scene,
                    anomaly_type="low_priority_override",
                    description=f"来源{preference_data.source}优先级低于现有来源，无法覆盖",
                    source=preference_data.source,
                    status="pending",
                    metadata={
                        "existing_source": existing.source.value,
                        "existing_priority": existing.source_priority,
                        "new_source": preference_data.source.value,
                        "new_priority": source_priority
                    }
                )
                self.db.add(anomaly)
                self.db.flush()
                
                return existing, False
            
            elif source_priority == existing.source_priority:
                old_value = {"enabled": existing.enabled, "metadata": existing.meta_data}
                
                existing.enabled = preference_data.enabled
                existing.meta_data = preference_data.meta_data or {}
                existing.status = PreferenceStatus.ACTIVE
                
                new_value = {"enabled": preference_data.enabled, "metadata": preference_data.meta_data}
                
                self.create_change_history(
                    existing, old_value, new_value, preference_data.source, "merge_update", operator
                )
                
                self.db.flush()
                return existing, True
            
            else:
                old_value = {
                    "enabled": existing.enabled,
                    "source": existing.source.value,
                    "source_priority": existing.source_priority,
                    "metadata": existing.meta_data
                }
                
                existing.enabled = preference_data.enabled
                existing.source = preference_data.source
                existing.source_priority = source_priority
                existing.meta_data = preference_data.meta_data or {}
                existing.status = PreferenceStatus.ACTIVE
                
                new_value = {
                    "enabled": preference_data.enabled,
                    "source": preference_data.source.value,
                    "source_priority": source_priority,
                    "metadata": preference_data.meta_data
                }
                
                self.create_change_history(
                    existing, old_value, new_value, preference_data.source, "priority_override", operator
                )
                
                self.db.flush()
                return existing, True

        preference = UserPreference(
            user_id=preference_data.user_id,
            channel=preference_data.channel,
            business_scene=preference_data.business_scene,
            enabled=preference_data.enabled,
            source=preference_data.source,
            source_priority=source_priority,
            status=PreferenceStatus.ACTIVE,
            expires_at=preference_data.expires_at,
            meta_data=preference_data.meta_data or {}
        )
        
        self.db.add(preference)
        self.db.flush()
        
        self.create_change_history(
            preference, {}, preference_data.model_dump(), preference_data.source, "create", operator
        )
        
        return preference, True

    def merge_preferences(
        self, user_id: str, channel: ChannelType, business_scene: BusinessScene, operator: str = "system"
    ) -> Optional[UserPreference]:
        preferences = self.db.query(UserPreference).filter(
            and_(
                UserPreference.user_id == user_id,
                UserPreference.channel == channel,
                UserPreference.business_scene == business_scene,
                UserPreference.status.in_([PreferenceStatus.ACTIVE, PreferenceStatus.CONFLICT, PreferenceStatus.PENDING])
            )
        ).order_by(UserPreference.source_priority.desc()).all()

        if not preferences:
            return None

        primary = preferences[0]
        merged_metadata = {}

        for pref in preferences:
            if pref.meta_data:
                merged_metadata.update(pref.meta_data)

        old_value = {"metadata": primary.meta_data, "status": primary.status.value}
        
        primary.meta_data = merged_metadata
        primary.status = PreferenceStatus.MERGED
        
        new_value = {"metadata": merged_metadata, "status": PreferenceStatus.MERGED.value}
        
        self.create_change_history(
            primary, old_value, new_value, primary.source, "merge", operator
        )

        for pref in preferences[1:]:
            pref.status = PreferenceStatus.MERGED
            self.create_change_history(
                pref, {"status": pref.status.value}, {"status": PreferenceStatus.MERGED.value},
                pref.source, "merge_mark", operator
            )

        self.db.flush()
        return primary

    def validate_before_send(
        self, user_id: str, channel: ChannelType, business_scene: BusinessScene
    ) -> Tuple[ValidationResult, Optional[SendInterception]]:
        preference = self.find_existing_preference(user_id, channel, business_scene)
        
        interception = SendInterception(
            user_id=user_id,
            channel=channel,
            business_scene=business_scene,
            status=InterceptionStatus.PENDING,
            checked_at=datetime.now()
        )
        self.db.add(interception)
        self.db.flush()

        if not preference:
            interception.status = InterceptionStatus.BLOCKED
            interception.reason = "未找到用户偏好配置"
            interception.interception_rule = "preference_not_found"
            self.db.flush()
            return ValidationResult(
                allowed=False,
                reason="未找到用户偏好配置",
                rule="preference_not_found"
            ), interception

        if preference.status not in [PreferenceStatus.ACTIVE, PreferenceStatus.MERGED]:
            interception.status = InterceptionStatus.BLOCKED
            interception.reason = f"偏好状态异常: {preference.status.value}"
            interception.interception_rule = "invalid_preference_status"
            interception.preference_id = preference.id
            self.db.flush()
            return ValidationResult(
                allowed=False,
                reason=f"偏好状态异常: {preference.status.value}",
                rule="invalid_preference_status"
            ), interception

        if not preference.enabled:
            interception.status = InterceptionStatus.BLOCKED
            interception.reason = "用户已关闭该渠道通知"
            interception.interception_rule = "preference_disabled"
            interception.preference_id = preference.id
            self.db.flush()
            return ValidationResult(
                allowed=False,
                reason="用户已关闭该渠道通知",
                rule="preference_disabled"
            ), interception

        if preference.expires_at and preference.expires_at < datetime.now():
            interception.status = InterceptionStatus.BLOCKED
            interception.reason = "偏好配置已过期"
            interception.interception_rule = "preference_expired"
            interception.preference_id = preference.id
            self.db.flush()
            return ValidationResult(
                allowed=False,
                reason="偏好配置已过期",
                rule="preference_expired"
            ), interception

        interception.status = InterceptionStatus.ALLOWED
        interception.preference_id = preference.id
        self.db.flush()
        
        return ValidationResult(allowed=True), interception

    def get_user_preferences(
        self, user_id: Optional[str] = None, channel: Optional[ChannelType] = None,
        business_scene: Optional[BusinessScene] = None, status: Optional[PreferenceStatus] = None,
        skip: int = 0, limit: int = 100
    ) -> List[UserPreference]:
        query = self.db.query(UserPreference)
        
        if user_id:
            query = query.filter(UserPreference.user_id == user_id)
        if channel:
            query = query.filter(UserPreference.channel == channel)
        if business_scene:
            query = query.filter(UserPreference.business_scene == business_scene)
        if status:
            query = query.filter(UserPreference.status == status)
            
        return query.offset(skip).limit(limit).all()

    def get_change_history(
        self, user_id: Optional[str] = None, preference_id: Optional[int] = None,
        skip: int = 0, limit: int = 100
    ) -> List[ChangeHistory]:
        query = self.db.query(ChangeHistory)
        
        if user_id:
            query = query.filter(ChangeHistory.user_id == user_id)
        if preference_id:
            query = query.filter(ChangeHistory.preference_id == preference_id)
            
        return query.order_by(ChangeHistory.created_at.desc()).offset(skip).limit(limit).all()

    def get_anomaly_queue(
        self, status: Optional[str] = None, user_id: Optional[str] = None,
        skip: int = 0, limit: int = 100
    ) -> List[AnomalyQueue]:
        query = self.db.query(AnomalyQueue)
        
        if status:
            query = query.filter(AnomalyQueue.status == status)
        if user_id:
            query = query.filter(AnomalyQueue.user_id == user_id)
            
        return query.order_by(AnomalyQueue.created_at.desc()).offset(skip).limit(limit).all()

    def advance_anomaly_status(
        self, anomaly_id: int, target_status: str, resolution_note: Optional[str] = None,
        resolver: str = "system"
    ) -> Optional[AnomalyQueue]:
        anomaly = self.db.query(AnomalyQueue).filter(AnomalyQueue.id == anomaly_id).first()
        if not anomaly:
            return None

        anomaly.status = target_status
        if target_status == "resolved":
            anomaly.resolved_at = datetime.now()
            anomaly.resolver = resolver
            anomaly.resolution_note = resolution_note
        elif target_status == "retrying":
            anomaly.retry_count += 1
            anomaly.last_retry_at = datetime.now()

        self.db.flush()
        return anomaly

    def get_interceptions(
        self, user_id: Optional[str] = None, status: Optional[InterceptionStatus] = None,
        skip: int = 0, limit: int = 100
    ) -> List[SendInterception]:
        query = self.db.query(SendInterception)
        
        if user_id:
            query = query.filter(SendInterception.user_id == user_id)
        if status:
            query = query.filter(SendInterception.status == status)
            
        return query.order_by(SendInterception.created_at.desc()).offset(skip).limit(limit).all()

    def generate_interception_report(
        self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        query = self.db.query(SendInterception)
        
        if start_date:
            query = query.filter(SendInterception.created_at >= start_date)
        if end_date:
            query = query.filter(SendInterception.created_at <= end_date)

        interceptions = query.all()
        
        total = len(interceptions)
        blocked = sum(1 for i in interceptions if i.status == InterceptionStatus.BLOCKED)
        allowed = sum(1 for i in interceptions if i.status == InterceptionStatus.ALLOWED)
        
        by_rule: Dict[str, int] = {}
        for i in interceptions:
            if i.interception_rule:
                by_rule[i.interception_rule] = by_rule.get(i.interception_rule, 0) + 1
        
        by_channel: Dict[str, int] = {}
        for i in interceptions:
            channel = i.channel.value
            by_channel[channel] = by_channel.get(channel, 0) + 1

        return {
            "total_interceptions": total,
            "blocked_count": blocked,
            "allowed_count": allowed,
            "block_rate": blocked / total if total > 0 else 0,
            "by_rule": by_rule,
            "by_channel": by_channel,
            "period_start": start_date.isoformat() if start_date else None,
            "period_end": end_date.isoformat() if end_date else None
        }
