"""数据导入模块 - 样本导入作为入口"""

import os
import json
import csv
from typing import List, Dict, Any
from datetime import datetime

from .models import TrapRecord, PestCount


class DataLoader:
    """数据加载器"""

    def __init__(self):
        pass

    def load_from_json(self, file_path: str) -> List[TrapRecord]:
        """从JSON文件加载数据"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"数据文件不存在: {file_path}")

        with open(file_path, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)

        records = raw_data.get('records', []) if isinstance(raw_data, dict) else raw_data
        return self._parse_records(records)

    def load_from_csv(self, file_path: str) -> List[TrapRecord]:
        """从CSV文件加载数据"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"数据文件不存在: {file_path}")

        records = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(self._row_to_dict(row))

        return self._parse_records(records)

    def load_sample_data(self, sample_type: str = 'all') -> List[TrapRecord]:
        """加载样例数据"""
        samples = self._get_sample_data()

        if sample_type == 'normal':
            return self._parse_records([s for s in samples if s.get('sample_type') == 'normal'])
        elif sample_type == 'abnormal':
            return self._parse_records([s for s in samples if s.get('sample_type') != 'normal'])
        else:
            return self._parse_records(samples)

    def _row_to_dict(self, row: Dict[str, str]) -> Dict[str, Any]:
        """将CSV行转换为字典"""
        result = {
            'record_id': row.get('record_id', ''),
            'trap_board_id': row.get('trap_board_id', ''),
            'greenhouse_id': row.get('greenhouse_id', ''),
            'capture_date': row.get('capture_date', ''),
            'board_type': row.get('board_type', ''),
            'board_type_name': row.get('board_type_name', row.get('board_type', '')),
            'image_path': row.get('image_path', ''),
            'capture_time': row.get('capture_time', ''),
            'operator': row.get('operator', ''),
            'remark': row.get('remark', ''),
            'total_ai_count': self._safe_int(row.get('total_ai_count', '0')),
            'total_final_count': self._safe_int(row.get('total_final_count', '0')),
            'pest_counts': [],
            'sample_type': row.get('sample_type', 'normal'),
            'abnormal_type': row.get('abnormal_type', '')
        }

        for pest_key in ['aphid', 'whitefly', 'thrips', 'spider_mite', 'leafminer']:
            ai_key = f'{pest_key}_ai_count'
            r1_key = f'{pest_key}_round1'
            r2_key = f'{pest_key}_round2'
            final_key = f'{pest_key}_final_count'
            corrected_key = f'{pest_key}_is_corrected'

            if ai_key in row:
                result['pest_counts'].append({
                    'pest_type': pest_key,
                    'pest_name': row.get(f'{pest_key}_name', pest_key),
                    'ai_count': self._safe_int(row.get(ai_key, '0')),
                    'manual_count_round1': self._safe_int(row.get(r1_key, ''), None),
                    'manual_count_round2': self._safe_int(row.get(r2_key, ''), None),
                    'final_count': self._safe_int(row.get(final_key, row.get(ai_key, '0'))),
                    'is_manual_corrected': str(row.get(corrected_key, 'false')).lower() == 'true',
                    'correction_reason': row.get(f'{pest_key}_correction_reason', '')
                })

        return result

    def _safe_int(self, value: str, default: Any = 0) -> Any:
        """安全转换整数"""
        if value is None or value == '':
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def _parse_records(self, raw_records: List[Dict[str, Any]]) -> List[TrapRecord]:
        """解析记录"""
        trap_records = []

        for idx, raw in enumerate(raw_records):
            record_id = raw.get('record_id', f'REC_{idx + 1:04d}')

            pest_counts = []
            for pc_raw in raw.get('pest_counts', []):
                pest_counts.append(PestCount(
                    pest_type=pc_raw.get('pest_type', ''),
                    pest_name=pc_raw.get('pest_name', pc_raw.get('pest_type', '')),
                    ai_count=pc_raw.get('ai_count', 0),
                    manual_count_round1=pc_raw.get('manual_count_round1'),
                    manual_count_round2=pc_raw.get('manual_count_round2'),
                    final_count=pc_raw.get('final_count', pc_raw.get('ai_count', 0)),
                    is_manual_corrected=pc_raw.get('is_manual_corrected', False),
                    correction_reason=pc_raw.get('correction_reason')
                ))

            trap_record = TrapRecord(
                record_id=record_id,
                trap_board_id=raw.get('trap_board_id', ''),
                greenhouse_id=raw.get('greenhouse_id', ''),
                capture_date=raw.get('capture_date', ''),
                board_type=raw.get('board_type', ''),
                board_type_name=raw.get('board_type_name', raw.get('board_type', '')),
                image_path=raw.get('image_path'),
                capture_time=raw.get('capture_time'),
                operator=raw.get('operator'),
                remark=raw.get('remark'),
                pest_counts=pest_counts,
                total_ai_count=raw.get('total_ai_count', 0),
                total_final_count=raw.get('total_final_count', 0),
                raw_data=raw
            )

            trap_records.append(trap_record)

        return trap_records

    def _get_sample_data(self) -> List[Dict[str, Any]]:
        """获取样例数据"""
        today_str = datetime.now().strftime('%Y-%m-%d')
        yesterday_str = (datetime.now().replace(day=datetime.now().day - 1)).strftime('%Y-%m-%d')

        return [
            {
                'record_id': 'REC_0001',
                'sample_type': 'normal',
                'abnormal_type': '',
                'trap_board_id': 'GH01-Y01',
                'greenhouse_id': 'GH01',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH01-Y01_20240509.jpg',
                'capture_time': '08:30:00',
                'operator': '张三',
                'remark': '诱捕板位于温室1号入口左侧，安装高度1.2米',
                'total_ai_count': 45,
                'total_final_count': 45,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 28,
                        'manual_count_round1': 28,
                        'manual_count_round2': 27,
                        'final_count': 28,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 12,
                        'manual_count_round1': 12,
                        'manual_count_round2': 12,
                        'final_count': 12,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'thrips',
                        'pest_name': '蓟马',
                        'ai_count': 5,
                        'manual_count_round1': 5,
                        'manual_count_round2': 5,
                        'final_count': 5,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0002',
                'sample_type': 'normal',
                'abnormal_type': '',
                'trap_board_id': 'GH02-B01',
                'greenhouse_id': 'GH02',
                'capture_date': yesterday_str,
                'board_type': 'blue',
                'board_type_name': '蓝板',
                'image_path': '/images/GH02-B01_20240509.jpg',
                'capture_time': '09:15:00',
                'operator': '李四',
                'remark': '诱捕板位于温室2号中部，黄瓜种植区',
                'total_ai_count': 23,
                'total_final_count': 23,
                'pest_counts': [
                    {
                        'pest_type': 'thrips',
                        'pest_name': '蓟马',
                        'ai_count': 18,
                        'manual_count_round1': 18,
                        'manual_count_round2': 18,
                        'final_count': 18,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 5,
                        'manual_count_round1': 5,
                        'manual_count_round2': 5,
                        'final_count': 5,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0003',
                'sample_type': 'abnormal',
                'abnormal_type': 'duplicate',
                'trap_board_id': 'GH01-Y01',
                'greenhouse_id': 'GH01',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH01-Y01_20240509_dup.jpg',
                'capture_time': '08:32:00',
                'operator': '王五',
                'remark': '这是一条重复记录，与REC_0001为同一诱捕板同一天',
                'total_ai_count': 45,
                'total_final_count': 45,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 28,
                        'manual_count_round1': 28,
                        'manual_count_round2': 28,
                        'final_count': 28,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 12,
                        'manual_count_round1': 12,
                        'manual_count_round2': 12,
                        'final_count': 12,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'thrips',
                        'pest_name': '蓟马',
                        'ai_count': 5,
                        'manual_count_round1': 5,
                        'manual_count_round2': 5,
                        'final_count': 5,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0004',
                'sample_type': 'abnormal',
                'abnormal_type': 'missing_fields',
                'trap_board_id': '',
                'greenhouse_id': 'GH03',
                'capture_date': yesterday_str,
                'board_type': '',
                'board_type_name': '',
                'image_path': None,
                'capture_time': None,
                'operator': None,
                'remark': '这条记录缺少诱捕板编号和板类型两个必填字段',
                'total_ai_count': 15,
                'total_final_count': 15,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 10,
                        'manual_count_round1': 10,
                        'manual_count_round2': 10,
                        'final_count': 10,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 5,
                        'manual_count_round1': 5,
                        'manual_count_round2': 5,
                        'final_count': 5,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0005',
                'sample_type': 'abnormal',
                'abnormal_type': 'manual_correction_large',
                'trap_board_id': 'GH03-Y02',
                'greenhouse_id': 'GH03',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH03-Y02_20240509.jpg',
                'capture_time': '10:00:00',
                'operator': '赵六',
                'remark': 'AI识别严重错误，粉虱被误识别为灰尘，人工修正幅度大',
                'total_ai_count': 30,
                'total_final_count': 85,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 20,
                        'manual_count_round1': 22,
                        'manual_count_round2': 21,
                        'final_count': 22,
                        'is_manual_corrected': True,
                        'correction_reason': '边界虫体补充计数'
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 10,
                        'manual_count_round1': 63,
                        'manual_count_round2': 61,
                        'final_count': 63,
                        'is_manual_corrected': True,
                        'correction_reason': 'AI漏检严重，大量粉虱被误判为背景'
                    }
                ]
            },
            {
                'record_id': 'REC_0006',
                'sample_type': 'abnormal',
                'abnormal_type': 'rounds_inconsistent',
                'trap_board_id': 'GH04-Y01',
                'greenhouse_id': 'GH04',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH04-Y01_20240509.jpg',
                'capture_time': '14:30:00',
                'operator': '张三',
                'remark': '两人人工复核结果差异较大，需要第三轮复核',
                'total_ai_count': 50,
                'total_final_count': 70,
                'pest_counts': [
                    {
                        'pest_type': 'thrips',
                        'pest_name': '蓟马',
                        'ai_count': 50,
                        'manual_count_round1': 60,
                        'manual_count_round2': 70,
                        'final_count': 70,
                        'is_manual_corrected': True,
                        'correction_reason': '使用第二轮复核结果'
                    }
                ]
            },
            {
                'record_id': 'REC_0007',
                'sample_type': 'abnormal',
                'abnormal_type': 'invalid_date',
                'trap_board_id': 'GH05-Y01',
                'greenhouse_id': 'GH05',
                'capture_date': '2030-01-01',
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH05-Y01_20300101.jpg',
                'capture_time': '09:00:00',
                'operator': '李四',
                'remark': '日期输入错误，应该是2024年',
                'total_ai_count': 25,
                'total_final_count': 25,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 15,
                        'manual_count_round1': 15,
                        'manual_count_round2': 15,
                        'final_count': 15,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 10,
                        'manual_count_round1': 10,
                        'manual_count_round2': 10,
                        'final_count': 10,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0008',
                'sample_type': 'abnormal',
                'abnormal_type': 'negative_count',
                'trap_board_id': 'GH06-Y01',
                'greenhouse_id': 'GH06',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH06-Y01_20240509.jpg',
                'capture_time': '11:00:00',
                'operator': '王五',
                'remark': '负数计数错误，可能是输入时误按了减号',
                'total_ai_count': 5,
                'total_final_count': 5,
                'pest_counts': [
                    {
                        'pest_type': 'spider_mite',
                        'pest_name': '红蜘蛛',
                        'ai_count': -5,
                        'manual_count_round1': 5,
                        'manual_count_round2': 5,
                        'final_count': 5,
                        'is_manual_corrected': True,
                        'correction_reason': '修正AI负数错误'
                    }
                ]
            },
            {
                'record_id': 'REC_0009',
                'sample_type': 'abnormal',
                'abnormal_type': 'excessive_count',
                'trap_board_id': 'GH07-Y01',
                'greenhouse_id': 'GH07',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH07-Y01_20240509.jpg',
                'capture_time': '13:00:00',
                'operator': '赵六',
                'remark': '计数异常偏高，可能是把灰尘、斑点等误识别为虫害',
                'total_ai_count': 350,
                'total_final_count': 45,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 350,
                        'manual_count_round1': 42,
                        'manual_count_round2': 45,
                        'final_count': 45,
                        'is_manual_corrected': True,
                        'correction_reason': 'AI严重误识别，大量背景杂质被算作蚜虫'
                    }
                ]
            },
            {
                'record_id': 'REC_0010',
                'sample_type': 'abnormal',
                'abnormal_type': 'unexpected_pest',
                'trap_board_id': 'GH08-Y01',
                'greenhouse_id': 'GH08',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH08-Y01_20240509.jpg',
                'capture_time': '15:00:00',
                'operator': '张三',
                'remark': '出现规则库中未定义的虫害类型，可能是新发现的虫害或录入错误',
                'total_ai_count': 30,
                'total_final_count': 30,
                'pest_counts': [
                    {
                        'pest_type': 'unknown_bug',
                        'pest_name': '未知甲虫',
                        'ai_count': 15,
                        'manual_count_round1': 15,
                        'manual_count_round2': 15,
                        'final_count': 15,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 15,
                        'manual_count_round1': 15,
                        'manual_count_round2': 15,
                        'final_count': 15,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0011',
                'sample_type': 'abnormal',
                'abnormal_type': 'sum_inconsistent',
                'trap_board_id': 'GH09-Y01',
                'greenhouse_id': 'GH09',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH09-Y01_20240509.jpg',
                'capture_time': '16:00:00',
                'operator': '李四',
                'remark': '计数总和不一致，分项之和与总计数不符',
                'total_ai_count': 100,
                'total_final_count': 50,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 20,
                        'manual_count_round1': 20,
                        'manual_count_round2': 20,
                        'final_count': 20,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 15,
                        'manual_count_round1': 15,
                        'manual_count_round2': 15,
                        'final_count': 15,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'thrips',
                        'pest_name': '蓟马',
                        'ai_count': 10,
                        'manual_count_round1': 10,
                        'manual_count_round2': 10,
                        'final_count': 10,
                        'is_manual_corrected': False
                    }
                ]
            },
            {
                'record_id': 'REC_0012',
                'sample_type': 'normal',
                'abnormal_type': '',
                'trap_board_id': 'GH10-Y01',
                'greenhouse_id': 'GH10',
                'capture_date': yesterday_str,
                'board_type': 'yellow',
                'board_type_name': '黄板',
                'image_path': '/images/GH10-Y01_20240509.jpg',
                'capture_time': '17:00:00',
                'operator': '王五',
                'remark': '虫量较高，达到高预警阈值，需要防治',
                'total_ai_count': 200,
                'total_final_count': 200,
                'pest_counts': [
                    {
                        'pest_type': 'aphid',
                        'pest_name': '蚜虫',
                        'ai_count': 150,
                        'manual_count_round1': 148,
                        'manual_count_round2': 150,
                        'final_count': 150,
                        'is_manual_corrected': False
                    },
                    {
                        'pest_type': 'whitefly',
                        'pest_name': '粉虱',
                        'ai_count': 50,
                        'manual_count_round1': 50,
                        'manual_count_round2': 50,
                        'final_count': 50,
                        'is_manual_corrected': False
                    }
                ]
            }
        ]
