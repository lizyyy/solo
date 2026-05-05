import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from io import StringIO
from flask import current_app

from app import db
from app.models import (
    Bibliography, PriceList, ChannelListing, BadData, 
    ImportSession, ManualCorrection, FixHistory
)

class DataExporter:
    def __init__(self):
        self.export_folder = current_app.config.get('EXPORT_FOLDER', 'exports')
        os.makedirs(self.export_folder, exist_ok=True)
    
    def export_clean_bibliography_csv(self, filters: Dict = None) -> str:
        query = Bibliography.query
        
        if filters:
            if filters.get('isbn'):
                query = query.filter(Bibliography.isbn.like(f"%{filters['isbn']}%"))
            if filters.get('category'):
                query = query.filter(Bibliography.category == filters['category'])
            if filters.get('publisher'):
                query = query.filter(Bibliography.publisher.like(f"%{filters['publisher']}%"))
        
        books = query.all()
        
        filename = f"clean_bibliography_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(self.export_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ISBN', '书名', '作者', '出版社', '出版日期', 
                '分类', '丛书', '页数', '装帧', '创建时间', '更新时间'
            ])
            
            for book in books:
                writer.writerow([
                    book.isbn or '',
                    book.title or '',
                    book.author or '',
                    book.publisher or '',
                    book.publish_date.strftime('%Y-%m-%d') if book.publish_date else '',
                    book.category or '',
                    book.series or '',
                    book.page_count or '',
                    book.binding or '',
                    book.created_at.strftime('%Y-%m-%d %H:%M:%S') if book.created_at else '',
                    book.updated_at.strftime('%Y-%m-%d %H:%M:%S') if book.updated_at else ''
                ])
        
        return filepath
    
    def export_clean_price_list_csv(self, filters: Dict = None) -> str:
        query = PriceList.query.join(Bibliography)
        
        if filters:
            if filters.get('isbn'):
                query = query.filter(Bibliography.isbn.like(f"%{filters['isbn']}%"))
            if filters.get('currency'):
                query = query.filter(PriceList.currency == filters['currency'])
            if filters.get('is_active') is not None:
                query = query.filter(PriceList.is_active == filters['is_active'])
        
        price_lists = query.all()
        
        filename = f"clean_price_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(self.export_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ISBN', '书名', '印次', '价格', '币种', '生效日期', '是否激活', '创建时间', '更新时间'
            ])
            
            for pl in price_lists:
                writer.writerow([
                    pl.bibliography.isbn if pl.bibliography else '',
                    pl.bibliography.title if pl.bibliography else '',
                    pl.print_run or '',
                    pl.price or '',
                    pl.currency or '',
                    pl.effective_date.strftime('%Y-%m-%d') if pl.effective_date else '',
                    '是' if pl.is_active else '否',
                    pl.created_at.strftime('%Y-%m-%d %H:%M:%S') if pl.created_at else '',
                    pl.updated_at.strftime('%Y-%m-%d %H:%M:%S') if pl.updated_at else ''
                ])
        
        return filepath
    
    def export_clean_channel_listing_csv(self, filters: Dict = None) -> str:
        query = ChannelListing.query.join(Bibliography)
        
        if filters:
            if filters.get('isbn'):
                query = query.filter(Bibliography.isbn.like(f"%{filters['isbn']}%"))
            if filters.get('channel_name'):
                query = query.filter(ChannelListing.channel_name.like(f"%{filters['channel_name']}%"))
            if filters.get('listing_status'):
                query = query.filter(ChannelListing.listing_status == filters['listing_status'])
        
        listings = query.all()
        
        filename = f"clean_channel_listing_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(self.export_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ISBN', '书名', '渠道名称', '渠道分类', '渠道价格', '上架状态', '上架日期', '创建时间', '更新时间'
            ])
            
            for cl in listings:
                writer.writerow([
                    cl.bibliography.isbn if cl.bibliography else '',
                    cl.bibliography.title if cl.bibliography else '',
                    cl.channel_name or '',
                    cl.channel_category or '',
                    cl.channel_price or '',
                    cl.listing_status or '',
                    cl.listing_date.strftime('%Y-%m-%d') if cl.listing_date else '',
                    cl.created_at.strftime('%Y-%m-%d %H:%M:%S') if cl.created_at else '',
                    cl.updated_at.strftime('%Y-%m-%d %H:%M:%S') if cl.updated_at else ''
                ])
        
        return filepath
    
    def export_bad_data_json(self, filters: Dict = None) -> str:
        query = BadData.query
        
        if filters:
            if filters.get('session_id'):
                query = query.filter(BadData.session_id == filters['session_id'])
            if filters.get('error_code'):
                query = query.filter(BadData.error_code == filters['error_code'])
            if filters.get('fix_status'):
                query = query.filter(BadData.fix_status == filters['fix_status'])
            if filters.get('data_type'):
                query = query.filter(BadData.data_type == filters['data_type'])
            if filters.get('isbn'):
                query = query.filter(BadData.isbn.like(f"%{filters['isbn']}%"))
        
        bad_data_list = query.all()
        
        filename = f"bad_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.export_folder, filename)
        
        result = []
        for bd in bad_data_list:
            try:
                original_data = json.loads(bd.original_data)
            except:
                original_data = bd.original_data
            
            result.append({
                'id': bd.id,
                'session_id': bd.session_id,
                'source_file': bd.source_file,
                'line_number': bd.line_number,
                'data_type': bd.data_type,
                'field_name': bd.field_name,
                'error_code': bd.error_code,
                'error_message': bd.error_message,
                'original_data': original_data,
                'isbn': bd.isbn,
                'fix_status': bd.fix_status,
                'fix_note': bd.fix_note,
                'fixed_at': bd.fixed_at.strftime('%Y-%m-%d %H:%M:%S') if bd.fixed_at else None,
                'fixed_by': bd.fixed_by,
                'created_at': bd.created_at.strftime('%Y-%m-%d %H:%M:%S') if bd.created_at else None
            })
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                'export_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'total_count': len(result),
                'bad_data': result
            }, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def generate_markdown_report(self, filters: Dict = None) -> str:
        sessions = ImportSession.query.order_by(ImportSession.import_time.desc()).all()
        
        bad_data_query = BadData.query
        if filters:
            if filters.get('session_id'):
                bad_data_query = bad_data_query.filter(BadData.session_id == filters['session_id'])
            if filters.get('error_code'):
                bad_data_query = bad_data_query.filter(BadData.error_code == filters['error_code'])
            if filters.get('fix_status'):
                bad_data_query = bad_data_query.filter(BadData.fix_status == filters['fix_status'])
        
        all_bad_data = bad_data_query.all()
        
        error_stats = {}
        status_stats = {'pending': 0, 'fixed': 0, 'ignored': 0}
        data_type_stats = {}
        
        for bd in all_bad_data:
            if bd.error_code not in error_stats:
                error_stats[bd.error_code] = {'count': 0, 'description': ''}
            error_stats[bd.error_code]['count'] += 1
            error_stats[bd.error_code]['description'] = bd.error_message[:50]
            
            if bd.fix_status in status_stats:
                status_stats[bd.fix_status] += 1
            
            if bd.data_type not in data_type_stats:
                data_type_stats[bd.data_type] = 0
            data_type_stats[bd.data_type] += 1
        
        filename = f"bad_data_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        filepath = os.path.join(self.export_folder, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"# 书目上架坏数据追踪报告\n\n")
            f.write(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write(f"---\n\n")
            
            f.write(f"## 一、概览\n\n")
            f.write(f"| 指标 | 数值 |\n")
            f.write(f"|------|------|\n")
            f.write(f"| 导入会话总数 | {len(sessions)} |\n")
            f.write(f"| 坏数据总数 | {len(all_bad_data)} |\n")
            f.write(f"| 待处理 | {status_stats['pending']} |\n")
            f.write(f"| 已修复 | {status_stats['fixed']} |\n")
            f.write(f"| 已忽略 | {status_stats['ignored']} |\n\n")
            
            f.write(f"## 二、按错误类型统计\n\n")
            f.write(f"| 错误代码 | 数量 | 描述 |\n")
            f.write(f"|----------|------|------|\n")
            for code, stats in sorted(error_stats.items(), key=lambda x: x[1]['count'], reverse=True):
                f.write(f"| {code} | {stats['count']} | {stats['description']} |\n")
            f.write(f"\n")
            
            f.write(f"## 三、按数据类型统计\n\n")
            f.write(f"| 数据类型 | 数量 |\n")
            f.write(f"|----------|------|\n")
            for dtype, count in sorted(data_type_stats.items(), key=lambda x: x[1], reverse=True):
                dtype_name = {
                    'bibliography': '书目主数据',
                    'price_list': '印次价格表',
                    'channel_listing': '渠道上架数据',
                    'manual_correction': '人工修正数据'
                }.get(dtype, dtype)
                f.write(f"| {dtype_name} | {count} |\n")
            f.write(f"\n")
            
            f.write(f"## 四、导入会话详情\n\n")
            for session in sessions[:10]:
                f.write(f"### 会话: {session.session_name}\n\n")
                f.write(f"- **导入时间**: {session.import_time.strftime('%Y-%m-%d %H:%M:%S') if session.import_time else 'N/A'}\n")
                f.write(f"- **文件类型**: {session.file_type}\n")
                f.write(f"- **原始文件名**: {session.original_filename}\n")
                f.write(f"- **总记录数**: {session.total_records}\n")
                f.write(f"- **有效记录**: {session.valid_records}\n")
                f.write(f"- **坏数据**: {session.bad_records}\n\n")
                
                session_bad_data = [bd for bd in all_bad_data if bd.session_id == session.id]
                if session_bad_data:
                    f.write(f"**坏数据列表**:\n\n")
                    for bd in session_bad_data:
                        status_icon = {'pending': '🔴', 'fixed': '🟢', 'ignored': '🟡'}.get(bd.fix_status, '⚪')
                        f.write(f"{status_icon} **行 {bd.line_number}** - {bd.error_code}: {bd.error_message}\n")
                        f.write(f"   - 字段: {bd.field_name or 'N/A'}\n")
                        f.write(f"   - ISBN: {bd.isbn or 'N/A'}\n")
                        f.write(f"   - 状态: {bd.fix_status}\n")
                        if bd.fix_note:
                            f.write(f"   - 修复备注: {bd.fix_note}\n")
                        f.write(f"\n")
            
            f.write(f"---\n\n")
            f.write(f"*此报告由书目上架坏数据追踪器自动生成*\n")
        
        return filepath
    
    def export_all_clean_data(self) -> Dict[str, str]:
        return {
            'bibliography': self.export_clean_bibliography_csv(),
            'price_list': self.export_clean_price_list_csv(),
            'channel_listing': self.export_clean_channel_listing_csv()
        }
