import os
import re
import logging
from datetime import datetime
from typing import Tuple, Optional, Dict, Any
from config import Config
from database import Database

logger = logging.getLogger(__name__)

class FileMatcher:
    def __init__(self, db: Database = None):
        self.db = db or Database()
    
    def classify_file(self, file_path: str) -> Tuple[str, str]:
        file_name = os.path.basename(file_path)
        name_without_ext, ext = os.path.splitext(file_name)
        ext = ext.lower()
        
        file_type = None
        performance_name = name_without_ext
        
        lower_name = name_without_ext.lower()
        
        if ext in Config.AUDIO_EXTENSIONS:
            if '_audio' in lower_name:
                performance_name = name_without_ext[:lower_name.rfind('_audio')]
            elif '-audio' in lower_name:
                performance_name = name_without_ext[:lower_name.rfind('-audio')]
            file_type = 'audio'
        
        elif ext in Config.TRANSCRIPT_EXTENSIONS:
            if '_transcript' in lower_name or '_转写稿' in name_without_ext:
                idx = lower_name.rfind('_transcript')
                if idx == -1:
                    idx = name_without_ext.rfind('_转写稿')
                performance_name = name_without_ext[:idx]
            elif '-transcript' in lower_name:
                performance_name = name_without_ext[:lower_name.rfind('-transcript')]
            file_type = 'transcript'
        
        elif ext in Config.LICENSE_EXTENSIONS:
            if '_license' in lower_name or '_授权' in name_without_ext:
                idx = lower_name.rfind('_license')
                if idx == -1:
                    idx = name_without_ext.rfind('_授权')
                performance_name = name_without_ext[:idx]
            elif '-license' in lower_name:
                performance_name = name_without_ext[:lower_name.rfind('-license')]
            file_type = 'license'
        
        if file_type is None:
            if ext in Config.AUDIO_EXTENSIONS:
                file_type = 'audio'
            elif ext in Config.LICENSE_EXTENSIONS:
                file_type = 'license'
            elif ext in Config.TRANSCRIPT_EXTENSIONS:
                file_type = 'transcript'
        
        return file_type, performance_name
    
    def extract_performance_info(self, performance_name: str) -> Dict[str, Any]:
        result = {
            'name': performance_name,
            'date': None
        }
        
        date_patterns = [
            r'(\d{4})[-_年]?(\d{1,2})[-_月]?(\d{1,2})',
            r'(\d{4})(\d{2})(\d{2})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, performance_name)
            if match:
                try:
                    year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    if 1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
                        result['date'] = f"{year:04d}-{month:02d}-{day:02d}"
                        break
                except (ValueError, IndexError):
                    continue
        
        return result
    
    def process_file(self, file_path: str) -> Dict[str, Any]:
        file_name = os.path.basename(file_path)
        result = {
            'success': False,
            'file_name': file_name,
            'file_type': None,
            'performance_name': None,
            'message': ''
        }
        
        if not os.path.exists(file_path):
            result['message'] = f'文件不存在: {file_path}'
            return result
        
        file_size = os.path.getsize(file_path)
        file_type, performance_name = self.classify_file(file_path)
        
        result['file_type'] = file_type
        result['performance_name'] = performance_name
        
        if file_type is None:
            result['message'] = f'无法识别文件类型: {file_name}'
            return result
        
        if not performance_name or performance_name.strip() == '':
            result['message'] = f'无法从文件名提取演出名称: {file_name}'
            return result
        
        perf_info = self.extract_performance_info(performance_name)
        
        if self.db.check_duplicate_file(file_name):
            result['message'] = f'文件名已存在: {file_name}'
            result['is_duplicate'] = True
            self._record_duplicate_issue(performance_name, file_name)
            return result
        
        performance_id = self.db.get_or_create_performance(performance_name)
        
        if perf_info['date']:
            self.db.update_performance_info(performance_id, performance_date=perf_info['date'])
        
        try:
            if file_type == 'audio':
                self._process_audio_file(performance_id, file_path, file_name, file_size)
            elif file_type == 'transcript':
                self._process_transcript(performance_id, file_path, file_name, file_size)
            elif file_type == 'license':
                self._process_license(performance_id, file_path, file_name, file_size)
            
            result['success'] = True
            result['performance_id'] = performance_id
            result['message'] = f'成功处理文件: {file_name} -> 演出: {performance_name}'
            logger.info(result['message'])
            
        except Exception as e:
            result['message'] = f'处理文件时出错: {str(e)}'
            logger.error(result['message'])
        
        return result
    
    def _process_audio_file(self, performance_id: int, file_path: str, file_name: str, file_size: int):
        ext = os.path.splitext(file_name)[1].lower().lstrip('.')
        self.db.add_audio_file(
            performance_id=performance_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            format=ext
        )
    
    def _process_transcript(self, performance_id: int, file_path: str, file_name: str, file_size: int):
        ext = os.path.splitext(file_name)[1].lower().lstrip('.')
        page_count = self._estimate_page_count(file_path, ext)
        
        self.db.add_transcript(
            performance_id=performance_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            page_count=page_count,
            format=ext
        )
        
        if page_count and page_count < 2:
            self.db.add_issue(
                performance_id=performance_id,
                issue_type='missing_pages',
                issue_description=f'转写稿页数较少 ({page_count}页)，可能缺页',
                file_name=file_name,
                severity='warning'
            )
    
    def _process_license(self, performance_id: int, file_path: str, file_name: str, file_size: int):
        ext = os.path.splitext(file_name)[1].lower().lstrip('.')
        license_info = self._extract_license_info(file_path)
        
        self.db.add_license(
            performance_id=performance_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            license_type=license_info.get('type'),
            start_date=license_info.get('start_date'),
            end_date=license_info.get('end_date')
        )
    
    def _estimate_page_count(self, file_path: str, ext: str) -> Optional[int]:
        try:
            if ext == 'pdf':
                import PyPDF2
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    return len(reader.pages)
            elif ext == 'docx':
                from docx import Document
                doc = Document(file_path)
                paragraphs = len(doc.paragraphs)
                return max(1, paragraphs // 30)
            elif ext == 'txt':
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
                    return max(1, len(lines) // 50)
        except Exception as e:
            logger.warning(f"估算页数时出错 {file_path}: {e}")
        
        return None
    
    def _extract_license_info(self, file_path: str) -> Dict[str, Any]:
        result = {
            'type': None,
            'start_date': None,
            'end_date': None
        }
        
        try:
            ext = os.path.splitext(file_path)[1].lower()
            
            text = ""
            if ext == '.pdf':
                import PyPDF2
                with open(file_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    for page in reader.pages:
                        text += page.extract_text() or ""
            elif ext == '.txt':
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    text = f.read()
            
            if '非商业' in text or 'non-commercial' in text.lower():
                result['type'] = '非商业授权'
            elif '商业' in text or 'commercial' in text.lower():
                result['type'] = '商业授权'
            
            date_patterns = [
                r'(\d{4})[-_年](\d{1,2})[-_月](\d{1,2})',
                r'(\d{4})/(\d{1,2})/(\d{1,2})',
                r'(\d{4})(\d{2})(\d{2})',
            ]
            
            dates = []
            for pattern in date_patterns:
                for match in re.finditer(pattern, text):
                    try:
                        year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
                        if 1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
                            date_str = f"{year:04d}-{month:02d}-{day:02d}"
                            dates.append((match.start(), date_str))
                    except (ValueError, IndexError):
                        continue
            
            if len(dates) >= 2:
                dates.sort()
                result['start_date'] = dates[0][1]
                result['end_date'] = dates[-1][1]
            elif len(dates) == 1:
                result['end_date'] = dates[0][1]
        
        except Exception as e:
            logger.warning(f"提取授权信息时出错 {file_path}: {e}")
        
        return result
    
    def _record_duplicate_issue(self, performance_name: str, file_name: str):
        performance = self.db.get_performance_by_name(performance_name)
        if performance:
            self.db.add_issue(
                performance_id=performance['id'],
                issue_type='filename_conflict',
                issue_description=f'文件名冲突，文件已存在: {file_name}',
                file_name=file_name,
                severity='error'
            )
