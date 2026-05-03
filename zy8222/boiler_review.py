#!/usr/bin/env python3
"""
燃气锅炉燃烧配风复核工具
用于离线复核燃气锅炉的燃烧配风状况，检测异常并生成报告
"""

import argparse
import csv
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml


class DataLoader:
    """数据加载器：负责读取各种格式的输入文件"""

    @staticmethod
    def load_csv(file_path: str) -> List[Dict[str, Any]]:
        """读取 CSV 文件"""
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(row)
        return data

    @staticmethod
    def load_yaml(file_path: str) -> Dict[str, Any]:
        """读取 YAML 文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    @staticmethod
    def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
        """读取 JSONL 文件（每行一个 JSON 对象）"""
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    data.append(json.loads(line))
        return data


class TimelineReconstructor:
    """时间线重建器：按锅炉/燃烧器重建时间线"""

    def __init__(self, burners: List[Dict], minute_logs: List[Dict], 
                 maintenance: List[Dict]):
        self.burners = burners
        self.minute_logs = minute_logs
        self.maintenance = maintenance
        self._normalize_data()

    def _normalize_data(self):
        """规范化数据格式"""
        # 规范化分钟日志的时间戳
        for log in self.minute_logs:
            if 'timestamp' in log:
                log['timestamp'] = self._parse_timestamp(log['timestamp'])
            # 转换数值字段
            for key in ['load', 'o2', 'co', 'nox', 'gas_flow', 'air_flow']:
                if key in log and log[key] != '':
                    try:
                        log[key] = float(log[key])
                    except (ValueError, TypeError):
                        pass

        # 规范化维护记录的时间戳
        for m in self.maintenance:
            if 'timestamp' in m:
                m['timestamp'] = self._parse_timestamp(m['timestamp'])

    def _parse_timestamp(self, ts_str: str) -> datetime:
        """解析时间戳字符串，支持多种格式"""
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(ts_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析时间戳: {ts_str}")

    def rebuild_timelines(self) -> Dict[str, Dict[str, List[Dict]]]:
        """
        按锅炉/燃烧器重建时间线
        返回: {boiler_id: {burner_id: [sorted_logs]}}
        """
        timelines: Dict[str, Dict[str, List[Dict]]] = {}
        
        # 初始化所有锅炉和燃烧器
        for burner in self.burners:
            boiler_id = burner.get('boiler_id', '')
            burner_id = burner.get('burner_id', '')
            if boiler_id not in timelines:
                timelines[boiler_id] = {}
            if burner_id not in timelines[boiler_id]:
                timelines[boiler_id][burner_id] = []

        # 将日志分配到对应的时间线
        for log in self.minute_logs:
            boiler_id = log.get('boiler_id', '')
            burner_id = log.get('burner_id', '')
            
            if boiler_id in timelines and burner_id in timelines[boiler_id]:
                timelines[boiler_id][burner_id].append(log)

        # 按时间排序每个时间线
        for boiler_id in timelines:
            for burner_id in timelines[boiler_id]:
                timelines[boiler_id][burner_id].sort(
                    key=lambda x: x.get('timestamp', datetime.min)
                )

        return timelines

    def get_maintenance_for_boiler_burner(self, boiler_id: str, 
                                          burner_id: str) -> List[Dict]:
        """获取特定锅炉/燃烧器的维护记录"""
        return [
            m for m in self.maintenance
            if m.get('boiler_id') == boiler_id and m.get('burner_id') == burner_id
        ]


class CombustionCalculator:
    """燃烧计算器：计算过量空气系数、负荷突变等"""

    def __init__(self, emission_limits: Dict):
        self.emission_limits = emission_limits
        # 默认参数：燃气锅炉的理论空气量相关系数
        self.co2_theoretical = 11.8  # 天然气理论 CO2 体积分数 (%)
        self.o2_reference = 3.5  # 参考 O2 浓度 (%)

    def calculate_excess_air_ratio(self, o2: float, co2: Optional[float] = None) -> Dict:
        """
        计算过量空气系数
        公式: λ = 21 / (21 - O2) （简化公式）
        或使用 CO2 计算: λ = CO2理论 / CO2实测
        """
        result = {
            'excess_air_ratio': None,
            'status': 'unknown',
            'message': ''
        }

        if o2 is None or o2 < 0 or o2 > 21:
            result['status'] = 'invalid'
            result['message'] = f'O2 浓度无效: {o2}%'
            return result

        # 使用简化公式计算过量空气系数
        if 21 - o2 == 0:
            result['status'] = 'invalid'
            result['message'] = 'O2 浓度等于 21%，无法计算过量空气系数'
            return result

        lambda_val = 21 / (21 - o2)
        result['excess_air_ratio'] = round(lambda_val, 3)

        # 评估过量空气系数状态
        # 燃气锅炉推荐范围: 1.05 - 1.2
        if lambda_val < 1.0:
            result['status'] = 'critical'
            result['message'] = f'过量空气系数过低: {lambda_val:.3f}，可能存在不完全燃烧'
        elif lambda_val < 1.05:
            result['status'] = 'warning'
            result['message'] = f'过量空气系数偏低: {lambda_val:.3f}，存在不完全燃烧风险'
        elif lambda_val > 1.3:
            result['status'] = 'warning'
            result['message'] = f'过量空气系数偏高: {lambda_val:.3f}，热损失增加'
        elif lambda_val > 1.5:
            result['status'] = 'critical'
            result['message'] = f'过量空气系数过高: {lambda_val:.3f}，严重热损失'
        else:
            result['status'] = 'normal'
            result['message'] = f'过量空气系数正常: {lambda_val:.3f}'

        return result

    def check_load_transient(self, current_load: float, previous_load: float, 
                             threshold_pct: float = 20.0) -> Dict:
        """
        检测负荷突变
        threshold_pct: 突变阈值百分比，默认 20%
        """
        result = {
            'load_change_pct': None,
            'status': 'unknown',
            'message': ''
        }

        if previous_load is None or previous_load <= 0:
            result['status'] = 'unknown'
            result['message'] = '无前序负荷数据'
            return result

        if current_load is None:
            result['status'] = 'unknown'
            result['message'] = '当前负荷数据无效'
            return result

        load_change_pct = abs((current_load - previous_load) / previous_load * 100)
        result['load_change_pct'] = round(load_change_pct, 2)

        if load_change_pct > threshold_pct:
            result['status'] = 'warning'
            result['message'] = (f'负荷突变: {previous_load:.1f}% -> {current_load:.1f}%, '
                                f'变化率: {load_change_pct:.1f}%')
        else:
            result['status'] = 'normal'
            result['message'] = f'负荷变化平稳: {load_change_pct:.1f}%'

        return result

    def check_emission_limits(self, nox: Optional[float] = None, 
                               co: Optional[float] = None) -> Dict:
        """
        检查 NOx 和 CO 是否超限
        """
        result = {
            'nox_status': 'unknown',
            'co_status': 'unknown',
            'nox_limit': None,
            'co_limit': None,
            'status': 'normal',
            'message': ''
        }

        # 获取限值
        nox_limit = self.emission_limits.get('nox', {}).get('limit_mg_m3')
        co_limit = self.emission_limits.get('co', {}).get('limit_mg_m3')
        
        result['nox_limit'] = nox_limit
        result['co_limit'] = co_limit

        messages = []

        # 检查 NOx
        if nox is not None and nox_limit is not None:
            if nox > nox_limit:
                result['nox_status'] = 'exceeded'
                messages.append(f'NOx 超限: {nox:.1f} mg/m³ > 限值 {nox_limit} mg/m³')
                result['status'] = 'warning'
            else:
                result['nox_status'] = 'normal'
        else:
            result['nox_status'] = 'unknown'

        # 检查 CO
        if co is not None and co_limit is not None:
            if co > co_limit:
                result['co_status'] = 'exceeded'
                messages.append(f'CO 超限: {co:.1f} mg/m³ > 限值 {co_limit} mg/m³')
                result['status'] = 'warning'
            else:
                result['co_status'] = 'normal'
        else:
            result['co_status'] = 'unknown'

        if not messages:
            messages.append('排放指标正常')
        
        result['message'] = '; '.join(messages)
        return result

    def check_maintenance_regression(self, log: Dict, maintenance: Dict, 
                                     hours_after: int = 24) -> Dict:
        """
        检查维护后回归风险
        hours_after: 维护后检查时间窗口（小时）
        """
        result = {
            'hours_after_maintenance': None,
            'status': 'normal',
            'message': ''
        }

        if 'timestamp' not in log or 'timestamp' not in maintenance:
            return result

        log_time = log['timestamp']
        maintenance_time = maintenance['timestamp']
        
        hours_diff = (log_time - maintenance_time).total_seconds() / 3600
        result['hours_after_maintenance'] = round(hours_diff, 1)

        # 只检查维护后一段时间内的数据
        if hours_diff < 0 or hours_diff > hours_after:
            return result

        # 检查燃烧参数是否回归到维护前的不良状态
        issues = []
        
        # 检查 O2 是否偏离正常范围
        o2 = log.get('o2')
        if o2 is not None:
            if o2 < 2.0 or o2 > 8.0:
                issues.append(f'O2 浓度异常: {o2}%')

        # 检查 CO
        co = log.get('co')
        co_limit = self.emission_limits.get('co', {}).get('limit_mg_m3')
        if co is not None and co_limit is not None:
            if co > co_limit * 0.8:  # 接近限值
                issues.append(f'CO 接近限值: {co:.1f} mg/m³')

        if issues:
            result['status'] = 'warning'
            result['message'] = f'维护后 {hours_diff:.1f} 小时检测到潜在回归风险: {"; ".join(issues)}'

        return result


class AlarmDetector:
    """告警检测器：检测跨午夜班次、传感器断采、单位混用等问题"""

    def __init__(self, logs: List[Dict]):
        self.logs = logs
        self._sorted_logs = sorted(logs, key=lambda x: x.get('timestamp', datetime.min))

    def detect_midnight_shift_crossing(self) -> List[Dict]:
        """
        检测跨午夜班次
        检查是否存在从一天跨越到另一天的班次
        """
        alarms = []
        
        if len(self._sorted_logs) < 2:
            return alarms

        for i in range(1, len(self._sorted_logs)):
            prev_log = self._sorted_logs[i-1]
            curr_log = self._sorted_logs[i]
            
            prev_time = prev_log.get('timestamp')
            curr_time = curr_log.get('timestamp')
            
            if prev_time and curr_time:
                # 检查是否跨天
                prev_date = prev_time.date()
                curr_date = curr_time.date()
                
                if prev_date != curr_date:
                    # 计算时间间隔
                    time_diff = curr_time - prev_time
                    
                    # 如果时间间隔在合理范围内（如 < 1 小时），可能是班次跨越
                    if time_diff.total_seconds() < 3600:
                        alarms.append({
                            'type': 'midnight_shift_crossing',
                            'severity': 'info',
                            'prev_timestamp': prev_time.strftime("%Y-%m-%d %H:%M:%S"),
                            'curr_timestamp': curr_time.strftime("%Y-%m-%d %H:%M:%S"),
                            'boiler_id': curr_log.get('boiler_id'),
                            'burner_id': curr_log.get('burner_id'),
                            'message': (f'检测到跨午夜班次: {prev_time.strftime("%Y-%m-%d")} '
                                       f'-> {curr_time.strftime("%Y-%m-%d")}')
                        })

        return alarms

    def detect_sensor_gaps(self, expected_interval_minutes: int = 1, 
                           gap_threshold_minutes: int = 5) -> List[Dict]:
        """
        检测传感器断采
        expected_interval_minutes: 预期采样间隔（分钟）
        gap_threshold_minutes: 断采告警阈值（分钟）
        """
        alarms = []
        
        if len(self._sorted_logs) < 2:
            return alarms

        for i in range(1, len(self._sorted_logs)):
            prev_log = self._sorted_logs[i-1]
            curr_log = self._sorted_logs[i]
            
            prev_time = prev_log.get('timestamp')
            curr_time = curr_log.get('timestamp')
            
            if prev_time and curr_time:
                time_diff = curr_time - prev_time
                diff_minutes = time_diff.total_seconds() / 60
                
                if diff_minutes > gap_threshold_minutes:
                    alarms.append({
                        'type': 'sensor_gap',
                        'severity': 'warning',
                        'start_timestamp': prev_time.strftime("%Y-%m-%d %H:%M:%S"),
                        'end_timestamp': curr_time.strftime("%Y-%m-%d %H:%M:%S"),
                        'gap_minutes': round(diff_minutes, 2),
                        'boiler_id': curr_log.get('boiler_id'),
                        'burner_id': curr_log.get('burner_id'),
                        'message': (f'检测到传感器断采: {prev_time.strftime("%Y-%m-%d %H:%M")} '
                                   f'-> {curr_time.strftime("%Y-%m-%d %H:%M")}, '
                                   f'断采时长: {diff_minutes:.1f} 分钟')
                    })

        return alarms

    def detect_unit_inconsistencies(self) -> List[Dict]:
        """
        检测单位混用
        通过检查数值范围的异常变化来推断可能的单位问题
        """
        alarms = []
        
        if len(self._sorted_logs) < 2:
            return alarms

        # 检查关键参数的异常跳变
        key_params = ['load', 'o2', 'co', 'nox', 'gas_flow', 'air_flow']
        
        for param in key_params:
            values = []
            timestamps = []
            boiler_burner = None
            
            for log in self._sorted_logs:
                val = log.get(param)
                if val is not None and isinstance(val, (int, float)):
                    values.append(val)
                    timestamps.append(log.get('timestamp'))
                    if boiler_burner is None:
                        boiler_burner = (log.get('boiler_id'), log.get('burner_id'))

            if len(values) < 10:
                continue  # 数据点不足

            # 检查是否存在量级差异（可能是单位问题）
            for i in range(1, len(values)):
                prev_val = values[i-1]
                curr_val = values[i]
                
                if prev_val == 0:
                    continue
                
                ratio = curr_val / prev_val if prev_val != 0 else 0
                
                # 检查是否存在 10 倍、100 倍、1000 倍的跳变
                for multiplier in [10, 100, 1000, 0.1, 0.01, 0.001]:
                    if 0.8 * multiplier <= ratio <= 1.2 * multiplier:
                        prev_ts = timestamps[i-1]
                        curr_ts = timestamps[i]
                        
                        alarms.append({
                            'type': 'unit_inconsistency',
                            'severity': 'warning',
                            'parameter': param,
                            'prev_value': prev_val,
                            'curr_value': curr_val,
                            'prev_timestamp': prev_ts.strftime("%Y-%m-%d %H:%M:%S") if prev_ts else None,
                            'curr_timestamp': curr_ts.strftime("%Y-%m-%d %H:%M:%S") if curr_ts else None,
                            'boiler_id': boiler_burner[0] if boiler_burner else None,
                            'burner_id': boiler_burner[1] if boiler_burner else None,
                            'message': (f'检测到可能的单位混用: 参数 {param} 在 '
                                       f'{prev_ts.strftime("%Y-%m-%d %H:%M") if prev_ts else "?"} '
                                       f'-> {curr_ts.strftime("%Y-%m-%d %H:%M") if curr_ts else "?"} '
                                       f'间出现 {curr_val/prev_val:.1f} 倍跳变')
                        })

        return alarms

    def detect_all_alarms(self) -> List[Dict]:
        """检测所有类型的告警"""
        alarms = []
        alarms.extend(self.detect_midnight_shift_crossing())
        alarms.extend(self.detect_sensor_gaps())
        alarms.extend(self.detect_unit_inconsistencies())
        return alarms


class IssueAggregator:
    """问题聚合器：汇总所有检测到的问题"""

    def __init__(self, timelines: Dict, calculator: CombustionCalculator,
                 maintenance_records: Dict[str, List[Dict]]):
        self.timelines = timelines
        self.calculator = calculator
        self.maintenance_records = maintenance_records
        self.issues: List[Dict] = []

    def analyze_all(self):
        """分析所有锅炉/燃烧器的时间线"""
        for boiler_id, burners in self.timelines.items():
            for burner_id, logs in burners.items():
                self._analyze_burner_timeline(boiler_id, burner_id, logs)

    def _analyze_burner_timeline(self, boiler_id: str, burner_id: str, logs: List[Dict]):
        """分析单个燃烧器的时间线"""
        if not logs:
            return

        # 获取该燃烧器的维护记录
        maintenance_list = self.maintenance_records.get(
            f"{boiler_id}_{burner_id}", []
        )
        maintenance_list.sort(key=lambda x: x.get('timestamp', datetime.min))

        # 遍历日志，逐个分析
        for i, log in enumerate(logs):
            base_issue = {
                'boiler_id': boiler_id,
                'burner_id': burner_id,
                'timestamp': log.get('timestamp'),
                'load': log.get('load'),
            }

            # 1. 过量空气系数分析
            o2 = log.get('o2')
            if o2 is not None:
                excess_air_result = self.calculator.calculate_excess_air_ratio(o2)
                if excess_air_result['status'] in ['warning', 'critical', 'invalid']:
                    self._add_issue({
                        **base_issue,
                        'issue_type': 'excess_air_ratio',
                        'severity': excess_air_result['status'],
                        'excess_air_ratio': excess_air_result['excess_air_ratio'],
                        'o2': o2,
                        'message': excess_air_result['message']
                    })

            # 2. 负荷突变分析
            if i > 0:
                prev_log = logs[i-1]
                current_load = log.get('load')
                previous_load = prev_log.get('load')
                
                if current_load is not None and previous_load is not None:
                    load_result = self.calculator.check_load_transient(
                        current_load, previous_load
                    )
                    if load_result['status'] == 'warning':
                        self._add_issue({
                            **base_issue,
                            'issue_type': 'load_transient',
                            'severity': 'warning',
                            'previous_load': previous_load,
                            'current_load': current_load,
                            'load_change_pct': load_result['load_change_pct'],
                            'message': load_result['message']
                        })

            # 3. 排放超限分析
            nox = log.get('nox')
            co = log.get('co')
            
            emission_result = self.calculator.check_emission_limits(nox, co)
            if emission_result['status'] == 'warning':
                self._add_issue({
                    **base_issue,
                    'issue_type': 'emission_exceeded',
                    'severity': 'warning',
                    'nox': nox,
                    'co': co,
                    'nox_limit': emission_result['nox_limit'],
                    'co_limit': emission_result['co_limit'],
                    'message': emission_result['message']
                })

            # 4. 维护后回归风险分析
            log_time = log.get('timestamp')
            if log_time:
                for maintenance in maintenance_list:
                    maintenance_time = maintenance.get('timestamp')
                    if maintenance_time:
                        regression_result = self.calculator.check_maintenance_regression(
                            log, maintenance
                        )
                        if regression_result['status'] == 'warning':
                            self._add_issue({
                                **base_issue,
                                'issue_type': 'maintenance_regression',
                                'severity': 'warning',
                                'maintenance_timestamp': maintenance_time,
                                'hours_after_maintenance': regression_result['hours_after_maintenance'],
                                'maintenance_type': maintenance.get('type'),
                                'message': regression_result['message']
                            })

    def _add_issue(self, issue: Dict):
        """添加问题到列表"""
        self.issues.append(issue)

    def get_issues(self) -> List[Dict]:
        """获取所有问题"""
        return sorted(self.issues, key=lambda x: x.get('timestamp', datetime.min))


class ReportExporter:
    """报告导出器：导出 issues.csv 和 combustion_review.md"""

    def __init__(self, issues: List[Dict], alarms: List[Dict], 
                 timelines: Dict, burners: List[Dict],
                 emission_limits: Dict, maintenance: List[Dict]):
        self.issues = issues
        self.alarms = alarms
        self.timelines = timelines
        self.burners = burners
        self.emission_limits = emission_limits
        self.maintenance = maintenance

    def export_issues_csv(self, output_path: str):
        """导出 issues.csv"""
        if not self.issues:
            # 创建空文件
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'boiler_id', 'burner_id', 'timestamp', 'issue_type', 
                    'severity', 'load', 'o2', 'co', 'nox', 
                    'excess_air_ratio', 'load_change_pct', 'message'
                ])
            return

        # 确定所有字段
        fieldnames = set()
        for issue in self.issues:
            fieldnames.update(issue.keys())
        
        # 排序字段
        ordered_fields = [
            'boiler_id', 'burner_id', 'timestamp', 'issue_type', 'severity',
            'load', 'o2', 'co', 'nox', 'excess_air_ratio',
            'previous_load', 'current_load', 'load_change_pct',
            'maintenance_type', 'hours_after_maintenance',
            'nox_limit', 'co_limit', 'message'
        ]
        
        # 确保所有字段都被包含
        for field in fieldnames:
            if field not in ordered_fields:
                ordered_fields.append(field)

        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=ordered_fields, extrasaction='ignore')
            writer.writeheader()
            
            for issue in self.issues:
                # 处理时间戳
                row = issue.copy()
                if 'timestamp' in row and isinstance(row['timestamp'], datetime):
                    row['timestamp'] = row['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
                if 'maintenance_timestamp' in row and isinstance(row['maintenance_timestamp'], datetime):
                    row['maintenance_timestamp'] = row['maintenance_timestamp'].strftime("%Y-%m-%d %H:%M:%S")
                writer.writerow(row)

    def export_markdown_report(self, output_path: str):
        """导出 combustion_review.md"""
        report = self._generate_markdown_report()
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)

    def _generate_markdown_report(self) -> str:
        """生成 Markdown 报告"""
        lines = []
        
        # 标题
        lines.append("# 燃气锅炉燃烧配风复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 统计概览
        lines.append("## 1. 统计概览")
        lines.append("")
        
        # 锅炉/燃烧器统计
        boiler_count = len(self.timelines)
        burner_count = sum(len(burners) for burners in self.timelines.values())
        lines.append(f"- **锅炉数量**: {boiler_count}")
        lines.append(f"- **燃烧器数量**: {burner_count}")
        
        # 问题统计
        issue_count = len(self.issues)
        severity_counts = {'warning': 0, 'critical': 0, 'normal': 0, 'invalid': 0}
        issue_type_counts = {}
        
        for issue in self.issues:
            severity = issue.get('severity', 'unknown')
            if severity in severity_counts:
                severity_counts[severity] += 1
            else:
                severity_counts[severity] = 1
            
            issue_type = issue.get('issue_type', 'unknown')
            if issue_type not in issue_type_counts:
                issue_type_counts[issue_type] = 0
            issue_type_counts[issue_type] += 1
        
        lines.append(f"- **检测到的问题总数**: {issue_count}")
        lines.append(f"- **严重问题**: {severity_counts.get('critical', 0)}")
        lines.append(f"- **警告问题**: {severity_counts.get('warning', 0)}")
        lines.append("")
        
        lines.append("### 按问题类型统计")
        lines.append("")
        lines.append("| 问题类型 | 数量 |")
        lines.append("|---------|------|")
        for issue_type, count in sorted(issue_type_counts.items(), key=lambda x: -x[1]):
            lines.append(f"| {issue_type} | {count} |")
        lines.append("")
        
        # 告警统计
        lines.append("## 2. 告警信息")
        lines.append("")
        
        if self.alarms:
            alarm_type_counts = {}
            for alarm in self.alarms:
                alarm_type = alarm.get('type', 'unknown')
                if alarm_type not in alarm_type_counts:
                    alarm_type_counts[alarm_type] = 0
                alarm_type_counts[alarm_type] += 1
            
            lines.append("### 告警统计")
            lines.append("")
            lines.append("| 告警类型 | 数量 |")
            lines.append("|---------|------|")
            for alarm_type, count in sorted(alarm_type_counts.items()):
                lines.append(f"| {alarm_type} | {count} |")
            lines.append("")
            
            lines.append("### 告警详情")
            lines.append("")
            for i, alarm in enumerate(self.alarms[:20], 1):  # 最多显示 20 条
                lines.append(f"#### 告警 {i}")
                lines.append("")
                lines.append(f"- **类型**: {alarm.get('type')}")
                lines.append(f"- **严重程度**: {alarm.get('severity')}")
                lines.append(f"- **锅炉 ID**: {alarm.get('boiler_id')}")
                lines.append(f"- **燃烧器 ID**: {alarm.get('burner_id')}")
                lines.append(f"- **消息**: {alarm.get('message')}")
                lines.append("")
            
            if len(self.alarms) > 20:
                lines.append(f"*注: 共 {len(self.alarms)} 条告警，仅显示前 20 条*")
                lines.append("")
        else:
            lines.append("无告警信息。")
            lines.append("")
        
        # 问题详情
        lines.append("## 3. 问题详情")
        lines.append("")
        
        if self.issues:
            # 按锅炉/燃烧器分组显示
            grouped_issues: Dict[str, Dict[str, List[Dict]]] = {}
            for issue in self.issues:
                boiler_id = issue.get('boiler_id', 'unknown')
                burner_id = issue.get('burner_id', 'unknown')
                if boiler_id not in grouped_issues:
                    grouped_issues[boiler_id] = {}
                if burner_id not in grouped_issues[boiler_id]:
                    grouped_issues[boiler_id][burner_id] = []
                grouped_issues[boiler_id][burner_id].append(issue)
            
            for boiler_id, burners in sorted(grouped_issues.items()):
                for burner_id, issues in sorted(burners.items()):
                    lines.append(f"### 锅炉 {boiler_id} - 燃烧器 {burner_id}")
                    lines.append("")
                    
                    # 严重问题优先
                    critical_issues = [i for i in issues if i.get('severity') == 'critical']
                    warning_issues = [i for i in issues if i.get('severity') == 'warning']
                    other_issues = [i for i in issues if i.get('severity') not in ['critical', 'warning']]
                    
                    all_sorted_issues = critical_issues + warning_issues + other_issues
                    
                    for issue in all_sorted_issues[:10]:  # 每个燃烧器最多显示 10 条
                        ts = issue.get('timestamp')
                        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if isinstance(ts, datetime) else str(ts)
                        
                        severity_marker = "🔴" if issue.get('severity') == 'critical' else "🟡"
                        lines.append(f"{severity_marker} **{ts_str}** - {issue.get('issue_type')}")
                        lines.append(f"   - 严重程度: {issue.get('severity')}")
                        lines.append(f"   - 消息: {issue.get('message')}")
                        
                        # 显示相关参数
                        params = []
                        for key in ['load', 'o2', 'co', 'nox', 'excess_air_ratio', 'load_change_pct']:
                            val = issue.get(key)
                            if val is not None:
                                params.append(f"{key}: {val}")
                        if params:
                            lines.append(f"   - 参数: {', '.join(params)}")
                        lines.append("")
                    
                    if len(all_sorted_issues) > 10:
                        lines.append(f"*注: 该燃烧器共 {len(all_sorted_issues)} 个问题，仅显示前 10 条，详情请查看 issues.csv*")
                        lines.append("")
        else:
            lines.append("未检测到任何问题。")
            lines.append("")
        
        # 配置信息
        lines.append("## 4. 配置信息")
        lines.append("")
        
        lines.append("### 燃烧器配置")
        lines.append("")
        lines.append("| 锅炉 ID | 燃烧器 ID | 型号 | 额定功率 (MW) |")
        lines.append("|---------|----------|------|---------------|")
        for burner in self.burners:
            lines.append(f"| {burner.get('boiler_id')} | {burner.get('burner_id')} | "
                        f"{burner.get('model', '-')} | {burner.get('rated_power_mw', '-')} |")
        lines.append("")
        
        lines.append("### 排放限值")
        lines.append("")
        nox_limit = self.emission_limits.get('nox', {}).get('limit_mg_m3', '未设置')
        co_limit = self.emission_limits.get('co', {}).get('limit_mg_m3', '未设置')
        lines.append(f"- **NOx 限值**: {nox_limit} mg/m³")
        lines.append(f"- **CO 限值**: {co_limit} mg/m³")
        lines.append("")
        
        # 维护记录
        if self.maintenance:
            lines.append("## 5. 维护记录")
            lines.append("")
            lines.append("| 锅炉 ID | 燃烧器 ID | 时间 | 类型 | 描述 |")
            lines.append("|---------|----------|------|------|------|")
            for m in sorted(self.maintenance, key=lambda x: x.get('timestamp', datetime.min)):
                ts = m.get('timestamp')
                ts_str = ts.strftime("%Y-%m-%d %H:%M:%S") if isinstance(ts, datetime) else str(ts)
                lines.append(f"| {m.get('boiler_id')} | {m.get('burner_id')} | {ts_str} | "
                            f"{m.get('type', '-')} | {m.get('description', '-')} |")
            lines.append("")
        
        return "\n".join(lines)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='燃气锅炉燃烧配风复核工具 - 离线分析燃气锅炉的燃烧配风状况',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python boiler_review.py --help
  python boiler_review.py -b burners.csv -l minute_logs.csv -e emission_limits.yaml -m maintenance.jsonl
  python boiler_review.py -b data/burners.csv -l data/minute_logs.csv -e data/emission_limits.yaml -m data/maintenance.jsonl -o ./output
        '''
    )
    
    parser.add_argument('-b', '--burners', required=True,
                        help='燃烧器配置 CSV 文件路径')
    parser.add_argument('-l', '--logs', required=True,
                        help='分钟日志 CSV 文件路径')
    parser.add_argument('-e', '--emission-limits', required=True,
                        help='排放限值 YAML 文件路径')
    parser.add_argument('-m', '--maintenance', required=True,
                        help='维护记录 JSONL 文件路径')
    parser.add_argument('-o', '--output-dir', default='.',
                        help='输出目录 (默认: 当前目录)')
    parser.add_argument('-v', '--verbose', action='store_true',
                        help='显示详细输出')
    
    args = parser.parse_args()
    
    # 验证输入文件存在
    input_files = [args.burners, args.logs, args.emission_limits, args.maintenance]
    for file_path in input_files:
        if not os.path.exists(file_path):
            print(f"错误: 文件不存在: {file_path}")
            return 1
    
    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 加载数据
    if args.verbose:
        print("正在加载数据...")
    
    data_loader = DataLoader()
    burners = data_loader.load_csv(args.burners)
    minute_logs = data_loader.load_csv(args.logs)
    emission_limits = data_loader.load_yaml(args.emission_limits)
    maintenance = data_loader.load_jsonl(args.maintenance)
    
    if args.verbose:
        print(f"  - 燃烧器配置: {len(burners)} 条")
        print(f"  - 分钟日志: {len(minute_logs)} 条")
        print(f"  - 排放限值: {emission_limits}")
        print(f"  - 维护记录: {len(maintenance)} 条")
    
    # 重建时间线
    if args.verbose:
        print("正在重建时间线...")
    
    timeline_reconstructor = TimelineReconstructor(burners, minute_logs, maintenance)
    timelines = timeline_reconstructor.rebuild_timelines()
    
    # 组织维护记录
    maintenance_by_burner: Dict[str, List[Dict]] = {}
    for m in maintenance:
        key = f"{m.get('boiler_id')}_{m.get('burner_id')}"
        if key not in maintenance_by_burner:
            maintenance_by_burner[key] = []
        maintenance_by_burner[key].append(m)
    
    # 创建计算器
    calculator = CombustionCalculator(emission_limits)
    
    # 分析问题
    if args.verbose:
        print("正在分析燃烧问题...")
    
    issue_aggregator = IssueAggregator(timelines, calculator, maintenance_by_burner)
    issue_aggregator.analyze_all()
    issues = issue_aggregator.get_issues()
    
    if args.verbose:
        print(f"  - 检测到 {len(issues)} 个问题")
    
    # 检测告警
    if args.verbose:
        print("正在检测告警...")
    
    # 收集所有日志用于告警检测
    all_logs = []
    for boiler_id, burners_dict in timelines.items():
        for burner_id, logs in burners_dict.items():
            all_logs.extend(logs)
    
    alarm_detector = AlarmDetector(all_logs)
    alarms = alarm_detector.detect_all_alarms()
    
    if args.verbose:
        print(f"  - 检测到 {len(alarms)} 个告警")
    
    # 导出报告
    if args.verbose:
        print("正在导出报告...")
    
    issues_csv_path = output_dir / "issues.csv"
    report_md_path = output_dir / "combustion_review.md"
    
    report_exporter = ReportExporter(
        issues, alarms, timelines, burners, emission_limits, maintenance
    )
    report_exporter.export_issues_csv(str(issues_csv_path))
    report_exporter.export_markdown_report(str(report_md_path))
    
    # 打印总结
    print("\n" + "=" * 60)
    print("燃气锅炉燃烧配风复核完成")
    print("=" * 60)
    print(f"\n统计概览:")
    print(f"  - 锅炉数量: {len(timelines)}")
    print(f"  - 燃烧器数量: {sum(len(b) for b in timelines.values())}")
    print(f"  - 检测到的问题: {len(issues)}")
    print(f"  - 检测到的告警: {len(alarms)}")
    
    # 按类型统计问题
    issue_types = {}
    for issue in issues:
        itype = issue.get('issue_type', 'unknown')
        if itype not in issue_types:
            issue_types[itype] = 0
        issue_types[itype] += 1
    
    if issue_types:
        print(f"\n问题类型分布:")
        for itype, count in sorted(issue_types.items()):
            print(f"  - {itype}: {count}")
    
    print(f"\n输出文件:")
    print(f"  - 问题列表: {issues_csv_path}")
    print(f"  - 详细报告: {report_md_path}")
    
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
