from typing import List, Dict, Optional, Set, Tuple
from collections import defaultdict

from .data_access import DataAccess


class VolumeChecker:
    def __init__(self, data_access: DataAccess):
        self.data_access = data_access
    
    def run_check(self, session_id: Optional[int] = None, 
                  description: Optional[str] = None) -> Dict:
        files = self.data_access.get_scanned_files(session_id=session_id)
        
        if not files:
            return {
                'success': False,
                'error': '没有找到扫描文件，请先导入扫描目录',
                'check_run_id': None
            }
        
        check_run_id = self.data_access.create_check_run(description)
        
        volumes = defaultdict(list)
        parsed_files = [f for f in files if f['parse_status'] == 'success']
        
        for file in parsed_files:
            vol = file['volume_number']
            if vol is not None:
                volumes[vol].append(file)
        
        volume_numbers = sorted(volumes.keys())
        
        for i, vol_num in enumerate(volume_numbers):
            vol_files = volumes[vol_num]
            pages = sorted(set(f['page_number'] for f in vol_files if f['page_number'] is not None))
            
            actual_start_page = pages[0] if pages else None
            actual_end_page = pages[-1] if pages else None
            actual_page_count = len(pages)
            
            expected_start_page = 1
            expected_end_page = actual_end_page
            expected_page_count = actual_page_count
            
            if i > 0:
                prev_vol_num = volume_numbers[i - 1]
                prev_vol_files = volumes[prev_vol_num]
                prev_pages = sorted(set(f['page_number'] for f in prev_vol_files if f['page_number'] is not None))
                if prev_pages:
                    expected_end_page = prev_pages[-1]
                    expected_start_page = expected_end_page + 1
            
            missing_pages = self._find_missing_pages(pages, expected_start_page, expected_end_page)
            
            for page in range(expected_start_page, expected_end_page + 1) if expected_end_page else pages:
                if page in pages:
                    matching_files = [f for f in vol_files if f['page_number'] == page]
                    if len(matching_files) > 1:
                        status = 'duplicate'
                        issues = f'重复页码，找到 {len(matching_files)} 个文件'
                        file_path = matching_files[0]['file_path']
                        
                        self.data_access.insert_exception(
                            exception_type='duplicate_page',
                            severity='error',
                            title=f'卷{vol_num} 页码{page} 重复',
                            description=f'找到 {len(matching_files)} 个文件对应同一页码',
                            check_run_id=check_run_id,
                            source_type='page',
                            source_reference=f'v{vol_num}p{page}',
                            source_data={
                                'files': [f['file_path'] for f in matching_files],
                                'volume': vol_num,
                                'page': page
                            }
                        )
                    else:
                        status = 'ok'
                        issues = None
                        file_path = matching_files[0]['file_path']
                    
                    self.data_access.insert_page_check(
                        check_run_id=check_run_id,
                        volume_number=vol_num,
                        page_number=page,
                        file_path=file_path,
                        status=status,
                        issues=issues
                    )
                else:
                    self.data_access.insert_page_check(
                        check_run_id=check_run_id,
                        volume_number=vol_num,
                        page_number=page,
                        file_path=None,
                        status='missing',
                        issues='缺页'
                    )
                    
                    self.data_access.insert_exception(
                        exception_type='missing_page',
                        severity='error',
                        title=f'卷{vol_num} 页码{page} 缺失',
                        description=f'在预期的页码范围内未找到该页码的扫描文件',
                        check_run_id=check_run_id,
                        source_type='page',
                        source_reference=f'v{vol_num}p{page}',
                        source_data={
                            'volume': vol_num,
                            'page': page,
                            'expected_start': expected_start_page,
                            'expected_end': expected_end_page
                        }
                    )
            
            vol_status = 'ok'
            if missing_pages:
                vol_status = 'has_missing'
            
            has_duplicates = any(len([f for f in vol_files if f['page_number'] == p]) > 1 for p in pages)
            if has_duplicates:
                vol_status = 'has_issues'
            
            self.data_access.insert_volume(
                check_run_id=check_run_id,
                volume_number=vol_num,
                expected_start_page=expected_start_page,
                expected_end_page=expected_end_page,
                actual_start_page=actual_start_page,
                actual_end_page=actual_end_page,
                expected_page_count=expected_page_count,
                actual_page_count=actual_page_count,
                status=vol_status
            )
        
        if len(volume_numbers) > 1:
            min_vol = min(volume_numbers)
            max_vol = max(volume_numbers)
            for expected_vol in range(min_vol, max_vol + 1):
                if expected_vol not in volume_numbers:
                    self.data_access.insert_exception(
                        exception_type='missing_volume',
                        severity='critical',
                        title=f'卷次 {expected_vol} 缺失',
                        description=f'在卷次 {min_vol} 到 {max_vol} 之间缺少卷 {expected_vol}',
                        check_run_id=check_run_id,
                        source_type='volume',
                        source_reference=f'v{expected_vol}',
                        source_data={
                            'missing_volume': expected_vol,
                            'min_volume': min_vol,
                            'max_volume': max_vol
                        }
                    )
        
        total_volumes = len(volume_numbers)
        total_pages = sum(len(v) for v in volumes.values())
        exceptions = self.data_access.get_exceptions(check_run_id=check_run_id)
        error_count = sum(1 for e in exceptions if e['severity'] in ['error', 'critical'])
        warning_count = sum(1 for e in exceptions if e['severity'] == 'warning')
        
        return {
            'success': True,
            'check_run_id': check_run_id,
            'total_volumes': total_volumes,
            'total_pages': total_pages,
            'error_count': error_count,
            'warning_count': warning_count,
            'volume_numbers': volume_numbers
        }
    
    def _find_missing_pages(self, actual_pages: List[int], 
                           expected_start: int, expected_end: int) -> List[int]:
        if not actual_pages:
            return []
        
        expected_pages = set(range(expected_start, expected_end + 1))
        actual_set = set(actual_pages)
        
        return sorted(expected_pages - actual_set)
