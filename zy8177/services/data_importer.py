#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据导入模块
用于导入不同格式的视野检查数据
"""

import csv
import json
import yaml
from datetime import datetime
from typing import Dict, Any, List, Optional
import os

from models.data_models import VisualFieldTest, PatientData, ReliabilityRules


class DataImporter:
    """
    数据导入器
    支持导入CSV、JSON、YAML格式的数据
    """
    
    @staticmethod
    def import_csv(file_path: str) -> VisualFieldTest:
        """
        从CSV文件导入视野检查点位数据
        
        CSV文件格式要求:
        - 可选的元数据行（以 # 开头）
        - 表头行包含: x, y, value, td, pd, td_p, pd_p, location 等
        """
        test = VisualFieldTest()
        test.raw_data['file_path'] = file_path
        test.raw_data['import_time'] = datetime.now().isoformat()
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            
            # 读取元数据行（以 # 开头）
            metadata_lines = []
            header = None
            
            for row in reader:
                if not row:
                    continue
                
                # 处理元数据行
                if row[0].startswith('#'):
                    metadata_lines.append(row[0][1:].strip())
                    continue
                
                # 处理表头
                if header is None:
                    header = [col.strip().lower() for col in row]
                    continue
                
                # 处理数据行
                if len(row) > 0:
                    point = DataImporter._parse_csv_point(row, header)
                    if point:
                        test.points.append(point)
        
        # 解析元数据
        for line in metadata_lines:
            DataImporter._parse_metadata_line(test, line)
        
        # 尝试从文件名获取信息
        DataImporter._parse_filename_info(test, file_path)
        
        # 如果没有眼别信息，尝试从点位分布推断
        if not test.eye and test.points:
            test.eye = DataImporter._infer_eye_from_points(test.points)
        
        return test
    
    @staticmethod
    def _parse_csv_point(row: List[str], header: List[str]) -> Optional[Dict[str, Any]]:
        """
        解析CSV中的点位数据行
        """
        point = {}
        
        # 列名映射
        column_mapping = {
            'x': ['x', 'x坐标', 'x_coord', 'xcoord'],
            'y': ['y', 'y坐标', 'y_coord', 'ycoord'],
            'value': ['value', '阈值', 'threshold', 'sensitivity'],
            'td': ['td', '总偏差', 'total_deviation', 'total deviation'],
            'pd': ['pd', '模式偏差', 'pattern_deviation', 'pattern deviation'],
            'td_p': ['td_p', 'td-p', 'tdp', '总偏差概率', 'total_deviation_prob'],
            'pd_p': ['pd_p', 'pd-p', 'pdp', '模式偏差概率', 'pattern_deviation_prob'],
            'location': ['location', '点位', '位置', 'loc'],
            'eye': ['eye', '眼别', '眼']
        }
        
        # 构建反向映射
        reverse_mapping = {}
        for standard_name, aliases in column_mapping.items():
            for alias in aliases:
                reverse_mapping[alias] = standard_name
        
        # 解析每一列
        for i, col_name in enumerate(header):
            if i >= len(row):
                continue
            
            value = row[i].strip()
            if not value:
                continue
            
            # 查找标准列名
            standard_name = reverse_mapping.get(col_name.lower())
            
            if standard_name:
                # 数值类型转换
                if standard_name in ['x', 'y', 'value', 'td', 'pd', 'td_p', 'pd_p']:
                    try:
                        point[standard_name] = float(value)
                    except ValueError:
                        point[standard_name] = value
                else:
                    point[standard_name] = value
        
        # 至少需要x, y, value中的部分信息
        if 'x' in point or 'y' in point or 'value' in point or 'location' in point:
            return point
        
        return None
    
    @staticmethod
    def _parse_metadata_line(test: VisualFieldTest, line: str):
        """
        解析元数据行
        格式: key=value 或 key: value
        """
        # 尝试不同的分隔符
        separators = ['=', ':', '：']
        
        for sep in separators:
            if sep in line:
                parts = line.split(sep, 1)
                if len(parts) == 2:
                    key = parts[0].strip().lower()
                    value = parts[1].strip()
                    
                    # 映射到字段
                    key_mapping = {
                        'patient_id': ['patient_id', '患者id', '病人id', 'id'],
                        'patient_name': ['patient_name', '患者姓名', '姓名', 'name'],
                        'test_date': ['test_date', '检查日期', '日期', 'date'],
                        'eye': ['eye', '眼别', '眼'],
                        'strategy': ['strategy', '检查策略', '策略'],
                        'md': ['md', '平均缺损', 'mean deviation'],
                        'psd': ['psd', '模式标准差', 'pattern standard deviation'],
                        'vfi': ['vfi', '视野指数', 'visual field index'],
                        'fixation_losses': ['fixation_losses', '固视丢失', 'fl'],
                        'fixation_total': ['fixation_total', '固视总次数'],
                        'false_positives': ['false_positives', '假阳性', 'fp'],
                        'false_positive_total': ['false_positive_total', '假阳性总次数'],
                        'false_negatives': ['false_negatives', '假阴性', 'fn'],
                        'false_negative_total': ['false_negative_total', '假阴性总次数'],
                        'pupil_size': ['pupil_size', '瞳孔大小'],
                        'visual_acuity': ['visual_acuity', '视力', 'va'],
                        'refraction': ['refraction', '验光', 'ref']
                    }
                    
                    # 查找对应的字段
                    for field_name, aliases in key_mapping.items():
                        if key in aliases:
                            # 特殊处理日期
                            if field_name == 'test_date':
                                try:
                                    # 尝试多种日期格式
                                    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y', '%Y%m%d']:
                                        try:
                                            test.test_date = datetime.strptime(value, fmt)
                                            break
                                        except ValueError:
                                            continue
                                except:
                                    pass
                            # 数值类型
                            elif field_name in ['md', 'psd', 'vfi', 'pupil_size']:
                                try:
                                    setattr(test, field_name, float(value))
                                except ValueError:
                                    pass
                            # 整数类型
                            elif field_name in ['fixation_losses', 'fixation_total', 
                                               'false_positives', 'false_positive_total',
                                               'false_negatives', 'false_negative_total']:
                                try:
                                    setattr(test, field_name, int(value))
                                except ValueError:
                                    pass
                            # 字符串类型
                            else:
                                setattr(test, field_name, value)
                            
                            break
                
                break
    
    @staticmethod
    def _parse_filename_info(test: VisualFieldTest, file_path: str):
        """
        从文件名尝试解析信息
        """
        filename = os.path.basename(file_path)
        name_without_ext = os.path.splitext(filename)[0]
        
        # 尝试解析眼别
        name_lower = name_without_ext.lower()
        if 'left' in name_lower or '_l' in name_lower or '-l' in name_lower or '左眼' in name_without_ext:
            test.eye = 'left'
        elif 'right' in name_lower or '_r' in name_lower or '-r' in name_lower or '右眼' in name_without_ext:
            test.eye = 'right'
    
    @staticmethod
    def _infer_eye_from_points(points: List[Dict[str, Any]]) -> str:
        """
        从点位分布推断眼别
        对于视野检查，右眼的视野图主要在左侧（负x坐标），左眼主要在右侧（正x坐标）
        """
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
        if left_x_count > right_x_count:
            return 'right'
        elif right_x_count > left_x_count:
            return 'left'
        
        return ''
    
    @staticmethod
    def import_json(file_path: str) -> PatientData:
        """
        从JSON文件导入患者随访数据
        
        JSON格式可以包含：
        - 患者基本信息
        - 左眼和右眼的检查数据
        - 历史检查数据
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 尝试直接从字典创建
        if 'patient_id' in data or 'patient_name' in data:
            return PatientData.from_dict(data)
        
        # 尝试解析嵌套结构
        patient = PatientData()
        
        # 查找患者信息
        if 'patient' in data:
            patient_data = data['patient']
            patient.patient_id = patient_data.get('id', patient_data.get('patient_id', ''))
            patient.patient_name = patient_data.get('name', patient_data.get('patient_name', ''))
            
            dob = patient_data.get('date_of_birth')
            if dob:
                try:
                    patient.date_of_birth = datetime.fromisoformat(dob)
                except:
                    pass
            
            patient.gender = patient_data.get('gender', '')
        
        # 查找检查数据
        if 'tests' in data or 'examinations' in data:
            tests = data.get('tests', data.get('examinations', []))
            
            for test_data in tests:
                test = DataImporter._parse_json_test(test_data)
                
                if test.eye == 'left':
                    if patient.left_eye is None:
                        patient.left_eye = test
                    else:
                        patient.left_eye_history.append(test)
                elif test.eye == 'right':
                    if patient.right_eye is None:
                        patient.right_eye = test
                    else:
                        patient.right_eye_history.append(test)
        
        # 直接查找左右眼数据
        if 'left_eye' in data or 'left' in data:
            left_data = data.get('left_eye', data.get('left'))
            if left_data:
                test = DataImporter._parse_json_test(left_data)
                test.eye = 'left'
                if patient.left_eye is None:
                    patient.left_eye = test
                else:
                    patient.left_eye_history.append(test)
        
        if 'right_eye' in data or 'right' in data:
            right_data = data.get('right_eye', data.get('right'))
            if right_data:
                test = DataImporter._parse_json_test(right_data)
                test.eye = 'right'
                if patient.right_eye is None:
                    patient.right_eye = test
                else:
                    patient.right_eye_history.append(test)
        
        # 历史数据
        if 'history' in data:
            history = data['history']
            if 'left' in history:
                for hist_data in history['left']:
                    test = DataImporter._parse_json_test(hist_data)
                    test.eye = 'left'
                    patient.left_eye_history.append(test)
            if 'right' in history:
                for hist_data in history['right']:
                    test = DataImporter._parse_json_test(hist_data)
                    test.eye = 'right'
                    patient.right_eye_history.append(test)
        
        # 诊断信息
        patient.diagnosis = data.get('diagnosis', data.get('诊断', ''))
        patient.notes = data.get('notes', data.get('备注', ''))
        
        return patient
    
    @staticmethod
    def _parse_json_test(data: Dict[str, Any]) -> VisualFieldTest:
        """
        从JSON数据解析视野检查
        """
        test = VisualFieldTest()
        
        # 基本信息
        test.test_id = data.get('test_id', data.get('id', ''))
        test.patient_id = data.get('patient_id', '')
        test.patient_name = data.get('patient_name', '')
        
        test_date = data.get('test_date', data.get('date'))
        if test_date:
            try:
                if isinstance(test_date, str):
                    test.test_date = datetime.fromisoformat(test_date)
                else:
                    test.test_date = test_date
            except:
                pass
        
        test.eye = data.get('eye', '')
        # 标准化眼别
        eye_lower = test.eye.lower()
        if eye_lower in ['left', '左眼', 'l']:
            test.eye = 'left'
        elif eye_lower in ['right', '右眼', 'r']:
            test.eye = 'right'
        
        # 检查参数
        test.strategy = data.get('strategy', '')
        test.algorithm = data.get('algorithm', '')
        test.pupil_size = data.get('pupil_size', 0.0)
        test.visual_acuity = data.get('visual_acuity', data.get('va', ''))
        test.refraction = data.get('refraction', data.get('ref', ''))
        
        # 可靠性指标
        test.fixation_losses = data.get('fixation_losses', data.get('fl', 0))
        test.fixation_total = data.get('fixation_total', data.get('fixation_count', 0))
        test.false_positives = data.get('false_positives', data.get('fp', 0))
        test.false_positive_total = data.get('false_positive_total', data.get('fp_count', 0))
        test.false_negatives = data.get('false_negatives', data.get('fn', 0))
        test.false_negative_total = data.get('false_negative_total', data.get('fn_count', 0))
        
        # 全局指标
        test.md = data.get('md', 0.0)
        test.psd = data.get('psd', 0.0)
        test.vfi = data.get('vfi', 0.0)
        
        # 点位数据
        if 'points' in data:
            test.points = data['points']
        elif 'locations' in data:
            test.points = data['locations']
        
        # 聚类信息
        if 'clusters' in data:
            test.clusters = data['clusters']
        
        # 原始数据
        test.raw_data = data
        
        return test
    
    @staticmethod
    def import_yaml(file_path: str) -> ReliabilityRules:
        """
        从YAML文件导入设备可靠性规则
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if data is None:
            data = {}
        
        # 尝试直接从字典创建
        if 'fixation_loss_threshold' in data or 'name' in data:
            return ReliabilityRules.from_dict(data)
        
        # 尝试解析嵌套结构
        rules = ReliabilityRules()
        
        # 基本信息
        rules.name = data.get('name', "Imported Reliability Rules")
        rules.version = data.get('version', "1.0")
        
        # 阈值设置
        thresholds = data.get('thresholds', data.get('阈值', {}))
        
        # 固视丢失
        fixation = thresholds.get('fixation_loss', thresholds.get('固视丢失', {}))
        rules.fixation_loss_threshold = fixation.get('threshold', fixation.get('阈值', 0.2))
        rules.fixation_loss_warning = fixation.get('warning', fixation.get('警告', 0.15))
        rules.fixation_loss_critical = fixation.get('critical', fixation.get('严重', 0.3))
        
        # 假阳性
        fp = thresholds.get('false_positive', thresholds.get('假阳性', {}))
        rules.false_positive_threshold = fp.get('threshold', fp.get('阈值', 0.15))
        rules.false_positive_warning = fp.get('warning', fp.get('警告', 0.1))
        rules.false_positive_critical = fp.get('critical', fp.get('严重', 0.2))
        
        # 假阴性
        fn = thresholds.get('false_negative', thresholds.get('假阴性', {}))
        rules.false_negative_threshold = fn.get('threshold', fn.get('阈值', 0.2))
        rules.false_negative_warning = fn.get('warning', fn.get('警告', 0.15))
        rules.false_negative_critical = fn.get('critical', fn.get('严重', 0.3))
        
        # 权重设置
        weights = data.get('weights', data.get('权重', {}))
        rules.fixation_weight = weights.get('fixation', weights.get('固视丢失', 0.4))
        rules.false_positive_weight = weights.get('false_positive', weights.get('假阳性', 0.3))
        rules.false_negative_weight = weights.get('false_negative', weights.get('假阴性', 0.3))
        
        # 等级定义
        levels = data.get('levels', data.get('等级', {}))
        if levels:
            for level_name, level_info in levels.items():
                rules.levels[level_name] = {
                    'min_score': level_info.get('min_score', level_info.get('最低分', 0)),
                    'label': level_info.get('label', level_info.get('标签', level_name)),
                    'color': level_info.get('color', level_info.get('颜色', '#000000')),
                    'description': level_info.get('description', level_info.get('描述', ''))
                }
        
        # 附加规则
        if 'additional_rules' in data:
            rules.additional_rules = data['additional_rules']
        
        return rules
