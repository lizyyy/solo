"""
生成结算附件样例数据
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

os.makedirs('data/samples', exist_ok=True)

def generate_transaction_samples():
    np.random.seed(42)
    
    n_records = 50
    start_date = datetime(2024, 1, 1)
    
    data = []
    for i in range(n_records):
        txn_date = start_date + timedelta(days=np.random.randint(0, 30))
        amount = round(np.random.uniform(100, 5000), 2)
        fee = round(amount * np.random.uniform(0.003, 0.005), 2)
        settlement = round(amount - fee, 2)
        
        data.append({
            '交易流水号': f'TXN{202401000000 + i + 1}',
            '交易日期': txn_date.strftime('%Y-%m-%d'),
            '卡号': f'622202****{np.random.randint(1000, 9999)}',
            '卡类型': np.random.choice(['储值卡', '礼品卡', '员工卡']),
            '交易金额': amount,
            '手续费': fee,
            '结算金额': settlement,
            '商户号': f'MCH{np.random.randint(10000, 99999)}',
            '商户名称': np.random.choice(['XX超市', 'YY商场', 'ZZ餐饮', 'AA便利店', 'BB百货']),
            '终端号': f'TRM{np.random.randint(1000, 9999)}',
            '订单号': f'ORD{txn_date.strftime("%Y%m%d")}{np.random.randint(10000, 99999)}'
        })
    
    dup_idx = np.random.randint(0, n_records)
    dup_record = data[dup_idx].copy()
    dup_record['交易流水号'] = f'TXN{202401000000 + n_records + 1}'
    dup_record['备注'] = '重复入账测试'
    data.append(dup_record)
    
    df = pd.DataFrame(data)
    df.to_excel('data/samples/交易明细样例.xlsx', index=False, engine='openpyxl')
    print("交易明细样例已生成: data/samples/交易明细样例.xlsx")
    return df

def generate_settlement_samples():
    np.random.seed(42)
    
    n_records = 10
    start_date = datetime(2024, 1, 2)
    
    data = []
    for i in range(n_records):
        settle_date = start_date + timedelta(days=i * 3)
        if settle_date.day > 31:
            continue
            
        total_amount = round(np.random.uniform(5000, 20000), 2)
        total_fee = round(total_amount * 0.004, 2)
        net_settlement = round(total_amount - total_fee, 2)
        
        data.append({
            '结算流水号': f'SET{20240100000 + i + 1}',
            '结算日期': settle_date.strftime('%Y-%m-%d'),
            '批次号': f'BATCH{settle_date.strftime("%Y%m%d")}',
            '交易总金额': total_amount,
            '手续费总额': total_fee,
            '实际结算金额': net_settlement,
            '交易笔数': np.random.randint(3, 10),
            '结算账户': '622202********1234'
        })
    
    df = pd.DataFrame(data)
    df.to_excel('data/samples/结算记录样例.xlsx', index=False, engine='openpyxl')
    print("结算记录样例已生成: data/samples/结算记录样例.xlsx")
    return df

if __name__ == '__main__':
    generate_transaction_samples()
    generate_settlement_samples()
    print("\n样例数据生成完成！")
