import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
from config import BINS_META, GARBAGE_TYPES, HOLIDAYS_2026


def generate_sample_records(output_path, start_date='2026-04-20', end_date='2026-04-30'):
    records = []
    record_id = 1

    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d')

    current_dt = start_dt

    while current_dt <= end_dt:
        date_str = current_dt.strftime('%Y-%m-%d')

        is_holiday = date_str in HOLIDAYS_2026
        is_weekend = current_dt.weekday() >= 5

        base_multiplier = 2.5 if is_holiday else (1.5 if is_weekend else 1.0)

        for bin_meta in BINS_META:
            bin_id = bin_meta['bin_id']
            bin_type = bin_meta['type']
            capacity = 240 if bin_meta['model'] == 'A' else (120 if bin_meta['model'] == 'B' else 60)

            daily_count = int(4 * base_multiplier)
            daily_count = max(2, daily_count)

            for i in range(daily_count):
                hour = random.randint(7, 21)
                minute = random.randint(0, 59)
                drop_time = current_dt.replace(hour=hour, minute=minute)

                if bin_type == '厨余':
                    volume = random.randint(10, 30) * base_multiplier
                elif bin_type == '可回收':
                    volume = random.randint(8, 25) * base_multiplier
                elif bin_type == '其他':
                    volume = random.randint(5, 20) * base_multiplier
                else:
                    volume = random.randint(2, 8) * base_multiplier

                volume = int(volume)

                records.append({
                    'record_id': f'REC-{record_id:04d}',
                    'bin_id': bin_id,
                    'drop_time': drop_time,
                    'volume_l': volume,
                    'source': random.choice(['app', 'manual', 'sensor']),
                    'submitter': f'User{random.randint(1, 5)}',
                    'submit_time': drop_time + timedelta(minutes=random.randint(0, 30)),
                    'status': 'valid'
                })
                record_id += 1

        current_dt += timedelta(days=1)

    dup_bin = BINS_META[1]
    dup_time = start_dt.replace(hour=9, minute=15)
    records.append({
        'record_id': f'REC-{record_id:04d}',
        'bin_id': dup_bin['bin_id'],
        'drop_time': dup_time,
        'volume_l': 25,
        'source': 'manual',
        'submitter': 'User1',
        'submit_time': dup_time,
        'status': 'valid'
    })
    record_id += 1

    records.append({
        'record_id': f'REC-{record_id:04d}',
        'bin_id': dup_bin['bin_id'],
        'drop_time': dup_time.replace(minute=17),
        'volume_l': 25,
        'source': 'manual',
        'submitter': 'User1',
        'submit_time': dup_time.replace(minute=20),
        'status': 'valid'
    })
    record_id += 1

    conflict_bin = BINS_META[7]
    conflict_time = start_dt.replace(hour=10, minute=0)
    records.append({
        'record_id': f'REC-{record_id:04d}',
        'bin_id': conflict_bin['bin_id'],
        'drop_time': conflict_time,
        'volume_l': 200,
        'source': 'manual',
        'submitter': 'User3',
        'submit_time': conflict_time,
        'status': 'valid'
    })
    record_id += 1

    records.append({
        'record_id': f'REC-{record_id:04d}',
        'bin_id': conflict_bin['bin_id'],
        'drop_time': conflict_time.replace(hour=11),
        'volume_l': 150,
        'source': 'manual',
        'submitter': 'User3',
        'submit_time': conflict_time.replace(hour=11),
        'status': 'valid'
    })

    df = pd.DataFrame(records)
    df = df.sort_values('drop_time')
    df.to_csv(output_path, index=False, encoding='utf-8-sig')

    return len(df)


if __name__ == '__main__':
    count = generate_sample_records('data/sample_records.csv')
    print(f'生成样例数据共 {count} 条记录')
