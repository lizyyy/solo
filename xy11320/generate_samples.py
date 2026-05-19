#!/usr/bin/env python3
import pandas as pd
from datetime import datetime, timedelta


def generate_normal_sample():
    """生成正常数据样例"""
    data = [
        {
            'record_no': 'REC001',
            'tractor_no': 'TRACTOR01',
            'operator': '张三',
            'work_date': '2024-05-01',
            'work_type': '耕地',
            'billing_type': 'hourly',
            'hours': 8,
            'hourly_rate': 150,
            'area': None,
            'area_rate': None,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 1200
        },
        {
            'record_no': 'REC002',
            'tractor_no': 'TRACTOR02',
            'operator': '李四',
            'work_date': '2024-05-02',
            'work_type': '播种',
            'billing_type': 'by_area',
            'hours': None,
            'hourly_rate': None,
            'area': 50,
            'area_rate': 60,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 3000
        },
        {
            'record_no': 'REC003',
            'tractor_no': 'TRACTOR01',
            'operator': '张三',
            'work_date': '2024-05-03',
            'work_type': '运输',
            'billing_type': 'fuel',
            'hours': None,
            'hourly_rate': None,
            'area': None,
            'area_rate': None,
            'fuel_consumption': 100,
            'fuel_price': 7.5,
            'total_amount': 750
        },
        {
            'record_no': 'REC004',
            'tractor_no': 'TRACTOR03',
            'operator': '王五',
            'work_date': '2024-05-04',
            'work_type': '收割',
            'billing_type': 'mixed',
            'hours': 6,
            'hourly_rate': 200,
            'area': 30,
            'area_rate': 50,
            'fuel_consumption': 50,
            'fuel_price': 7.5,
            'total_amount': 2775
        },
        {
            'record_no': 'REC005',
            'tractor_no': 'TRACTOR02',
            'operator': '李四',
            'work_date': '2024-05-05',
            'work_type': '耕地',
            'billing_type': 'hourly',
            'hours': 10,
            'hourly_rate': 150,
            'area': None,
            'area_rate': None,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 1500
        }
    ]
    
    df = pd.DataFrame(data)
    df.to_excel('sample_normal.xlsx', index=False)
    print("已生成: sample_normal.xlsx (5条正常数据)")
    return df


def generate_mixed_sample():
    """生成包含异常数据的混合样例"""
    data = [
        {
            'record_no': 'REC101',
            'tractor_no': 'TRACTOR01',
            'operator': '张三',
            'work_date': '2024-05-10',
            'work_type': '耕地',
            'billing_type': 'hourly',
            'hours': 8,
            'hourly_rate': 150,
            'area': None,
            'area_rate': None,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 1200
        },
        {
            'record_no': 'REC102',
            'tractor_no': 'TRACTOR02',
            'operator': None,
            'work_date': '2024-05-11',
            'work_type': '播种',
            'billing_type': 'by_area',
            'hours': None,
            'hourly_rate': None,
            'area': 50,
            'area_rate': 60,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 3000
        },
        {
            'record_no': 'REC103',
            'tractor_no': 'TRACTOR01',
            'operator': '张三',
            'work_date': '2024-05-12',
            'work_type': '运输',
            'billing_type': 'unknown_type',
            'hours': None,
            'hourly_rate': None,
            'area': None,
            'area_rate': None,
            'fuel_consumption': 100,
            'fuel_price': 7.5,
            'total_amount': 750
        },
        {
            'record_no': 'REC104',
            'tractor_no': 'TRACTOR03',
            'operator': '王五',
            'work_date': '2024-05-33',
            'work_type': '收割',
            'billing_type': 'mixed',
            'hours': 6,
            'hourly_rate': 200,
            'area': 30,
            'area_rate': 50,
            'fuel_consumption': 50,
            'fuel_price': 7.5,
            'total_amount': 2775
        },
        {
            'record_no': 'REC105',
            'tractor_no': 'TRACTOR02',
            'operator': '李四',
            'work_date': '2024-05-15',
            'work_type': '耕地',
            'billing_type': 'hourly',
            'hours': None,
            'hourly_rate': 150,
            'area': None,
            'area_rate': None,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 1500
        },
        {
            'record_no': 'REC106',
            'tractor_no': 'TRACTOR04',
            'operator': '赵六',
            'work_date': '2024-05-16',
            'work_type': '耕地',
            'billing_type': 'hourly',
            'hours': 8,
            'hourly_rate': 150,
            'area': None,
            'area_rate': None,
            'fuel_consumption': None,
            'fuel_price': None,
            'total_amount': 99999
        }
    ]
    
    df = pd.DataFrame(data)
    df.to_excel('sample_mixed.xlsx', index=False)
    print("已生成: sample_mixed.xlsx (6条混合数据, 包含5条异常)")
    print("  异常说明:")
    print("  - REC102: 缺少机手姓名 (missing_field)")
    print("  - REC103: 计费类型无效 (invalid_value)")
    print("  - REC104: 日期格式错误 (invalid_value)")
    print("  - REC105: 缺少小时数但按时计费 (missing_field)")
    print("  - REC106: 金额不匹配 1200 vs 99999 (calculation_error)")
    return df


def generate_batch_sample():
    """生成批量测试数据"""
    base_date = datetime(2024, 5, 1)
    operators = ['张三', '李四', '王五', '赵六', '钱七']
    tractors = ['TRACTOR01', 'TRACTOR02', 'TRACTOR03', 'TRACTOR04']
    work_types = ['耕地', '播种', '收割', '运输', '打药']
    billing_types = ['hourly', 'by_area', 'fuel', 'mixed']
    
    data = []
    for i in range(20):
        billing_type = billing_types[i % 4]
        row = {
            'record_no': f'BATCH{i+1:03d}',
            'tractor_no': tractors[i % 4],
            'operator': operators[i % 5],
            'work_date': (base_date + timedelta(days=i)).strftime('%Y-%m-%d'),
            'work_type': work_types[i % 5],
            'billing_type': billing_type,
            'hours': 8 if billing_type in ['hourly', 'mixed'] else None,
            'hourly_rate': 150 if billing_type in ['hourly', 'mixed'] else None,
            'area': 50 if billing_type in ['by_area', 'mixed'] else None,
            'area_rate': 60 if billing_type in ['by_area', 'mixed'] else None,
            'fuel_consumption': 80 if billing_type in ['fuel', 'mixed'] else None,
            'fuel_price': 7.5 if billing_type in ['fuel', 'mixed'] else None,
            'total_amount': None
        }
        data.append(row)
    
    df = pd.DataFrame(data)
    df.to_excel('sample_batch.xlsx', index=False)
    print(f"已生成: sample_batch.xlsx ({len(data)}条批量数据)")
    return df


if __name__ == '__main__':
    print("=" * 50)
    print("农机财务系统 - 样例数据生成")
    print("=" * 50)
    
    generate_normal_sample()
    print()
    generate_mixed_sample()
    print()
    generate_batch_sample()
    print()
    print("=" * 50)
    print("所有样例数据已生成完成!")
