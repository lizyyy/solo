#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
import random
from datetime import datetime, timedelta


def generate_sample_files(output_dir='./samples'):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    books_data = [
        {
            '书名': '活着',
            '作者': '余华',
            '出版社': '作家出版社',
            '定价': '39.00'
        },
        {
            '书名': '三体',
            '作者': '刘慈欣',
            '出版社': '重庆出版社',
            '定价': '98.00'
        },
        {
            '书名': '百年孤独',
            '作者': '加西亚·马尔克斯',
            '出版社': '南海出版公司',
            '定价': '55.00'
        },
        {
            '书名': '平凡的世界',
            '作者': '路遥',
            '出版社': '北京十月文艺出版社',
            '定价': '108.00'
        },
        {
            '书名': '小王子',
            '作者': '圣埃克苏佩里',
            '出版社': '人民文学出版社',
            '定价': '32.00'
        },
        {
            '书名': '围城',
            '作者': '钱钟书',
            '出版社': '人民文学出版社',
            '定价': '42.00'
        },
        {
            '书名': '红楼梦',
            '作者': '曹雪芹',
            '出版社': '人民文学出版社',
            '定价': '128.00'
        },
        {
            '书名': '白夜行',
            '作者': '东野圭吾',
            '出版社': '南海出版公司',
            '定价': '59.60'
        },
        {
            '书名': '追风筝的人',
            '作者': '卡勒德·胡赛尼',
            '出版社': '上海人民出版社',
            '定价': '45.00'
        },
        {
            '书名': '嫌疑人X的献身',
            '作者': '东野圭吾',
            '出版社': '南海出版公司',
            '定价': '39.50'
        }
    ]
    
    consignors = ['张三', '李四', '王五', '赵六', '陈七', '刘八', '周九', '吴十']
    statuses = ['在架', '待售', '预定', '出库待结']
    locations = ['A-01', 'A-02', 'A-03', 'B-01', 'B-02', 'B-03', 'C-01', 'C-02', 'C-03']
    
    normal_barcodes = [
        '9787506365437',
        '9787536692930',
        '9787544259422',
        '9787530209578',
        '9787020092734',
        '9787020090006',
        '9787020092581',
        '9787544258609',
        '9787208061644',
        '9787544245555'
    ]
    
    barcodes_with_missing_zeros = [
        '787506365437',
        '787536692930',
        '7544259422',
        '87530209578',
        '7020092734'
    ]
    
    data = []
    start_date = datetime.now() - timedelta(days=90)
    
    for i in range(15):
        book = books_data[i % len(books_data)]
        if i < 10:
            barcode = normal_barcodes[i]
        else:
            barcode = barcodes_with_missing_zeros[i - 10]
        
        days_offset = random.randint(0, 89)
        consign_date = (start_date + timedelta(days=days_offset)).strftime('%Y-%m-%d')
        
        data.append({
            '条码': barcode,
            '书名': book['书名'],
            '作者': book['作者'],
            '出版社': book['出版社'],
            '定价': book['定价'],
            '寄卖人': random.choice(consignors),
            '寄卖日期': consign_date,
            '库存状态': random.choice(statuses),
            '货架位置': random.choice(locations),
            '盘点数量': str(random.randint(1, 5))
        })
    
    for i in range(3):
        book = books_data[i]
        barcode = normal_barcodes[i]
        days_offset = random.randint(0, 89)
        consign_date = (start_date + timedelta(days=days_offset)).strftime('%Y-%m-%d')
        
        for dup in range(2):
            data.append({
                '条码': barcode,
                '书名': book['书名'],
                '作者': book['作者'],
                '出版社': book['出版社'],
                '定价': book['定价'],
                '寄卖人': random.choice(consignors),
                '寄卖日期': consign_date,
                '库存状态': random.choice(statuses),
                '货架位置': random.choice(locations),
                '盘点数量': str(random.randint(1, 3))
            })
    
    df = pd.DataFrame(data)
    
    xlsx_file = output_path / '二手书店寄卖库存盘点_原始数据.xlsx'
    df.to_excel(xlsx_file, index=False, engine='openpyxl')
    
    csv_file = output_path / '二手书店寄卖库存盘点_原始数据.csv'
    df.to_csv(csv_file, index=False, encoding='utf-8-sig')
    
    df_clean = df.iloc[:10].copy()
    clean_file = output_path / '二手书店寄卖库存盘点_干净数据.xlsx'
    df_clean.to_excel(clean_file, index=False, engine='openpyxl')
    
    return {
        'xlsx': xlsx_file,
        'csv': csv_file,
        'clean': clean_file
    }


if __name__ == '__main__':
    files = generate_sample_files()
    print(f"✓ 样例数据已生成:")
    print(f"  - {files['xlsx']}")
    print(f"  - {files['csv']}")
    print(f"  - {files['clean']}")
