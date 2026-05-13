from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from alert_reducer.models import DutyHistory, Alert, EscalatedAlert


class DutyManager:
    """值班历史管理器"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create_duty_record(self, oncall_name: str, shift: str = 'day',
                           duty_date: datetime = None, notes: str = None) -> DutyHistory:
        """创建值班记录"""
        duty_date = duty_date or datetime.utcnow()
        
        # 计算统计信息
        stats = self._calculate_duty_stats(duty_date, shift)
        
        duty = DutyHistory(
            duty_date=duty_date,
            oncall_name=oncall_name,
            shift=shift,
            total_alerts=stats['total_alerts'],
            escalated_alerts=stats['escalated_alerts'],
            response_time_avg=stats['response_time_avg'],
            notes=notes
        )
        
        self.session.add(duty)
        self.session.commit()
        
        return duty
    
    def _calculate_duty_stats(self, duty_date: datetime, shift: str) -> Dict[str, Any]:
        """计算值班统计信息"""
        # 确定值班时间范围
        start_time, end_time = self._get_shift_time_range(duty_date, shift)
        
        # 查询该时间段的告警
        total_alerts = self.session.query(Alert).filter(
            Alert.starts_at >= start_time,
            Alert.starts_at <= end_time
        ).count()
        
        # 查询升级的告警
        escalated_alerts = self.session.query(EscalatedAlert).filter(
            EscalatedAlert.created_at >= start_time,
            EscalatedAlert.created_at <= end_time
        ).count()
        
        # 计算平均响应时间（简单估算）
        response_time_avg = None
        
        return {
            'total_alerts': total_alerts,
            'escalated_alerts': escalated_alerts,
            'response_time_avg': response_time_avg
        }
    
    def _get_shift_time_range(self, duty_date: datetime, shift: str) -> tuple:
        """获取班次的时间范围"""
        date = duty_date.date()
        
        if shift == 'night':
            # 夜班：22:00 - 次日06:00
            start_time = datetime.combine(date, datetime.strptime('22:00', '%H:%M').time())
            end_time = datetime.combine(date + timedelta(days=1), datetime.strptime('06:00', '%H:%M').time())
        else:
            # 白班：06:00 - 22:00
            start_time = datetime.combine(date, datetime.strptime('06:00', '%H:%M').time())
            end_time = datetime.combine(date, datetime.strptime('22:00', '%H:%M').time())
        
        return start_time, end_time
    
    def get_duty_history(self, start_date: datetime = None, end_date: datetime = None,
                         oncall_name: str = None, limit: int = 100) -> List[DutyHistory]:
        """获取值班历史"""
        query = self.session.query(DutyHistory)
        
        if start_date:
            query = query.filter(DutyHistory.duty_date >= start_date)
        
        if end_date:
            query = query.filter(DutyHistory.duty_date <= end_date)
        
        if oncall_name:
            query = query.filter(DutyHistory.oncall_name == oncall_name)
        
        return query.order_by(DutyHistory.duty_date.desc()).limit(limit).all()
    
    def update_duty_record(self, duty_id: int, notes: str = None,
                          oncall_name: str = None) -> Optional[DutyHistory]:
        """更新值班记录"""
        duty = self.session.query(DutyHistory).filter(
            DutyHistory.id == duty_id
        ).first()
        
        if not duty:
            return None
        
        if notes is not None:
            duty.notes = notes
        
        if oncall_name is not None:
            duty.oncall_name = oncall_name
        
        self.session.commit()
        return duty
    
    def get_current_duty(self, current_time: datetime = None) -> Optional[DutyHistory]:
        """获取当前值班信息"""
        current_time = current_time or datetime.utcnow()
        current_hour = current_time.hour
        
        # 判断班次
        if 22 <= current_hour or current_hour < 6:
            shift = 'night'
            # 夜班是从前一天开始的
            if current_hour < 6:
                duty_date = current_time - timedelta(days=1)
            else:
                duty_date = current_time
        else:
            shift = 'day'
            duty_date = current_time
        
        # 计算日期范围
        date_start = datetime.combine(duty_date.date(), datetime.min.time())
        date_end = datetime.combine(duty_date.date(), datetime.max.time())
        
        # 查找最近的值班记录
        duty = self.session.query(DutyHistory).filter(
            DutyHistory.duty_date >= date_start,
            DutyHistory.duty_date <= date_end,
            DutyHistory.shift == shift
        ).order_by(DutyHistory.created_at.desc()).first()
        
        return duty
