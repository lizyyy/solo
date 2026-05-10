from datetime import date, datetime, timedelta
from typing import Dict, List, Optional
from uuid import uuid4

from models import DelayNotification, NotificationStatus, PaymentPlan
from repositories import NotificationRepository, PaymentPlanRepository


class NotificationService:
    def __init__(
        self,
        notification_repo: NotificationRepository,
        plan_repo: PaymentPlanRepository
    ):
        self.notification_repo = notification_repo
        self.plan_repo = plan_repo

    def create_delay_notification(
        self,
        plan_id: str,
        original_date: date,
        new_date: date,
        delay_reason: str,
        notify_to: str,
        notify_channel: str = 'email'
    ) -> Dict:
        rule_traces = []
        
        plan = self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise ValueError(f'付款计划 {plan_id} 不存在')
        
        delay_days = (new_date - original_date).days
        
        if delay_days <= 0:
            rule_traces.append({
                'rule': 'NOTI_DELAY_001',
                'description': '检查延后天数',
                'input': {
                    'original_date': original_date.isoformat(),
                    'new_date': new_date.isoformat()
                },
                'output': '新日期不晚于原日期，无需通知',
                'passed': False
            })
            return {
                'success': False,
                'error': '新付款日期不晚于原日期，无需发送延后通知',
                'rule_traces': rule_traces
            }
        
        rule_traces.append({
            'rule': 'NOTI_DELAY_001',
            'description': '检查延后天数',
            'input': {
                'original_date': original_date.isoformat(),
                'new_date': new_date.isoformat()
            },
            'output': f'延后{delay_days}天',
            'passed': True
        })
        
        notification_id = f'DN-{datetime.now().strftime("%Y%m%d")}-{str(uuid4())[:6].upper()}'
        
        notification = DelayNotification(
            id=notification_id,
            payment_plan_id=plan_id,
            original_payment_date=original_date,
            new_payment_date=new_date,
            delay_days=delay_days,
            delay_reason=delay_reason,
            notify_to=notify_to,
            notify_channel=notify_channel,
            status=NotificationStatus.PENDING
        )
        
        self.notification_repo.save(notification)
        
        rule_traces.append({
            'rule': 'NOTI_DELAY_002',
            'description': '创建延后通知',
            'input': {'plan_id': plan_id},
            'output': {'notification_id': notification_id},
            'passed': True
        })
        
        return {
            'success': True,
            'notification_id': notification_id,
            'plan_id': plan_id,
            'vendor_name': plan.vendor_name,
            'original_date': original_date.isoformat(),
            'new_date': new_date.isoformat(),
            'delay_days': delay_days,
            'delay_reason': delay_reason,
            'notify_to': notify_to,
            'notify_channel': notify_channel,
            'message': f'已创建延后通知：供应商{plan.vendor_name}的付款从{original_date.isoformat()}延后至{new_date.isoformat()}，共{delay_days}天',
            'rule_traces': rule_traces
        }

    def send_notification(
        self,
        notification_id: str
    ) -> Dict:
        rule_traces = []
        
        notification = self.notification_repo.get_by_id(notification_id)
        if not notification:
            raise ValueError(f'通知记录 {notification_id} 不存在')
        
        if notification.status != NotificationStatus.PENDING:
            return {
                'success': False,
                'error': f'通知当前状态为{notification.status.value}，无法发送'
            }
        
        try:
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.now()
            notification.mark_updated()
            self.notification_repo.save(notification)
            
            rule_traces.append({
                'rule': 'NOTI_DELAY_003',
                'description': '发送延后通知',
                'input': {
                    'notification_id': notification_id,
                    'channel': notification.notify_channel,
                    'to': notification.notify_to
                },
                'output': '发送成功',
                'passed': True
            })
            
            return {
                'success': True,
                'notification_id': notification_id,
                'status': NotificationStatus.SENT.value,
                'sent_at': notification.sent_at.isoformat(),
                'message': f'通知已通过{notification.notify_channel}发送给{notification.notify_to}',
                'rule_traces': rule_traces
            }
            
        except Exception as e:
            notification.status = NotificationStatus.FAILED
            notification.remark = f'发送失败：{str(e)}'
            notification.mark_updated()
            self.notification_repo.save(notification)
            
            return {
                'success': False,
                'notification_id': notification_id,
                'status': NotificationStatus.FAILED.value,
                'error': f'通知发送失败：{str(e)}',
                'retryable': True
            }

    def acknowledge_notification(
        self,
        notification_id: str
    ) -> Dict:
        notification = self.notification_repo.get_by_id(notification_id)
        if not notification:
            raise ValueError(f'通知记录 {notification_id} 不存在')
        
        if notification.status != NotificationStatus.SENT:
            return {
                'success': False,
                'error': f'通知当前状态为{notification.status.value}，无法确认'
            }
        
        notification.status = NotificationStatus.ACKNOWLEDGED
        notification.acknowledged_at = datetime.now()
        notification.mark_updated()
        self.notification_repo.save(notification)
        
        return {
            'success': True,
            'notification_id': notification_id,
            'status': NotificationStatus.ACKNOWLEDGED.value,
            'acknowledged_at': notification.acknowledged_at.isoformat(),
            'message': '通知已确认收到'
        }

    def get_pending_notifications(self) -> List[Dict]:
        notifications = self.notification_repo.get_by_status(NotificationStatus.PENDING)
        
        result = []
        for notif in notifications:
            plan = self.plan_repo.get_by_id(notif.payment_plan_id)
            result.append({
                'notification_id': notif.id,
                'plan_id': notif.payment_plan_id,
                'vendor_name': plan.vendor_name if plan else '未知供应商',
                'original_date': notif.original_payment_date.isoformat(),
                'new_date': notif.new_payment_date.isoformat(),
                'delay_days': notif.delay_days,
                'delay_reason': notif.delay_reason,
                'notify_to': notif.notify_to,
                'notify_channel': notif.notify_channel,
                'created_at': notif.created_at.isoformat()
            })
        
        return result

    def get_failed_notifications(self) -> List[Dict]:
        notifications = self.notification_repo.get_by_status(NotificationStatus.FAILED)
        
        result = []
        for notif in notifications:
            plan = self.plan_repo.get_by_id(notif.payment_plan_id)
            result.append({
                'notification_id': notif.id,
                'plan_id': notif.payment_plan_id,
                'vendor_name': plan.vendor_name if plan else '未知供应商',
                'error': notif.remark,
                'retryable': True
            })
        
        return result
