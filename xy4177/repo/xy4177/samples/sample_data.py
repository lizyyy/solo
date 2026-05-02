# -*- coding: utf-8 -*-
"""
示例数据生成器
"""

import csv
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timedelta
from core.models import SKUData


def get_sample_sku_list() -> List[SKUData]:
    """获取示例SKU数据列表"""
    today = datetime.now()
    expiry_date = (today + timedelta(days=365)).strftime("%Y-%m-%d")
    past_date = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    
    samples = [
        {
            'sku': 'SKU001',
            'box_number': 'BOX-2026-001',
            'batch_number': 'BATCH-2026-001',
            'expiry_date': expiry_date,
            'product_name': '矿泉水 500ml',
            'quantity': 24,
        },
        {
            'sku': 'SKU002',
            'box_number': 'BOX-2026-002',
            'batch_number': 'BATCH-2026-002',
            'expiry_date': expiry_date,
            'product_name': '可乐 330ml',
            'quantity': 12,
        },
        {
            'sku': 'SKU003',
            'box_number': 'BOX-2026-001',
            'batch_number': 'BATCH-2026-003',
            'expiry_date': expiry_date,
            'product_name': '橙汁 1L',
            'quantity': 6,
        },
        {
            'sku': 'SKU004',
            'box_number': 'BOX-2026-004',
            'batch_number': '',
            'expiry_date': past_date,
            'product_name': '牛奶 250ml',
            'quantity': 30,
        },
        {
            'sku': 'SKU005',
            'box_number': '',
            'batch_number': 'BATCH-2026-005',
            'expiry_date': expiry_date,
            'product_name': '酸奶 100g',
            'quantity': 12,
        },
    ]
    
    sku_list = []
    for idx, data in enumerate(samples, start=1):
        sku_list.append(SKUData.from_dict(data, idx))
    
    return sku_list


def get_sample_template_zpl() -> str:
    """获取示例ZPL模板内容"""
    return """^XA
^PW480
^LL320
^FO50,50^A0N,30,30^FD{sku}^FS
^FO50,100^BCN,80,Y,N,N^FD{box_number}^FS
^FO50,200^A0N,25,25^FD批次: {batch_number}^FS
^FO50,230^A0N,25,25^FD效期: {expiry_date}^FS
^FO50,260^A0N,20,20^FD{product_name}^FS
^XZ"""


def get_sample_template_json() -> str:
    """获取示例JSON模板内容"""
    import json
    template = {
        "name": "标准出库标签",
        "width": 60.0,
        "height": 40.0,
        "dpi": 203,
        "margin": 2.0,
        "fields": [
            {
                "name": "sku",
                "type": "text",
                "x": 5.0,
                "y": 5.0,
                "font_size": 4.0,
                "required": True
            },
            {
                "name": "box_number",
                "type": "barcode",
                "barcode_type": "CODE128",
                "x": 5.0,
                "y": 12.0,
                "width": 50.0,
                "height": 10.0,
                "required": True
            },
            {
                "name": "batch_number",
                "type": "text",
                "x": 5.0,
                "y": 25.0,
                "font_size": 3.0,
                "required": True
            },
            {
                "name": "expiry_date",
                "type": "text",
                "x": 5.0,
                "y": 29.0,
                "font_size": 3.0,
                "required": False
            },
            {
                "name": "product_name",
                "type": "text",
                "x": 5.0,
                "y": 33.0,
                "font_size": 2.5,
                "required": False
            }
        ]
    }
    return json.dumps(template, ensure_ascii=False, indent=2)


def create_sample_csv(output_path: str):
    """创建示例CSV文件"""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    samples = [
        {
            'sku': 'SKU001',
            'box_number': 'BOX-2026-001',
            'batch_number': 'BATCH-2026-001',
            'expiry_date': '2027-05-01',
            'product_name': '矿泉水 500ml',
            'quantity': '24',
        },
        {
            'sku': 'SKU002',
            'box_number': 'BOX-2026-002',
            'batch_number': 'BATCH-2026-002',
            'expiry_date': '2027-06-15',
            'product_name': '可乐 330ml',
            'quantity': '12',
        },
        {
            'sku': 'SKU003',
            'box_number': 'BOX-2026-001',
            'batch_number': 'BATCH-2026-003',
            'expiry_date': '2026-12-20',
            'product_name': '橙汁 1L',
            'quantity': '6',
        },
        {
            'sku': 'SKU004',
            'box_number': 'BOX-2026-004',
            'batch_number': '',
            'expiry_date': '2025-03-10',
            'product_name': '牛奶 250ml',
            'quantity': '30',
        },
        {
            'sku': 'SKU005',
            'box_number': '',
            'batch_number': 'BATCH-2026-005',
            'expiry_date': '2027-01-01',
            'product_name': '酸奶 100g',
            'quantity': '12',
        },
    ]
    
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        fieldnames = ['sku', 'box_number', 'batch_number', 'expiry_date', 'product_name', 'quantity']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(samples)


def create_sample_zpl(output_path: str):
    """创建示例ZPL模板文件"""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(get_sample_template_zpl())


def create_sample_json_template(output_path: str):
    """创建示例JSON模板文件"""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(get_sample_template_json())
