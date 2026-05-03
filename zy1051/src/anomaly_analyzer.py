import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class AnomalyType(Enum):
    FREQUENT_DELAY = "频繁晚点"
    STATION_CONSECUTIVE_DELAY = "站点连续晚点"
    HIGH_UTILIZATION = "高满载率"
    FREQUENT_OVERLOAD = "频繁超载"
    LARGE_DELAY_VARIANCE = "延误波动大"
    PEAK_HOUR_PROBLEM = "高峰时段问题"

@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: str
    location: str
    description: str
    cause_analysis: str
    suggestion: str
    metrics: Dict
    affected_records: pd.DataFrame

class AnomalyAnalyzer:
    CONSECUTIVE_DELAY_THRESHOLD = 3
    HIGH_UTILIZATION_THRESHOLD = 0.9
    OVERLOAD_FREQUENCY_THRESHOLD = 0.1
    DELAY_VARIANCE_THRESHOLD = 8
    FREQUENT_DELAY_RATE = 0.3
    
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.anomalies: List[Anomaly] = []
    
    def analyze_all(self) -> List[Anomaly]:
        self.anomalies = []
        
        self._analyze_frequent_delays()
        self._analyze_consecutive_delays()
        self._analyze_high_utilization()
        self._analyze_frequent_overloads()
        self._analyze_delay_variance()
        self._analyze_peak_hour_problems()
        
        return self.anomalies
    
    def _get_severity(self, score: float) -> str:
        if score >= 0.7:
            return "严重"
        elif score >= 0.4:
            return "中等"
        else:
            return "轻微"
    
    def _analyze_frequent_delays(self):
        route_groups = self.df.groupby('线路')
        
        for route, group in route_groups:
            delay_rate = group['是否严重延误'].mean()
            total_records = len(group)
            severe_delays = group['是否严重延误'].sum()
            
            if delay_rate >= self.FREQUENT_DELAY_RATE:
                avg_delay = group[group['最大延误_分钟'].notna()]['最大延误_分钟'].mean()
                max_delay = group[group['最大延误_分钟'].notna()]['最大延误_分钟'].max()
                
                affected = group[group['是否严重延误']].copy()
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.FREQUENT_DELAY,
                    severity=self._get_severity(delay_rate),
                    location=f"线路: {route}",
                    description=f"线路 {route} 严重晚点率达到 {delay_rate*100:.1f}%，共 {severe_delays}/{total_records} 次严重延误",
                    cause_analysis=self._analyze_delay_causes(affected),
                    suggestion=self._generate_delay_suggestion(route, affected),
                    metrics={
                        '严重晚点率': f"{delay_rate*100:.1f}%",
                        '平均延误': f"{avg_delay:.1f}分钟",
                        '最大延误': f"{max_delay:.1f}分钟",
                        '影响次数': severe_delays
                    },
                    affected_records=affected
                )
                self.anomalies.append(anomaly)
    
    def _analyze_delay_causes(self, affected_df: pd.DataFrame) -> str:
        if affected_df.empty:
            return "暂无详细原因分析"
        
        remark_counts = affected_df['司机备注'].value_counts()
        causes = []
        
        if len(remark_counts) > 0:
            top_remark = remark_counts.index[0]
            if top_remark != '正常':
                causes.append(f"司机备注中最常见的原因是: '{top_remark}'")
        
        peak_periods = affected_df['时段'].value_counts()
        if len(peak_periods) > 0:
            top_period = peak_periods.index[0]
            causes.append(f"主要发生在{top_period}时段")
        
        if not causes:
            return "需要进一步调查具体原因，建议检查该时段的路况和调度情况"
        
        return "；".join(causes)
    
    def _generate_delay_suggestion(self, route: str, affected_df: pd.DataFrame) -> str:
        peak_periods = affected_df['时段'].value_counts()
        
        suggestions = []
        
        if len(peak_periods) > 0:
            top_period = peak_periods.index[0]
            if top_period in ['早高峰', '晚高峰']:
                suggestions.append(f"建议在{top_period}时段提前10-15分钟发车，避开高峰期拥堵")
                suggestions.append("考虑调配备用车辆应对突发情况")
            else:
                suggestions.append("建议排查该时段的固定路况问题，是否有施工或常态化拥堵点")
        
        remarks = affected_df['司机备注'].unique()
        for remark in remarks:
            if '堵车' in str(remark) or '拥堵' in str(remark):
                suggestions.append("建议优化行车路线，避开常态化拥堵路段")
            elif '车辆故障' in str(remark):
                suggestions.append("建议加强车辆定期维护，减少故障发生率")
            elif '天气' in str(remark):
                suggestions.append("恶劣天气时应提前发布通知，适当延长行车时间")
        
        if not suggestions:
            suggestions.append("建议加强司机调度管理，提前预判可能的延误情况")
        
        return "；".join(suggestions)
    
    def _analyze_consecutive_delays(self):
        station_date_groups = self.df.groupby(['线路', '站点', '日期'])
        
        station_stats = {}
        
        for (route, station, date), group in station_date_groups:
            key = (route, station)
            if key not in station_stats:
                station_stats[key] = {
                    'total_days': 0,
                    'delay_days': 0,
                    'dates_with_delays': [],
                    'total_records': 0,
                    'total_delays': 0
                }
            
            has_delay = (group['最大延误_分钟'] > 5).any()
            station_stats[key]['total_days'] += 1
            station_stats[key]['total_records'] += len(group)
            station_stats[key]['total_delays'] += (group['最大延误_分钟'] > 5).sum()
            
            if has_delay:
                station_stats[key]['delay_days'] += 1
                station_stats[key]['dates_with_delays'].append(date)
        
        for (route, station), stats in station_stats.items():
            delay_rate = stats['delay_days'] / stats['total_days'] if stats['total_days'] > 0 else 0
            
            if delay_rate >= 0.5 and stats['delay_days'] >= self.CONSECUTIVE_DELAY_THRESHOLD:
                dates_sorted = sorted(stats['dates_with_delays'])
                consecutive_count = 1
                max_consecutive = 1
                
                for i in range(1, len(dates_sorted)):
                    d1 = datetime.strptime(dates_sorted[i-1], '%Y-%m-%d')
                    d2 = datetime.strptime(dates_sorted[i], '%Y-%m-%d')
                    if (d2 - d1).days == 1:
                        consecutive_count += 1
                        max_consecutive = max(max_consecutive, consecutive_count)
                    else:
                        consecutive_count = 1
                
                affected = self.df[
                    (self.df['线路'] == route) & 
                    (self.df['站点'] == station) & 
                    (self.df['最大延误_分钟'] > 5)
                ].copy()
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.STATION_CONSECUTIVE_DELAY,
                    severity=self._get_severity(delay_rate),
                    location=f"站点: {route} - {station}",
                    description=f"站点 {station}（{route}）在 {stats['delay_days']}/{stats['total_days']} 天存在晚点，最长连续 {max_consecutive} 天",
                    cause_analysis="该站点可能存在常态化问题，如：站点位置拥堵、乘客上下车效率低、红绿灯等待时间过长等",
                    suggestion=f"建议：1）实地考察 {station} 站点周边路况；2）评估是否需要调整站点位置；3）在高峰时段安排站点助理协助上下车；4）考虑为该站点增加预留时间",
                    metrics={
                        '晚点天数占比': f"{delay_rate*100:.1f}%",
                        '最长连续晚点天数': max_consecutive,
                        '总晚点记录': stats['total_delays']
                    },
                    affected_records=affected
                )
                self.anomalies.append(anomaly)
    
    def _analyze_high_utilization(self):
        route_station_groups = self.df.groupby(['线路', '站点'])
        
        for (route, station), group in route_station_groups:
            high_util_rate = (group['座位利用率'] >= self.HIGH_UTILIZATION_THRESHOLD).mean()
            total_records = len(group)
            high_util_count = (group['座位利用率'] >= self.HIGH_UTILIZATION_THRESHOLD).sum()
            
            if high_util_rate >= 0.3 and high_util_count >= 3:
                avg_util = group[group['座位利用率'].notna()]['座位利用率'].mean()
                
                affected = group[group['座位利用率'] >= self.HIGH_UTILIZATION_THRESHOLD].copy()
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.HIGH_UTILIZATION,
                    severity=self._get_severity(high_util_rate),
                    location=f"站点: {route} - {station}",
                    description=f"站点 {station}（{route}）高满载率（≥90%）比例达 {high_util_rate*100:.1f}%，共 {high_util_count}/{total_records} 次",
                    cause_analysis=self._analyze_utilization_causes(affected),
                    suggestion=self._generate_utilization_suggestion(route, station, affected),
                    metrics={
                        '高满载率占比': f"{high_util_rate*100:.1f}%",
                        '平均座位利用率': f"{avg_util*100:.1f}%",
                        '影响次数': high_util_count
                    },
                    affected_records=affected
                )
                self.anomalies.append(anomaly)
    
    def _analyze_utilization_causes(self, affected_df: pd.DataFrame) -> str:
        peak_periods = affected_df['时段'].value_counts()
        causes = []
        
        if len(peak_periods) > 0:
            top_period = peak_periods.index[0]
            period_count = peak_periods.iloc[0]
            total = len(affected_df)
            causes.append(f"{period_count}/{total} 的高满载发生在{top_period}时段")
        
        dates = affected_df['日期'].value_counts()
        if len(dates) >= 3:
            causes.append("高满载情况在多个日期持续出现，可能是常态化需求")
        
        if not causes:
            return "需要进一步分析需求分布"
        
        return "；".join(causes)
    
    def _generate_utilization_suggestion(self, route: str, station: str, affected_df: pd.DataFrame) -> str:
        peak_periods = affected_df['时段'].value_counts()
        suggestions = []
        
        if len(peak_periods) > 0:
            top_period = peak_periods.index[0]
            suggestions.append(f"建议在{top_period}时段增加 {route} 的发车班次")
        
        suggestions.append(f"考虑更换 {route} 为更大容量的车型")
        suggestions.append(f"评估 {station} 站点的需求，是否需要增设区间车")
        suggestions.append("建议收集员工通勤需求，优化线路规划")
        
        return "；".join(suggestions)
    
    def _analyze_frequent_overloads(self):
        route_groups = self.df.groupby('线路')
        
        for route, group in route_groups:
            overload_rate = group['是否超载'].mean()
            total_records = len(group)
            overload_count = group['是否超载'].sum()
            
            if overload_rate >= self.OVERLOAD_FREQUENCY_THRESHOLD and overload_count >= 2:
                avg_overload = group[group['是否超载']].apply(
                    lambda x: x['签到人数'] - x['座位数'], axis=1
                ).mean() if '签到人数' in group.columns else 0
                
                affected = group[group['是否超载']].copy()
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.FREQUENT_OVERLOAD,
                    severity=self._get_severity(overload_rate * 2),
                    location=f"线路: {route}",
                    description=f"线路 {route} 超载率达 {overload_rate*100:.1f}%，共 {overload_count}/{total_records} 次超载",
                    cause_analysis="超载表明该线路的运力无法满足当前需求，可能原因：高峰时段需求集中、车型容量不足、发车间隔过长",
                    suggestion=f"紧急建议：1）立即为 {route} 增加高峰时段班次；2）临时调配更大容量车辆；3）长期方案：评估需求，优化线路或增加运力投入",
                    metrics={
                        '超载率': f"{overload_rate*100:.1f}%",
                        '平均超载人数': f"{avg_overload:.1f}人",
                        '超载次数': overload_count
                    },
                    affected_records=affected
                )
                self.anomalies.append(anomaly)
    
    def _analyze_delay_variance(self):
        route_groups = self.df.groupby('线路')
        
        for route, group in route_groups:
            valid_delays = group[group['最大延误_分钟'].notna()]['最大延误_分钟']
            if len(valid_delays) < 5:
                continue
            
            delay_std = valid_delays.std()
            delay_mean = valid_delays.mean()
            cv = delay_std / delay_mean if delay_mean > 0 else 0
            
            if delay_std >= self.DELAY_VARIANCE_THRESHOLD and cv >= 0.5:
                affected = group[group['最大延误_分钟'] >= delay_mean + delay_std].copy()
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.LARGE_DELAY_VARIANCE,
                    severity=self._get_severity(min(cv, 1)),
                    location=f"线路: {route}",
                    description=f"线路 {route} 延误波动大，标准差 {delay_std:.1f} 分钟，变异系数 {cv:.2f}",
                    cause_analysis="延误波动大表明该线路受不确定因素影响较大，可能原因：路况不稳定、突发事故频发、天气影响大、调度不规律",
                    suggestion=f"建议：1）分析波动较大的时段和日期，找出规律；2）在波动时段增加备用车辆；3）与司机沟通，了解实际运营中的不确定因素；4）考虑建立应急预案",
                    metrics={
                        '平均延误': f"{delay_mean:.1f}分钟",
                        '延误标准差': f"{delay_std:.1f}分钟",
                        '变异系数': f"{cv:.2f}"
                    },
                    affected_records=affected
                )
                self.anomalies.append(anomaly)
    
    def _analyze_peak_hour_problems(self):
        peak_periods = ['早高峰', '晚高峰']
        
        for period in peak_periods:
            period_df = self.df[self.df['时段'] == period]
            if period_df.empty:
                continue
            
            overall_df = self.df[self.df['时段'].isin(['早高峰', '晚高峰', '平峰'])]
            if overall_df.empty:
                continue
            
            period_delay_rate = period_df['是否严重延误'].mean()
            overall_delay_rate = overall_df['是否严重延误'].mean()
            
            period_util_rate = (period_df['座位利用率'] >= 0.9).mean()
            overall_util_rate = (overall_df['座位利用率'] >= 0.9).mean()
            
            delay_ratio = period_delay_rate / overall_delay_rate if overall_delay_rate > 0 else 1
            util_ratio = period_util_rate / overall_util_rate if overall_util_rate > 0 else 1
            
            if delay_ratio >= 1.5 or util_ratio >= 1.5:
                affected = period_df.copy()
                
                problem_desc = []
                if delay_ratio >= 1.5:
                    problem_desc.append(f"严重晚点率是平峰期的 {delay_ratio:.1f} 倍")
                if util_ratio >= 1.5:
                    problem_desc.append(f"高满载率是平峰期的 {util_ratio:.1f} 倍")
                
                anomaly = Anomaly(
                    anomaly_type=AnomalyType.PEAK_HOUR_PROBLEM,
                    severity=self._get_severity(max(delay_ratio, util_ratio) / 3),
                    location=f"时段: {period}",
                    description=f"{period}问题突出：{'；'.join(problem_desc)}",
                    cause_analysis=f"{period}是通勤需求最集中的时段，路况拥堵+需求集中双重压力导致问题频发",
                    suggestion=f"建议针对{period}：1）提前15-30分钟开始发车，分流需求；2）增加20%-30%的运力；3）鼓励错峰通勤；4）与交管部门沟通，优化{period}的交通管控",
                    metrics={
                        f'{period}严重晚点率': f"{period_delay_rate*100:.1f}%",
                        f'{period}高满载率': f"{period_util_rate*100:.1f}%",
                        '晚点率相对倍数': f"{delay_ratio:.1f}x",
                        '满载率相对倍数': f"{util_ratio:.1f}x"
                    },
                    affected_records=affected
                )
                self.anomalies.append(anomaly)
    
    def get_anomalies_by_severity(self) -> Dict[str, List[Anomaly]]:
        result = {'严重': [], '中等': [], '轻微': []}
        for anomaly in self.anomalies:
            result[anomaly.severity].append(anomaly)
        return result
    
    def get_summary(self) -> Dict:
        by_severity = self.get_anomalies_by_severity()
        
        return {
            '总异常数': len(self.anomalies),
            '严重异常数': len(by_severity['严重']),
            '中等异常数': len(by_severity['中等']),
            '轻微异常数': len(by_severity['轻微']),
            '异常分类统计': self._get_type_stats()
        }
    
    def _get_type_stats(self) -> Dict:
        type_counts = {}
        for anomaly in self.anomalies:
            type_name = anomaly.anomaly_type.value
            if type_name not in type_counts:
                type_counts[type_name] = 0
            type_counts[type_name] += 1
        return type_counts
