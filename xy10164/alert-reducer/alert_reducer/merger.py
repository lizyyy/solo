import json
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from alert_reducer.models import Alert, MergedAlert


class AlertMerger:
    """告警合并器"""
    
    def __init__(self, session: Session, merge_window_minutes: int = 15,
                 merge_by_fields: List[str] = None):
        self.session = session
        self.merge_window_minutes = merge_window_minutes
        self.merge_by_fields = merge_by_fields or ['alertname', 'severity', 'job', 'instance']
    
    def _generate_merge_key(self, alert: Alert) -> str:
        """生成合并键"""
        key_parts = []
        for field in self.merge_by_fields:
            value = getattr(alert, field, '') or ''
            key_parts.append(str(value))
        
        # 生成哈希
        key_str = "|".join(key_parts)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def _find_existing_merged_alert(self, alert: Alert, merge_key: str, 
                                     window_end: datetime) -> Optional[MergedAlert]:
        """查找现有的合并告警"""
        # 查找在时间窗口内的合并告警
        existing = self.session.query(MergedAlert).filter(
            MergedAlert.merge_key == merge_key,
            MergedAlert.status.in_(['active', 'escalated']),
            MergedAlert.starts_at <= window_end,
            # 结束时间为空或在窗口内
        ).first()
        
        return existing
    
    def _is_in_merge_window(self, alert: Alert, merged: MergedAlert) -> bool:
        """检查告警是否在合并窗口内"""
        if not merged.starts_at:
            return False
        
        # 计算时间差
        time_diff = (alert.starts_at - merged.starts_at).total_seconds()
        window_seconds = self.merge_window_minutes * 60
        
        # 允许告警在合并告警开始时间之后的窗口内
        return 0 <= time_diff <= window_seconds
    
    def _split_into_windows(self, alerts: List[Alert]) -> List[List[Alert]]:
        """按时间窗口切分告警组"""
        if not alerts:
            return []
        
        # 按时间排序
        sorted_alerts = sorted(alerts, key=lambda a: a.starts_at)
        
        windows = []
        current_window = [sorted_alerts[0]]
        window_start = sorted_alerts[0].starts_at
        window_seconds = self.merge_window_minutes * 60
        
        for alert in sorted_alerts[1:]:
            # 检查当前告警是否在当前窗口内
            time_diff = (alert.starts_at - window_start).total_seconds()
            
            if time_diff <= window_seconds:
                # 在当前窗口内，添加到当前窗口
                current_window.append(alert)
            else:
                # 超出当前窗口，保存当前窗口并开始新窗口
                windows.append(current_window)
                current_window = [alert]
                window_start = alert.starts_at
        
        # 添加最后一个窗口
        if current_window:
            windows.append(current_window)
        
        return windows
    
    def _find_existing_merged_for_window(self, merge_key: str, 
                                          window_start: datetime,
                                          window_end: datetime) -> Optional[MergedAlert]:
        """查找与当前时间窗口重叠的现有合并告警"""
        # 查找在时间范围内的合并告警
        existing = self.session.query(MergedAlert).filter(
            MergedAlert.merge_key == merge_key,
            MergedAlert.status.in_(['active', 'escalated']),
            # 合并告警的时间范围与当前窗口有重叠
            MergedAlert.starts_at <= window_end,
            # 合并告警的结束时间 >= 窗口开始时间（如果结束时间为空，则认为是活跃的）
        ).all()
        
        # 检查哪个合并告警与当前窗口最匹配
        for merged in existing:
            # 如果合并告警还没有结束，或者结束时间在窗口之后
            if not merged.ends_at or merged.ends_at >= window_start:
                # 检查窗口开始时间是否在合并告警的窗口内
                if self._is_alert_in_merged_window(window_start, merged):
                    return merged
        
        return None
    
    def _is_alert_in_merged_window(self, alert_time: datetime, 
                                    merged: MergedAlert) -> bool:
        """检查时间是否在合并告警的窗口内"""
        if not merged.starts_at:
            return False
        
        time_diff = (alert_time - merged.starts_at).total_seconds()
        window_seconds = self.merge_window_minutes * 60
        
        return 0 <= time_diff <= window_seconds
    
    def merge_alerts(self, alerts: List[Alert], batch_id: int = None) -> Dict[str, Any]:
        """合并告警 - 按时间窗口切分"""
        results = {
            'merged_groups': 0,
            'total_merged_alerts': 0,
            'merged_alerts': []
        }
        
        # 按合并键分组
        merge_groups: Dict[str, List[Alert]] = {}
        
        for alert in alerts:
            # 只处理未处理的告警
            if alert.status != 'pending':
                continue
            
            merge_key = self._generate_merge_key(alert)
            
            if merge_key not in merge_groups:
                merge_groups[merge_key] = []
            merge_groups[merge_key].append(alert)
        
        # 处理每个分组
        for merge_key, group_alerts in merge_groups.items():
            if len(group_alerts) == 0:
                continue
            
            # 按时间窗口切分
            windows = self._split_into_windows(group_alerts)
            
            # 处理每个时间窗口
            for window_alerts in windows:
                if not window_alerts:
                    continue
                
                # 按时间排序
                window_alerts.sort(key=lambda a: a.starts_at)
                
                # 计算窗口时间范围
                window_start = window_alerts[0].starts_at
                window_end = window_start + timedelta(minutes=self.merge_window_minutes)
                
                # 检查是否已有匹配的合并告警
                existing_merged = self._find_existing_merged_for_window(
                    merge_key, window_start, window_end
                )
                
                if existing_merged:
                    # 更新现有合并告警
                    self._update_merged_alert(existing_merged, window_alerts, batch_id)
                    results['merged_alerts'].append({
                        'id': existing_merged.id,
                        'merge_key': merge_key,
                        'alert_count': existing_merged.alert_count,
                        'is_new': False,
                        'window_start': window_start.isoformat(),
                        'window_end': window_end.isoformat()
                    })
                else:
                    # 创建新的合并告警
                    merged_alert = self._create_merged_alert(merge_key, window_alerts, batch_id)
                    results['merged_groups'] += 1
                    results['merged_alerts'].append({
                        'id': merged_alert.id,
                        'merge_key': merge_key,
                        'alert_count': merged_alert.alert_count,
                        'is_new': True,
                        'window_start': window_start.isoformat(),
                        'window_end': window_end.isoformat()
                    })
                
                results['total_merged_alerts'] += len(window_alerts)
        
        self.session.commit()
        return results
    
    def _create_merged_alert(self, merge_key: str, alerts: List[Alert], 
                             batch_id: int = None) -> MergedAlert:
        """创建新的合并告警"""
        if not alerts:
            return None
        
        # 按时间排序
        alerts.sort(key=lambda a: a.starts_at)
        
        # 获取告警的优先级（取最高优先级）
        severity_order = {'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4, 'P5': 5, 'info': 6, 'debug': 7}
        sorted_by_severity = sorted(alerts, key=lambda a: severity_order.get(a.severity, 99))
        highest_severity = sorted_by_severity[0].severity if sorted_by_severity else None
        
        # 获取告警名称（使用第一个告警的名称）
        alertname = alerts[0].alertname if alerts else None
        
        # 创建合并告警
        merged = MergedAlert(
            merge_key=merge_key,
            alert_count=len(alerts),
            starts_at=alerts[0].starts_at,
            ends_at=alerts[-1].ends_at if alerts[-1].ends_at else None,
            severity=highest_severity,
            alertname=alertname,
            status='active',
            batch_id=batch_id
        )
        
        self.session.add(merged)
        self.session.flush()
        
        # 更新原始告警
        for alert in alerts:
            alert.merged_alert_id = merged.id
            alert.status = 'merged'
        
        return merged
    
    def _update_merged_alert(self, merged: MergedAlert, alerts: List[Alert],
                             batch_id: int = None):
        """更新现有合并告警"""
        # 过滤出在合并窗口内的告警
        alerts_to_merge = [
            a for a in alerts 
            if self._is_in_merge_window(a, merged)
        ]
        
        if not alerts_to_merge:
            return
        
        # 更新合并告警
        merged.alert_count += len(alerts_to_merge)
        
        # 更新结束时间
        latest_end = max(
            [a.ends_at for a in alerts_to_merge if a.ends_at] + 
            ([merged.ends_at] if merged.ends_at else [])
        )
        if latest_end:
            merged.ends_at = latest_end
        
        # 更新批次ID
        if batch_id:
            merged.batch_id = batch_id
        
        # 更新原始告警
        for alert in alerts_to_merge:
            alert.merged_alert_id = merged.id
            alert.status = 'merged'
    
    def get_merged_alerts(self, status: str = None, start_time: datetime = None,
                          end_time: datetime = None) -> List[MergedAlert]:
        """获取合并告警"""
        query = self.session.query(MergedAlert)
        
        if status:
            query = query.filter(MergedAlert.status == status)
        
        if start_time:
            query = query.filter(MergedAlert.starts_at >= start_time)
        
        if end_time:
            query = query.filter(MergedAlert.starts_at <= end_time)
        
        return query.order_by(MergedAlert.starts_at.desc()).all()
