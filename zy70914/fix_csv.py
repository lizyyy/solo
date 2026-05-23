#!/usr/bin/env python3
import csv

def fix_csv(input_file, output_file):
    fixed_rows = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        print(f"表头字段: {headers}")
        print(f"表头字段数: {len(headers)}")
        fixed_rows.append(headers)
        
        for row_num, row in enumerate(reader, start=2):
            if len(row) == len(headers):
                print(f"行{row_num}: 正常，字段数={len(row)}")
                fixed_rows.append(row)
            else:
                print(f"行{row_num}: 异常，字段数={len(row)} (期望{len(headers)})")
                print(f"  原始数据: {row}")
                
                photo_ids_idx = headers.index('photo_ids')
                remarks_idx = headers.index('remarks')
                
                extra_count = len(row) - len(headers)
                if extra_count > 0:
                    photo_ids = ','.join(row[photo_ids_idx:photo_ids_idx + extra_count + 1])
                    print(f"  合并后的 photo_ids: {photo_ids}")
                    
                    new_row = row[:photo_ids_idx] + [photo_ids] + row[photo_ids_idx + extra_count + 1:]
                    print(f"  修复后字段数: {len(new_row)}")
                    fixed_rows.append(new_row)
                else:
                    fixed_rows.append(row)
    
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerows(fixed_rows)
    
    print(f"\n修复完成！文件已保存至: {output_file}")

def verify_csv(file_path):
    print("\n=== 验证修复后的CSV文件 ===")
    try:
        import pandas as pd
        df = pd.read_csv(file_path)
        print(f"✓ pandas读取成功")
        print(f"✓ 列数: {len(df.columns)}")
        print(f"✓ 行数: {len(df)}")
        print(f"\n数据预览:")
        print(df[['claim_id', 'photo_ids']].to_string())
        return True
    except Exception as e:
        print(f"✗ pandas读取失败: {e}")
        return False

if __name__ == '__main__':
    input_file = 'sample_data/claims.csv'
    output_file = 'sample_data/claims_fixed.csv'
    
    fix_csv(input_file, output_file)
    verify_csv(output_file)
    
    print(f"\n原始文件: {input_file}")
    print(f"修复文件: {output_file}")
