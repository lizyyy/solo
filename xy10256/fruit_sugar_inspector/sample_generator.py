import json
import random
import os
from typing import Dict, List, Any


class SampleGenerator:
    def __init__(self, seed: int = 42):
        random.seed(seed)

    def generate_normal_batch(self, batch_id: str, fruit_type: str, batch_size: int = 2000,
                              target_grade: str = '一级', output_dir: str = 'data/samples') -> Dict[str, Any]:
        sugar_range = self._get_sugar_range_for_grade(fruit_type, target_grade)
        
        measurements = []
        for i in range(batch_size):
            sugar = round(random.uniform(sugar_range['min'], sugar_range['max']), 1)
            measurements.append({
                'id': f'S{batch_id}_{i+1:04d}',
                'sugar': sugar,
                'measurement_time': f'2026-05-10 {random.randint(8, 18):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}'
            })
        
        batch_data = {
            'batch_id': batch_id,
            'fruit_type': fruit_type,
            'batch_size': batch_size,
            'production_date': '2026-05-08',
            'source_farm': f'{fruit_type}_farm_001',
            'target_grade': target_grade,
            'description': f'正常批次 - {fruit_type} - 目标等级 {target_grade}',
            'measurements': measurements
        }
        
        if output_dir:
            filepath = os.path.join(output_dir, f'{batch_id}.json')
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, ensure_ascii=False, indent=2)
        
        return batch_data

    def generate_batch_with_controversy(self, batch_id: str, fruit_type: str, 
                                        batch_size: int = 2000, output_dir: str = 'data/samples') -> Dict[str, Any]:
        measurements = []
        boundary = self._get_grade_boundary(fruit_type, '一级', '二级')
        
        for i in range(batch_size):
            rand_val = random.random()
            if rand_val < 0.45:
                sugar = round(random.uniform(boundary + 0.01, boundary + 1.0), 1)
            elif rand_val < 0.90:
                sugar = round(random.uniform(boundary - 0.3, boundary + 0.3), 1)
            else:
                sugar = round(random.uniform(boundary - 1.5, boundary - 0.31), 1)
            
            measurements.append({
                'id': f'S{batch_id}_{i+1:04d}',
                'sugar': sugar,
                'measurement_time': f'2026-05-10 {random.randint(8, 18):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}'
            })
        
        batch_data = {
            'batch_id': batch_id,
            'fruit_type': fruit_type,
            'batch_size': batch_size,
            'production_date': '2026-05-08',
            'source_farm': f'{fruit_type}_farm_002',
            'description': f'等级争议批次 - {fruit_type} - 大量样本靠近分级边界',
            'controversy_type': 'near_boundary',
            'measurements': measurements
        }
        
        if output_dir:
            filepath = os.path.join(output_dir, f'{batch_id}.json')
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, ensure_ascii=False, indent=2)
        
        return batch_data

    def generate_batch_with_mixing(self, batch_id: str, fruit_type: str, 
                                   batch_size: int = 2000, output_dir: str = 'data/samples') -> Dict[str, Any]:
        measurements = []
        
        high_grade_range = self._get_sugar_range_for_grade(fruit_type, '特级')
        low_grade_range = self._get_sugar_range_for_grade(fruit_type, '二级')
        
        for i in range(batch_size):
            if random.random() < 0.70:
                sugar = round(random.uniform(high_grade_range['min'], high_grade_range['max']), 1)
            else:
                sugar = round(random.uniform(low_grade_range['min'], low_grade_range['max']), 1)
            
            measurements.append({
                'id': f'S{batch_id}_{i+1:04d}',
                'sugar': sugar,
                'measurement_time': f'2026-05-10 {random.randint(8, 18):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}'
            })
        
        batch_data = {
            'batch_id': batch_id,
            'fruit_type': fruit_type,
            'batch_size': batch_size,
            'production_date': '2026-05-08',
            'source_farm': f'{fruit_type}_farm_003',
            'description': f'批次混入批次 - {fruit_type} - 两个不同等级批次混合',
            'mixing_type': 'two_batches_mixed',
            'measurements': measurements
        }
        
        if output_dir:
            filepath = os.path.join(output_dir, f'{batch_id}.json')
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, ensure_ascii=False, indent=2)
        
        return batch_data

    def generate_batch_with_low_samples(self, batch_id: str, fruit_type: str, 
                                        batch_size: int = 500, output_dir: str = 'data/samples') -> Dict[str, Any]:
        sugar_range = self._get_sugar_range_for_grade(fruit_type, '一级')
        
        measurements = []
        for i in range(min(50, batch_size)):
            sugar = round(random.uniform(sugar_range['min'], sugar_range['max']), 1)
            measurements.append({
                'id': f'S{batch_id}_{i+1:04d}',
                'sugar': sugar,
                'measurement_time': f'2026-05-10 {random.randint(8, 18):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}'
            })
        
        batch_data = {
            'batch_id': batch_id,
            'fruit_type': fruit_type,
            'batch_size': batch_size,
            'production_date': '2026-05-08',
            'source_farm': f'{fruit_type}_farm_004',
            'description': f'抽样不足批次 - {fruit_type} - 抽样数量低于最低要求',
            'sample_issue': 'insufficient_measurements',
            'measurements': measurements
        }
        
        if output_dir:
            filepath = os.path.join(output_dir, f'{batch_id}.json')
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(batch_data, f, ensure_ascii=False, indent=2)
        
        return batch_data

    def _get_sugar_range_for_grade(self, fruit_type: str, grade: str) -> Dict[str, float]:
        ranges = {
            'apple': {
                '特级': {'min': 14.5, 'max': 16.5},
                '一级': {'min': 12.5, 'max': 13.5},
                '二级': {'min': 10.5, 'max': 11.5},
                '等外': {'min': 8.0, 'max': 9.5}
            },
            'pear': {
                '特级': {'min': 13.5, 'max': 15.5},
                '一级': {'min': 11.5, 'max': 12.5},
                '二级': {'min': 9.5, 'max': 10.5},
                '等外': {'min': 7.0, 'max': 8.5}
            },
            'orange': {
                '特级': {'min': 12.5, 'max': 14.5},
                '一级': {'min': 10.5, 'max': 11.5},
                '二级': {'min': 9.0, 'max': 10.0},
                '等外': {'min': 6.0, 'max': 8.0}
            }
        }
        
        fruit_ranges = ranges.get(fruit_type, ranges['apple'])
        return fruit_ranges.get(grade, fruit_ranges['一级'])

    def _get_grade_boundary(self, fruit_type: str, upper_grade: str, lower_grade: str) -> float:
        boundaries = {
            'apple': {'一级': 12.0, '二级': 10.0, '特级': 14.0},
            'pear': {'一级': 11.0, '二级': 9.0, '特级': 13.0},
            'orange': {'一级': 10.0, '二级': 8.5, '特级': 12.0}
        }
        
        fruit_boundaries = boundaries.get(fruit_type, boundaries['apple'])
        return fruit_boundaries.get(upper_grade, 12.0)


def generate_all_samples(output_dir: str = 'data/samples'):
    generator = SampleGenerator(seed=42)
    
    print('正在生成样例数据...')
    
    print('1. 正常批次 (苹果-一级)...')
    generator.generate_normal_batch(
        batch_id='BATCH_APPLE_001',
        fruit_type='apple',
        batch_size=2000,
        target_grade='一级',
        output_dir=output_dir
    )
    
    print('2. 正常批次 (梨-特级)...')
    generator.generate_normal_batch(
        batch_id='BATCH_PEAR_001',
        fruit_type='pear',
        batch_size=1500,
        target_grade='特级',
        output_dir=output_dir
    )
    
    print('3. 等级争议批次 (柑橘)...')
    generator.generate_batch_with_controversy(
        batch_id='BATCH_ORANGE_002',
        fruit_type='orange',
        batch_size=2000,
        output_dir=output_dir
    )
    
    print('4. 批次混入批次 (苹果)...')
    generator.generate_batch_with_mixing(
        batch_id='BATCH_APPLE_002',
        fruit_type='apple',
        batch_size=2000,
        output_dir=output_dir
    )
    
    print('5. 抽样不足批次 (梨)...')
    generator.generate_batch_with_low_samples(
        batch_id='BATCH_PEAR_002',
        fruit_type='pear',
        batch_size=1000,
        output_dir=output_dir
    )
    
    print('\n所有样例数据已生成完成!')
    print(f'输出目录: {output_dir}')
    print('\n生成的文件:')
    for f in os.listdir(output_dir):
        if f.endswith('.json'):
            filepath = os.path.join(output_dir, f)
            size = os.path.getsize(filepath)
            print(f'  - {f} ({size/1024:.1f} KB)')


if __name__ == '__main__':
    import sys
    output_dir = sys.argv[1] if len(sys.argv) > 1 else 'data/samples'
    generate_all_samples(output_dir)
