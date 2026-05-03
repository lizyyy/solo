import pandas as pd
from datetime import datetime, time, date
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
import re


class ViolationType(Enum):
    NIGHT_WITHOUT_PERMIT = "夜间无许可施工"
    EXCEED_PERMIT_HOURS = "超出许可施工时间"
    EXCEED_NOISE_LIMIT = "噪声超标"
    UNAUTHORIZED_WORK = "未授权施工"
    MULTIPLE_COMPLAINTS = "多次重复投诉"


@dataclass
class Violation:
    violation_id: str
    violation_type: ViolationType
    severity: str  # "high", "medium", "low"
    description: str
    evidence: Dict[str, Any]
    related_records: List[str] = field(default_factory=list)
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_time: Optional[datetime] = None


def check_time_overlap(
    check_start: datetime,
    check_end: datetime,
    permit_start_time: str,
    permit_end_time: str,
    permitted_night_work: bool = False,
    night_start: str = "22:00",
    night_end: str = "06:00"
) -> Tuple[bool, str, List[Tuple[datetime, datetime, bool]]]:
    """
    检查时间段是否与许可时间重叠
    
    返回:
    - 是否完全在许可时间内
    - 详细描述
    - 重叠时间段列表 (开始时间, 结束时间, 是否违规)
    """
    # 解析时间字符串
    def parse_time(t: str) -> time:
        try:
            return datetime.strptime(t, "%H:%M").time()
        except:
            try:
                return datetime.strptime(t, "%H:%M:%S").time()
            except:
                return time(0, 0)
    
    permit_start = parse_time(permit_start_time)
    permit_end = parse_time(permit_end_time)
    night_start_t = parse_time(night_start)
    night_end_t = parse_time(night_end)
    
    # 转换为分钟数
    def time_to_minutes(t: time) -> int:
        return t.hour * 60 + t.minute
    
    permit_start_m = time_to_minutes(permit_start)
    permit_end_m = time_to_minutes(permit_end)
    night_start_m = time_to_minutes(night_start_t)
    night_end_m = time_to_minutes(night_end_t)
    
    # 生成检查时间段内的所有日期
    days = []
    current = check_start.date()
    end_date = check_end.date()
    while current <= end_date:
        days.append(current)
        current = current.replace(day=current.day + 1) if current.day < current.month else date(current.year, current.month + 1, 1)
        # 简单的日期递增
        try:
            current = current.replace(day=current.day + 1)
        except ValueError:
            # 月底处理
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
    # 修正日期生成
    from datetime import timedelta
    days = []
    current = check_start.date()
    end_date = check_end.date()
    while current <= end_date:
        days.append(current)
        current += timedelta(days=1)
    
    overlap_details = []
    all_legal = True
    
    for day in days:
        # 计算当天的检查时间范围
        day_start = datetime.combine(day, time(0, 0))
        day_end = datetime.combine(day, time(23, 59, 59))
        
        # 与实际检查时间的交集
        segment_start = max(check_start, day_start)
        segment_end = min(check_end, day_end)
        
        if segment_start > segment_end:
            continue
        
        # 按分钟检查
        current_time = segment_start
        while current_time <= segment_end:
            current_minutes = current_time.hour * 60 + current_time.minute
            
            # 判断是否夜间
            is_night = (current_minutes >= night_start_m) or (current_minutes < night_end_m)
            
            if is_night:
                if permitted_night_work:
                    # 有夜间许可，检查夜间时间段
                    legal = True
                else:
                    # 无夜间许可
                    legal = False
                    all_legal = False
            else:
                # 昼间检查
                if permit_start_m <= current_minutes < permit_end_m:
                    legal = True
                else:
                    legal = False
                    all_legal = False
            
            # 记录时间段
            if not overlap_details or overlap_details[-1][2] != legal:
                overlap_details.append((current_time, current_time, legal))
            else:
                # 更新结束时间
                last_start, last_end, last_legal = overlap_details[-1]
                overlap_details[-1] = (last_start, current_time, legal)
            
            # 前进一分钟
            current_time += timedelta(minutes=1)
    
    # 生成描述
    if all_legal:
        description = "所有时间段均在许可施工时间内"
    else:
        illegal_segments = [(s, e) for s, e, l in overlap_details if not l]
        description = f"存在{len(illegal_segments)}个违规时间段"
    
    return all_legal, description, overlap_details


def detect_illegal_construction(
    complaints_df: pd.DataFrame,
    decibel_df: pd.DataFrame,
    permits_df: pd.DataFrame,
    night_threshold: float = 55.0,
    day_threshold: float = 70.0
) -> Tuple[List[Violation], pd.DataFrame]:
    """
    检测疑似违规施工
    
    参数:
    - complaints_df: 投诉数据
    - decibel_df: 分贝仪数据
    - permits_df: 施工许可数据
    - night_threshold: 夜间噪声阈值
    - day_threshold: 昼间噪声阈值
    
    返回:
    - 违规列表
    - 标记了违规的数据框
    """
    violations = []
    violation_id_counter = 1
    
    # 确保必要的列存在
    for df, name in [(complaints_df, 'complaints'), (decibel_df, 'decibel'), (permits_df, 'permits')]:
        if df.empty:
            continue
    
    # 1. 检测夜间无许可施工投诉
    if not complaints_df.empty and 'is_night' in complaints_df.columns:
        night_complaints = complaints_df[complaints_df['is_night'] == True].copy()
        
        for idx, complaint in night_complaints.iterrows():
            # 检查是否有对应许可
            community = complaint.get('community', '')
            noise_source = complaint.get('noise_source', '')
            complaint_time = complaint.get('complaint_time')
            
            if pd.isna(complaint_time):
                continue
            
            # 查找相关许可
            relevant_permits = []
            if not permits_df.empty:
                for _, permit in permits_df.iterrows():
                    # 检查日期范围
                    permit_start = permit.get('permit_start_date')
                    permit_end = permit.get('permit_end_date')
                    
                    if permit_start and permit_end:
                        try:
                            if isinstance(permit_start, str):
                                permit_start = datetime.strptime(permit_start, '%Y-%m-%d').date()
                            if isinstance(permit_end, str):
                                permit_end = datetime.strptime(permit_end, '%Y-%m-%d').date()
                            
                            complaint_date = complaint_time.date()
                            if permit_start <= complaint_date <= permit_end:
                                # 检查是否涉及同一小区
                                permit_community = str(permit.get('community', '')).lower()
                                complaint_community = str(community).lower()
                                
                                if permit_community in complaint_community or complaint_community in permit_community:
                                    relevant_permits.append(permit)
                        except:
                            continue
            
            # 检查是否有夜间施工许可
            has_night_permit = False
            for permit in relevant_permits:
                if permit.get('permitted_night_work', False):
                    has_night_permit = True
                    break
            
            if not has_night_permit and relevant_permits:
                # 发现违规：夜间施工但无夜间许可
                violation = Violation(
                    violation_id=f"V-{violation_id_counter:04d}",
                    violation_type=ViolationType.NIGHT_WITHOUT_PERMIT,
                    severity="high",
                    description=f"小区{community}在夜间收到噪声投诉，但相关施工项目无夜间施工许可",
                    evidence={
                        'complaint_time': str(complaint_time),
                        'complaint_description': str(complaint.get('description', '')),
                        'noise_source': str(noise_source),
                        'relevant_permits': [str(p.get('project_name', '')) for p in relevant_permits]
                    },
                    related_records=[str(complaint.get('complaint_id', ''))]
                )
                violations.append(violation)
                violation_id_counter += 1
    
    # 2. 检测噪声超标
    if not decibel_df.empty and 'exceeds_standard' in decibel_df.columns:
        exceedance_df = decibel_df[decibel_df['exceeds_standard'] == True].copy()
        
        if not exceedance_df.empty:
            # 按地点聚合
            for location in exceedance_df['location'].unique():
                if pd.isna(location):
                    continue
                
                loc_exceed = exceedance_df[exceedance_df['location'] == location]
                exceed_count = len(loc_exceed)
                max_db = loc_exceed['db_value'].max()
                avg_db = loc_exceed['db_value'].mean()
                
                # 判断严重程度
                if max_db > night_threshold + 20:  # 超标20分贝以上
                    severity = "high"
                elif max_db > night_threshold + 10:
                    severity = "medium"
                else:
                    severity = "low"
                
                violation = Violation(
                    violation_id=f"V-{violation_id_counter:04d}",
                    violation_type=ViolationType.EXCEED_NOISE_LIMIT,
                    severity=severity,
                    description=f"地点{location}噪声超标，共{exceed_count}次超标记录，最高{max_db:.1f}分贝",
                    evidence={
                        'location': str(location),
                        'exceedance_count': int(exceed_count),
                        'max_db': float(max_db),
                        'avg_db': float(avg_db),
                        'threshold_night': float(night_threshold),
                        'threshold_day': float(day_threshold)
                    },
                    related_records=[]
                )
                violations.append(violation)
                violation_id_counter += 1
    
    # 3. 检测重复投诉
    if not complaints_df.empty and 'is_duplicate' in complaints_df.columns:
        duplicate_df = complaints_df[complaints_df['is_duplicate'] == True].copy()
        
        if not duplicate_df.empty and 'duplicate_group_id' in duplicate_df.columns:
            for group_id in duplicate_df['duplicate_group_id'].unique():
                if pd.isna(group_id):
                    continue
                
                group_df = duplicate_df[duplicate_df['duplicate_group_id'] == group_id]
                group_size = len(group_df)
                primary_complaint = group_df.iloc[0]
                
                # 判断严重程度
                if group_size >= 5:
                    severity = "high"
                elif group_size >= 3:
                    severity = "medium"
                else:
                    severity = "low"
                
                violation = Violation(
                    violation_id=f"V-{violation_id_counter:04d}",
                    violation_type=ViolationType.MULTIPLE_COMPLAINTS,
                    severity=severity,
                    description=f"小区{primary_complaint.get('community', '未知')}收到{group_size}起重复投诉，噪声源: {primary_complaint.get('noise_source', '未知')}",
                    evidence={
                        'group_size': int(group_size),
                        'community': str(primary_complaint.get('community', '')),
                        'noise_source': str(primary_complaint.get('noise_source', '')),
                        'complaint_times': [str(t) for t in group_df['complaint_time'].tolist() if pd.notna(t)]
                    },
                    related_records=group_df['complaint_id'].tolist()
                )
                violations.append(violation)
                violation_id_counter += 1
    
    # 创建违规摘要DataFrame
    violations_summary = pd.DataFrame([{
        'violation_id': v.violation_id,
        'violation_type': v.violation_type.value,
        'severity': v.severity,
        'description': v.description,
        'is_verified': v.is_verified,
        'verified_by': v.verified_by,
        'verified_time': v.verified_time
    } for v in violations])
    
    return violations, violations_summary


class RuleEngine:
    """
    规则引擎类，用于统一管理和执行各种噪声治理规则
    """
    
    def __init__(
        self,
        night_threshold: float = 55.0,
        day_threshold: float = 70.0,
        night_start_hour: int = 22,
        night_end_hour: int = 6,
        duplicate_time_window_minutes: int = 60
    ):
        self.night_threshold = night_threshold
        self.day_threshold = day_threshold
        self.night_start_hour = night_start_hour
        self.night_end_hour = night_end_hour
        self.duplicate_time_window_minutes = duplicate_time_window_minutes
        
        self.rules = []
        self._register_default_rules()
    
    def _register_default_rules(self):
        """注册默认规则"""
        self.rules.extend([
            {
                'name': '夜间无许可施工检测',
                'type': 'construction_permit',
                'enabled': True,
                'severity': 'high'
            },
            {
                'name': '噪声超标检测',
                'type': 'noise_level',
                'enabled': True,
                'severity': 'medium'
            },
            {
                'name': '重复投诉检测',
                'type': 'duplicate_complaint',
                'enabled': True,
                'severity': 'medium'
            },
            {
                'name': '响应延迟检测',
                'type': 'response_time',
                'enabled': True,
                'severity': 'low'
            }
        ])
    
    def add_rule(self, rule: Dict):
        """添加自定义规则"""
        self.rules.append(rule)
    
    def execute_all(
        self,
        complaints_df: pd.DataFrame,
        decibel_df: pd.DataFrame,
        enforcement_df: pd.DataFrame,
        permits_df: pd.DataFrame
    ) -> Dict:
        """
        执行所有启用的规则
        
        返回包含所有分析结果的字典
        """
        results = {
            'violations': [],
            'statistics': {},
            'alerts': []
        }
        
        # 检测违规
        violations, violations_df = detect_illegal_construction(
            complaints_df, decibel_df, permits_df,
            self.night_threshold, self.day_threshold
        )
        results['violations'] = violations
        results['violations_df'] = violations_df
        
        # 统计信息
        stats = {
            'total_violations': len(violations),
            'high_severity': sum(1 for v in violations if v.severity == 'high'),
            'medium_severity': sum(1 for v in violations if v.severity == 'medium'),
            'low_severity': sum(1 for v in violations if v.severity == 'low'),
            'verified_count': sum(1 for v in violations if v.is_verified)
        }
        results['statistics'] = stats
        
        # 生成警报（高优先级违规）
        high_severity = [v for v in violations if v.severity == 'high']
        for v in high_severity:
            results['alerts'].append({
                'violation_id': v.violation_id,
                'type': v.violation_type.value,
                'description': v.description,
                'severity': 'high'
            })
        
        return results
    
    def check_single_time(
        self,
        check_time: datetime,
        permit_start: str,
        permit_end: str,
        permitted_night: bool
    ) -> Tuple[bool, str]:
        """
        检查单个时间点是否在许可范围内
        
        返回: (是否合法, 原因说明)
        """
        hour = check_time.hour
        minute = check_time.minute
        total_minutes = hour * 60 + minute
        
        # 夜间时间段
        night_start = self.night_start_hour * 60
        night_end = self.night_end_hour * 60
        
        is_night = (total_minutes >= night_start) or (total_minutes < night_end)
        
        if is_night:
            if permitted_night:
                return True, "在夜间施工许可时间内"
            else:
                return False, "夜间施工无许可"
        else:
            # 解析许可时间
            try:
                start_h, start_m = map(int, permit_start.split(':'))
                end_h, end_m = map(int, permit_end.split(':'))
                start_total = start_h * 60 + start_m
                end_total = end_h * 60 + end_m
                
                if start_total <= total_minutes < end_total:
                    return True, "在昼间施工许可时间内"
                else:
                    return False, f"不在昼间施工许可时间内 ({permit_start}-{permit_end})"
            except:
                return False, "无法解析许可时间"
