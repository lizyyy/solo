from datetime import datetime, date
from typing import Dict, Optional
import traceback

from repositories import (
    PaymentPlanRepository, InvoiceRepository, FundRepository,
    ScheduleRepository, NotificationRepository
)
from services import SchedulingService, NotificationService


class SchedulerTask:
    """
    自动排程后台任务
    
    任务说明：
    1. 定时任务：建议每日凌晨2点执行
    2. 处理逻辑：
       - 获取所有待排程的付款计划
       - 按优先级排序（紧急 > 高 > 普通）
       - 逐个执行排程计算
       - 生成排程记录和延后通知
    
    失败处理：
    - 任务幂等性：同一批次号不会重复执行
    - 部分失败：已成功排程的计划状态已更新，未成功的转入人工复核
    - 重试机制：可手动重新执行，或等待下次定时任务
    """
    
    def __init__(
        self,
        plan_repo: PaymentPlanRepository,
        invoice_repo: InvoiceRepository,
        fund_repo: FundRepository,
        schedule_repo: ScheduleRepository,
        notification_repo: NotificationRepository
    ):
        self.plan_repo = plan_repo
        self.invoice_repo = invoice_repo
        self.fund_repo = fund_repo
        self.schedule_repo = schedule_repo
        self.notification_repo = notification_repo
        
        self.scheduling_service = SchedulingService(
            plan_repo, invoice_repo, fund_repo, schedule_repo, notification_repo
        )
        self.notification_service = NotificationService(notification_repo, plan_repo)
        
        self._last_run_result: Optional[Dict] = None
        self._run_count = 0
    
    def run(self, target_month: Optional[str] = None) -> Dict:
        """
        执行自动排程任务
        
        返回格式：
        {
            'task_id': '任务ID',
            'status': 'success/partial_success/failed',
            'start_time': '开始时间',
            'end_time': '结束时间',
            'batch_no': '排程批次号',
            'scheduled_count': 成功排程数,
            'manual_review_count': 转入人工复核数,
            'delayed_count': 需要延后通知数,
            'errors': ['错误信息列表'],
            'retryable': 是否可重试
        }
        """
        self._run_count += 1
        task_id = f'AUTO-SCH-{datetime.now().strftime("%Y%m%d%H%M%S")}'
        start_time = datetime.now()
        errors: List[str] = []
        
        if not target_month:
            today = date.today()
            target_month = today.strftime('%Y-%m')
        
        result = {
            'task_id': task_id,
            'status': 'running',
            'start_time': start_time.isoformat(),
            'target_month': target_month,
            'run_count': self._run_count
        }
        
        try:
            pending_count = len(self.plan_repo.get_pending_scheduling())
            result['pending_count'] = pending_count
            
            if pending_count == 0:
                result['status'] = 'success'
                result['end_time'] = datetime.now().isoformat()
                result['message'] = '无待排程的付款计划，任务跳过'
                self._last_run_result = result
                return result
            
            schedule_result = self.scheduling_service.run_scheduling(
                target_month=target_month,
                triggered_by='auto_scheduler',
                is_auto_run=True
            )
            
            result['batch_no'] = schedule_result.get('batch_no')
            result['scheduled_count'] = schedule_result.get('scheduled_count', 0)
            result['manual_review_count'] = schedule_result.get('manual_review_count', 0)
            result['delayed_count'] = schedule_result.get('delayed_count', 0)
            
            for delay_info in schedule_result.get('delayed_notifications', []):
                try:
                    plan = self.plan_repo.get_by_id(delay_info['plan_id'])
                    if plan:
                        self.notification_service.create_delay_notification(
                            plan_id=delay_info['plan_id'],
                            original_date=delay_info['original_date'],
                            new_date=delay_info['new_date'],
                            delay_reason=delay_info['reason'],
                            notify_to=f'采购负责人-{plan.vendor_name}'
                        )
                except Exception as e:
                    errors.append(f'创建延后通知失败[{delay_info["plan_id"]}]: {str(e)}')
            
            if result['manual_review_count'] > 0:
                result['status'] = 'partial_success'
                result['message'] = f'排程部分成功：{result["scheduled_count"]}笔已排程，{result["manual_review_count"]}笔转入人工复核'
            else:
                result['status'] = 'success'
                result['message'] = f'排程全部成功：共{result["scheduled_count"]}笔付款计划已排程'
            
            if errors:
                result['errors'] = errors
                result['status'] = 'partial_success'
            
        except Exception as e:
            result['status'] = 'failed'
            result['message'] = f'排程任务执行失败：{str(e)}'
            result['errors'] = [str(e), traceback.format_exc()]
            result['retryable'] = True
        
        result['end_time'] = datetime.now().isoformat()
        self._last_run_result = result
        
        return result
    
    def get_last_run_result(self) -> Optional[Dict]:
        """获取上次任务执行结果"""
        return self._last_run_result
    
    def get_run_count(self) -> int:
        """获取任务执行次数"""
        return self._run_count
    
    def can_retry(self) -> bool:
        """
        判断任务是否可以重试
        
        可重试条件：
        1. 上次任务状态为 failed
        2. 上次任务状态为 partial_success 且有未处理的待排程计划
        """
        if not self._last_run_result:
            return True
        
        if self._last_run_result.get('status') == 'failed':
            return True
        
        if self._last_run_result.get('status') == 'partial_success':
            pending_count = len(self.plan_repo.get_pending_scheduling())
            return pending_count > 0
        
        return False
