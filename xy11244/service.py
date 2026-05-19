import re
import csv
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
from io import TextIOWrapper

from storage import BookStorage
from models import DonationStatus, ExceptionType, ConditionLevel


class ISBNValidator:
    @staticmethod
    def normalize_isbn(isbn: str) -> Optional[str]:
        if not isbn:
            return None

        cleaned = re.sub(r'[^0-9Xx]', '', str(isbn))

        if len(cleaned) == 10:
            return ISBNValidator.isbn10_to_13(cleaned)
        elif len(cleaned) == 13:
            return cleaned.upper() if cleaned[-1] == 'x' else cleaned
        return None

    @staticmethod
    def isbn10_to_13(isbn10: str) -> str:
        prefix = "978" + isbn10[:9]

        total = 0
        for i, char in enumerate(prefix):
            digit = int(char)
            total += digit * (1 if i % 2 == 0 else 3)

        check_digit = (10 - (total % 10)) % 10
        return prefix + str(check_digit)

    @staticmethod
    def validate_isbn13(isbn: str) -> bool:
        if len(isbn) != 13 or not isbn.isdigit():
            return False

        total = 0
        for i, char in enumerate(isbn[:12]):
            digit = int(char)
            total += digit * (1 if i % 2 == 0 else 3)

        check_digit = (10 - (total % 10)) % 10
        return str(check_digit) == isbn[12]


class GradeStandardizer:
    GRADE_MAPPINGS = {
        r'^一.*$': '一年级',
        r'^1.*$': '一年级',
        r'^二.*$': '二年级',
        r'^2.*$': '二年级',
        r'^三.*$': '三年级',
        r'^3.*$': '三年级',
        r'^四.*$': '四年级',
        r'^4.*$': '四年级',
        r'^五.*$': '五年级',
        r'^5.*$': '五年级',
        r'^六.*$': '六年级',
        r'^6.*$': '六年级',
        r'^七.*$': '七年级',
        r'^7.*$': '七年级',
        r'^初.*一': '七年级',
        r'^八.*$': '八年级',
        r'^8.*$': '八年级',
        r'^初.*二': '八年级',
        r'^九.*$': '九年级',
        r'^9.*$': '九年级',
        r'^初.*三': '九年级',
        r'^高.*一': '高一',
        r'^高.*二': '高二',
        r'^高.*三': '高三',
        r'^小.*学': '小学通用',
        r'^初.*中': '初中通用',
        r'^高.*中': '高中通用',
    }

    GRADE_ORDER = {
        '一年级': 1,
        '二年级': 2,
        '三年级': 3,
        '四年级': 4,
        '五年级': 5,
        '六年级': 6,
        '七年级': 7,
        '八年级': 8,
        '九年级': 9,
        '高一': 10,
        '高二': 11,
        '高三': 12,
        '小学通用': 0,
        '初中通用': 0,
        '高中通用': 0,
    }

    @classmethod
    def standardize(cls, raw_grade: str, storage: BookStorage) -> Tuple[Optional[str], Optional[int]]:
        if not raw_grade:
            return None, None

        existing = storage.get_grade_label(raw_grade)
        if existing:
            return existing['standard_grade'], existing['grade_order']

        for pattern, standard in cls.GRADE_MAPPINGS.items():
            if re.match(pattern, raw_grade, re.IGNORECASE):
                storage.add_grade_label(
                    raw_label=raw_grade,
                    standard_grade=standard,
                    grade_order=cls.GRADE_ORDER.get(standard, 0),
                    description=f"自动映射: {raw_grade} -> {standard}"
                )
                return standard, cls.GRADE_ORDER.get(standard, 0)

        return None, None


class ConditionStandardizer:
    CONDITION_MAPPINGS = {
        r'(全新|新|未拆|未阅|全新品)': ('new', 100, True),
        r'(九成|9成|几乎全新|像新|准新)': ('like_new', 90, True),
        r'(八成|8成|良好|好品|不错)': ('good', 80, True),
        r'(七成|7成|六品|可接受|一般)': ('acceptable', 70, True),
        r'(六成|6成|五成|5成|较差|旧)': ('poor', 50, True),
        r'(破损|缺页|严重|无法|报废)': ('unusable', 20, False),
    }

    @classmethod
    def standardize(cls, raw_condition: str, storage: BookStorage) -> Tuple[Optional[str], Optional[int], Optional[bool]]:
        if not raw_condition:
            return None, None, None

        existing = storage.get_condition_rule(raw_condition)
        if existing:
            return existing['standard_condition'], existing['condition_score'], existing['can_shelf']

        for pattern, (standard, score, can_shelf) in cls.CONDITION_MAPPINGS.items():
            if re.search(pattern, raw_condition, re.IGNORECASE):
                storage.add_condition_rule(
                    raw_description=raw_condition,
                    standard_condition=standard,
                    condition_score=score,
                    min_score=score - 10,
                    max_score=score + 5,
                    can_shelf=can_shelf
                )
                return standard, score, can_shelf

        return None, None, None


class BookDonationService:
    def __init__(self, storage: Optional[BookStorage] = None):
        self.storage = storage or BookStorage()
        self.isbn_validator = ISBNValidator()

    def parse_csv_file(self, file_path: str) -> List[Dict[str, Any]]:
        donations = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                donations.append({
                    'isbn': row.get('ISBN', row.get('isbn', '')),
                    'title': row.get('书名', row.get('title', row.get('Title', ''))),
                    'author': row.get('作者', row.get('author', '')),
                    'publisher': row.get('出版社', row.get('publisher', '')),
                    'grade': row.get('年级', row.get('grade', '')),
                    'condition': row.get('品相', row.get('condition', '')),
                    'donor': row.get('捐赠人', row.get('donor', '')),
                })
        return donations

    def import_donations(
        self,
        donations: List[Dict[str, Any]],
        volunteer: str,
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if not batch_id:
            batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        success_ids, failed_items = self.storage.batch_insert_donations(
            donations=donations,
            volunteer=volunteer,
            batch_id=batch_id
        )

        self._standardize_donations(success_ids)

        return {
            'batch_id': batch_id,
            'total': len(donations),
            'success': len(success_ids),
            'failed': len(failed_items),
            'failed_items': failed_items,
            'success_ids': success_ids
        }

    def _standardize_donations(self, donation_ids: List[int]) -> None:
        for donation_id in donation_ids:
            donation = self.storage.get_donation_by_id(donation_id)
            if not donation:
                continue

            updates = {}
            exception_updates = {}

            isbn_standard = self.isbn_validator.normalize_isbn(donation['isbn_raw'])
            if isbn_standard and self.isbn_validator.validate_isbn13(isbn_standard):
                updates['isbn_standard'] = isbn_standard

                isbn_info = self.storage.get_isbn_info(isbn_standard)
                if isbn_info:
                    updates['title_standard'] = isbn_info.title
                    if isbn_info.author:
                        updates['author'] = isbn_info.author
                    if isbn_info.publisher:
                        updates['publisher'] = isbn_info.publisher
            else:
                exception_updates[donation_id] = (
                    ExceptionType.INVALID_ISBN.value,
                    f"无效ISBN: {donation['isbn_raw']}"
                )

            if donation['grade_raw']:
                std_grade, grade_order = GradeStandardizer.standardize(
                    donation['grade_raw'], self.storage
                )
                if std_grade:
                    updates['grade_standard'] = std_grade
                else:
                    if donation_id not in exception_updates:
                        exception_updates[donation_id] = (
                            ExceptionType.UNKNOWN_GRADE.value,
                            f"无法识别年级: {donation['grade_raw']}"
                        )

            if donation['condition_raw']:
                std_condition, score, can_shelf = ConditionStandardizer.standardize(
                    donation['condition_raw'], self.storage
                )
                if std_condition:
                    updates['condition_standard'] = std_condition
                    updates['condition_score'] = score
                else:
                    if donation_id not in exception_updates:
                        exception_updates[donation_id] = (
                            ExceptionType.UNKNOWN_CONDITION.value,
                            f"无法识别品相: {donation['condition_raw']}"
                        )

            if updates:
                self.storage.update_donation_standard_info(donation_id, updates)

            if exception_updates and donation_id in exception_updates:
                self.storage.bulk_update_status(
                    [donation_id],
                    DonationStatus.GRADED.value,
                    "system",
                    exception_updates
                )
            else:
                self.storage.bulk_update_status(
                    [donation_id],
                    DonationStatus.GRADED.value,
                    "system"
                )

    def deduplicate_batch(
        self,
        batch_id: str,
        operator: str,
        auto_mark: bool = False
    ) -> Dict[str, Any]:
        duplicates = self.storage.find_potential_duplicates(batch_id=batch_id)

        results = []
        total_marked = 0

        for isbn, ids in duplicates:
            if len(ids) <= 1:
                continue

            original_id = min(ids)
            duplicate_ids = [d for d in ids if d != original_id]

            result = {
                'isbn': isbn,
                'original_id': original_id,
                'duplicate_ids': duplicate_ids,
                'marked': False
            }

            if auto_mark:
                marked_count = 0
                for dup_id in duplicate_ids:
                    if self.storage.mark_duplicate(dup_id, original_id, operator):
                        marked_count += 1
                result['marked'] = True
                result['marked_count'] = marked_count
                total_marked += marked_count

            results.append(result)

        self.storage.log_operation(
            operation_type="deduplicate",
            batch_id=batch_id,
            operator=operator,
            success_count=total_marked,
            fail_count=0,
            total_count=len(duplicates),
            details=json.dumps({"groups": results}, ensure_ascii=False)
        )

        return {
            'batch_id': batch_id,
            'duplicate_groups': len(results),
            'total_duplicates_marked': total_marked,
            'groups': results
        }

    def generate_shelf_list(
        self,
        batch_id: str,
        operator: str,
        list_id: Optional[str] = None,
        shelf_code: str = "",
        filter_duplicates: bool = True,
        filter_unusable: bool = True
    ) -> Dict[str, Any]:
        donations, total = self.storage.query_donations(
            batch_id=batch_id,
            is_duplicate=False if filter_duplicates else None,
            limit=10000
        )

        filtered_ids = []
        for d in donations:
            if filter_unusable and d['condition_standard'] == ConditionLevel.UNUSABLE.value:
                continue
            filtered_ids.append(d['id'])

        if not list_id:
            list_id = f"shelf_{batch_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        result_list_id, failed_items = self.storage.create_shelf_list(
            list_id=list_id,
            batch_id=batch_id,
            generated_by=operator,
            donation_ids=filtered_ids,
            shelf_code=shelf_code
        )

        shelf_items = self.storage.get_shelf_list_items(list_id)
        donation_details = []
        for item in shelf_items:
            d = item['donation']
            donation_details.append({
                'id': d.get('id'),
                'isbn': d.get('isbn_standard') or d.get('isbn_raw'),
                'title': d.get('title_standard') or d.get('title_raw'),
                'grade': d.get('grade_standard') or d.get('grade_raw'),
                'condition': d.get('condition_standard') or d.get('condition_raw'),
                'sort_order': item['sort_order'],
                'shelf_code': item['shelf_code']
            })

        donation_details.sort(key=lambda x: (x.get('grade', ''), x['sort_order']))

        return {
            'list_id': list_id,
            'batch_id': batch_id,
            'total_books': len(donation_details),
            'failed_count': len(failed_items),
            'failed_items': failed_items,
            'books': donation_details
        }

    def query_with_filters(
        self,
        volunteer: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        exception_type: Optional[str] = None,
        batch_id: Optional[str] = None,
        is_duplicate: Optional[bool] = None,
        page: int = 1,
        page_size: int = 100
    ) -> Dict[str, Any]:
        start_time = datetime.fromisoformat(start_date) if start_date else None
        end_time = datetime.fromisoformat(end_date) if end_date else None

        offset = (page - 1) * page_size

        donations, total = self.storage.query_donations(
            volunteer=volunteer,
            start_time=start_time,
            end_time=end_time,
            status=status,
            exception_type=exception_type,
            batch_id=batch_id,
            is_duplicate=is_duplicate,
            offset=offset,
            limit=page_size
        )

        results = []
        for d in donations:
            results.append({
                'id': d['id'],
                'batch_id': d['batch_id'],
                'isbn_raw': d['isbn_raw'],
                'isbn_standard': d['isbn_standard'],
                'title_raw': d['title_raw'],
                'title_standard': d['title_standard'],
                'grade_raw': d['grade_raw'],
                'grade_standard': d['grade_standard'],
                'condition_raw': d['condition_raw'],
                'condition_standard': d['condition_standard'],
                'condition_score': d['condition_score'],
                'donor_name': d['donor_name'],
                'volunteer': d['volunteer'],
                'status': d['status'],
                'exception_type': d['exception_type'],
                'exception_detail': d['exception_detail'],
                'is_duplicate': d['is_duplicate'],
                'duplicate_of': d['duplicate_of'],
                'import_time': d['import_time'].isoformat() if d['import_time'] else None,
                'shelf_code': d['shelf_code'],
                'notes': d['notes']
            })

        return {
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'data': results
        }

    def export_to_csv(
        self,
        output_path: str,
        volunteer: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        exception_type: Optional[str] = None,
        batch_id: Optional[str] = None,
        is_duplicate: Optional[bool] = None
    ) -> Dict[str, Any]:
        query_result = self.query_with_filters(
            volunteer=volunteer,
            start_date=start_date,
            end_date=end_date,
            status=status,
            exception_type=exception_type,
            batch_id=batch_id,
            is_duplicate=is_duplicate,
            page=1,
            page_size=100000
        )

        donations = query_result['data']

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            fieldnames = [
                'ID', '批次ID', '原始ISBN', '标准ISBN',
                '原始书名', '标准书名', '原始年级', '标准年级',
                '原始品相', '标准品相', '品相分数', '捐赠人',
                '负责人', '状态', '异常类型', '异常详情',
                '是否重复', '重复源ID', '导入时间', '货架编码', '备注'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for d in donations:
                writer.writerow({
                    'ID': d['id'],
                    '批次ID': d['batch_id'],
                    '原始ISBN': d['isbn_raw'],
                    '标准ISBN': d['isbn_standard'] or '',
                    '原始书名': d['title_raw'] or '',
                    '标准书名': d['title_standard'] or '',
                    '原始年级': d['grade_raw'] or '',
                    '标准年级': d['grade_standard'] or '',
                    '原始品相': d['condition_raw'] or '',
                    '标准品相': d['condition_standard'] or '',
                    '品相分数': d['condition_score'] or '',
                    '捐赠人': d['donor_name'] or '',
                    '负责人': d['volunteer'],
                    '状态': d['status'],
                    '异常类型': d['exception_type'] or '',
                    '异常详情': d['exception_detail'] or '',
                    '是否重复': '是' if d['is_duplicate'] else '否',
                    '重复源ID': d['duplicate_of'] or '',
                    '导入时间': d['import_time'] or '',
                    '货架编码': d['shelf_code'] or '',
                    '备注': d['notes'] or ''
                })

        return {
            'file_path': output_path,
            'total_records': len(donations),
            'filters': {
                'volunteer': volunteer,
                'start_date': start_date,
                'end_date': end_date,
                'status': status,
                'exception_type': exception_type,
                'batch_id': batch_id,
                'is_duplicate': is_duplicate
            }
        }

    def export_shelf_list(
        self,
        list_id: str,
        output_path: str
    ) -> Dict[str, Any]:
        shelf_list = self.storage.get_shelf_list(list_id)
        if not shelf_list:
            raise ValueError(f"Shelf list {list_id} not found")

        items = self.storage.get_shelf_list_items(list_id)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            fieldnames = [
                '序号', '记录ID', 'ISBN', '书名', '年级', '品相', '货架编码'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for idx, item in enumerate(items, 1):
                d = item['donation']
                writer.writerow({
                    '序号': idx,
                    '记录ID': d.get('id'),
                    'ISBN': d.get('isbn_standard') or d.get('isbn_raw'),
                    '书名': d.get('title_standard') or d.get('title_raw'),
                    '年级': d.get('grade_standard') or d.get('grade_raw'),
                    '品相': d.get('condition_standard') or d.get('condition_raw'),
                    '货架编码': item.get('shelf_code') or shelf_list.get('shelf_code') or ''
                })

        return {
            'list_id': list_id,
            'file_path': output_path,
            'total_books': len(items),
            'generated_by': shelf_list.get('generated_by'),
            'generate_time': shelf_list.get('generate_time').isoformat() if shelf_list.get('generate_time') else None
        }

    def get_operation_history(
        self,
        operation_type: Optional[str] = None,
        batch_id: Optional[str] = None,
        operator: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 100
    ) -> Dict[str, Any]:
        start_time = datetime.fromisoformat(start_date) if start_date else None
        end_time = datetime.fromisoformat(end_date) if end_date else None

        offset = (page - 1) * page_size

        logs, total = self.storage.query_operation_logs(
            operation_type=operation_type,
            batch_id=batch_id,
            operator=operator,
            start_time=start_time,
            end_time=end_time,
            offset=offset,
            limit=page_size
        )

        results = []
        for log in logs:
            details = {}
            if log['details']:
                try:
                    details = json.loads(log['details'])
                except:
                    details = {'raw': log['details']}

            results.append({
                'id': log['id'],
                'operation_type': log['operation_type'],
                'batch_id': log['batch_id'],
                'operator': log['operator'],
                'operation_time': log['operation_time'].isoformat() if log['operation_time'] else None,
                'success_count': log['success_count'],
                'fail_count': log['fail_count'],
                'total_count': log['total_count'],
                'details': details
            })

        return {
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'data': results
        }
