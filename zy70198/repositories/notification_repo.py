from datetime import date
from typing import Dict, List, Optional

from models import DelayNotification, NotificationStatus


class NotificationRepository:
    def __init__(self):
        self._notifications: Dict[str, DelayNotification] = {}

    def save(self, notification: DelayNotification) -> None:
        self._notifications[notification.id] = notification

    def get_by_id(self, notification_id: str) -> Optional[DelayNotification]:
        return self._notifications.get(notification_id)

    def get_by_plan(self, plan_id: str) -> List[DelayNotification]:
        return [n for n in self._notifications.values() if n.payment_plan_id == plan_id]

    def get_by_status(self, status: NotificationStatus) -> List[DelayNotification]:
        return [n for n in self._notifications.values() if n.status == status]

    def get_pending(self) -> List[DelayNotification]:
        return self.get_by_status(NotificationStatus.PENDING)

    def get_failed(self) -> List[DelayNotification]:
        return self.get_by_status(NotificationStatus.FAILED)

    def get_by_date(self, target_date: date) -> List[DelayNotification]:
        return [n for n in self._notifications.values() 
                if n.new_payment_date == target_date]

    def get_all(self) -> List[DelayNotification]:
        return list(self._notifications.values())

    def delete(self, notification_id: str) -> bool:
        if notification_id in self._notifications:
            del self._notifications[notification_id]
            return True
        return False
