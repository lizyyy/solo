import pandas as pd

df = pd.read_csv('samples/潮汐发电功率预测台账_样例.csv', dtype=str, encoding='utf-8-sig')

print('=== 关键记录验证 ===')
print()

for rid in ['TIDAL-2024-101', 'TIDAL-2024-103', 'TIDAL-2024-105', 'TIDAL-2024-108']:
    row = df[df['记录编号'] == rid].iloc[0]
    print(f'{rid}:')
    print(f'  数据来源: {row["数据来源"]}')
    print(f'  水轮机效率: {row["水轮机效率"]}')
    print(f'  备注: {row["备注"]}')
    if rid == 'TIDAL-2024-105':
        print(f'  流速: {row["流速"]}')
        print(f'  流速单位: {row["流速单位"]}')
        print(f'  过水面积: {row["过水面积"]}')
        print(f'  面积单位: {row["面积单位"]}')
    print()
