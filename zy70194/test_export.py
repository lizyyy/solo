#!/usr/bin/env python3
"""测试导出功能"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.services import InquiryService, QuoteService, ComparisonService, ExportService
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    print('创建测试询价单...')
    inquiry_data = {
        'title': '测试采购',
        'created_by': 'tester',
        'department': '测试部',
        'quote_deadline': (datetime.utcnow() + timedelta(days=7)).isoformat(),
        'required_items': [
            {
                'item_no': 'TEST-001',
                'item_name': '测试商品',
                'quantity': 5,
                'unit': '个'
            }
        ]
    }
    
    result = InquiryService.create_inquiry(inquiry_data)
    if not result['success']:
        print(f'创建询价失败: {result}')
        sys.exit(1)
    
    inquiry_id = result['data']['id']
    
    print('发布询价单...')
    result = InquiryService.publish_inquiry(inquiry_id, 'tester')
    if not result['success']:
        print(f'发布失败: {result}')
        sys.exit(1)
    
    valid_until = (datetime.utcnow() + timedelta(days=14)).isoformat()
    
    print('创建供应商A报价...')
    quote_a_data = {
        'inquiry_id': inquiry_id,
        'vendor_id': 'V-A',
        'vendor_name': '供应商A',
        'tax_rate': 0.13,
        'valid_until': valid_until,
        'total_freight': 100,
        'created_by': 'vendor_a',
        'items': [
            {
                'item_name': '测试商品',
                'unit': '个',
                'quantity': 5,
                'unit_price_excl_tax': 100.0,
                'tax_rate': 0.13,
                'freight_per_unit': 5.0
            }
        ]
    }
    result = QuoteService.create_quote(quote_a_data)
    quote_a_id = result['data']['id']
    QuoteService.submit_quote(quote_a_id, 'vendor_a')
    
    print('创建供应商B报价...')
    quote_b_data = {
        'inquiry_id': inquiry_id,
        'vendor_id': 'V-B',
        'vendor_name': '供应商B',
        'tax_rate': 0.13,
        'valid_until': valid_until,
        'total_freight': 80,
        'created_by': 'vendor_b',
        'items': [
            {
                'item_name': '测试商品',
                'unit': '个',
                'quantity': 5,
                'unit_price_excl_tax': 110.0,
                'tax_rate': 0.13,
                'freight_per_unit': 3.0
            }
        ]
    }
    result = QuoteService.create_quote(quote_b_data)
    quote_b_id = result['data']['id']
    QuoteService.submit_quote(quote_b_id, 'vendor_b')
    
    print('生成比价表...')
    result = ComparisonService.generate_comparison(inquiry_id, 'tester')
    if not result['success']:
        print(f'比价失败: {result}')
        sys.exit(1)
    
    print('导出比价表到Excel...')
    result = ExportService.export_comparison_to_excel(inquiry_id)
    if result['success']:
        print(f'✅ 导出成功!')
        print(f'   文件路径: {result["data"]["file_path"]}')
        print(f'   文件名: {result["data"]["filename"]}')
    else:
        print(f'❌ 导出失败: {result}')
        sys.exit(1)
    
    print('\n导出报价单...')
    result = ExportService.export_quote_to_excel(quote_a_id)
    if result['success']:
        print(f'✅ 报价单导出成功!')
        print(f'   文件路径: {result["data"]["file_path"]}')
    else:
        print(f'❌ 报价单导出失败: {result}')

    print('\n🎉 所有测试通过!')
