import fnmatch
import hashlib
import traceback
from typing import List, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models import (
    BloodlineSubscription, SubscriptionStatus, BloodlineRelation,
    Notification, NotificationStatus, NotificationBatch, FailureRecord
)
from schemas import BloodlineRelationCreate, generate_id

def pattern_match(pattern: str, value: str) -> bool:
    if not pattern or not value:
        return False
    return fnmatch.fnmatch(value.lower(), pattern.lower())

def match_bloodline_subscription(
    bloodline: BloodlineRelation,
    subscription: BloodlineSubscription
) -> Tuple[bool, str]:
    match_details = []
    if pattern_match(subscription.field_name_pattern, bloodline.field_name):
        match_details.append(f"字段匹配: {subscription.field_name_pattern} ~ {bloodline.field_name}")
    else:
        return False, f"字段不匹配: {subscription.field_name_pattern} != {bloodline.field_name}"
    
    if pattern_match(subscription.upstream_table_pattern, bloodline.upstream_table):
        match_details.append(f"上游表匹配: {subscription.upstream_table_pattern} ~ {bloodline.upstream_table}")
    else:
        return False, f"上游表不匹配: {subscription.upstream_table_pattern} != {bloodline.upstream_table}"
    
    if pattern_match(subscription.downstream_report_pattern, bloodline.downstream_report):
        match_details.append(f"下游报表匹配: {subscription.downstream_report_pattern} ~ {bloodline.downstream_report}")
    else:
        return False, f"下游报表不匹配: {subscription.downstream_report_pattern} != {bloodline.downstream_report}"
    
    return True, "; ".join(match_details)

def generate_deduplication_key(bloodline: BloodlineRelation, subscription: BloodlineSubscription) -> str:
    key_parts = [
        bloodline.field_name,
        bloodline.upstream_table,
        bloodline.downstream_report,
        subscription.team_name,
        bloodline.change_type or ""
    ]
    key_string = "|".join(str(p) for p in key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()

def check_duplicate_notification(
    db: Session,
    deduplication_key: str,
    batch_id: str
) -> bool:
    existing = db.query(Notification).filter(
        Notification.deduplication_key == deduplication_key,
        Notification.status.in_([
            NotificationStatus.MATCHED,
            NotificationStatus.DEDUPLICATED,
            NotificationStatus.NOTIFIED,
            NotificationStatus.CONFIRMED
        ]),
        Notification.batch_id != batch_id
    ).first()
    return existing is not None

def process_single_bloodline(
    db: Session,
    bloodline: BloodlineRelation,
    batch_id: str
) -> List[Notification]:
    notifications = []
    subscriptions = db.query(BloodlineSubscription).filter(
        BloodlineSubscription.status == SubscriptionStatus.ACTIVE
    ).all()
    
    for subscription in subscriptions:
        notification = Notification(
            bloodline_relation_id=bloodline.id,
            subscription_id=subscription.id,
            batch_id=batch_id,
            team_name=subscription.team_name,
            status=NotificationStatus.PENDING
        )
        
        try:
            is_matched, match_reason = match_bloodline_subscription(bloodline, subscription)
            if not is_matched:
                notification.status = NotificationStatus.FILTERED
                notification.filter_reason = match_reason
                db.add(notification)
                continue
            
            notification.status = NotificationStatus.MATCHED
            notification.match_reason = match_reason
            
            dedup_key = generate_deduplication_key(bloodline, subscription)
            notification.deduplication_key = dedup_key
            
            if check_duplicate_notification(db, dedup_key, batch_id):
                notification.status = NotificationStatus.FILTERED
                notification.filter_reason = f"去重拦截: 同一团队同一血缘已通知过 (key: {dedup_key[:8]}...)"
                db.add(notification)
                continue
            
            notification.status = NotificationStatus.DEDUPLICATED
            db.add(notification)
            notifications.append(notification)
            
        except Exception as e:
            notification.status = NotificationStatus.FAILED
            db.add(notification)
            db.flush()
            
            failure_record = FailureRecord(
                notification_id=notification.id,
                original_input={
                    "bloodline": {
                        "field_name": bloodline.field_name,
                        "upstream_table": bloodline.upstream_table,
                        "downstream_report": bloodline.downstream_report,
                        "change_type": bloodline.change_type
                    },
                    "subscription": {
                        "team_name": subscription.team_name,
                        "field_pattern": subscription.field_name_pattern,
                        "table_pattern": subscription.upstream_table_pattern,
                        "report_pattern": subscription.downstream_report_pattern
                    }
                },
                processing_rules={
                    "match_logic": "pattern_match使用fnmatch通配符匹配",
                    "dedup_logic": "基于字段+表+报表+团队+变更类型的MD5去重",
                    "filter_logic": "订阅状态必须为ACTIVE"
                },
                error_message=str(e),
                error_stack=traceback.format_exc(),
                final_conclusion="处理异常，已记录失败信息"
            )
            db.add(failure_record)
    
    return notifications

def batch_process_bloodline_changes(
    db: Session,
    bloodline_changes: List[BloodlineRelationCreate],
    batch_id: Optional[str] = None
) -> Tuple[str, List[Notification], int, int, int]:
    batch_id = batch_id or f"batch_{generate_id()}"
    
    batch = NotificationBatch(
        batch_id=batch_id,
        total_count=len(bloodline_changes),
        status="processing"
    )
    db.add(batch)
    db.flush()
    
    all_notifications = []
    matched_count = 0
    filtered_count = 0
    failed_count = 0
    
    for change in bloodline_changes:
        try:
            bloodline = BloodlineRelation(
                field_name=change.field_name,
                upstream_table=change.upstream_table,
                downstream_report=change.downstream_report,
                bloodline_path=change.bloodline_path,
                change_type=change.change_type,
                change_description=change.change_description,
                batch_id=batch_id
            )
            db.add(bloodline)
            db.flush()
            
            notifications = process_single_bloodline(db, bloodline, batch_id)
            all_notifications.extend(notifications)
            
            for n in notifications:
                if n.status == NotificationStatus.MATCHED or n.status == NotificationStatus.DEDUPLICATED:
                    matched_count += 1
                elif n.status == NotificationStatus.FILTERED:
                    filtered_count += 1
                elif n.status == NotificationStatus.FAILED:
                    failed_count += 1
                    
        except Exception as e:
            failed_count += 1
    
    batch.matched_count = matched_count
    batch.filtered_count = filtered_count
    batch.failed_count = failed_count
    batch.status = "completed"
    batch.completed_at = datetime.now()
    
    db.commit()
    return batch_id, all_notifications, matched_count, filtered_count, failed_count
