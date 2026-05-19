from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from models import Secret, SecretLevel, ProcessingStatus, Owner


def get_expiry_grade(secret: Secret) -> Tuple[str, int]:
    days = secret.get_days_until_expiry()
    if days < 0:
        return "EXPIRED", 0
    elif days <= 3:
        return "URGENT", 1
    elif days <= 7:
        return "WARNING", 2
    elif days <= 14:
        return "NOTICE", 3
    elif days <= 30:
        return "INFO", 4
    else:
        return "SAFE", 5


def calculate_secret_level(secret: Secret) -> SecretLevel:
    grade, priority = get_expiry_grade(secret)
    base_level = secret.level
    
    if grade == "EXPIRED":
        return SecretLevel.CRITICAL
    elif grade == "URGENT":
        return SecretLevel.CRITICAL
    elif grade == "WARNING":
        return SecretLevel.HIGH
    elif grade == "NOTICE":
        return SecretLevel.MEDIUM
    else:
        return base_level


def should_remind(secret: Secret) -> bool:
    if secret.status in [ProcessingStatus.RESOLVED, ProcessingStatus.CLOSED]:
        return False
    
    grade, _ = get_expiry_grade(secret)
    if grade in ["SAFE", "INFO"]:
        return False
    
    if secret.owner.is_on_vacation:
        return True
    
    non_duplicate_reminders = [r for r in secret.reminder_records if not r.is_duplicate]
    if not non_duplicate_reminders:
        return True
    
    last_reminder = max(non_duplicate_reminders, key=lambda r: r.reminder_time)
    days_since_last = (datetime.now() - last_reminder.reminder_time).days
    
    if grade == "URGENT" and days_since_last >= 1:
        return True
    elif grade == "WARNING" and days_since_last >= 3:
        return True
    elif grade == "NOTICE" and days_since_last >= 7:
        return True
    
    return False


def is_duplicate_reminder(secret: Secret, new_reminder) -> bool:
    grade, _ = get_expiry_grade(secret)
    
    for reminder in secret.reminder_records:
        if reminder.reminder_channel != new_reminder.reminder_channel:
            continue
        
        time_diff = (new_reminder.reminder_time - reminder.reminder_time).total_seconds()
        
        if grade == "URGENT" and time_diff < 24 * 3600:
            return True
        elif grade == "WARNING" and time_diff < 3 * 24 * 3600:
            return True
        elif grade == "NOTICE" and time_diff < 7 * 24 * 3600:
            return True
        elif grade in ["INFO", "SAFE"] and time_diff < 30 * 24 * 3600:
            return True
    
    return False


def should_transfer_on_vacation(secret: Secret) -> Tuple[bool, Optional[str]]:
    if not secret.owner.is_on_vacation:
        return False, None
    
    if secret.status in [ProcessingStatus.TRANSFERRED, ProcessingStatus.RESOLVED, ProcessingStatus.CLOSED]:
        return False, None
    
    grade, _ = get_expiry_grade(secret)
    if grade in ["SAFE", "INFO"]:
        return False, None
    
    if secret.owner.backup_owner:
        return True, secret.owner.backup_owner
    
    return True, None


def can_transition_status(secret: Secret, new_status: ProcessingStatus) -> bool:
    current = secret.status
    
    valid_transitions = {
        ProcessingStatus.PENDING: [
            ProcessingStatus.REMINDED,
            ProcessingStatus.TRANSFERRED,
            ProcessingStatus.RESOLVED,
            ProcessingStatus.CLOSED
        ],
        ProcessingStatus.REMINDED: [
            ProcessingStatus.REMINDED,    # 可以再次提醒（非重复时）
            ProcessingStatus.TRANSFERRED,
            ProcessingStatus.RESOLVED,
            ProcessingStatus.CLOSED,
            ProcessingStatus.PENDING
        ],
        ProcessingStatus.TRANSFERRED: [
            ProcessingStatus.REMINDED,
            ProcessingStatus.RESOLVED,
            ProcessingStatus.CLOSED,
            ProcessingStatus.TRANSFERRED
        ],
        ProcessingStatus.RESOLVED: [
            ProcessingStatus.CLOSED,
            ProcessingStatus.PENDING
        ],
        ProcessingStatus.CLOSED: [
            ProcessingStatus.PENDING
        ]
    }
    
    return new_status in valid_transitions.get(current, [])


def apply_automatic_rules(secret: Secret, all_owners: List[Owner]) -> Secret:
    if secret.status in [ProcessingStatus.RESOLVED, ProcessingStatus.CLOSED]:
        return secret
    
    should_transfer, backup_name = should_transfer_on_vacation(secret)
    if should_transfer and backup_name and can_transition_status(secret, ProcessingStatus.TRANSFERRED):
        backup_owner = next((o for o in all_owners if o.name == backup_name), None)
        if backup_owner:
            secret.transfer_owner(
                new_owner=backup_owner,
                operator="system",
                reason=f"原负责人{secret.owner.name}休假，自动转交给备份负责人{backup_name}"
            )
    
    secret.level = calculate_secret_level(secret)
    
    return secret


def get_reminder_content(secret: Secret) -> str:
    days = secret.get_days_until_expiry()
    grade, _ = get_expiry_grade(secret)
    
    if days < 0:
        return f"【{grade}】密钥 {secret.secret_name} 已过期 {-days} 天，请立即处理！"
    elif days == 0:
        return f"【{grade}】密钥 {secret.secret_name} 今日到期，请立即处理！"
    else:
        return f"【{grade}】密钥 {secret.secret_name} 将在 {days} 天后到期，请及时处理。"
