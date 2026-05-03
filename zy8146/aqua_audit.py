#!/usr/bin/env python3
"""
水产养殖投喂增氧复盘CLI工具
用于分析池塘投喂、溶氧数据，检测风险并生成报告
"""

import argparse
import csv
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple

import yaml
from dateutil.parser import parse as parse_datetime


class DataLoader:
    """数据加载器"""
    
    def __init__(self, rules_path: str):
        with open(rules_path, 'r', encoding='utf-8') as f:
            self.rules = yaml.safe_load(f)
    
    def load_ponds(self, ponds_path: str) -> Dict[str, Dict]:
        """加载池塘信息"""
        ponds = {}
        with open(ponds_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                ponds[row['pond_id']] = {
                    'pond_id': row['pond_id'],
                    'pond_name': row['pond_name'],
                    'area_sqm': float(row['area_sqm']),
                    'aerator_count': int(row['aerator_count']),
                    'stock_density': int(row['stock_density']),
                    'species': row['species']
                }
        return ponds
    
    def load_feed_events(self, feed_path: str) -> List[Dict]:
        """加载投喂事件"""
        events = []
        with open(feed_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    event = json.loads(line)
                    event['timestamp'] = parse_datetime(event['timestamp'])
                    events.append(event)
        return sorted(events, key=lambda x: x['timestamp'])
    
    def load_oxygen_readings(self, oxygen_path: str) -> List[Dict]:
        """加载溶氧读数"""
        readings = []
        with open(oxygen_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                readings.append({
                    'pond_id': row['pond_id'],
                    'timestamp': parse_datetime(row['timestamp']),
                    'oxygen_mg_l': float(row['oxygen_mg_l']),
                    'temperature_c': float(row['temperature_c']),
                    'aerator_status': int(row['aerator_status'])
                })
        return sorted(readings, key=lambda x: x['timestamp'])


class TimelineReconstructor:
    """时间线重建器"""
    
    def __init__(self, rules: Dict):
        self.rules = rules
    
    def group_by_pond(self, readings: List[Dict], feed_events: List[Dict]) -> Dict[str, Dict]:
        """按池塘分组数据"""
        pond_data = {}
        
        for reading in readings:
            pond_id = reading['pond_id']
            if pond_id not in pond_data:
                pond_data[pond_id] = {
                    'readings': [],
                    'feed_events': []
                }
            pond_data[pond_id]['readings'].append(reading)
        
        for event in feed_events:
            pond_id = event['pond_id']
            if pond_id not in pond_data:
                pond_data[pond_id] = {
                    'readings': [],
                    'feed_events': []
                }
            pond_data[pond_id]['feed_events'].append(event)
        
        return pond_data
    
    def build_pond_timeline(self, pond_data: Dict) -> List[Dict]:
        """构建单个池塘的时间线"""
        timeline = []
        
        for reading in pond_data.get('readings', []):
            timeline.append({
                'type': 'oxygen_reading',
                'timestamp': reading['timestamp'],
                'data': reading
            })
        
        for event in pond_data.get('feed_events', []):
            timeline.append({
                'type': 'feed_event',
                'timestamp': event['timestamp'],
                'data': event
            })
        
        return sorted(timeline, key=lambda x: x['timestamp'])
    
    def interpolate_missing_readings(self, readings: List[Dict], expected_interval_minutes: int) -> Tuple[List[Dict], List[Dict]]:
        """插值缺失读数，返回填充后的读数和标记的缺失点"""
        if not readings:
            return [], []
        
        filled = []
        gaps = []
        prev = None
        
        for reading in readings:
            if prev is not None:
                gap_minutes = (reading['timestamp'] - prev['timestamp']).total_seconds() / 60
                expected_gap = expected_interval_minutes
                
                while gap_minutes > expected_gap * 1.5:
                    interpolated_time = prev['timestamp'] + timedelta(minutes=expected_gap)
                    gaps.append({
                        'start_time': prev['timestamp'],
                        'end_time': reading['timestamp'],
                        'gap_minutes': gap_minutes,
                        'expected_interval': expected_gap
                    })
                    
                    interpolated_reading = {
                        'pond_id': reading['pond_id'],
                        'timestamp': interpolated_time,
                        'oxygen_mg_l': prev['oxygen_mg_l'],
                        'temperature_c': prev['temperature_c'],
                        'aerator_status': prev['aerator_status'],
                        'is_interpolated': True
                    }
                    filled.append(interpolated_reading)
                    
                    prev = interpolated_reading
                    gap_minutes = (reading['timestamp'] - prev['timestamp']).total_seconds() / 60
            
            filled.append(reading)
            prev = reading
        
        return filled, gaps


class RiskDetector:
    """风险检测器"""
    
    def __init__(self, rules: Dict):
        self.rules = rules
        self.issues = []
    
    def _add_issue(self, pond_id: str, issue_type: str, severity: str, 
                   description: str, timestamp: Optional[datetime] = None,
                   details: Optional[Dict] = None):
        """添加问题记录"""
        self.issues.append({
            'pond_id': pond_id,
            'issue_type': issue_type,
            'severity': severity,
            'description': description,
            'timestamp': timestamp,
            'details': details or {}
        })
    
    def detect_low_oxygen_feeding(self, pond_id: str, feed_events: List[Dict], 
                                   readings: List[Dict]) -> None:
        """检测低氧时投喂"""
        min_oxygen = self.rules['feeding_rules']['minimum_oxygen_required']
        
        for event in feed_events:
            feed_time = event['timestamp']
            
            relevant_readings = [
                r for r in readings 
                if abs((r['timestamp'] - feed_time).total_seconds()) < 3600
            ]
            
            if relevant_readings:
                avg_oxygen = sum(r['oxygen_mg_l'] for r in relevant_readings) / len(relevant_readings)
                
                if avg_oxygen < min_oxygen:
                    self._add_issue(
                        pond_id=pond_id,
                        issue_type='low_oxygen_feeding',
                        severity='high',
                        description=f'低氧时投喂，溶氧值{avg_oxygen:.1f}mg/L低于阈值{min_oxygen}mg/L',
                        timestamp=feed_time,
                        details={
                            'oxygen_level': avg_oxygen,
                            'threshold': min_oxygen,
                            'feed_amount': event['amount_kg'],
                            'operator': event.get('operator', '未知')
                        }
                    )
    
    def detect_aerator_missed(self, pond_id: str, readings: List[Dict]) -> None:
        """检测增氧机漏开"""
        auto_on_below = self.rules['aerator_rules']['auto_on_below']
        grace_period = self.rules['aerator_rules']['grace_period_minutes']
        
        low_oxygen_periods = []
        current_low_start = None
        aerator_off_during_low = False
        
        for i, reading in enumerate(readings):
            if reading['oxygen_mg_l'] < auto_on_below:
                if current_low_start is None:
                    current_low_start = reading['timestamp']
                if reading['aerator_status'] == 0:
                    aerator_off_during_low = True
            else:
                if current_low_start is not None and aerator_off_during_low:
                    duration = (reading['timestamp'] - current_low_start).total_seconds() / 60
                    
                    if duration > grace_period:
                        low_oxygen_periods.append({
                            'start': current_low_start,
                            'end': reading['timestamp'],
                            'duration_minutes': duration
                        })
                current_low_start = None
                aerator_off_during_low = False
        
        if current_low_start is not None and aerator_off_during_low:
            last_reading = readings[-1]
            duration = (last_reading['timestamp'] - current_low_start).total_seconds() / 60
            if duration > grace_period:
                low_oxygen_periods.append({
                    'start': current_low_start,
                    'end': last_reading['timestamp'],
                    'duration_minutes': duration
                })
        
        for period in low_oxygen_periods:
            self._add_issue(
                pond_id=pond_id,
                issue_type='aerator_missed',
                severity='high',
                description=f'低氧期间增氧机未开启，持续{period["duration_minutes"]:.0f}分钟，溶氧低于{auto_on_below}mg/L',
                timestamp=period['start'],
                details={
                    'start_time': period['start'].isoformat(),
                    'end_time': period['end'].isoformat(),
                    'duration_minutes': period['duration_minutes'],
                    'threshold': auto_on_below
                }
            )
    
    def detect_duplicate_feeding(self, pond_id: str, feed_events: List[Dict]) -> None:
        """检测重复投喂"""
        min_interval = self.rules['feeding_rules']['minimum_interval_minutes']
        
        for i, event in enumerate(feed_events):
            for j in range(i + 1, len(feed_events)):
                other_event = feed_events[j]
                time_diff = (other_event['timestamp'] - event['timestamp']).total_seconds() / 60
                
                if time_diff < min_interval:
                    self._add_issue(
                        pond_id=pond_id,
                        issue_type='duplicate_feeding',
                        severity='medium',
                        description=f'重复投喂，两次投喂间隔{time_diff:.0f}分钟，低于最小间隔{min_interval}分钟',
                        timestamp=event['timestamp'],
                        details={
                            'first_feed_time': event['timestamp'].isoformat(),
                            'second_feed_time': other_event['timestamp'].isoformat(),
                            'interval_minutes': time_diff,
                            'first_amount': event['amount_kg'],
                            'second_amount': other_event['amount_kg'],
                            'first_operator': event.get('operator', '未知'),
                            'second_operator': other_event.get('operator', '未知')
                        }
                    )
    
    def detect_sensor_gaps(self, pond_id: str, readings: List[Dict]) -> None:
        """检测传感器断采"""
        max_gap = self.rules['sensor_rules']['max_gap_minutes']
        expected_interval = self.rules['sensor_rules']['expected_interval_minutes']
        
        for i in range(1, len(readings)):
            prev = readings[i - 1]
            curr = readings[i]
            
            gap_minutes = (curr['timestamp'] - prev['timestamp']).total_seconds() / 60
            
            if gap_minutes > max_gap:
                missing_readings = int(gap_minutes / expected_interval)
                
                self._add_issue(
                    pond_id=pond_id,
                    issue_type='sensor_gap',
                    severity='medium',
                    description=f'传感器断采，数据间隔{gap_minutes:.0f}分钟，超过阈值{max_gap}分钟',
                    timestamp=prev['timestamp'],
                    details={
                        'start_time': prev['timestamp'].isoformat(),
                        'end_time': curr['timestamp'].isoformat(),
                        'gap_minutes': gap_minutes,
                        'max_threshold': max_gap,
                        'missing_readings_count': missing_readings
                    }
                )
    
    def detect_excessive_feeds(self, pond_id: str, feed_events: List[Dict]) -> None:
        """检测过度投喂（超过每日最大次数）"""
        max_feeds = self.rules['feeding_rules']['maximum_feeds_per_day']
        
        if not feed_events:
            return
        
        feeds_by_day = {}
        for event in feed_events:
            day_key = event['timestamp'].date()
            if day_key not in feeds_by_day:
                feeds_by_day[day_key] = []
            feeds_by_day[day_key].append(event)
        
        for day, day_feeds in feeds_by_day.items():
            if len(day_feeds) > max_feeds:
                self._add_issue(
                    pond_id=pond_id,
                    issue_type='excessive_feeding',
                    severity='medium',
                    description=f'当日投喂次数{len(day_feeds)}次，超过每日最大限制{max_feeds}次',
                    timestamp=day_feeds[0]['timestamp'],
                    details={
                        'date': day.isoformat(),
                        'feed_count': len(day_feeds),
                        'max_limit': max_feeds,
                        'total_amount_kg': sum(f['amount_kg'] for f in day_feeds)
                    }
                )
    
    def analyze_pond(self, pond_id: str, pond_data: Dict) -> None:
        """分析单个池塘"""
        readings = pond_data.get('readings', [])
        feed_events = pond_data.get('feed_events', [])
        
        self.detect_low_oxygen_feeding(pond_id, feed_events, readings)
        self.detect_aerator_missed(pond_id, readings)
        self.detect_duplicate_feeding(pond_id, feed_events)
        self.detect_sensor_gaps(pond_id, readings)
        self.detect_excessive_feeds(pond_id, feed_events)
    
    def get_issues(self) -> List[Dict]:
        """获取所有问题"""
        return self.issues


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self, rules: Dict):
        self.rules = rules
    
    def generate_issues_csv(self, issues: List[Dict], output_path: str) -> None:
        """生成问题CSV文件"""
        fieldnames = [
            'pond_id', 'issue_type', 'severity', 'description',
            'timestamp', 'details_json'
        ]
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for issue in issues:
                writer.writerow({
                    'pond_id': issue['pond_id'],
                    'issue_type': issue['issue_type'],
                    'severity': issue['severity'],
                    'description': issue['description'],
                    'timestamp': issue['timestamp'].isoformat() if issue['timestamp'] else '',
                    'details_json': json.dumps(issue['details'], ensure_ascii=False)
                })
        
        print(f"问题报告已生成: {output_path}")
    
    def generate_pond_report(self, ponds: Dict[str, Dict], pond_data: Dict[str, Dict],
                              issues: List[Dict], output_path: str, analysis_date: datetime) -> None:
        """生成池塘报告Markdown文件"""
        issues_by_pond = {}
        for issue in issues:
            pond_id = issue['pond_id']
            if pond_id not in issues_by_pond:
                issues_by_pond[pond_id] = []
            issues_by_pond[pond_id].append(issue)
        
        high_count = sum(1 for i in issues if i['severity'] == 'high')
        medium_count = sum(1 for i in issues if i['severity'] == 'medium')
        low_count = sum(1 for i in issues if i['severity'] == 'low')
        
        report = []
        report.append("# 水产养殖投喂增氧复盘报告")
        report.append("")
        report.append(f"**分析日期**: {analysis_date.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"**分析池塘数**: {len(ponds)}")
        report.append(f"**发现问题数**: {len(issues)}")
        report.append(f"  - 高风险: {high_count}")
        report.append(f"  - 中风险: {medium_count}")
        report.append(f"  - 低风险: {low_count}")
        report.append("")
        report.append("---")
        report.append("")
        
        issue_type_names = {
            'low_oxygen_feeding': '低氧投喂',
            'aerator_missed': '增氧漏开',
            'duplicate_feeding': '重复投喂',
            'sensor_gap': '传感器断采',
            'excessive_feeding': '过度投喂'
        }
        
        for pond_id, pond_info in ponds.items():
            report.append(f"## 池塘: {pond_info['pond_name']} ({pond_id})")
            report.append("")
            report.append(f"**面积**: {pond_info['area_sqm']} 平方米")
            report.append(f"**增氧机数量**: {pond_info['aerator_count']} 台")
            report.append(f"**养殖密度**: {pond_info['stock_density']} 尾/亩")
            report.append(f"**养殖品种**: {pond_info['species']}")
            report.append("")
            
            pd = pond_data.get(pond_id, {})
            readings = pd.get('readings', [])
            feed_events = pd.get('feed_events', [])
            
            report.append(f"**溶氧读数**: {len(readings)} 条")
            report.append(f"**投喂事件**: {len(feed_events)} 次")
            report.append("")
            
            if readings:
                oxygen_values = [r['oxygen_mg_l'] for r in readings]
                report.append(f"**溶氧范围**: {min(oxygen_values):.1f} - {max(oxygen_values):.1f} mg/L")
                report.append(f"**平均溶氧**: {sum(oxygen_values)/len(oxygen_values):.2f} mg/L")
                report.append("")
            
            pond_issues = issues_by_pond.get(pond_id, [])
            
            if pond_issues:
                report.append("### 发现的问题")
                report.append("")
                
                for issue in pond_issues:
                    issue_name = issue_type_names.get(issue['issue_type'], issue['issue_type'])
                    severity_icon = '🔴' if issue['severity'] == 'high' else '🟡' if issue['severity'] == 'medium' else '🟢'
                    
                    report.append(f"#### {severity_icon} {issue_name}")
                    report.append(f"**严重程度**: {issue['severity']}")
                    report.append(f"**描述**: {issue['description']}")
                    
                    if issue['timestamp']:
                        report.append(f"**发生时间**: {issue['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    if issue['details']:
                        report.append("**详情**:")
                        for key, value in issue['details'].items():
                            report.append(f"  - {key}: {value}")
                    
                    report.append("")
            else:
                report.append("✅ 未发现风险问题")
                report.append("")
            
            if feed_events:
                report.append("### 投喂时间线")
                report.append("")
                report.append("| 时间 | 投喂量(kg) | 饲料类型 | 操作人员 |")
                report.append("|------|-----------|---------|---------|")
                for event in feed_events:
                    report.append(f"| {event['timestamp'].strftime('%Y-%m-%d %H:%M')} | {event['amount_kg']} | {event['feed_type']} | {event.get('operator', '-')} |")
                report.append("")
            
            report.append("---")
            report.append("")
        
        report.append("## 风险类型说明")
        report.append("")
        report.append("### 低氧投喂 (low_oxygen_feeding)")
        report.append(f"当溶氧值低于 {self.rules['feeding_rules']['minimum_oxygen_required']} mg/L 时进行投喂，可能导致鱼虾应激反应。")
        report.append("")
        
        report.append("### 增氧漏开 (aerator_missed)")
        report.append(f"当溶氧值低于 {self.rules['aerator_rules']['auto_on_below']} mg/L 且超过 {self.rules['aerator_rules']['grace_period_minutes']} 分钟增氧机未开启。")
        report.append("")
        
        report.append("### 重复投喂 (duplicate_feeding)")
        report.append(f"两次投喂间隔小于 {self.rules['feeding_rules']['minimum_interval_minutes']} 分钟，可能导致过度投喂或操作失误。")
        report.append("")
        
        report.append("### 传感器断采 (sensor_gap)")
        report.append(f"溶氧读数间隔超过 {self.rules['sensor_rules']['max_gap_minutes']} 分钟，可能存在传感器故障或数据丢失。")
        report.append("")
        
        report.append("### 过度投喂 (excessive_feeding)")
        report.append(f"单日投喂次数超过 {self.rules['feeding_rules']['maximum_feeds_per_day']} 次，可能导致水质恶化。")
        report.append("")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report))
        
        print(f"池塘报告已生成: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description='水产养殖投喂增氧复盘CLI工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python aqua_audit.py --ponds sample/ponds.csv --feed sample/feed_events.jsonl --oxygen sample/oxygen_readings.csv --rules rules.yaml
        '''
    )
    
    parser.add_argument('--ponds', required=True, help='池塘信息CSV文件路径')
    parser.add_argument('--feed', required=True, help='投喂事件JSONL文件路径')
    parser.add_argument('--oxygen', required=True, help='溶氧读数CSV文件路径')
    parser.add_argument('--rules', required=True, help='规则配置YAML文件路径')
    parser.add_argument('--output-issues', default='issues.csv', help='问题输出CSV文件路径 (默认: issues.csv)')
    parser.add_argument('--output-report', default='pond_report.md', help='报告输出Markdown文件路径 (默认: pond_report.md)')
    parser.add_argument('--analysis-date', help='分析日期 (默认: 最新数据日期)', type=str)
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("水产养殖投喂增氧复盘工具")
    print("=" * 60)
    print(f"池塘文件: {args.ponds}")
    print(f"投喂文件: {args.feed}")
    print(f"溶氧文件: {args.oxygen}")
    print(f"规则文件: {args.rules}")
    print("-" * 60)
    
    data_loader = DataLoader(args.rules)
    ponds = data_loader.load_ponds(args.ponds)
    feed_events = data_loader.load_feed_events(args.feed)
    oxygen_readings = data_loader.load_oxygen_readings(args.oxygen)
    
    print(f"加载池塘: {len(ponds)} 个")
    print(f"加载投喂事件: {len(feed_events)} 条")
    print(f"加载溶氧读数: {len(oxygen_readings)} 条")
    
    timeline_builder = TimelineReconstructor(data_loader.rules)
    pond_data = timeline_builder.group_by_pond(oxygen_readings, feed_events)
    
    for pond_id, pd in pond_data.items():
        readings, gaps = timeline_builder.interpolate_missing_readings(
            pd['readings'],
            data_loader.rules['sensor_rules']['expected_interval_minutes']
        )
        pd['readings'] = readings
        pd['timeline'] = timeline_builder.build_pond_timeline(pd)
    
    print("-" * 60)
    print("开始风险检测...")
    
    risk_detector = RiskDetector(data_loader.rules)
    for pond_id, pd in pond_data.items():
        risk_detector.analyze_pond(pond_id, pd)
    
    issues = risk_detector.get_issues()
    print(f"发现风险问题: {len(issues)} 个")
    
    analysis_date = datetime.now()
    if args.analysis_date:
        analysis_date = parse_datetime(args.analysis_date)
    elif oxygen_readings:
        analysis_date = oxygen_readings[-1]['timestamp']
    
    report_generator = ReportGenerator(data_loader.rules)
    
    report_generator.generate_issues_csv(issues, args.output_issues)
    report_generator.generate_pond_report(
        ponds, pond_data, issues, args.output_report, analysis_date
    )
    
    print("-" * 60)
    print("分析完成!")
    print("=" * 60)
    
    if issues:
        print("\n问题汇总:")
        for issue in issues[:10]:
            severity_icon = '🔴' if issue['severity'] == 'high' else '🟡' if issue['severity'] == 'medium' else '🟢'
            print(f"  {severity_icon} [{issue['pond_id']}] {issue['description']}")
        if len(issues) > 10:
            print(f"  ... 还有 {len(issues) - 10} 个问题")


if __name__ == '__main__':
    main()
