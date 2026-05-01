import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from typing import Dict, List, Any

def generate_sample_data() -> Dict[str, pd.DataFrame]:
    np.random.seed(42)
    
    base_date = datetime(2026, 4, 30, 8, 0, 0)
    
    dishes = ['凯撒沙拉', '鸡胸肉藜麦碗', '三文鱼牛油果饭', '希腊酸奶碗', '越南春卷']
    stores = ['国贸店', '三里屯店', '望京店', '中关村店', '朝阳大悦城店']
    delivery_cars = ['京A12345', '京B67890', '京C11111', '京D22222']
    freezers = ['F001', 'F002', 'F003', 'F004']
    sample_results = ['合格', '不合格', '待检']
    
    batches_data = []
    temperatures_data = []
    handover_data = []
    samples_data = []
    
    for batch_idx in range(20):
        batch_number = f"B{20260430}{batch_idx:04d}"
        dish = np.random.choice(dishes)
        store = np.random.choice(stores)
        delivery_car = np.random.choice(delivery_cars)
        
        production_time = base_date + timedelta(hours=batch_idx * 0.5)
        
        if batch_idx == 3:
            outbound_time = production_time + timedelta(hours=3)
        else:
            outbound_time = production_time + timedelta(minutes=np.random.randint(30, 90))
        
        if batch_idx == 7:
            signoff_time = outbound_time - timedelta(minutes=30)
        else:
            signoff_time = outbound_time + timedelta(minutes=np.random.randint(20, 60))
        
        batches_data.append({
            '批次号': batch_number,
            '菜品': dish,
            '生产时间': production_time.strftime('%Y-%m-%d %H:%M:%S'),
            '出库时间': outbound_time.strftime('%Y-%m-%d %H:%M:%S'),
            '门店': store,
            '配送车': delivery_car,
            '状态': '已出库'
        })
        
        freezer = np.random.choice(freezers)
        temp_count = np.random.randint(8, 15)
        
        if batch_idx == 5:
            for i in range(temp_count):
                temp_time = outbound_time + timedelta(minutes=i * 10)
                if 3 <= i <= 6:
                    temp_value = np.random.uniform(5.0, 8.0)
                else:
                    temp_value = np.random.uniform(1.0, 3.5)
                
                temperatures_data.append({
                    '批次号': batch_number,
                    '冷柜编号': freezer,
                    '温度读数时间': temp_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '温度值': round(temp_value, 1)
                })
        elif batch_idx == 10:
            for i in range(temp_count):
                if 4 <= i <= 7:
                    continue
                temp_time = outbound_time + timedelta(minutes=i * 10)
                temp_value = np.random.uniform(1.0, 3.5)
                
                temperatures_data.append({
                    '批次号': batch_number,
                    '冷柜编号': freezer,
                    '温度读数时间': temp_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '温度值': round(temp_value, 1)
                })
        else:
            for i in range(temp_count):
                temp_time = outbound_time + timedelta(minutes=i * 10)
                temp_value = np.random.uniform(1.0, 3.5)
                
                temperatures_data.append({
                    '批次号': batch_number,
                    '冷柜编号': freezer,
                    '温度读数时间': temp_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '温度值': round(temp_value, 1)
                })
        
        handover_data.append({
            '批次号': batch_number,
            '交接签收时间': signoff_time.strftime('%Y-%m-%d %H:%M:%S'),
            '签收人': f'配送员{np.random.randint(1, 6)}',
            '门店签收人': f'门店员工{np.random.randint(1, 10)}'
        })
        
        if batch_idx == 12:
            continue
        elif batch_idx == 15:
            sample_number1 = f'S{20260430}{15:04d}'
            sample_number2 = f'S{20260430}{15:04d}'
            
            for sample_num in [sample_number1, sample_number2]:
                samples_data.append({
                    '批次号': batch_number,
                    '留样编号': sample_num,
                    '留样时间': (production_time + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S'),
                    '抽检时间': (production_time + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S'),
                    '抽检结论': '合格'
                })
        elif batch_idx == 18:
            sample_number = f'S{20260430}{18:04d}'
            samples_data.append({
                '批次号': batch_number,
                '留样编号': sample_number,
                '留样时间': (production_time + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S'),
                '抽检时间': (production_time + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S'),
                '抽检结论': '不合格'
            })
            
            batches_data[-1]['状态'] = '已出库'
        else:
            sample_number = f'S{20260430}{batch_idx:04d}'
            sample_result = np.random.choice(sample_results, p=[0.7, 0.1, 0.2])
            
            samples_data.append({
                '批次号': batch_number,
                '留样编号': sample_number,
                '留样时间': (production_time + timedelta(minutes=15)).strftime('%Y-%m-%d %H:%M:%S'),
                '抽检时间': (production_time + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S'),
                '抽检结论': sample_result
            })
    
    batches_df = pd.DataFrame(batches_data)
    temperatures_df = pd.DataFrame(temperatures_data)
    handover_df = pd.DataFrame(handover_data)
    samples_df = pd.DataFrame(samples_data)
    
    return {
        'batches': batches_df,
        'temperatures': temperatures_df,
        'handover': handover_df,
        'samples': samples_df
    }

def save_sample_data_to_csv(data: Dict[str, pd.DataFrame], output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)
    
    file_names = {
        'batches': '成品批次数据.csv',
        'temperatures': '冷柜温度记录.csv',
        'handover': '配送交接记录.csv',
        'samples': '留样抽检结果.csv'
    }
    
    for key, df in data.items():
        file_path = os.path.join(output_dir, file_names.get(key, f'{key}.csv'))
        df.to_csv(file_path, index=False, encoding='utf-8-sig')
        print(f"已保存: {file_path}")

def load_sample_data_from_csv(input_dir: str) -> Dict[str, pd.DataFrame]:
    file_patterns = {
        'batches': ['批次', 'batch'],
        'temperatures': ['温度', 'temperature'],
        'handover': ['交接', 'handover'],
        'samples': ['留样', 'sample', '抽检']
    }
    
    result = {}
    
    if not os.path.exists(input_dir):
        return result
    
    for file_name in os.listdir(input_dir):
        if not file_name.endswith('.csv'):
            continue
        
        file_path = os.path.join(input_dir, file_name)
        file_lower = file_name.lower()
        
        for key, patterns in file_patterns.items():
            if any(pattern.lower() in file_lower for pattern in patterns):
                df = pd.read_csv(file_path, encoding='utf-8-sig')
                result[key] = df
                break
    
    return result
