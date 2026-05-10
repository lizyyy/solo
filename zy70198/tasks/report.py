from datetime import datetime, date, timedelta
from typing import Dict, Optional
import traceback

from repositories import (
    PaymentPlanRepository, FundRepository,
    ScheduleRepository, NotificationRepository
)


class ReportTask:
    """
    排程报表生成后台任务
    
    任务说明：
    1. 定时任务：建议每日凌晨6点执行
    2. 处理逻辑：
       - 生成昨日的排程日报
       - 统计资金使用情况
       - 汇总异常情况
    
    失败处理：
    - 报表生成失败不影响业务流程
    - 可随时手动重新生成
    - 报表数据基于当前数据库状态，可重复生成
    """
    
    def __init__(
        self,
        plan_repo: PaymentPlanRepository,
        fund_repo: FundRepository,
        schedule_repo: ScheduleRepository,
        notification_repo: NotificationRepository
    ):
        self.plan_repo = plan_repo
        self.fund_repo = fund_repo
        self.schedule_repo = schedule_repo
        self.notification_repo = notification_repo
        
        self._last_report: Optional[Dict] = None
    
    def generate_daily_report(self, report_date: Optional[date] = None) -> Dict:
        """
        生成每日排程报表
        
        返回格式：
        {
            'report_id': '报表ID',
            'report_date': '报表日期',
            'generated_at': '生成时间',
            'summary': {
                'total_scheduled_amount': 已排程总金额,
                'total_scheduled_count': 已排程笔数,
                'insertion_count': 插单笔数,
                'delay_count': 延后笔数,
                'manual_review_count': 人工复核笔数
            },
            'fund_usage': {
                'total_available': 可用资金总额,
                'total_reserved': 已预留资金,
                'utilization_rate': 资金利用率
            },
            'anomalies': {
                'overdue_plans': 逾期付款计划列表,
                'delayed_notifications': 延后通知列表,
                'manual_reviews': 人工复核列表
            },
            'recommendations': ['建议事项列表']
        }
        """
        if report_date is None:
            report_date = date.today() - timedelta(days=1)
        
        report_id = f'RPT-{report_date.strftime("%Y%m%d")}'
        generated_at = datetime.now()
        
        report = {
            'report_id': report_id,
            'report_date': report_date.isoformat(),
            'generated_at': generated_at.isoformat()
        }
        
        try:
            all_plans = self.plan_repo.get_all()
            
            scheduled_plans = [
                p for p in all_plans
                if p.current_payment_date
                and p.current_payment_date <= report_date
                and p.status.value in ['scheduled', 'partially_paid', 'fully_paid']
            ]
            
            insertions = [p for p in scheduled_plans if p.is_insertion]
            manual_reviews = self.plan_repo.get_manual_review_plans()
            
            today = date.today()
            overdue_plans = [
                p for p in all_plans
                if p.expected_payment_date
                and p.expected_payment_date < today
                and p.status.value not in ['fully_paid', 'cancelled']
            ]
            
            delayed_notifications = [
                n for n in self.notification_repo.get_all()
                if n.new_payment_date <= report_date
            ]
            
            fund_entries = self.fund_repo.get_all_entries()
            total_available = sum(e.total_fund for e in fund_entries)
            total_reserved = sum(e.reserved_fund for e in fund_entries)
            
            summary = {
                'total_scheduled_amount': sum(p.total_amount for p in scheduled_plans),
                'total_scheduled_count': len(scheduled_plans),
                'insertion_count': len(insertions),
                'delay_count': len(delayed_notifications),
                'manual_review_count': len(manual_reviews)
            }
            
            fund_usage = {
                'total_available': total_available,
                'total_reserved': total_reserved,
                'available_balance': total_available - total_reserved,
                'utilization_rate': (total_reserved / total_available * 100) if total_available > 0 else 0
            }
            
            anomalies = {
                'overdue_count': len(overdue_plans),
                'overdue_plans': [
                    {
                        'plan_id': p.id,
                        'vendor_name': p.vendor_name,
                        'expected_date': p.expected_payment_date.isoformat() if p.expected_payment_date else None,
                        'current_date': p.current_payment_date.isoformat() if p.current_payment_date else None,
                        'amount': p.total_amount,
                        'status': p.status.value
                    }
                    for p in overdue_plans
                ],
                'delayed_notifications': [
                    {
                        'plan_id': n.payment_plan_id,
                        'original_date': n.original_payment_date.isoformat(),
                        'new_date': n.new_payment_date.isoformat(),
                        'delay_days': n.delay_days,
                        'reason': n.delay_reason,
                        'status': n.status.value
                    }
                    for n in delayed_notifications
                ],
                'manual_reviews': [
                    {
                        'plan_id': p.id,
                        'vendor_name': p.vendor_name,
                        'amount': p.total_amount,
                        'reason': p.remark
                    }
                    for p in manual_reviews
                ]
            }
            
            recommendations = []
            if anomalies['overdue_count'] > 0:
                recommendations.append(f'有{anomalies["overdue_count"]}笔付款计划已逾期，请尽快处理')
            if len(manual_reviews) > 0:
                recommendations.append(f'有{len(manual_reviews)}笔付款计划需要人工复核')
            if fund_usage['utilization_rate'] > 90:
                recommendations.append(f'资金利用率已达{fund_usage["utilization_rate"]:.1f}%，建议补充资金计划')
            
            report['summary'] = summary
            report['fund_usage'] = fund_usage
            report['anomalies'] = anomalies
            report['recommendations'] = recommendations
            report['status'] = 'success'
            report['message'] = f'{report_date.isoformat()} 排程日报已生成'
            
        except Exception as e:
            report['status'] = 'failed'
            report['message'] = f'报表生成失败：{str(e)}'
            report['error'] = str(e)
            report['traceback'] = traceback.format_exc()
            report['retryable'] = True
        
        self._last_report = report
        return report
    
    def get_last_report(self) -> Optional[Dict]:
        """获取上次生成的报表"""
        return self._last_report
    
    def generate_weekly_report(self, start_date: date) -> Dict:
        """
        生成周报表（从start_date开始的7天）
        """
        end_date = start_date + timedelta(days=6)
        
        weekly_summary = {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'daily_reports': [],
            'weekly_summary': {}
        }
        
        current_date = start_date
        while current_date <= end_date:
            daily_report = self.generate_daily_report(current_date)
            weekly_summary['daily_reports'].append(daily_report)
            current_date += timedelta(days=1)
        
        total_amount = sum(r.get('summary', {}).get('total_scheduled_amount', 0) 
                          for r in weekly_summary['daily_reports'] if r.get('status') == 'success')
        total_count = sum(r.get('summary', {}).get('total_scheduled_count', 0) 
                         for r in weekly_summary['daily_reports'] if r.get('status') == 'success')
        
        weekly_summary['weekly_summary'] = {
            'total_scheduled_amount': total_amount,
            'total_scheduled_count': total_count,
            'days_with_reports': len([r for r in weekly_summary['daily_reports'] if r.get('status') == 'success'])
        }
        
        return weekly_summary
