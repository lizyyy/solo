import csv
import json
import os
from datetime import datetime, date
from typing import Dict, List, Any, Tuple, Optional
from werkzeug.utils import secure_filename
from flask import current_app

from app import db
from app.models import (
    ImportSession, Bibliography, PriceList, ChannelListing,
    ManualCorrection, BadData, FixHistory
)
from app.validators import DataValidator, ValidationResult, ISBNValidator, ReboundDetector

class DataImporter:
    def __init__(self):
        self.validator = DataValidator()
    
    def allowed_file(self, filename: str) -> bool:
        allowed_extensions = current_app.config['ALLOWED_EXTENSIONS']
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
    
    def parse_date(self, date_str: str) -> Optional[date]:
        if not date_str:
            return None
        
        date_formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y%m%d',
            '%Y年%m月%d日'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt).date()
            except (ValueError, TypeError):
                continue
        
        return None
    
    def read_csv(self, file_path: str, encoding: str = 'utf-8') -> List[Dict]:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f)
                return list(reader)
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                reader = csv.DictReader(f)
                return list(reader)
    
    def read_json(self, file_path: str, encoding: str = 'utf-8') -> List[Dict]:
        with open(file_path, 'r', encoding=encoding) as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data.get('data', data.get('records', [data]))
            return data
    
    def detect_file_type(self, filename: str, sample_data: List[Dict]) -> str:
        if not sample_data:
            return 'unknown'
        
        first_row = sample_data[0]
        keys = {k.lower() for k in first_row.keys()}
        
        bibliography_keys = {'isbn', 'title', 'author', 'publisher', 'category'}
        price_keys = {'isbn', 'print_run', 'price', 'currency'}
        channel_keys = {'isbn', 'channel_name', 'channel_category'}
        correction_keys = {'isbn', 'field_name', 'old_value', 'new_value'}
        
        bibliography_match = sum(1 for k in bibliography_keys if k in keys)
        price_match = sum(1 for k in price_keys if k in keys)
        channel_match = sum(1 for k in channel_keys if k in keys)
        correction_match = sum(1 for k in correction_keys if k in keys)
        
        matches = [
            ('bibliography', bibliography_match),
            ('price_list', price_match),
            ('channel_listing', channel_match),
            ('manual_correction', correction_match)
        ]
        
        best_match = max(matches, key=lambda x: x[1])
        if best_match[1] >= 2:
            return best_match[0]
        
        return 'unknown'
    
    def create_bad_data(self, session_id: int, source_file: str, line_number: int,
                        data_type: str, error: Dict, isbn: Optional[str] = None) -> BadData:
        bad_data = BadData(
            session_id=session_id,
            source_file=source_file,
            line_number=line_number,
            data_type=data_type,
            field_name=error.get('field_name'),
            error_code=error.get('error_code', 'UNKNOWN_ERROR'),
            error_message=error.get('error_message', '未知错误'),
            original_data=json.dumps(error.get('original_data', {}), ensure_ascii=False),
            isbn=isbn or error.get('isbn'),
            fix_status='pending'
        )
        db.session.add(bad_data)
        return bad_data
    
    def import_bibliography(self, data: List[Dict], session: ImportSession, 
                            filename: str) -> Tuple[int, int]:
        total = len(data)
        valid_count = 0
        bad_count = 0
        seen_isbns = set()
        
        for idx, row in enumerate(data, start=2):
            isbn = row.get('isbn', '').strip()
            isbn_clean = ISBNValidator.validate(isbn)[0] and isbn.replace('-', '').replace(' ', '') or isbn
            
            result = self.validator.validate_bibliography(row, idx, seen_isbns)
            
            if isbn_clean:
                seen_isbns.add(isbn_clean)
            
            for error in result.errors:
                self.create_bad_data(
                    session_id=session.id,
                    source_file=filename,
                    line_number=idx,
                    data_type='bibliography',
                    error=error,
                    isbn=isbn
                )
                bad_count += 1
            
            if result.is_valid:
                try:
                    existing_book = Bibliography.query.filter_by(isbn=isbn_clean).first()
                    
                    if existing_book:
                        existing_book.title = row.get('title', '').strip()
                        existing_book.author = row.get('author', '').strip() if row.get('author') else None
                        existing_book.publisher = row.get('publisher', '').strip() if row.get('publisher') else None
                        existing_book.publish_date = self.parse_date(row.get('publish_date', ''))
                        existing_book.category = row.get('category', '').strip() if row.get('category') else None
                        existing_book.series = row.get('series', '').strip() if row.get('series') else None
                        existing_book.page_count = int(row.get('page_count')) if row.get('page_count') and str(row.get('page_count')).isdigit() else None
                        existing_book.binding = row.get('binding', '').strip() if row.get('binding') else None
                    else:
                        book = Bibliography(
                            isbn=isbn_clean,
                            title=row.get('title', '').strip(),
                            author=row.get('author', '').strip() if row.get('author') else None,
                            publisher=row.get('publisher', '').strip() if row.get('publisher') else None,
                            publish_date=self.parse_date(row.get('publish_date', '')),
                            category=row.get('category', '').strip() if row.get('category') else None,
                            series=row.get('series', '').strip() if row.get('series') else None,
                            page_count=int(row.get('page_count')) if row.get('page_count') and str(row.get('page_count')).isdigit() else None,
                            binding=row.get('binding', '').strip() if row.get('binding') else None
                        )
                        db.session.add(book)
                    
                    valid_count += 1
                except Exception as e:
                    error_dict = {
                        'error_code': 'IMPORT_ERROR',
                        'error_message': str(e),
                        'field_name': None,
                        'original_data': row.copy(),
                        'line_number': idx,
                        'isbn': isbn
                    }
                    self.create_bad_data(
                        session_id=session.id,
                        source_file=filename,
                        line_number=idx,
                        data_type='bibliography',
                        error=error_dict,
                        isbn=isbn
                    )
                    bad_count += 1
        
        return valid_count, bad_count
    
    def import_price_list(self, data: List[Dict], session: ImportSession,
                          filename: str) -> Tuple[int, int]:
        total = len(data)
        valid_count = 0
        bad_count = 0
        
        for idx, row in enumerate(data, start=2):
            isbn = row.get('isbn', '').strip()
            isbn_clean = ISBNValidator.validate(isbn)[0] and isbn.replace('-', '').replace(' ', '') or isbn
            
            result = self.validator.validate_price_list(row, idx)
            
            for error in result.errors:
                self.create_bad_data(
                    session_id=session.id,
                    source_file=filename,
                    line_number=idx,
                    data_type='price_list',
                    error=error,
                    isbn=isbn
                )
                bad_count += 1
            
            if result.is_valid:
                try:
                    book = Bibliography.query.filter_by(isbn=isbn_clean).first()
                    
                    if not book:
                        error_dict = {
                            'error_code': 'BIBLIOGRAPHY_NOT_FOUND',
                            'error_message': f"书目不存在: {isbn_clean}",
                            'field_name': 'isbn',
                            'original_data': row.copy(),
                            'line_number': idx,
                            'isbn': isbn
                        }
                        self.create_bad_data(
                            session_id=session.id,
                            source_file=filename,
                            line_number=idx,
                            data_type='price_list',
                            error=error_dict,
                            isbn=isbn
                        )
                        bad_count += 1
                        continue
                    
                    print_run = row.get('print_run', '').strip()
                    existing_price = PriceList.query.filter_by(
                        bibliography_id=book.id,
                        print_run=print_run
                    ).first()
                    
                    currency = row.get('currency', 'CNY').strip().upper()
                    
                    if existing_price:
                        existing_price.price = float(row.get('price', 0))
                        existing_price.currency = currency
                        existing_price.effective_date = self.parse_date(row.get('effective_date', ''))
                        existing_price.is_active = row.get('is_active', 'true').lower() in ['true', '1', 'yes'] if row.get('is_active') else True
                    else:
                        price_list = PriceList(
                            bibliography_id=book.id,
                            print_run=print_run,
                            price=float(row.get('price', 0)),
                            currency=currency,
                            effective_date=self.parse_date(row.get('effective_date', '')),
                            is_active=row.get('is_active', 'true').lower() in ['true', '1', 'yes'] if row.get('is_active') else True
                        )
                        db.session.add(price_list)
                    
                    valid_count += 1
                except Exception as e:
                    error_dict = {
                        'error_code': 'IMPORT_ERROR',
                        'error_message': str(e),
                        'field_name': None,
                        'original_data': row.copy(),
                        'line_number': idx,
                        'isbn': isbn
                    }
                    self.create_bad_data(
                        session_id=session.id,
                        source_file=filename,
                        line_number=idx,
                        data_type='price_list',
                        error=error_dict,
                        isbn=isbn
                    )
                    bad_count += 1
        
        return valid_count, bad_count
    
    def import_channel_listing(self, data: List[Dict], session: ImportSession,
                               filename: str) -> Tuple[int, int]:
        total = len(data)
        valid_count = 0
        bad_count = 0
        
        for idx, row in enumerate(data, start=2):
            isbn = row.get('isbn', '').strip()
            isbn_clean = ISBNValidator.validate(isbn)[0] and isbn.replace('-', '').replace(' ', '') or isbn
            
            result = self.validator.validate_channel_listing(row, idx)
            
            for error in result.errors:
                self.create_bad_data(
                    session_id=session.id,
                    source_file=filename,
                    line_number=idx,
                    data_type='channel_listing',
                    error=error,
                    isbn=isbn
                )
                bad_count += 1
            
            if result.is_valid:
                try:
                    book = Bibliography.query.filter_by(isbn=isbn_clean).first()
                    
                    if not book:
                        error_dict = {
                            'error_code': 'BIBLIOGRAPHY_NOT_FOUND',
                            'error_message': f"书目不存在: {isbn_clean}",
                            'field_name': 'isbn',
                            'original_data': row.copy(),
                            'line_number': idx,
                            'isbn': isbn
                        }
                        self.create_bad_data(
                            session_id=session.id,
                            source_file=filename,
                            line_number=idx,
                            data_type='channel_listing',
                            error=error_dict,
                            isbn=isbn
                        )
                        bad_count += 1
                        continue
                    
                    channel_name = row.get('channel_name', '').strip()
                    existing_listing = ChannelListing.query.filter_by(
                        bibliography_id=book.id,
                        channel_name=channel_name
                    ).first()
                    
                    if existing_listing:
                        existing_listing.channel_category = row.get('channel_category', '').strip() if row.get('channel_category') else None
                        existing_listing.channel_price = float(row.get('channel_price')) if row.get('channel_price') else None
                        existing_listing.listing_status = row.get('listing_status', 'active').strip() if row.get('listing_status') else 'active'
                        existing_listing.listing_date = self.parse_date(row.get('listing_date', ''))
                    else:
                        channel_listing = ChannelListing(
                            bibliography_id=book.id,
                            channel_name=channel_name,
                            channel_category=row.get('channel_category', '').strip() if row.get('channel_category') else None,
                            channel_price=float(row.get('channel_price')) if row.get('channel_price') else None,
                            listing_status=row.get('listing_status', 'active').strip() if row.get('listing_status') else 'active',
                            listing_date=self.parse_date(row.get('listing_date', ''))
                        )
                        db.session.add(channel_listing)
                    
                    valid_count += 1
                except Exception as e:
                    error_dict = {
                        'error_code': 'IMPORT_ERROR',
                        'error_message': str(e),
                        'field_name': None,
                        'original_data': row.copy(),
                        'line_number': idx,
                        'isbn': isbn
                    }
                    self.create_bad_data(
                        session_id=session.id,
                        source_file=filename,
                        line_number=idx,
                        data_type='channel_listing',
                        error=error_dict,
                        isbn=isbn
                    )
                    bad_count += 1
        
        return valid_count, bad_count
    
    def import_manual_correction(self, data: List[Dict], session: ImportSession,
                                  filename: str) -> Tuple[int, int]:
        total = len(data)
        valid_count = 0
        bad_count = 0
        
        for idx, row in enumerate(data, start=2):
            isbn = row.get('isbn', '').strip()
            isbn_clean = ISBNValidator.validate(isbn)[0] and isbn.replace('-', '').replace(' ', '') or isbn
            field_name = row.get('field_name', '').strip()
            new_value = row.get('new_value', '')
            
            result = self.validator.validate_manual_correction(row, idx)
            
            for error in result.errors:
                self.create_bad_data(
                    session_id=session.id,
                    source_file=filename,
                    line_number=idx,
                    data_type='manual_correction',
                    error=error,
                    isbn=isbn
                )
                bad_count += 1
            
            if result.is_valid:
                try:
                    rebound_detected, rebound_msg, rebound_info = ReboundDetector.check_rebound(
                        isbn_clean, field_name, new_value
                    )
                    
                    if rebound_detected:
                        error_dict = {
                            'error_code': 'DATA_REBOUND',
                            'error_message': rebound_msg,
                            'field_name': field_name,
                            'original_data': {**row.copy(), 'rebound_info': rebound_info},
                            'line_number': idx,
                            'isbn': isbn
                        }
                        self.create_bad_data(
                            session_id=session.id,
                            source_file=filename,
                            line_number=idx,
                            data_type='manual_correction',
                            error=error_dict,
                            isbn=isbn
                        )
                        bad_count += 1
                        continue
                    
                    book = Bibliography.query.filter_by(isbn=isbn_clean).first()
                    if book:
                        old_value = None
                        if hasattr(book, field_name):
                            old_value = str(getattr(book, field_name) or '')
                        
                        correction = ManualCorrection(
                            isbn=isbn_clean,
                            field_name=field_name,
                            old_value=old_value,
                            new_value=str(new_value),
                            correction_reason=row.get('correction_reason', '').strip() if row.get('correction_reason') else None,
                            corrector=row.get('corrector', '').strip() if row.get('corrector') else None
                        )
                        db.session.add(correction)
                        
                        if hasattr(book, field_name):
                            setattr(book, field_name, new_value)
                    
                    valid_count += 1
                except Exception as e:
                    error_dict = {
                        'error_code': 'IMPORT_ERROR',
                        'error_message': str(e),
                        'field_name': None,
                        'original_data': row.copy(),
                        'line_number': idx,
                        'isbn': isbn
                    }
                    self.create_bad_data(
                        session_id=session.id,
                        source_file=filename,
                        line_number=idx,
                        data_type='manual_correction',
                        error=error_dict,
                        isbn=isbn
                    )
                    bad_count += 1
        
        return valid_count, bad_count
    
    def import_file(self, file_path: str, filename: str, file_type: str = None) -> Dict:
        secure_name = secure_filename(filename)
        
        if filename.lower().endswith('.csv'):
            data = self.read_csv(file_path)
        elif filename.lower().endswith('.json'):
            data = self.read_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {filename}")
        
        if not file_type or file_type == 'auto':
            file_type = self.detect_file_type(secure_name, data)
        
        if file_type == 'unknown':
            raise ValueError("无法自动识别文件类型，请手动指定")
        
        session = ImportSession(
            session_name=f"{file_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            file_type=file_type,
            original_filename=secure_name,
            total_records=len(data)
        )
        db.session.add(session)
        db.session.flush()
        
        try:
            if file_type == 'bibliography':
                valid_count, bad_count = self.import_bibliography(data, session, secure_name)
            elif file_type == 'price_list':
                valid_count, bad_count = self.import_price_list(data, session, secure_name)
            elif file_type == 'channel_listing':
                valid_count, bad_count = self.import_channel_listing(data, session, secure_name)
            elif file_type == 'manual_correction':
                valid_count, bad_count = self.import_manual_correction(data, session, secure_name)
            else:
                raise ValueError(f"不支持的文件类型: {file_type}")
            
            session.valid_records = valid_count
            session.bad_records = bad_count
            
            db.session.commit()
            
            return {
                'success': True,
                'session_id': session.id,
                'file_type': file_type,
                'total_records': session.total_records,
                'valid_records': valid_count,
                'bad_records': bad_count,
                'message': f"导入完成: 有效 {valid_count} 条, 坏数据 {bad_count} 条"
            }
            
        except Exception as e:
            db.session.rollback()
            raise e
