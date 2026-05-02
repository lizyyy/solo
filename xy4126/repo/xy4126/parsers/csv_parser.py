import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, TextIO, Optional
from io import StringIO
from uuid import uuid4

from models import ServiceNote, ClaimApplication
from indexers import WaybillExtractor


class CSVParseError(Exception):
    pass


class ServiceNoteParser:
    REQUIRED_COLUMNS = ['运单号', '备注内容']
    ALTERNATIVE_COLUMNS = {
        '运单号': ['waybill_number', 'waybill', 'tracking_number', 'tracking', '快递单号', '单号', '物流号'],
        '备注内容': ['content', 'remark', 'note', '内容', '备注', '说明', '客服备注'],
    }
    
    def _parse_datetime(self, dt_str: Any) -> Optional[datetime]:
        if not dt_str:
            return None
        
        if isinstance(dt_str, datetime):
            return dt_str
        
        dt_str = str(dt_str).strip()
        if not dt_str:
            return None
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d-%m-%Y %H:%M:%S',
            '%d/%m/%Y %H:%M:%S',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        return None
    
    def _find_column(self, fieldnames: List[str], required: str) -> Optional[str]:
        fieldnames_lower = [f.lower().strip() for f in fieldnames]
        
        if required in fieldnames:
            return required
        
        required_lower = required.lower()
        if required_lower in fieldnames_lower:
            idx = fieldnames_lower.index(required_lower)
            return fieldnames[idx]
        
        if required in self.ALTERNATIVE_COLUMNS:
            for alt in self.ALTERNATIVE_COLUMNS[required]:
                alt_lower = alt.lower()
                if alt_lower in fieldnames_lower:
                    idx = fieldnames_lower.index(alt_lower)
                    return fieldnames[idx]
                for fn in fieldnames:
                    if alt_lower in fn.lower():
                        return fn
        
        return None
    
    def parse(self, content: str, source_file: str = "") -> List[ServiceNote]:
        notes = []
        
        try:
            reader = csv.DictReader(StringIO(content))
            fieldnames = reader.fieldnames or []
            
            waybill_col = self._find_column(fieldnames, '运单号')
            content_col = self._find_column(fieldnames, '备注内容')
            
            if not waybill_col:
                raise CSVParseError(f"找不到运单号列。可用列: {', '.join(fieldnames)}")
            
            if not content_col:
                raise CSVParseError(f"找不到备注内容列。可用列: {', '.join(fieldnames)}")
            
            operator_col = self._find_column(fieldnames, '操作人') or self._find_column(fieldnames, '客服')
            time_col = self._find_column(fieldnames, '时间') or self._find_column(fieldnames, '日期')
            
            for row in reader:
                waybill_value = str(row.get(waybill_col, '')).strip()
                if not waybill_value:
                    continue
                
                waybill_number = WaybillExtractor.extract(waybill_value) or waybill_value
                note_content = str(row.get(content_col, '')).strip()
                
                if not note_content:
                    continue
                
                operator = ""
                if operator_col:
                    operator = str(row.get(operator_col, '')).strip()
                
                timestamp = None
                if time_col:
                    timestamp = self._parse_datetime(row.get(time_col, ''))
                
                note = ServiceNote(
                    note_id=f"note_{uuid4().hex[:12]}",
                    waybill_number=waybill_number,
                    content=note_content,
                    operator=operator,
                    timestamp=timestamp,
                    source_file=source_file,
                    metadata={
                        "raw_row": {k: v for k, v in row.items()},
                        "parsed_at": datetime.now().isoformat()
                    }
                )
                notes.append(note)
            
            return notes
        
        except csv.Error as e:
            raise CSVParseError(f"CSV 解析错误: {str(e)}")
    
    def parse_file(self, file_path: str) -> List[ServiceNote]:
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            return self.parse(content, source_file=file_path)
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                content = f.read()
            return self.parse(content, source_file=file_path)
        except Exception as e:
            raise CSVParseError(f"读取文件失败: {str(e)}")


class ClaimApplicationParser:
    REQUIRED_COLUMNS = ['运单号', '赔付金额']
    ALTERNATIVE_COLUMNS = {
        '运单号': ['waybill_number', 'waybill', 'tracking_number', 'tracking', '快递单号', '单号', '物流号'],
        '赔付金额': ['claim_amount', 'amount', '金额', '申请金额', '理赔金额', '索赔金额'],
    }
    
    def _parse_datetime(self, dt_str: Any) -> Optional[datetime]:
        if not dt_str:
            return None
        
        if isinstance(dt_str, datetime):
            return dt_str
        
        dt_str = str(dt_str).strip()
        if not dt_str:
            return None
        
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        
        return None
    
    def _parse_decimal(self, value: Any) -> Decimal:
        if value is None:
            return Decimal('0')
        
        value_str = str(value).strip()
        
        value_str = value_str.replace('¥', '').replace('￥', '').replace('元', '')
        value_str = value_str.replace(',', '').strip()
        
        if not value_str:
            return Decimal('0')
        
        try:
            return Decimal(value_str)
        except InvalidOperation:
            return Decimal('0')
    
    def _find_column(self, fieldnames: List[str], required: str) -> Optional[str]:
        fieldnames_lower = [f.lower().strip() for f in fieldnames]
        
        if required in fieldnames:
            return required
        
        required_lower = required.lower()
        if required_lower in fieldnames_lower:
            idx = fieldnames_lower.index(required_lower)
            return fieldnames[idx]
        
        if required in self.ALTERNATIVE_COLUMNS:
            for alt in self.ALTERNATIVE_COLUMNS[required]:
                alt_lower = alt.lower()
                if alt_lower in fieldnames_lower:
                    idx = fieldnames_lower.index(alt_lower)
                    return fieldnames[idx]
                for fn in fieldnames:
                    if alt_lower in fn.lower():
                        return fn
        
        return None
    
    def parse(self, content: str, source_file: str = "") -> List[ClaimApplication]:
        applications = []
        
        try:
            reader = csv.DictReader(StringIO(content))
            fieldnames = reader.fieldnames or []
            
            waybill_col = self._find_column(fieldnames, '运单号')
            amount_col = self._find_column(fieldnames, '赔付金额')
            
            if not waybill_col:
                raise CSVParseError(f"找不到运单号列。可用列: {', '.join(fieldnames)}")
            
            for row in reader:
                waybill_value = str(row.get(waybill_col, '')).strip()
                if not waybill_value:
                    continue
                
                waybill_number = WaybillExtractor.extract(waybill_value) or waybill_value
                
                claim_amount = Decimal('0')
                if amount_col:
                    claim_amount = self._parse_decimal(row.get(amount_col, '0'))
                
                reason_col = self._find_column(fieldnames, '赔付原因') or self._find_column(fieldnames, '原因')
                claim_reason = ""
                if reason_col:
                    claim_reason = str(row.get(reason_col, '')).strip()
                
                applicant_col = self._find_column(fieldnames, '申请人') or self._find_column(fieldnames, '驿站')
                applicant = ""
                if applicant_col:
                    applicant = str(row.get(applicant_col, '')).strip()
                
                time_col = self._find_column(fieldnames, '申请时间') or self._find_column(fieldnames, '时间')
                apply_time = None
                if time_col:
                    apply_time = self._parse_datetime(row.get(time_col, ''))
                
                expected_col = self._find_column(fieldnames, '预期金额')
                expected_amount = Decimal('0')
                if expected_col:
                    expected_amount = self._parse_decimal(row.get(expected_col, '0'))
                
                approved_col = self._find_column(fieldnames, '核定金额') or self._find_column(fieldnames, '审批金额')
                approved_amount = None
                if approved_col and row.get(approved_col):
                    approved_amount = self._parse_decimal(row.get(approved_col, ''))
                
                status_col = self._find_column(fieldnames, '状态')
                status = "pending"
                if status_col:
                    status = str(row.get(status_col, 'pending')).strip().lower() or "pending"
                
                application = ClaimApplication(
                    claim_id=f"claim_{uuid4().hex[:12]}",
                    waybill_number=waybill_number,
                    claim_amount=claim_amount,
                    claim_reason=claim_reason,
                    applicant=applicant,
                    apply_time=apply_time,
                    expected_amount=expected_amount,
                    approved_amount=approved_amount,
                    source_file=source_file,
                    status=status,
                    metadata={
                        "raw_row": {k: v for k, v in row.items()},
                        "parsed_at": datetime.now().isoformat()
                    }
                )
                applications.append(application)
            
            return applications
        
        except csv.Error as e:
            raise CSVParseError(f"CSV 解析错误: {str(e)}")
    
    def parse_file(self, file_path: str) -> List[ClaimApplication]:
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                content = f.read()
            return self.parse(content, source_file=file_path)
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                content = f.read()
            return self.parse(content, source_file=file_path)
        except Exception as e:
            raise CSVParseError(f"读取文件失败: {str(e)}")
