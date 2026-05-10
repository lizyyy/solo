from typing import List, Dict, Optional, Tuple
from pathlib import Path
import re
from datetime import datetime

from .config import Config
from .data_access import DataAccess


class PageParser:
    def __init__(self, config: Config):
        self.config = config
        self.patterns = [re.compile(p, re.IGNORECASE) for p in config.page_patterns]
    
    def parse_filename(self, filename: str) -> Tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
        path = Path(filename)
        name = path.name
        ext = path.suffix.lower()
        
        for pattern in self.patterns:
            match = pattern.match(name)
            if match:
                try:
                    volume = int(match.group('volume'))
                    page = int(match.group('page'))
                    file_ext = match.group('ext').lower()
                    return volume, page, file_ext, None
                except (ValueError, IndexError) as e:
                    return None, None, ext[1:] if ext else None, f"解析数值失败: {str(e)}"
        
        return None, None, ext[1:] if ext else None, "文件名不符合任何已知的页码格式"
    
    def is_supported_extension(self, filename: str) -> bool:
        ext = Path(filename).suffix.lower()
        return ext in self.config.supported_extensions


class DirectoryScanner:
    def __init__(self, config: Config, data_access: DataAccess):
        self.config = config
        self.data_access = data_access
        self.parser = PageParser(config)
    
    def scan_directory(self, scan_dir: str, recursive: bool = True) -> Dict:
        scan_path = Path(scan_dir)
        
        if not scan_path.exists():
            return {
                'success': False,
                'error': f"目录不存在: {scan_dir}",
                'session_id': None
            }
        
        if not scan_path.is_dir():
            return {
                'success': False,
                'error': f"不是目录: {scan_dir}",
                'session_id': None
            }
        
        session_id = self.data_access.create_scan_session(str(scan_path.absolute()))
        
        files = []
        if recursive:
            for item in scan_path.rglob('*'):
                if item.is_file():
                    files.append(item)
        else:
            for item in scan_path.iterdir():
                if item.is_file():
                    files.append(item)
        
        total_files = 0
        parsed_files = 0
        failed_files = 0
        
        for file_path in files:
            if not self.parser.is_supported_extension(file_path.name):
                continue
            
            total_files += 1
            
            volume, page, ext, error = self.parser.parse_filename(file_path.name)
            
            file_stat = file_path.stat()
            file_size = file_stat.st_size
            modification_time = datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            
            if error:
                parse_status = 'failed'
                failed_files += 1
            else:
                parse_status = 'success'
                parsed_files += 1
            
            self.data_access.insert_scanned_file(
                session_id=session_id,
                file_path=str(file_path.absolute()),
                file_name=file_path.name,
                file_size=file_size,
                modification_time=modification_time,
                volume_number=volume,
                page_number=page,
                file_extension=ext,
                parse_status=parse_status,
                parse_error=error
            )
            
            if error:
                self.data_access.insert_exception(
                    exception_type='parse_error',
                    severity='warning',
                    title='文件名解析失败',
                    description=error,
                    source_type='file',
                    source_reference=str(file_path.absolute()),
                    source_data={
                        'file_name': file_path.name,
                        'session_id': session_id
                    }
                )
        
        self.data_access.update_scan_session_stats(
            session_id=session_id,
            total_files=total_files,
            parsed_files=parsed_files,
            failed_files=failed_files
        )
        
        return {
            'success': True,
            'session_id': session_id,
            'total_files': total_files,
            'parsed_files': parsed_files,
            'failed_files': failed_files,
            'scan_dir': str(scan_path.absolute())
        }
