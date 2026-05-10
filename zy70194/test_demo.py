#!/usr/bin/env python3
"""
采购询价比价服务 - 演示脚本
运行此脚本来测试完整的业务流程
"""

import sys
import os
from datetime import datetime, timedelta
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.services import (
    InquiryService, QuoteService, ComparisonService,
    ExportService, OperationLogService
)
from app.models import InquiryStatus, QuoteStatus

def print_separator(title=''):
    print('=' * 70)
    if title:
        print(f'  {title}')
        print('=' * 70)

def demo_flow():
    print_separator('采购询价比价服务 - 完整流程演示')
    
    app = create_app()
    
    with app.app_context():
        print('\n【第1步】创建询价单')
        print('-' * 70)
        
        tomorrow = (datetime.utcnow() + timedelta(days=1)).isoformat()
        next_week = (datetime.utcnow() + timedelta(days=7)).isoformat()
        
        inquiry_data = {
            'title': '办公电脑采购',
            'description': '采购10台办公用笔记本电脑，用于新员工入职',
            'created_by': 'procurement_manager',
            'department': '采购部',
            'project': '2024年度IT设备更新',
            'quote_deadline': next_week,
            'required_items': [
                {
                    'item_no': 'ITEM-001',
                    'item_name': '笔记本电脑',
                    'specification': 'Intel i5, 16GB RAM, 512GB SSD',
                    'quantity': 10,
                    'unit': '台'
                }
            ]
        }
        
        result = InquiryService.create_inquiry(inquiry_data)
        if not result['success']:
            print(f'❌ 创建询价单失败: {result["error"]}')
            return False
        
        inquiry = result['data']
        inquiry_id = inquiry['id']
        print(f'✅ 询价单创建成功')
        print(f'   询价单号: {inquiry["inquiry_no"]}')
        print(f'   标题: {inquiry["title"]}')
        print(f'   当前状态: {inquiry["status"]}')
        
        print('\n【第2步】发布询价单')
        print('-' * 70)
        
        result = InquiryService.publish_inquiry(inquiry_id, 'procurement_manager')
        if not result['success']:
            print(f'❌ 发布失败: {result["error"]}')
            return False
        
        inquiry = result['data']
        print(f'✅ 询价单已发布')
        print(f'   发布时间: {inquiry["publish_date"]}')
        print(f'   当前状态: {inquiry["status"]}')
        print(f'   报价截止: {inquiry["quote_deadline"]}')
        
        print('\n【第3步】供应商A提交报价')
        print('-' * 70)
        
        valid_until = (datetime.utcnow() + timedelta(days=14)).isoformat()
        
        quote_a_data = {
            'inquiry_id': inquiry_id,
            'vendor_id': 'VENDOR-A',
            'vendor_name': '科技贸易有限公司',
            'vendor_contact': '张经理',
            'vendor_phone': '13800001111',
            'tax_rate': 0.13,
            'valid_until': valid_until,
            'total_freight': 500.0,
            'payment_terms': '30%预付，70%货到验收后',
            'delivery_terms': '包邮送货上门',
            'delivery_location': '公司仓库',
            'delivery_time': '确认订单后7个工作日',
            'remarks': '提供原厂3年质保服务',
            'created_by': 'vendor_a',
            'items': [
                {
                    'item_no': 'ITEM-001',
                    'item_name': '笔记本电脑',
                    'specification': 'Intel i5, 16GB RAM, 512GB SSD',
                    'unit': '台',
                    'quantity': 10,
                    'unit_price_excl_tax': 4500.0,
                    'tax_rate': 0.13,
                    'freight_per_unit': 30.0,
                    'delivery_time': '7个工作日',
                    'warranty': '3年'
                }
            ]
        }
        
        result = QuoteService.create_quote(quote_a_data)
        if not result['success']:
            print(f'❌ 创建报价失败: {result["error"]}')
            if 'validation_errors' in result:
                print(f'   验证错误: {json.dumps(result["validation_errors"], ensure_ascii=False, indent=2)}')
            return False
        
        quote_a = result['data']
        quote_a_id = quote_a['id']
        
        result = QuoteService.submit_quote(quote_a_id, 'vendor_a')
        if not result['success']:
            print(f'❌ 提交报价失败: {result["error"]}')
            return False
        
        quote_a = result['data']
        print(f'✅ 供应商A报价已提交')
        print(f'   报价单号: {quote_a["quote_no"]}')
        print(f'   供应商: {quote_a["vendor_name"]}')
        print(f'   不含税总价: ¥{quote_a["total_price_excl_tax"]:,.2f}')
        print(f'   含税总价: ¥{quote_a["total_price_incl_tax"]:,.2f}')
        print(f'   运费: ¥{quote_a["total_freight"]:,.2f}')
        print(f'   总计: ¥{quote_a["total_amount"]:,.2f}')
        print(f'   有效期: {quote_a["valid_from"]} ~ {quote_a["valid_until"]}')
        print(f'   当前状态: {quote_a["status"]}')
        
        print('\n【第4步】供应商B提交报价')
        print('-' * 70)
        
        quote_b_data = {
            'inquiry_id': inquiry_id,
            'vendor_id': 'VENDOR-B',
            'vendor_name': '电脑直销商城',
            'vendor_contact': '李经理',
            'vendor_phone': '13900002222',
            'tax_rate': 0.13,
            'valid_until': valid_until,
            'total_freight': 300.0,
            'payment_terms': '50%预付，50%货到验收后',
            'delivery_terms': '包邮送货上门包安装',
            'delivery_location': '公司各部门',
            'delivery_time': '确认订单后5个工作日',
            'remarks': '提供2年质保，送原装电脑包',
            'created_by': 'vendor_b',
            'items': [
                {
                    'item_no': 'ITEM-001',
                    'item_name': '笔记本电脑',
                    'specification': 'Intel i5, 16GB RAM, 512GB SSD',
                    'unit': '台',
                    'quantity': 10,
                    'unit_price_excl_tax': 4800.0,
                    'tax_rate': 0.13,
                    'freight_per_unit': 10.0,
                    'delivery_time': '5个工作日',
                    'warranty': '2年'
                }
            ]
        }
        
        result = QuoteService.create_quote(quote_b_data)
        if not result['success']:
            print(f'❌ 创建报价失败: {result["error"]}')
            return False
        
        quote_b = result['data']
        quote_b_id = quote_b['id']
        
        result = QuoteService.submit_quote(quote_b_id, 'vendor_b')
        if not result['success']:
            print(f'❌ 提交报价失败: {result["error"]}')
            return False
        
        quote_b = result['data']
        print(f'✅ 供应商B报价已提交')
        print(f'   报价单号: {quote_b["quote_no"]}')
        print(f'   供应商: {quote_b["vendor_name"]}')
        print(f'   不含税总价: ¥{quote_b["total_price_excl_tax"]:,.2f}')
        print(f'   含税总价: ¥{quote_b["total_price_incl_tax"]:,.2f}')
        print(f'   运费: ¥{quote_b["total_freight"]:,.2f}')
        print(f'   总计: ¥{quote_b["total_amount"]:,.2f}')
        print(f'   有效期: {quote_b["valid_from"]} ~ {quote_b["valid_until"]}')
        print(f'   当前状态: {quote_b["status"]}')
        
        print('\n【第5步】供应商C提交报价')
        print('-' * 70)
        
        quote_c_data = {
            'inquiry_id': inquiry_id,
            'vendor_id': 'VENDOR-C',
            'vendor_name': '电子科技有限公司',
            'vendor_contact': '王经理',
            'vendor_phone': '13700003333',
            'tax_rate': 0.06,
            'valid_until': valid_until,
            'total_freight': 800.0,
            'payment_terms': '款到发货',
            'delivery_terms': '物流到付',
            'delivery_location': '公司仓库',
            'delivery_time': '确认订单后10个工作日',
            'remarks': '小规模纳税人，提供6%增值税发票',
            'created_by': 'vendor_c',
            'items': [
                {
                    'item_no': 'ITEM-001',
                    'item_name': '笔记本电脑',
                    'specification': 'Intel i5, 16GB RAM, 512GB SSD',
                    'unit': '台',
                    'quantity': 10,
                    'unit_price_excl_tax': 4300.0,
                    'tax_rate': 0.06,
                    'freight_per_unit': 50.0,
                    'delivery_time': '10个工作日',
                    'warranty': '1年'
                }
            ]
        }
        
        result = QuoteService.create_quote(quote_c_data)
        if not result['success']:
            print(f'❌ 创建报价失败: {result["error"]}')
            return False
        
        quote_c = result['data']
        quote_c_id = quote_c['id']
        
        result = QuoteService.submit_quote(quote_c_id, 'vendor_c')
        if not result['success']:
            print(f'❌ 提交报价失败: {result["error"]}')
            return False
        
        quote_c = result['data']
        print(f'✅ 供应商C报价已提交')
        print(f'   报价单号: {quote_c["quote_no"]}')
        print(f'   供应商: {quote_c["vendor_name"]}')
        print(f'   不含税总价: ¥{quote_c["total_price_excl_tax"]:,.2f}')
        print(f'   含税总价: ¥{quote_c["total_price_incl_tax"]:,.2f}')
        print(f'   运费: ¥{quote_c["total_freight"]:,.2f}')
        print(f'   总计: ¥{quote_c["total_amount"]:,.2f}')
        print(f'   税率: {quote_c["tax_rate"] * 100:.0f}%')
        print(f'   有效期: {quote_c["valid_from"]} ~ {quote_c["valid_until"]}')
        print(f'   当前状态: {quote_c["status"]}')
        
        print('\n【第6步】供应商B修改报价（模拟人工改错）')
        print('-' * 70)
        
        revised_quote_b_data = {
            'vendor_name': '电脑直销商城（修订版）',
            'total_freight': 200.0,
            'change_reason': '运费核算错误，重新修改',
            'items': [
                {
                    'item_no': 'ITEM-001',
                    'item_name': '笔记本电脑',
                    'specification': 'Intel i5, 16GB RAM, 512GB SSD, 带包鼠',
                    'unit': '台',
                    'quantity': 10,
                    'unit_price_excl_tax': 4700.0,
                    'tax_rate': 0.13,
                    'freight_per_unit': 5.0,
                    'delivery_time': '5个工作日',
                    'warranty': '3年'
                }
            ]
        }
        
        result = QuoteService.revise_quote(
            quote_b_id, 
            revised_quote_b_data, 
            'vendor_b', 
            '运费核算错误，重新修改报价'
        )
        
        if not result['success']:
            print(f'❌ 修改报价失败: {result["error"]}')
            return False
        
        quote_b_revised = result['data']
        print(f'✅ 供应商B报价已修改')
        print(f'   修改后含税总价: ¥{quote_b_revised["total_price_incl_tax"]:,.2f}')
        print(f'   修改后运费: ¥{quote_b_revised["total_freight"]:,.2f}')
        print(f'   修改后总计: ¥{quote_b_revised["total_amount"]:,.2f}')
        print(f'   当前状态: {quote_b_revised["status"]}')
        
        print('\n【第7步】查看报价版本历史')
        print('-' * 70)
        
        result = QuoteService.get_quote_versions(quote_b_id)
        if result['success']:
            versions = result['data']
            print(f'✅ 报价版本历史')
            for v in versions:
                print(f'   版本 {v["version_no"]}: {v["created_at"]}')
                print(f'     修改原因: {v["change_reason"] or "无"}')
                print(f'     修改人: {v["changed_by"]}')
        
        print('\n【第8步】生成比价表')
        print('-' * 70)
        
        result = ComparisonService.generate_comparison(inquiry_id, 'procurement_manager')
        if not result['success']:
            print(f'❌ 生成比价失败: {result["error"]}')
            return False
        
        comparison = result['data']
        print(f'✅ 比价表已生成')
        print(f'   比价编号: {comparison["comparison_no"]}')
        print(f'   推荐供应商: {comparison["recommended_vendor_name"] or "无"}')
        print(f'   推荐理由: {comparison["recommendation_reason"] or "无"}')
        print(f'   比价汇总: {json.dumps(comparison["comparison_summary"], ensure_ascii=False)}')
        
        quotes_data = comparison['comparison_data'].get('quotes', [])
        print(f'\n   报价排名:')
        for quote in quotes_data:
            print(f'     第{quote["rank"]}名: {quote["vendor_name"]}')
            print(f'       总计: ¥{quote["total_amount"]:,.2f}')
            if quote.get('price_difference'):
                print(f'       与最优价比差: ¥{quote["price_difference"]:,.2f} ({quote["price_difference_percent"]:.2f}%)')
        
        print('\n【第9步】导出比价表到Excel')
        print('-' * 70)
        
        result = ExportService.export_comparison_to_excel(inquiry_id)
        if result['success']:
            print(f'✅ 比价表已导出')
            print(f'   文件路径: {result["data"]["file_path"]}')
            print(f'   文件名: {result["data"]["filename"]}')
        else:
            print(f'⚠️ 导出失败: {result["error"]}')
        
        print('\n【第10步】确定中标')
        print('-' * 70)
        
        comparison_id = comparison['id']
        best_quote = quotes_data[0] if quotes_data else None
        
        if best_quote:
            result = ComparisonService.award_quote(
                comparison_id,
                best_quote['quote_id'],
                'procurement_manager',
                f'供应商{best_quote["vendor_name"]}报价最优，性价比最高'
            )
            
            if result['success']:
                print(f'✅ 已确定中标')
                print(f'   中标供应商: {best_quote["vendor_name"]}')
                print(f'   中标总价: ¥{best_quote["total_amount"]:,.2f}')
                
                inquiry_result = InquiryService.get_inquiry(inquiry_id)
                if inquiry_result['success']:
                    print(f'   询价单状态: {inquiry_result["data"]["status"]}')
            else:
                print(f'❌ 确定中标失败: {result["error"]}')
        
        print('\n【第11步】查看操作日志')
        print('-' * 70)
        
        logs = OperationLogService.get_inquiry_logs(inquiry_id)
        print(f'✅ 操作日志 ({len(logs)} 条):')
        for log in logs[:5]:
            print(f'   {log["operation_at"]} - {log["operation_type"]}: {log["operation_by"]}')
            if log.get('change_fields'):
                print(f'     修改字段: {list(log["change_fields"].keys())}')
            if not log['success']:
                print(f'     错误: {log["error_message"]}')
        
        print('\n【第12步】查询最终汇总信息')
        print('-' * 70)
        
        inquiry_result = InquiryService.get_inquiry(inquiry_id)
        if inquiry_result['success']:
            inquiry_final = inquiry_result['data']
            print(f'询价单汇总:')
            print(f'  编号: {inquiry_final["inquiry_no"]}')
            print(f'  标题: {inquiry_final["title"]}')
            print(f'  状态: {inquiry_final["status"]}')
            print(f'  创建人: {inquiry_final["created_by"]}')
            print(f'  报价截止: {inquiry_final["quote_deadline"]}')
        
        quotes_result = QuoteService.list_quotes(inquiry_id=inquiry_id, per_page=10)
        if quotes_result['success']:
            quotes_list = quotes_result['data']['items']
            print(f'\n报价单汇总 ({len(quotes_list)} 份):')
            for q in quotes_list:
                status_desc = {
                    'submitted': '已提交',
                    'revised': '已修订',
                    'awarded': '已中标',
                    'rejected': '已拒绝',
                    'withdrawn': '已撤回'
                }.get(q['status'], q['status'])
                
                print(f'  {q["vendor_name"]}: ¥{q["total_amount"] or 0:,.2f} - {status_desc}')
        
        print_separator('演示流程完成')
        print('\n📝 关键亮点总结:')
        print('  1. ✅ 询价单状态推进: draft -> published -> quoting -> comparing -> awarded')
        print('  2. ✅ 报价版本追踪: 每次修改自动创建版本记录')
        print('  3. ✅ 价税运费自动计算: 含税价=不含税价*(1+税率), 自动汇总')
        print('  4. ✅ 多供应商比价: 按含税含运费总价排序，自动给出中标建议')
        print('  5. ✅ 有效期管理: 自动检查报价有效期')
        print('  6. ✅ 操作日志追溯: 所有关键操作都有记录')
        print('  7. ✅ Excel导出: 比价表和报价单均可导出')
        print('  8. ✅ 历史查询: 所有数据存储在SQLite，重启后仍可查询')
        print('\n🛠️ 真实场景处理:')
        print('  - 缺字段: 严格的参数校验，返回详细错误信息')
        print('  - 重复报价: 同一供应商同一询价单不允许重复提交')
        print('  - 半路失败: 后台任务支持重试机制')
        print('  - 人工改错: 修改报价记录版本和变更原因')
        
        return True

if __name__ == '__main__':
    success = demo_flow()
    sys.exit(0 if success else 1)
