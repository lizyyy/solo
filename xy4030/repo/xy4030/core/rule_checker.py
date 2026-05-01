import os
import re
from typing import List, Dict, Optional, Any, Tuple
from collections import defaultdict
from dataclasses import dataclass, field

from config import Config


@dataclass
class Issue:
    issue_type: str
    severity: str = 'warning'
    description: str = ''
    file_id: Optional[int] = None
    index_record_id: Optional[int] = None
    affected_files: List[str] = field(default_factory=list)
    affected_pages: List[int] = field(default_factory=list)
    file_info: Optional[Dict] = None
    index_info: Optional[Dict] = None


class RuleChecker:
    def __init__(self, files: List[Dict], index_records: List[Dict], config: Dict = None):
        self.files = files
        self.index_records = index_records
        self.config = config or {}
        
        self.min_resolution = self.config.get('min_resolution', Config.DEFAULT_MIN_RESOLUTION)
        self.blank_page_threshold = self.config.get('blank_page_threshold', Config.DEFAULT_BLANK_PAGE_THRESHOLD)
        
        self.case_to_files = defaultdict(list)
        self.case_to_records = defaultdict(list)
        self.filename_to_file = {}
        self._build_indexes()
    
    def _build_indexes(self):
        for f in self.files:
            self.filename_to_file[f['filename']] = f
            
            case_num = f.get('extracted_case_number')
            if case_num:
                self.case_to_files[case_num].append(f)
        
        for record in self.index_records:
            case_num = record.get('case_number')
            if case_num:
                self.case_to_records[case_num].append(record)
    
    def check_all(self) -> List[Issue]:
        issues = []
        
        issues.extend(self.check_missing_pages())
        issues.extend(self.check_duplicate_pages())
        issues.extend(self.check_filename_mismatch())
        issues.extend(self.check_low_resolution())
        issues.extend(self.check_blank_pages())
        issues.extend(self.check_orientation_mismatch())
        issues.extend(self.check_index_missing_files())
        issues.extend(self.check_extra_files())
        issues.extend(self.check_box_mismatch())
        
        return issues
    
    def check_missing_pages(self) -> List[Issue]:
        issues = []
        
        for case_num, records in self.case_to_records.items():
            if not records:
                continue
            
            records_sorted = sorted(records, key=lambda r: r['page_number'] or 0)
            page_numbers = [r['page_number'] for r in records_sorted if r['page_number'] is not None]
            
            if not page_numbers:
                continue
            
            min_page = min(page_numbers)
            max_page = max(page_numbers)
            
            existing_pages = set(page_numbers)
            missing_pages = []
            
            for page in range(min_page, max_page + 1):
                if page not in existing_pages:
                    missing_pages.append(page)
            
            if missing_pages:
                issues.append(Issue(
                    issue_type='missing_page',
                    severity='error',
                    description=f"案卷号 {case_num}: 索引中缺少页码 {', '.join(map(str, missing_pages))}",
                    affected_pages=missing_pages,
                    index_info={'case_number': case_num}
                ))
            
            files = self.case_to_files.get(case_num, [])
            file_pages = {f.get('extracted_page_number') for f in files if f.get('extracted_page_number')}
            
            missing_in_files = []
            for page in page_numbers:
                if page not in file_pages:
                    missing_in_files.append(page)
            
            if missing_in_files:
                issues.append(Issue(
                    issue_type='index_missing_file',
                    severity='error',
                    description=f"案卷号 {case_num}: 索引中有但文件缺失的页码 {', '.join(map(str, missing_in_files))}",
                    affected_pages=missing_in_files,
                    index_info={'case_number': case_num}
                ))
        
        return issues
    
    def check_duplicate_pages(self) -> List[Issue]:
        issues = []
        
        for case_num, files in self.case_to_files.items():
            page_to_files = defaultdict(list)
            
            for f in files:
                page_num = f.get('extracted_page_number')
                if page_num is not None:
                    page_to_files[page_num].append(f)
            
            for page_num, file_list in page_to_files.items():
                if len(file_list) > 1:
                    filenames = [f['filename'] for f in file_list]
                    issues.append(Issue(
                        issue_type='duplicate_page',
                        severity='warning',
                        description=f"案卷号 {case_num}: 页码 {page_num} 有多个文件: {', '.join(filenames)}",
                        affected_files=filenames,
                        affected_pages=[page_num],
                        file_info={'case_number': case_num, 'page_number': page_num}
                    ))
        
        for case_num, records in self.case_to_records.items():
            page_to_records = defaultdict(list)
            
            for record in records:
                page_num = record.get('page_number')
                if page_num is not None:
                    page_to_records[page_num].append(record)
            
            for page_num, record_list in page_to_records.items():
                if len(record_list) > 1:
                    issues.append(Issue(
                        issue_type='duplicate_page',
                        severity='warning',
                        description=f"案卷号 {case_num}: 索引中页码 {page_num} 重复出现",
                        affected_pages=[page_num],
                        index_info={'case_number': case_num, 'page_number': page_num}
                    ))
        
        return issues
    
    def check_filename_mismatch(self) -> List[Issue]:
        issues = []
        
        for record in self.index_records:
            expected_filename = record.get('expected_filename')
            if not expected_filename:
                continue
            
            case_num = record.get('case_number')
            page_num = record.get('page_number')
            
            expected_base = os.path.splitext(expected_filename)[0].lower()
            
            found_match = False
            matching_files = []
            
            for f in self.files:
                file_base = os.path.splitext(f['filename'])[0].lower()
                
                if expected_base == file_base:
                    found_match = True
                    matching_files.append(f)
                elif expected_base.replace(' ', '').replace('_', '').replace('-', '') == \
                     file_base.replace(' ', '').replace('_', '').replace('-', ''):
                    matching_files.append(f)
            
            if not matching_files:
                file_case = f.get('extracted_case_number')
                file_page = f.get('extracted_page_number')
                
                if case_num and page_num:
                    for f in self.files:
                        if (f.get('extracted_case_number') == case_num and 
                            f.get('extracted_page_number') == page_num):
                            matching_files.append(f)
                            break
            
            if not matching_files:
                issues.append(Issue(
                    issue_type='filename_mismatch',
                    severity='warning',
                    description=f"索引文件 {expected_filename} 在扫描文件夹中未找到匹配文件",
                    affected_files=[expected_filename],
                    index_info=record
                ))
            elif len(matching_files) == 1:
                f = matching_files[0]
                file_base = os.path.splitext(f['filename'])[0]
                expected_base = os.path.splitext(expected_filename)[0]
                
                if file_base != expected_base:
                    issues.append(Issue(
                        issue_type='filename_mismatch',
                        severity='info',
                        description=f"文件名存在差异: 索引期望 '{expected_filename}', 实际文件 '{f['filename']}'",
                        affected_files=[expected_filename, f['filename']],
                        file_info=f,
                        index_info=record
                    ))
        
        return issues
    
    def check_low_resolution(self) -> List[Issue]:
        issues = []
        
        for f in self.files:
            resolution = f.get('resolution')
            if resolution is None:
                continue
            
            if resolution < self.min_resolution:
                issues.append(Issue(
                    issue_type='low_resolution',
                    severity='warning',
                    description=f"文件 {f['filename']}: 分辨率 {resolution} DPI 低于阈值 {self.min_resolution} DPI",
                    affected_files=[f['filename']],
                    file_info=f
                ))
        
        return issues
    
    def check_blank_pages(self) -> List[Issue]:
        issues = []
        
        for f in self.files:
            if f.get('is_blank'):
                confidence = f.get('blank_confidence', 0)
                issues.append(Issue(
                    issue_type='blank_page',
                    severity='info',
                    description=f"文件 {f['filename']}: 疑似空白页 (空白比例: {confidence:.2%})",
                    affected_files=[f['filename']],
                    file_info=f
                ))
        
        return issues
    
    def check_orientation_mismatch(self) -> List[Issue]:
        issues = []
        
        for case_num, files in self.case_to_files.items():
            if len(files) < 2:
                continue
            
            orientations = {}
            for f in files:
                orientation = f.get('orientation')
                if orientation:
                    orientations[f['filename']] = orientation
            
            if not orientations:
                continue
            
            orientation_counts = defaultdict(int)
            for orient in orientations.values():
                orientation_counts[orient] += 1
            
            if len(orientation_counts) > 1:
                majority_orient = max(orientation_counts.keys(), 
                                       key=lambda k: orientation_counts[k])
                
                mismatched_files = []
                for filename, orient in orientations.items():
                    if orient != majority_orient:
                        mismatched_files.append(filename)
                
                if mismatched_files:
                    orient_names = {'portrait': '竖版', 'landscape': '横版'}
                    issues.append(Issue(
                        issue_type='orientation_mismatch',
                        severity='info',
                        description=f"案卷号 {case_num}: 存在方向不一致的文件。"
                                   f"多数为 {orient_names.get(majority_orient, majority_orient)}，"
                                   f"不一致文件: {', '.join(mismatched_files)}",
                        affected_files=mismatched_files,
                        file_info={'case_number': case_num}
                    ))
        
        return issues
    
    def check_index_missing_files(self) -> List[Issue]:
        issues = []
        
        indexed_files = set()
        for record in self.index_records:
            expected_filename = record.get('expected_filename')
            if expected_filename:
                indexed_files.add(expected_filename.lower())
        
        actual_files = set(f['filename'].lower() for f in self.files)
        
        missing_files = indexed_files - actual_files
        
        for missing_file in missing_files:
            issues.append(Issue(
                issue_type='index_missing_file',
                severity='error',
                description=f"索引中有但文件夹中缺失的文件: {missing_file}",
                affected_files=[missing_file]
            ))
        
        return issues
    
    def check_extra_files(self) -> List[Issue]:
        issues = []
        
        indexed_files = set()
        for record in self.index_records:
            expected_filename = record.get('expected_filename')
            if expected_filename:
                indexed_files.add(expected_filename.lower())
        
        actual_files = {f['filename'].lower(): f for f in self.files}
        
        extra_files = []
        for filename_lower, f in actual_files.items():
            if filename_lower not in indexed_files:
                case_match = False
                for case_num, records in self.case_to_records.items():
                    if f.get('extracted_case_number') == case_num:
                        page_num = f.get('extracted_page_number')
                        if page_num is not None:
                            record_pages = {r.get('page_number') for r in records}
                            if page_num in record_pages:
                                case_match = True
                                break
                
                if not case_match:
                    extra_files.append(f['filename'])
        
        for extra_file in extra_files:
            issues.append(Issue(
                issue_type='extra_file',
                severity='warning',
                description=f"文件夹中有但索引中未登记的文件: {extra_file}",
                affected_files=[extra_file],
                file_info=self.filename_to_file.get(extra_file)
            ))
        
        return issues
    
    def check_box_mismatch(self) -> List[Issue]:
        issues = []
        
        for case_num, records in self.case_to_records.items():
            if not records:
                continue
            
            box_numbers = {r.get('box_number') for r in records if r.get('box_number')}
            
            if len(box_numbers) > 1:
                issues.append(Issue(
                    issue_type='box_mismatch',
                    severity='warning',
                    description=f"案卷号 {case_num}: 索引中存在多个盒号: {', '.join(box_numbers)}",
                    index_info={'case_number': case_num}
                ))
            
            files = self.case_to_files.get(case_num, [])
            file_boxes = {f.get('extracted_box_number') for f in files if f.get('extracted_box_number')}
            
            if file_boxes and box_numbers:
                common_boxes = file_boxes & box_numbers
                if not common_boxes:
                    issues.append(Issue(
                        issue_type='box_mismatch',
                        severity='warning',
                        description=f"案卷号 {case_num}: 文件盒号 {', '.join(file_boxes)} "
                                   f"与索引盒号 {', '.join(box_numbers)} 不匹配",
                        file_info={'case_number': case_num, 'file_boxes': list(file_boxes)},
                        index_info={'case_number': case_num, 'index_boxes': list(box_numbers)}
                    ))
        
        return issues


def check_rules(files: List[Dict], index_records: List[Dict], config: Dict = None) -> List[Dict]:
    checker = RuleChecker(files, index_records, config)
    issues = checker.check_all()
    
    result = []
    for issue in issues:
        result.append({
            'issue_type': issue.issue_type,
            'severity': issue.severity,
            'description': issue.description,
            'file_id': issue.file_id,
            'index_record_id': issue.index_record_id,
            'affected_files': issue.affected_files,
            'affected_pages': issue.affected_pages,
            'file_info': issue.file_info,
            'index_info': issue.index_info
        })
    
    return result
