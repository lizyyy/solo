from datetime import datetime
from typing import Dict, List, Optional
import traceback

from repositories import NotificationRepository, PaymentPlanRepository
from services import NotificationService


class NotificationTask:
    """
    延后通知发送后台任务
    
    任务说明：
    1. 定时任务：建议每小时执行一次
    2. 处理逻辑：
       - 获取所有待发送的延后通知
       - 逐个发送通知
       - 更新通知状态
    
    失败处理：
    - 单个通知失败不影响其他通知
    - 失败的通知状态标记为 failed
    - 重试时会重新发送所有 failed 状态的通知
    """
    
    def __init__(
        self,
        notification_repo: NotificationRepository,
        plan_repo: PaymentPlanRepository
    ):
        self.notification_repo = notification_repo
        self.plan_repo = plan_repo
        self.service = NotificationService(notification_repo, plan_repo)
        
        self._last_run_result: Optional[Dict] = None
    
    def run(self) -> Dict:
        """
        执行通知发送任务
        
        返回格式：
        {
            'task_id': '任务ID',
            'status': 'success/partial_success/failed',
            'start_time': '开始时间',
            'end_time': '结束时间',
            'total_count': 本次处理的通知总数,
            'sent_count': 成功发送数,
            'failed_count': 发送失败数,
            'failed_notifications': [失败的通知列表],
            'retryable': 是否可重试
        }
        """
        task_id = f'NOTI-{datetime.now().strftime("%Y%m%d%H%M%S")}'
        start_time = datetime.now()
        
        result = {
            'task_id': task_id,
            'status': 'running',
            'start_time': start_time.isoformat()
        }
        
        try:
            pending_notifications = self.service.get_pending_notifications()
            failed_notifications = self.service.get_failed_notifications()
            
            all_to_send = pending_notifications + failed_notifications
            result['total_count'] = len(all_to_send)
            
            if len(all_to_send) == 0:
                result['status'] = 'success'
                result['end_time'] = datetime.now().isoformat()
                result['message'] = '无待发送的通知，任务跳过'
                self._last_run_result = result
                return result
            
            sent_count = 0
            failed_list = []
            
            for notif_info in all_to_send:
                notif_id = notif_info.get('notification_id')
                try:
                    send_result = self.service.send_notification(notif_id)
                    if send_result.get('success'):
                        sent_count += 1
                    else:
                        failed_list.append({
                            'notification_id': notif_id,
                            'error': send_result.get('error', '未知错误')
                        })
                except Exception as e:
                    failed_list.append({
                        'notification_id': notif_id,
                        'error': str(e)
                    })
            
            result['sent_count'] = sent_count
            result['failed_count'] = len(failed_list)
            result['failed_notifications'] = failed_list
            
            if len(failed_list) == 0:
                result['status'] = 'success'
                result['message'] = f'通知发送成功：共{sent_count}条'
            elif sent_count > 0:
                result['status'] = 'partial_success'
                result['message'] = f'通知部分发送：成功{sent_count}条，失败{len(failed_list)}条'
                result['retryable'] = True
            else:
                result['status'] = 'failed'
                result['message'] = f'通知全部发送失败：共{len(failed_list)}条'
                result['retryable'] = True
            
        except Exception as e:
            result['status'] = 'failed'
            result['message'] = f'通知任务执行失败：{str(e)}'
            result['errors'] = [str(e), traceback.format_exc()]
            result['retryable'] = True
        
        result['end_time'] = datetime.now().isoformat()
        self._last_run_result = result
        
        return result
    
    def get_last_run_result(self) -> Optional[Dict]:
        """获取上次任务执行结果"""
        return self._last_run_result
    
    def retry_failed(self) -> Dict:
        """
        仅重试失败的通知
        
        与 run() 不同，此方法只处理 failed 状态的通知
        """
        failed_notifications = self.service.get_failed_notifications()
        
        if not failed_notifications:
            return {
                'status': 'success',
                'message': '没有失败的通知需要重试'
            }
        
        return self.run()
