#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据处理模块
处理视野检查数据的分析和验证
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import copy

from models.data_models import PatientData, VisualFieldTest, ReliabilityRules


class DataProcessor:
    """
    数据处理器
    负责处理视野检查数据，包括：
    - 可靠性评估
    - 进展分析
    - 数据质量检查
    - 跨日期随访排序
    """
    
    def __init__(self, reliability_rules: Optional[ReliabilityRules] = None):
        # 可靠性规则
        self.reliability_rules = reliability_rules or ReliabilityRules()
        
        # 处理结果
        self.left_eye_reliability: Optional[Dict[str, Any]] = None
        self.right_eye_reliability: Optional[Dict[str, Any]] = None
        
        self.left_eye_progress: List[Dict[str, Any]] = []
        self.right_eye_progress: List[Dict[str, Any]] = []
        
        self.data_quality_issues: List[str] = []
        
        # 排序后的历史数据
        self.sorted_left_history: List[VisualFieldTest] = []
        self.sorted_right_history: List[VisualFieldTest] = []
        
    def process(self, patient_data: PatientData):
        """
        处理患者数据
        """
        # 重置结果
        self.data_quality_issues = []
        self.left_eye_progress = []
        self.right_eye_progress = []
        
        # 1. 排序历史数据
        self._sort_history(patient_data)
        
        # 2. 检查数据质量问题
        self._check_data_quality(patient_data)
        
        # 3. 评估可靠性
        self._evaluate_reliability(patient_data)
        
        # 4. 分析进展
        self._analyze_progress(patient_data)
        
    def _sort_history(self, patient_data: PatientData):
        """
        排序历史数据
        按检查日期从旧到新排序
        """
        # 获取左眼历史（包括当前检查）
        self.sorted_left_history = patient_data.get_sorted_history('left')
        
        # 获取右眼历史（包括当前检查）
        self.sorted_right_history = patient_data.get_sorted_history('right')
        
    def _check_data_quality(self, patient_data: PatientData):
        """
        检查数据质量问题
        包括：
        - 左右眼混录
        - 缺失点位
        - 日期问题
        """
        # 检查左右眼混录
        self._check_eye_mixup(patient_data)
        
        # 检查缺失点位
        self._check_missing_points(patient_data)
        
        # 检查日期排序
        self._check_date_issues(patient_data)
        
    def _check_eye_mixup(self, patient_data: PatientData):
        """
        检查左右眼混录
        通过点位分布推断实际眼别，与记录的眼别比较
        """
        # 检查左眼
        if patient_data.left_eye:
            actual_eye = self._infer_eye_from_points(patient_data.left_eye.points)
            recorded_eye = patient_data.left_eye.eye
            
            if actual_eye and recorded_eye and actual_eye != recorded_eye:
                if actual_eye == 'right' and recorded_eye == 'left':
                    self.data_quality_issues.append(
                        f"左眼数据疑似混录：点位分布显示可能是右眼检查"
                    )
                elif actual_eye == 'left' and recorded_eye == 'right':
                    self.data_quality_issues.append(
                        f"右眼数据疑似混录：点位分布显示可能是左眼检查"
                    )
        
        # 检查右眼
        if patient_data.right_eye:
            actual_eye = self._infer_eye_from_points(patient_data.right_eye.points)
            recorded_eye = patient_data.right_eye.eye
            
            if actual_eye and recorded_eye and actual_eye != recorded_eye:
                if actual_eye == 'right' and recorded_eye == 'left':
                    self.data_quality_issues.append(
                        f"左眼数据疑似混录：点位分布显示可能是右眼检查"
                    )
                elif actual_eye == 'left' and recorded_eye == 'right':
                    self.data_quality_issues.append(
                        f"右眼数据疑似混录：点位分布显示可能是左眼检查"
                    )
        
        # 检查历史数据
        for history_list, eye_name in [
            (self.sorted_left_history, '左眼'),
            (self.sorted_right_history, '右眼')
        ]:
            for test in history_list:
                if test is patient_data.left_eye or test is patient_data.right_eye:
                    continue  # 已经检查过当前数据
                    
                actual_eye = self._infer_eye_from_points(test.points)
                recorded_eye = test.eye
                
                if actual_eye and recorded_eye and actual_eye != recorded_eye:
                    date_str = test.test_date.strftime('%Y-%m-%d') if test.test_date else '未知日期'
                    self.data_quality_issues.append(
                        f"{eye_name}历史数据({date_str})疑似混录：点位分布显示可能是{'右眼' if actual_eye == 'right' else '左眼'}检查"
                    )
    
    def _infer_eye_from_points(self, points: List[Dict[str, Any]]) -> Optional[str]:
        """
        从点位分布推断眼别
        返回 'left', 'right', 或 None
        """
        if not points:
            return None
        
        left_x_count = 0
        right_x_count = 0
        
        for point in points:
            x = point.get('x', 0)
            if x < 0:
                left_x_count += 1
            elif x > 0:
                right_x_count += 1
        
        # 如果左侧点位多，可能是右眼（检查右眼的视野）
        # 如果右侧点位多，可能是左眼
        if left_x_count > right_x_count + 2:  # 留一些余量
            return 'right'
        elif right_x_count > left_x_count + 2:
            return 'left'
        
        return None
    
    def _check_missing_points(self, patient_data: PatientData):
        """
        检查缺失点位
        与标准 Humphrey 视野检查点位比较
        """
        # 标准 24-2 视野检查的点位数量
        standard_points_24_2 = 54  # 包括生理盲点
        standard_points_30_2 = 76
        
        # 检查当前数据
        for test, eye_name in [
            (patient_data.left_eye, '左眼'),
            (patient_data.right_eye, '右眼')
        ]:
            if test and test.points:
                point_count = len(test.points)
                
                # 检查是否有缺失（假设是 24-2 检查）
                if point_count < standard_points_24_2 - 5:  # 允许一些差异
                    missing_count = standard_points_24_2 - point_count
                    self.data_quality_issues.append(
                        f"{eye_name}检查点位数量不足：共 {point_count} 个点位，标准 24-2 检查应有约 {standard_points_24_2} 个点位，疑似缺失 {missing_count} 个点位"
                    )
                
                # 检查单个点位是否有缺失值
                missing_values = []
                for i, point in enumerate(test.points):
                    if point.get('value') is None or point.get('value') == '':
                        missing_values.append(f"点位 {i+1}")
                    elif isinstance(point.get('value'), (int, float)) and point.get('value') <= 0:
                        # 阈值不应为0或负数
                        missing_values.append(f"点位 {i+1}(阈值异常)")
                
                if missing_values:
                    if len(missing_values) <= 5:
                        self.data_quality_issues.append(
                            f"{eye_name}检查存在缺失或异常值：{', '.join(missing_values)}"
                        )
                    else:
                        self.data_quality_issues.append(
                            f"{eye_name}检查存在 {len(missing_values)} 个缺失或异常值"
                        )
        
        # 检查历史数据
        for history_list, eye_name in [
            (self.sorted_left_history, '左眼'),
            (self.sorted_right_history, '右眼')
        ]:
            for test in history_list:
                if test is patient_data.left_eye or test is patient_data.right_eye:
                    continue
                
                if test.points:
                    point_count = len(test.points)
                    if point_count < standard_points_24_2 - 5:
                        date_str = test.test_date.strftime('%Y-%m-%d') if test.test_date else '未知日期'
                        self.data_quality_issues.append(
                            f"{eye_name}历史数据({date_str})点位数量不足：共 {point_count} 个点位"
                        )
    
    def _check_date_issues(self, patient_data: PatientData):
        """
        检查日期问题
        包括：
        - 日期顺序问题（新的检查日期比旧的早）
        - 重复日期
        - 未来日期
        """
        today = datetime.now()
        
        # 检查左眼历史
        if len(self.sorted_left_history) > 1:
            # 检查是否有未来日期
            for test in self.sorted_left_history:
                if test.test_date and test.test_date > today:
                    date_str = test.test_date.strftime('%Y-%m-%d')
                    self.data_quality_issues.append(
                        f"左眼检查日期({date_str})在未来日期，请检查"
                    )
            
            # 检查是否有重复日期
            dates = []
            for test in self.sorted_left_history:
                if test.test_date:
                    date_str = test.test_date.strftime('%Y-%m-%d')
                    if date_str in dates:
                        self.data_quality_issues.append(
                            f"左眼存在重复检查日期: {date_str}"
                        )
                    dates.append(date_str)
        
        # 检查右眼历史
        if len(self.sorted_right_history) > 1:
            # 检查是否有未来日期
            for test in self.sorted_right_history:
                if test.test_date and test.test_date > today:
                    date_str = test.test_date.strftime('%Y-%m-%d')
                    self.data_quality_issues.append(
                        f"右眼检查日期({date_str})在未来日期，请检查"
                    )
            
            # 检查是否有重复日期
            dates = []
            for test in self.sorted_right_history:
                if test.test_date:
                    date_str = test.test_date.strftime('%Y-%m-%d')
                    if date_str in dates:
                        self.data_quality_issues.append(
                            f"右眼存在重复检查日期: {date_str}"
                        )
                    dates.append(date_str)
        
        # 检查双眼日期是否匹配（用于双眼对比）
        if patient_data.left_eye and patient_data.right_eye:
            left_date = patient_data.left_eye.test_date
            right_date = patient_data.right_eye.test_date
            
            if left_date and right_date:
                days_diff = abs((left_date - right_date).days)
                if days_diff > 7:  # 超过一周
                    self.data_quality_issues.append(
                        f"左右眼检查日期相差较大（{days_diff}天），左眼: {left_date.strftime('%Y-%m-%d')}，右眼: {right_date.strftime('%Y-%m-%d')}"
                    )
    
    def _evaluate_reliability(self, patient_data: PatientData):
        """
        评估检查可靠性
        """
        # 左眼可靠性
        if patient_data.left_eye:
            self.left_eye_reliability = self.reliability_rules.evaluate_test(
                patient_data.left_eye
            )
        
        # 右眼可靠性
        if patient_data.right_eye:
            self.right_eye_reliability = self.reliability_rules.evaluate_test(
                patient_data.right_eye
            )
        
        # 检查固视丢失过高（特别关注）
        self._check_critical_fixation_loss(patient_data)
        
    def _check_critical_fixation_loss(self, patient_data: PatientData):
        """
        检查固视丢失过高的情况
        这是一个重要的可靠性问题
        """
        critical_threshold = self.reliability_rules.fixation_loss_critical
        
        # 左眼
        if patient_data.left_eye:
            fixation_rate = patient_data.left_eye.get_fixation_loss_rate()
            if fixation_rate >= critical_threshold:
                # 已经在可靠性评估中标记，但这里特别强调
                pass
        
        # 右眼
        if patient_data.right_eye:
            fixation_rate = patient_data.right_eye.get_fixation_loss_rate()
            if fixation_rate >= critical_threshold:
                # 已经在可靠性评估中标记
                pass
        
        # 历史数据
        for history_list, eye_name in [
            (self.sorted_left_history, '左眼'),
            (self.sorted_right_history, '右眼')
        ]:
            for test in history_list:
                fixation_rate = test.get_fixation_loss_rate()
                if fixation_rate >= critical_threshold:
                    date_str = test.test_date.strftime('%Y-%m-%d') if test.test_date else '未知日期'
                    if test is patient_data.left_eye or test is patient_data.right_eye:
                        # 当前数据已经在可靠性评估中
                        continue
                    
                    # 历史数据的固视丢失问题
                    self.data_quality_issues.append(
                        f"{eye_name}历史检查({date_str})固视丢失率过高: {fixation_rate*100:.1f}%"
                    )
    
    def _analyze_progress(self, patient_data: PatientData):
        """
        分析视野进展
        通过比较历史数据找出疑似进展的点位
        """
        # 分析左眼
        if len(self.sorted_left_history) >= 2:
            self.left_eye_progress = self._detect_progress_points(
                self.sorted_left_history, 'left'
            )
        
        # 分析右眼
        if len(self.sorted_right_history) >= 2:
            self.right_eye_progress = self._detect_progress_points(
                self.sorted_right_history, 'right'
            )
        
        # 聚类分析（找出连续的缺损区域）
        if self.left_eye_progress:
            self._cluster_progress_points(self.left_eye_progress, 'left')
        
        if self.right_eye_progress:
            self._cluster_progress_points(self.right_eye_progress, 'right')
    
    def _detect_progress_points(self, history: List[VisualFieldTest], eye: str) -> List[Dict[str, Any]]:
        """
        检测进展点位
        通过比较最新检查与历史检查的阈值变化
        """
        if len(history) < 2:
            return []
        
        progress_points = []
        
        # 最新的检查
        latest_test = history[-1]
        
        # 前一次检查（用于快速比较）
        previous_test = history[-2] if len(history) >= 2 else None
        
        # 最早的检查（用于长期趋势）
        earliest_test = history[0]
        
        # 点位映射（按位置）
        def get_point_by_location(points: List[Dict[str, Any]], location) -> Optional[Dict[str, Any]]:
            for point in points:
                if point.get('location') == location:
                    return point
                # 也可以通过坐标匹配
                if 'x' in point and 'y' in point:
                    # 需要实现坐标匹配逻辑
                    pass
            return None
        
        # 检测每个点位的变化
        for i, latest_point in enumerate(latest_test.points):
            point_info = {
                'point_index': i,
                'location': latest_point.get('location', f'点位{i+1}'),
                'x': latest_point.get('x'),
                'y': latest_point.get('y'),
                'latest_value': latest_point.get('value'),
                'latest_td': latest_point.get('td'),
                'latest_pd': latest_point.get('pd'),
                'changes': [],
                'severity': 'normal',
                'is_progress': False
            }
            
            # 与前一次检查比较
            if previous_test and i < len(previous_test.points):
                prev_point = previous_test.points[i]
                prev_value = prev_point.get('value')
                latest_value = latest_point.get('value')
                
                if isinstance(prev_value, (int, float)) and isinstance(latest_value, (int, float)):
                    change = latest_value - prev_value
                    point_info['previous_value'] = prev_value
                    point_info['change_from_previous'] = change
                    
                    # 阈值下降超过一定值视为可疑
                    if change <= -5:  # 下降5dB以上
                        point_info['changes'].append({
                            'type': 'short_term',
                            'description': f'与前次检查相比下降 {abs(change):.1f} dB',
                            'change': change
                        })
                        point_info['severity'] = 'mild'
                        point_info['is_progress'] = True
                    
                    if change <= -8:  # 下降8dB以上
                        point_info['severity'] = 'moderate'
                    
                    if change <= -12:  # 下降12dB以上
                        point_info['severity'] = 'severe'
            
            # 与最早的检查比较（长期趋势）
            if earliest_test and i < len(earliest_test.points):
                early_point = earliest_test.points[i]
                early_value = early_point.get('value')
                latest_value = latest_point.get('value')
                
                if isinstance(early_value, (int, float)) and isinstance(latest_value, (int, float)):
                    total_change = latest_value - early_value
                    point_info['earliest_value'] = early_value
                    point_info['total_change'] = total_change
                    
                    # 检查模式偏差的变化
                    early_pd = early_point.get('pd')
                    latest_pd = latest_point.get('pd')
                    
                    if isinstance(early_pd, (int, float)) and isinstance(latest_pd, (int, float)):
                        pd_change = latest_pd - early_pd
                        point_info['pd_change'] = pd_change
                        
                        # 模式偏差恶化更能说明进展
                        if pd_change <= -5:
                            point_info['changes'].append({
                                'type': 'long_term_pd',
                                'description': f'模式偏差长期恶化 {abs(pd_change):.1f} dB',
                                'change': pd_change
                            })
                            point_info['is_progress'] = True
                            
                            if pd_change <= -10:
                                point_info['severity'] = 'severe'
                            elif pd_change <= -7:
                                point_info['severity'] = 'moderate'
            
            # 检查概率值的变化
            latest_td_p = latest_point.get('td_p')
            latest_pd_p = latest_point.get('pd_p')
            
            # 新增的显著缺损
            if isinstance(latest_pd_p, (int, float)) and latest_pd_p < 0.01:  # p < 1%
                point_info['changes'].append({
                    'type': 'new_defect',
                    'description': f'出现显著模式偏差缺损 (p < 1%)',
                    'pd_p': latest_pd_p
                })
                point_info['is_progress'] = True
                
                if latest_pd_p < 0.005:
                    point_info['severity'] = 'moderate'
                if latest_pd_p < 0.001:
                    point_info['severity'] = 'severe'
            
            # 如果是进展点位，添加到结果
            if point_info['is_progress']:
                # 生成描述
                descriptions = [c['description'] for c in point_info['changes']]
                point_info['description'] = '; '.join(descriptions)
                
                # 严重程度标签
                severity_labels = {
                    'normal': '正常',
                    'mild': '轻度可疑',
                    'moderate': '中度进展',
                    'severe': '严重进展'
                }
                point_info['severity_label'] = severity_labels.get(point_info['severity'], '未知')
                
                progress_points.append(point_info)
        
        # 按严重程度排序
        severity_order = {'severe': 0, 'moderate': 1, 'mild': 2, 'normal': 3}
        progress_points.sort(key=lambda x: severity_order.get(x['severity'], 3))
        
        return progress_points
    
    def _cluster_progress_points(self, progress_points: List[Dict[str, Any]], eye: str):
        """
        聚类进展点位
        找出空间上相邻的进展点位，形成缺损区域
        """
        if len(progress_points) < 2:
            return
        
        # 简单的基于距离的聚类
        clusters = []
        
        for point in progress_points:
            if 'x' not in point or 'y' not in point:
                continue
            
            x, y = point['x'], point['y']
            added = False
            
            # 尝试加入已有聚类
            for cluster in clusters:
                for cluster_point in cluster['points']:
                    if 'x' in cluster_point and 'y' in cluster_point:
                        cx, cy = cluster_point['x'], cluster_point['y']
                        # 计算距离（视野检查中，点位间距约为6度）
                        distance = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                        
                        if distance <= 9:  # 约1.5倍点位间距
                            cluster['points'].append(point)
                            added = True
                            break
                
                if added:
                    break
            
            # 创建新聚类
            if not added:
                clusters.append({
                    'points': [point],
                    'eye': eye
                })
        
        # 分析聚类
        for i, cluster in enumerate(clusters):
            point_count = len(cluster['points'])
            
            if point_count >= 3:  # 3个以上连续点位
                # 计算聚类的严重程度
                severity_scores = []
                for point in cluster['points']:
                    if point['severity'] == 'severe':
                        severity_scores.append(3)
                    elif point['severity'] == 'moderate':
                        severity_scores.append(2)
                    elif point['severity'] == 'mild':
                        severity_scores.append(1)
                    else:
                        severity_scores.append(0)
                
                avg_severity = sum(severity_scores) / len(severity_scores)
                
                # 生成聚类描述
                locations = [p.get('location', '') for p in cluster['points'] if p.get('location')]
                location_str = ', '.join(locations[:3])
                if len(locations) > 3:
                    location_str += f' 等{len(locations)}个点位'
                
                cluster_description = f"{'左眼' if eye == 'left' else '右眼'}发现{point_count}个连续进展点位: {location_str}"
                
                if avg_severity >= 2:
                    cluster_description += "（中度至严重）"
                elif avg_severity >= 1:
                    cluster_description += "（轻度至中度）"
                
                # 将聚类信息添加到第一个点
                if cluster['points']:
                    cluster['points'][0]['cluster_info'] = {
                        'cluster_id': i,
                        'point_count': point_count,
                        'description': cluster_description,
                        'avg_severity': avg_severity
                    }
                    
                    # 更新描述
                    if 'description' in cluster['points'][0]:
                        cluster['points'][0]['description'] = cluster_description + '; ' + cluster['points'][0]['description']
                    else:
                        cluster['points'][0]['description'] = cluster_description
