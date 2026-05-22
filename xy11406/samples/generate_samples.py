#!/usr/bin/env python3
"""生成样例数据"""
import pandas as pd
import os
from datetime import datetime, timedelta

def generate_inventory_sample(output_path):
    today = datetime.now().date()
    
    data = [
        {'药品编码': 'YP001', '药品名称': '阿莫西林胶囊', '规格': '0.25g*24粒', '生产厂家': '华北制药', '批号': '20240101', '生产日期': '2024-01-15', '有效期': '2026-01-14', '数量': 100, '单位': '盒', '进价': 12.5, '售价': 18.0, '供应商': '医药公司A', '仓库': '一号库'},
        {'药品编码': 'YP002', '药品名称': '布洛芬缓释胶囊', '规格': '0.3g*20粒', '生产厂家': '中美史克', '批号': '20230601', '生产日期': '2023-06-20', '有效期': '2025-06-19', '数量': 50, '单位': '盒', '进价': 15.0, '售价': 22.0, '供应商': '医药公司A', '仓库': '一号库'},
        {'药品编码': 'YP003', '药品名称': '维生素C片', '规格': '100mg*100片', '生产厂家': '东北制药', '批号': '20240301', '生产日期': '2024-03-10', '有效期': '2026-05-20', '数量': 200, '单位': '瓶', '进价': 3.5, '售价': 6.0, '供应商': '医药公司B', '仓库': '二号库'},
        {'药品编码': 'YP004', '药品名称': '感冒灵颗粒', '规格': '10g*9袋', '生产厂家': '三九医药', '批号': '20221201', '生产日期': '2022-12-01', '有效期': '2024-11-30', '数量': 30, '单位': '盒', '进价': 8.0, '售价': 12.0, '供应商': '医药公司B', '仓库': '一号库'},
        {'药品编码': '', '药品名称': '双黄连口服液', '规格': '10ml*10支', '生产厂家': '哈药集团', '批号': '20240201', '生产日期': '2024-02-15', '有效期': '2026-02-14', '数量': 80, '单位': '盒', '进价': 10.0, '售价': 15.0, '供应商': '医药公司A', '仓库': '二号库'},
        {'药品编码': 'YP006', '药品名称': '', '规格': '5g*10袋', '生产厂家': '云南白药', '批号': '20240105', '生产日期': '2024-01-20', '有效期': '2026-01-19', '数量': 0, '单位': '盒', '进价': 25.0, '售价': 35.0, '供应商': '医药公司C', '仓库': '一号库'},
        {'药品编码': 'YP007', '药品名称': '健胃消食片', '规格': '0.5g*36片', '生产厂家': '江中制药', '批号': '', '生产日期': '2024-04-01', '有效期': '', '数量': 60, '单位': '盒', '进价': 6.0, '售价': 9.0, '供应商': '医药公司C', '仓库': '二号库'},
        {'药品编码': 'YP008', '药品名称': '丹参滴丸', '规格': '27mg*180丸', '生产厂家': '天士力', '批号': '20230501', '生产日期': '2023-05-10', '有效期': '2025-05-09', '数量': -5, '单位': '盒', '进价': 28.0, '售价': 42.0, '供应商': '医药公司A', '仓库': '一号库'},
        {'药品编码': 'YP009', '药品名称': '六味地黄丸', '规格': '9g*10丸', '生产厂家': '同仁堂', '批号': '20240101', '生产日期': '2025-01-01', '有效期': '2024-12-31', '数量': 40, '单位': '盒', '进价': 18.0, '售价': 28.0, '供应商': '医药公司B', '仓库': '一号库'},
        {'药品编码': 'YP010', '药品名称': '阿胶', '规格': '250g', '生产厂家': '东阿阿胶', '批号': '20230301', '生产日期': '2023-03-15', '有效期': '2028-03-14', '数量': 20, '单位': '盒', '进价': 890.0, '售价': 1280.0, '供应商': '医药公司C', '仓库': '二号库'},
    ]
    
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False)
    print(f'生成进销存样例: {output_path}')

def generate_transfer_sample(output_path):
    data = [
        {'药品编码': 'YP001', '药品名称': '阿莫西林胶囊', '规格': '0.25g*24粒', '批号': '20240101', '有效期': '2026-01-14', '数量': 20, '单位': '盒', '调出仓库': '一号库', '调入仓库': '乡镇店A'},
        {'药品编码': 'YP002', '药品名称': '布洛芬缓释胶囊', '规格': '0.3g*20粒', '批号': '20230601', '有效期': '2025-06-19', '数量': 10, '单位': '盒', '调出仓库': '一号库', '调入仓库': '乡镇店A'},
        {'药品编码': 'YP005', '药品名称': '双黄连口服液', '规格': '10ml*10支', '批号': '20240201', '有效期': '2026-02-14', '数量': 15, '单位': '盒', '调出仓库': '二号库', '调入仓库': '乡镇店B'},
    ]
    
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False)
    print(f'生成调拨单样例: {output_path}')

def generate_demo_script(output_path):
    script = """#!/bin/bash
# 乡镇药房近效期巡检演示脚本

set -e

echo "========================================"
echo "  乡镇药房近效期巡检 CLI 演示"
echo "========================================"
echo ""

echo "【步骤1】初始化数据库"
echo "----------------------------------------"
pharmacy-inspect init
echo ""

echo "【步骤2】导入进销存数据"
echo "----------------------------------------"
pharmacy-inspect import samples/inventory_sample.xlsx \\
    --source-type inventory \\
    --strategy append \\
    --pharmacy "XX镇中心药房" \\
    --operator "张店长" \\
    --name "2024年5月进销存"
echo ""

echo "【步骤3】查看批次列表"
echo "----------------------------------------"
pharmacy-inspect batches
echo ""

echo "【步骤4】校验数据"
echo "----------------------------------------"
pharmacy-inspect check --operator "张店长"
echo ""

echo "【步骤5】查看巡检报告"
echo "----------------------------------------"
pharmacy-inspect report
echo ""

echo "【步骤6】查看失败清单"
echo "----------------------------------------"
pharmacy-inspect report --show-failed
echo ""

echo "【步骤7】列出所有无效记录"
echo "----------------------------------------"
pharmacy-inspect fix --invalid-only --operator "张店长"
echo ""

echo "【步骤8】人工修正一条记录"
echo "----------------------------------------"
echo "修正记录ID 5 - 补充药品编码"
pharmacy-inspect fix 5 --field medicine_code --value "YP005" --operator "李督导" --reason "补录编码"
echo ""

echo "修正记录ID 7 - 补充有效期"
pharmacy-inspect fix 7 --field batch_number --value "B20240401" --operator "李督导" --reason "补录批号"
pharmacy-inspect fix 7 --field expiry_date --value "2026-03-31" --operator "李督导" --reason "补录有效期"
echo ""

echo "【步骤9】重新校验已修正数据"
echo "----------------------------------------"
pharmacy-inspect recheck --operator "李督导"
echo ""

echo "【步骤10】查看操作历史"
echo "----------------------------------------"
pharmacy-inspect history
echo ""

echo "【步骤11】导出最终数据"
echo "----------------------------------------"
pharmacy-inspect export samples/export_result --include-original
echo ""

echo "========================================"
echo "  演示完成！"
echo "========================================"
echo ""
echo "常用命令:"
echo "  pharmacy-inspect --help          查看帮助"
echo "  pharmacy-inspect batches         查看批次"
echo "  pharmacy-inspect report          查看报告"
echo "  pharmacy-inspect history         查看历史"
echo "  pharmacy-inspect tasks           查看任务"
"""
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(script)
    os.chmod(output_path, 0o755)
    print(f'生成演示脚本: {output_path}')

if __name__ == '__main__':
    os.makedirs('samples', exist_ok=True)
    generate_inventory_sample('samples/inventory_sample.xlsx')
    generate_transfer_sample('samples/transfer_sample.xlsx')
    generate_demo_script('samples/run_demo.sh')
    print('\n样例数据生成完成！')
    print('运行: pip install -e .')
    print('然后: bash samples/run_demo.sh')
