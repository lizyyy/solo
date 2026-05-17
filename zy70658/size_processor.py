import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ProcessResult:
    success: bool
    data: Optional[Dict] = None
    error_type: Optional[str] = None
    error_message: Optional[str] = None


class SizeStandardizer:
    STANDARD_SIZES = ['110', '120', '130', '140', '150', '160', '170', '180', '190', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
    
    SIZE_MAPPINGS = [
        ('特大号', 'XXL'),
        ('超大号', 'XXL'),
        ('加大号', 'XL'),
        ('加小号', 'XS'),
        ('特大', 'XXL'),
        ('超大', 'XXL'),
        ('加大', 'XL'),
        ('加小', 'XS'),
        ('大号', 'L'),
        ('中号', 'M'),
        ('小号', 'S'),
        ('大', 'L'),
        ('中', 'M'),
        ('小', 'S'),
    ]
    
    @classmethod
    def standardize(cls, size_str: str) -> Tuple[str, List[str]]:
        if pd.isna(size_str) or str(size_str).strip() == '':
            return '', ['empty_size']
        
        original_str = str(size_str).strip()
        size_str_upper = original_str.upper()
        exceptions = []
        
        if size_str_upper in cls.STANDARD_SIZES:
            return size_str_upper, exceptions
        
        for cn, en in cls.SIZE_MAPPINGS:
            if cn in original_str or cn.upper() in size_str_upper:
                return en, exceptions
        
        match = re.search(r'(\d{2,3})', original_str)
        if match:
            num = match.group(1)
            if 100 <= int(num) <= 200:
                return num, exceptions
        
        match = re.search(r'([SMLX]+)', size_str_upper)
        if match:
            letter_size = match.group(1)
            if letter_size in cls.STANDARD_SIZES:
                return letter_size, exceptions
        
        exceptions.append('non_standard_size')
        return original_str, exceptions


class HeaderRecognizer:
    HEADER_PATTERNS = {
        'name': ['姓名', '名字', '学生姓名', 'name', 'student'],
        'class_name': ['班级', '班别', 'class', '班级名称'],
        'grade': ['年级', 'grade', '年级名称'],
        'size': ['尺码', '尺寸', '大小', 'size', '校服尺码'],
        'student_no': ['学号', '编号', 'student_no', 'number'],
        'gender': ['性别', 'gender', 'sex'],
        'height': ['身高', 'height'],
        'weight': ['体重', 'weight'],
        'teacher': ['班主任', '老师', 'teacher'],
    }
    
    @classmethod
    def recognize_headers(cls, df: pd.DataFrame) -> Tuple[Dict[str, str], List[str]]:
        header_mapping = {}
        warnings = []
        
        for idx, col in enumerate(df.columns):
            col_str = str(col).lower().strip()
            matched = False
            
            for field, patterns in cls.HEADER_PATTERNS.items():
                for pattern in patterns:
                    if pattern.lower() in col_str:
                        header_mapping[field] = str(col)
                        matched = True
                        break
                if matched:
                    break
        
        required_fields = ['name', 'class_name', 'size']
        missing_fields = [f for f in required_fields if f not in header_mapping]
        
        if missing_fields:
            warnings.append(f'missing_required_fields: {missing_fields}')
        
        return header_mapping, warnings


class StudentMerger:
    @staticmethod
    def merge_duplicates(records: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        student_groups = {}
        
        for record in records:
            key = (record.get('name', ''), record.get('class_name', ''), record.get('student_no', ''))
            
            if key not in student_groups:
                student_groups[key] = []
            student_groups[key].append(record)
        
        merged = []
        duplicates = []
        
        for key, group in student_groups.items():
            if len(group) > 1:
                base_record = group[0].copy()
                sizes = []
                original_sizes = []
                
                for r in group:
                    sizes.append(r.get('size', ''))
                    original_sizes.append(r.get('original_size', ''))
                
                unique_sizes = list(set(sizes))
                
                if len(unique_sizes) > 1:
                    base_record['size'] = ' / '.join(unique_sizes)
                    base_record['original_size'] = '; '.join(set(original_sizes))
                    base_record['is_duplicate'] = True
                    base_record['has_size_conflict'] = True
                    base_record['quantity'] = 1
                    for r in group:
                        duplicates.append(r)
                    merged.append(base_record)
                else:
                    base_record['size'] = unique_sizes[0]
                    base_record['original_size'] = '; '.join(set(original_sizes))
                    base_record['is_duplicate'] = True
                    base_record['quantity'] = len(group)
                    base_record['duplicate_count'] = len(group)
                    merged.append(base_record)
            else:
                record = group[0]
                record['is_duplicate'] = False
                record['quantity'] = 1
                merged.append(record)
        
        return merged, duplicates


class ClassSummarizer:
    @staticmethod
    def summarize_by_class(records: List[Dict]) -> Dict[str, Dict]:
        summary = {}
        
        for record in records:
            class_name = record.get('class_name', '未知班级')
            size = record.get('size', '未知尺码')
            quantity = record.get('quantity', 1)
            
            if class_name not in summary:
                summary[class_name] = {}
            
            if size not in summary[class_name]:
                summary[class_name][size] = 0
            
            summary[class_name][size] += quantity
        
        return summary
    
    @staticmethod
    def get_total_summary(summary: Dict[str, Dict]) -> Dict[str, int]:
        total = {}
        for class_sizes in summary.values():
            for size, count in class_sizes.items():
                if size not in total:
                    total[size] = 0
                total[size] += count
        return total


class ReportExporter:
    @staticmethod
    def export_to_excel(records: List[Dict], summary: Dict[str, Dict], file_path: str) -> bool:
        try:
            with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
                df_details = pd.DataFrame(records)
                df_details.to_excel(writer, sheet_name='学生明细', index=False)
                
                summary_data = []
                all_sizes = set()
                for class_sizes in summary.values():
                    all_sizes.update(class_sizes.keys())
                
                all_sizes = sorted(all_sizes)
                
                for class_name, size_counts in summary.items():
                    row = {'班级': class_name}
                    for size in all_sizes:
                        row[size] = size_counts.get(size, 0)
                    summary_data.append(row)
                
                df_summary = pd.DataFrame(summary_data)
                df_summary.to_excel(writer, sheet_name='班级汇总', index=False)
                
                workbook = writer.book
                worksheet = writer.sheets['班级汇总']
                
                header_format = workbook.add_format({
                    'bold': True,
                    'bg_color': '#D7E4BC',
                    'border': 1
                })
                
                for col_num, value in enumerate(df_summary.columns.values):
                    worksheet.write(0, col_num, value, header_format)
            
            return True
        except Exception as e:
            print(f"导出失败: {e}")
            return False


def process_import_data(df: pd.DataFrame) -> ProcessResult:
    try:
        header_mapping, warnings = HeaderRecognizer.recognize_headers(df)
        
        if 'missing_required_fields' in str(warnings):
            return ProcessResult(
                success=False,
                error_type='missing_fields',
                error_message=f'缺少必要字段: {warnings}'
            )
        
        records = []
        exceptions = []
        
        for idx, row in df.iterrows():
            record = {
                'name': str(row.get(header_mapping.get('name', ''), '')),
                'class_name': str(row.get(header_mapping.get('class_name', ''), '')),
                'original_size': str(row.get(header_mapping.get('size', ''), '')),
                'student_no': str(row.get(header_mapping.get('student_no', ''), '')),
                'gender': str(row.get(header_mapping.get('gender', ''), '')),
                'row_index': idx + 2,
            }
            
            standardized_size, size_exceptions = SizeStandardizer.standardize(record['original_size'])
            record['size'] = standardized_size
            
            if size_exceptions:
                for ex in size_exceptions:
                    exceptions.append({
                        'row': idx + 2,
                        'name': record['name'],
                        'type': ex,
                        'message': f"尺码 '{record['original_size']}' 非标准格式"
                    })
            
            records.append(record)
        
        merged_records, duplicates = StudentMerger.merge_duplicates(records)
        
        for dup in duplicates:
            exceptions.append({
                'row': dup.get('row_index', 0),
                'name': dup.get('name', ''),
                'type': 'duplicate_student_conflict',
                'message': f"学生 {dup.get('name', '')} 存在多条记录且尺码不一致，需人工复核"
            })
        
        summary = ClassSummarizer.summarize_by_class(merged_records)
        total_summary = ClassSummarizer.get_total_summary(summary)
        
        return ProcessResult(
            success=True,
            data={
                'records': merged_records,
                'summary': summary,
                'total_summary': total_summary,
                'exceptions': exceptions,
                'header_mapping': header_mapping,
                'warnings': warnings
            }
        )
        
    except Exception as e:
        return ProcessResult(
            success=False,
            error_type='processing_error',
            error_message=str(e)
        )
