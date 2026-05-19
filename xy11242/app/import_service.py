import csv
import io
import re
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from markdown import markdown
from bs4 import BeautifulSoup

from app.models import ImportSource, BookCondition, GradeLevel
from app.schemas import BookCreate, BadRecordCreate
from app import crud


class CSVImportService:
    COLUMN_MAPPING = {
        'isbn': ['isbn', 'ISBN', '书号', '条形码'],
        'title': ['title', '书名', '标题', '书名/标题'],
        'author': ['author', '作者', '著者'],
        'publisher': ['publisher', '出版社', '出版单位'],
        'condition': ['condition', '品相', '成色', '新旧程度'],
        'grade_level': ['grade', '年级', '适用年级', '年级标签'],
        'volunteer': ['volunteer', '志愿者', '录入人', '负责人'],
        'remarks': ['remarks', '备注', '说明', '附注'],
        'shelf_location': ['shelf', '架位', '位置', '货架号']
    }

    CONDITION_MAPPING = {
        '全新': BookCondition.NEW,
        '新': BookCondition.NEW,
        '九成新': BookCondition.LIKE_NEW,
        '9成新': BookCondition.LIKE_NEW,
        '八成新': BookCondition.GOOD,
        '8成新': BookCondition.GOOD,
        '七成新': BookCondition.FAIR,
        '7成新': BookCondition.FAIR,
        '破损': BookCondition.POOR,
        '有破损': BookCondition.POOR,
    }

    GRADE_MAPPING = {
        '学前': GradeLevel.PRE_SCHOOL,
        '幼儿园': GradeLevel.PRE_SCHOOL,
        '一年级': GradeLevel.GRADE_1,
        '二年级': GradeLevel.GRADE_2,
        '三年级': GradeLevel.GRADE_3,
        '四年级': GradeLevel.GRADE_4,
        '五年级': GradeLevel.GRADE_5,
        '六年级': GradeLevel.GRADE_6,
        '初一': GradeLevel.JUNIOR_HIGH_1,
        '初二': GradeLevel.JUNIOR_HIGH_2,
        '初三': GradeLevel.JUNIOR_HIGH_3,
        '高一': GradeLevel.SENIOR_HIGH_1,
        '高二': GradeLevel.SENIOR_HIGH_2,
        '高三': GradeLevel.SENIOR_HIGH_3,
        '成人': GradeLevel.ADULT,
    }

    @classmethod
    def _map_column(cls, header: str) -> Optional[str]:
        for field, alternatives in cls.COLUMN_MAPPING.items():
            if header in alternatives:
                return field
        return None

    @classmethod
    def _parse_condition(cls, value: str) -> Optional[BookCondition]:
        if not value:
            return None
        value = value.strip()
        for key, cond in cls.CONDITION_MAPPING.items():
            if key in value:
                return cond
        return None

    @classmethod
    def _parse_grade_level(cls, value: str) -> Optional[GradeLevel]:
        if not value:
            return None
        value = value.strip()
        for key, grade in cls.GRADE_MAPPING.items():
            if key in value:
                return grade
        return None

    @classmethod
    def import_from_file(cls, db: Session, file_content: bytes, filename: str,
                         imported_by: str) -> dict:
        import_log = crud.create_import_log(db, ImportSource.CSV_SCAN, filename, imported_by)

        success_count = 0
        failed_count = 0
        book_ids = []

        try:
            content = file_content.decode('utf-8')
        except UnicodeDecodeError:
            content = file_content.decode('gbk')

        reader = csv.DictReader(io.StringIO(content))

        for row_num, row in enumerate(reader, start=2):
            book_data = {}
            raw_data = str(row)

            for header, value in row.items():
                field = cls._map_column(header)
                if field:
                    book_data[field] = value.strip() if value else None

            try:
                condition = cls._parse_condition(book_data.get('condition', ''))
                grade_level = cls._parse_grade_level(book_data.get('grade_level', ''))

                book_create = BookCreate(
                    isbn=book_data.get('isbn'),
                    title=book_data.get('title'),
                    author=book_data.get('author'),
                    publisher=book_data.get('publisher'),
                    condition=condition,
                    grade_level=grade_level,
                    volunteer=book_data.get('volunteer'),
                    remarks=book_data.get('remarks'),
                    shelf_location=book_data.get('shelf_location')
                )

                book, exceptions = crud.create_book(
                    db, book_create, ImportSource.CSV_SCAN, import_log.batch_id
                )
                book_ids.append(book.id)

                if exceptions:
                    failed_count += 1
                else:
                    success_count += 1

            except Exception as e:
                failed_count += 1
                suggestion = cls._generate_suggestion(book_data, str(e))
                bad_record = BadRecordCreate(
                    original_position=f"第{row_num}行",
                    raw_data=raw_data,
                    failure_reason=str(e),
                    suggestion=suggestion
                )
                crud.add_bad_record(db, import_log.id, bad_record)

        crud.complete_import_log(db, import_log.id, success_count + failed_count,
                                 success_count, failed_count)

        return {
            "batch_id": import_log.batch_id,
            "import_log_id": import_log.id,
            "total": success_count + failed_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "book_ids": book_ids
        }

    @classmethod
    def _generate_suggestion(cls, book_data: dict, error: str) -> str:
        suggestions = []
        if not book_data.get('title'):
            suggestions.append("缺少书名字段，请补充")
        if book_data.get('isbn') and len(book_data['isbn']) not in [10, 13]:
            suggestions.append("ISBN格式可能不正确，应为10位或13位")
        if not book_data.get('condition'):
            suggestions.append("缺少品相信息，建议补充：全新/九成新/八成新/七成新/有破损")
        if not book_data.get('grade_level'):
            suggestions.append("缺少年级标签，建议补充适用年级")
        if not suggestions:
            suggestions.append(f"请检查数据格式是否正确，错误信息：{error}")
        return "；".join(suggestions)


class MarkdownImportService:
    @staticmethod
    def _extract_books_from_markdown(content: str) -> List[dict]:
        books = []
        lines = content.split('\n')
        current_book = {}

        book_pattern = re.compile(r'^#{1,3}\s*(.+)|^[-*]\s*(.+)|^\d+\.\s*(.+)')

        for line_num, line in enumerate(lines, start=1):
            line = line.strip()
            if not line:
                if current_book:
                    books.append(current_book)
                    current_book = {}
                continue

            match = book_pattern.match(line)
            if match:
                if current_book:
                    books.append(current_book)
                title = match.group(1) or match.group(2) or match.group(3)
                current_book = {'title': title, '_line': line_num}
                continue

            if ':' in line or '：' in line:
                parts = re.split(r'[:：]', line, 1)
                key = parts[0].strip()
                value = parts[1].strip() if len(parts) > 1 else ''

                key_lower = key.lower()
                if any(k in key_lower for k in ['isbn', '书号', '条码']):
                    current_book['isbn'] = value
                elif any(k in key_lower for k in ['作者', '著者', '作者']):
                    current_book['author'] = value
                elif any(k in key_lower for k in ['出版社', '出版']):
                    current_book['publisher'] = value
                elif any(k in key_lower for k in ['品相', '成色', '新旧']):
                    current_book['condition'] = value
                elif any(k in key_lower for k in ['年级', '适用', '分类']):
                    current_book['grade_level'] = value
                elif any(k in key_lower for k in ['志愿者', '负责人', '录入']):
                    current_book['volunteer'] = value
                elif any(k in key_lower for k in ['备注', '说明', '附注']):
                    current_book['remarks'] = value
                elif any(k in key_lower for k in ['架位', '位置', '货架']):
                    current_book['shelf_location'] = value

        if current_book:
            books.append(current_book)

        return books

    @classmethod
    def import_from_file(cls, db: Session, file_content: bytes, filename: str,
                         imported_by: str) -> dict:
        import_log = crud.create_import_log(db, ImportSource.MARKDOWN_NOTE, filename, imported_by)

        success_count = 0
        failed_count = 0
        book_ids = []

        try:
            content = file_content.decode('utf-8')
        except UnicodeDecodeError:
            content = file_content.decode('gbk')

        books_data = cls._extract_books_from_markdown(content)

        for book_data in books_data:
            line_num = book_data.pop('_line', '未知')
            raw_data = str(book_data)

            try:
                condition = CSVImportService._parse_condition(book_data.get('condition', ''))
                grade_level = CSVImportService._parse_grade_level(book_data.get('grade_level', ''))

                book_create = BookCreate(
                    isbn=book_data.get('isbn'),
                    title=book_data.get('title'),
                    author=book_data.get('author'),
                    publisher=book_data.get('publisher'),
                    condition=condition,
                    grade_level=grade_level,
                    volunteer=book_data.get('volunteer'),
                    remarks=book_data.get('remarks'),
                    shelf_location=book_data.get('shelf_location')
                )

                book, exceptions = crud.create_book(
                    db, book_create, ImportSource.MARKDOWN_NOTE, import_log.batch_id
                )
                book_ids.append(book.id)

                if exceptions:
                    failed_count += 1
                else:
                    success_count += 1

            except Exception as e:
                failed_count += 1
                suggestion = CSVImportService._generate_suggestion(book_data, str(e))
                bad_record = BadRecordCreate(
                    original_position=f"第{line_num}行附近",
                    raw_data=raw_data,
                    failure_reason=str(e),
                    suggestion=suggestion
                )
                crud.add_bad_record(db, import_log.id, bad_record)

        crud.complete_import_log(db, import_log.id, success_count + failed_count,
                                 success_count, failed_count)

        return {
            "batch_id": import_log.batch_id,
            "import_log_id": import_log.id,
            "total": success_count + failed_count,
            "success_count": success_count,
            "failed_count": failed_count,
            "book_ids": book_ids
        }
