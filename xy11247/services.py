import re
import isbnlib
from datetime import datetime
from models import (
    db, Book, BookInventory, ImportBatch, ImportRecord, ReviewLog,
    ConditionEnum, GradeEnum, ImportStatusEnum
)

class ISBNService:
    @staticmethod
    def normalize_isbn(raw_isbn):
        if not raw_isbn:
            return None, "ISBN为空"
        
        cleaned = re.sub(r'[^0-9Xx]', '', str(raw_isbn)).upper()
        
        if len(cleaned) not in (10, 13):
            return None, f"ISBN长度错误，应为10或13位，实际{len(cleaned)}位"
        
        try:
            if len(cleaned) == 10:
                is_valid = isbnlib.is_isbn10(cleaned)
            else:
                is_valid = isbnlib.is_isbn13(cleaned)
            
            if is_valid:
                normalized = isbnlib.canonical(cleaned)
                return normalized, "ISBN格式有效"
            else:
                return cleaned, "ISBN校验位无效，格式可能不正确"
        except Exception as e:
            return cleaned, f"ISBN校验异常: {str(e)}"

class ConditionService:
    CONDITION_MAPPINGS = {
        r'全新|全新未拆|未拆封': ConditionEnum.NEW,
        r'九成新|9成新|几乎全新': ConditionEnum.LIKE_NEW,
        r'八成新|8成新|良好': ConditionEnum.GOOD,
        r'七成新|7成新|一般': ConditionEnum.FAIR,
        r'六成新|6成新|较差|破旧': ConditionEnum.POOR,
    }

    @classmethod
    def normalize_condition(cls, raw_condition):
        if not raw_condition:
            return ConditionEnum.UNKNOWN, "品相如为空，标记为未标注"
        
        raw = str(raw_condition).strip()
        
        for pattern, enum_value in cls.CONDITION_MAPPINGS.items():
            if re.search(pattern, raw, re.IGNORECASE):
                return enum_value, f"品相如标准化为: {enum_value.value}"
        
        return ConditionEnum.UNKNOWN, f"无法识别的品相: {raw}，标记为未标注"

class GradeService:
    GRADE_MAPPINGS = [
        (r'初一|七年级|初中一年级', GradeEnum.JUNIOR_HIGH_1),
        (r'初二|八年级|初中二年级', GradeEnum.JUNIOR_HIGH_2),
        (r'初三|九年级|初中三年级', GradeEnum.JUNIOR_HIGH_3),
        (r'高一|十年级|高中一年级', GradeEnum.HIGH_SCHOOL_1),
        (r'高二|十一年级|高中二年级', GradeEnum.HIGH_SCHOOL_2),
        (r'高三|十二年级|高中三年级', GradeEnum.HIGH_SCHOOL_3),
        (r'学前|幼儿园|学龄前', GradeEnum.PRESCHOOL),
        (r'小学一年级|(?<!初)一年级|(?<!初)1年级', GradeEnum.GRADE_1),
        (r'小学二年级|(?<!初)二年级|(?<!初)2年级', GradeEnum.GRADE_2),
        (r'小学三年级|(?<!初)三年级|(?<!初)3年级', GradeEnum.GRADE_3),
        (r'小学四年级|(?<!初)四年级|(?<!初)4年级', GradeEnum.GRADE_4),
        (r'小学五年级|(?<!初)五年级|(?<!初)5年级', GradeEnum.GRADE_5),
        (r'小学六年级|(?<!初)六年级|(?<!初)6年级', GradeEnum.GRADE_6),
        (r'成人|大学|成年|通用', GradeEnum.ADULT),
    ]

    @classmethod
    def normalize_grade(cls, raw_grade):
        if not raw_grade:
            return GradeEnum.UNKNOWN, "年级标签为空，标记为未标注"
        
        raw = str(raw_grade).strip()
        
        for pattern, enum_value in cls.GRADE_MAPPINGS:
            if re.search(pattern, raw, re.IGNORECASE):
                return enum_value, f"年级标签标准化为: {enum_value.value}"
        
        return GradeEnum.UNKNOWN, f"无法识别的年级标签: {raw}，标记为未标注"

class ImportService:
    @staticmethod
    def generate_batch_no():
        return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"

    @staticmethod
    def check_duplicate(normalized_isbn, title, raw_condition, grade, batch_id=None):
        query = ImportRecord.query.filter(
            ImportRecord.status.in_([ImportStatusEnum.SUCCESS, ImportStatusEnum.DUPLICATE, ImportStatusEnum.REVIEWED])
        )
        
        if batch_id:
            query = query.filter(ImportRecord.batch_id != batch_id)
        
        if normalized_isbn:
            query = query.filter(
                ImportRecord.normalized_isbn == normalized_isbn,
                ImportRecord.raw_condition == raw_condition
            )
        else:
            query = query.filter(
                ImportRecord.raw_title == title,
                ImportRecord.normalized_isbn.is_(None)
            )
        
        existing = query.first()
        if existing:
            return True, f"检测到重复记录，已存在相似记录(ID: {existing.id})"
        return False, "无重复记录"

    @classmethod
    def process_single_record(cls, record, batch_id):
        messages = []
        
        normalized_isbn, isbn_msg = ISBNService.normalize_isbn(record.get('isbn'))
        messages.append(isbn_msg)
        record['normalized_isbn'] = normalized_isbn
        
        condition, condition_msg = ConditionService.normalize_condition(record.get('condition'))
        messages.append(condition_msg)
        record['normalized_condition'] = condition
        
        grade, grade_msg = GradeService.normalize_grade(record.get('grade'))
        messages.append(grade_msg)
        record['normalized_grade'] = grade
        
        title = record.get('title', '').strip()
        if not title:
            return {
                'success': False,
                'status': ImportStatusEnum.FAILED,
                'message': '；'.join(['书名不能为空'] + messages),
                'data': record
            }
        
        is_duplicate, dup_msg = cls.check_duplicate(
            normalized_isbn, title, record.get('condition'), grade, batch_id
        )
        messages.append(dup_msg)
        
        if is_duplicate:
            return {
                'success': False,
                'status': ImportStatusEnum.DUPLICATE,
                'message': '；'.join(messages),
                'data': record
            }
        
        return {
            'success': True,
            'status': ImportStatusEnum.SUCCESS,
            'message': '；'.join(messages),
            'data': record
        }

    @classmethod
    def create_book_and_inventory(cls, record_data):
        normalized_isbn = record_data['normalized_isbn']
        title = record_data['title'].strip()
        author = record_data.get('author', '').strip()
        publisher = record_data.get('publisher', '').strip()
        condition = record_data['normalized_condition']
        grade = record_data['normalized_grade']
        quantity = int(record_data.get('quantity', 1) or 1)
        
        book = Book.query.filter_by(isbn=normalized_isbn, title=title).first()
        
        if not book:
            book = Book(
                isbn=normalized_isbn,
                isbn_valid=normalized_isbn is not None and isbnlib.is_isbn13(normalized_isbn),
                title=title,
                author=author,
                publisher=publisher
            )
            db.session.add(book)
            db.session.flush()
        
        inventory = BookInventory.query.filter_by(
            book_id=book.id,
            condition=condition,
            grade=grade
        ).first()
        
        if inventory:
            inventory.quantity += quantity
        else:
            inventory = BookInventory(
                book_id=book.id,
                condition=condition,
                grade=grade,
                quantity=quantity
            )
            db.session.add(inventory)
            db.session.flush()
        
        return book, inventory

    @classmethod
    def batch_import(cls, records, created_by="system"):
        batch_no = cls.generate_batch_no()
        batch = ImportBatch(
            batch_no=batch_no,
            total_count=len(records),
            created_by=created_by
        )
        db.session.add(batch)
        db.session.flush()
        
        results = {
            'batch_no': batch_no,
            'total': len(records),
            'success': [],
            'failed': [],
            'duplicate': []
        }
        
        processed_in_batch = []
        
        for idx, record in enumerate(records, 1):
            try:
                normalized_isbn, _ = ISBNService.normalize_isbn(record.get('isbn'))
                title = record.get('title', '').strip()
                raw_condition = record.get('condition', '')
                
                is_duplicate_in_batch = False
                for processed in processed_in_batch:
                    if processed['normalized_isbn'] and normalized_isbn == processed['normalized_isbn']:
                        if raw_condition == processed['raw_condition']:
                            is_duplicate_in_batch = True
                            break
                    if not processed['normalized_isbn'] and not normalized_isbn and title == processed['title']:
                        is_duplicate_in_batch = True
                        break
                
                if is_duplicate_in_batch:
                    result = {
                        'success': False,
                        'status': ImportStatusEnum.DUPLICATE,
                        'message': '检测到批次内重复记录',
                        'data': record
                    }
                else:
                    result = cls.process_single_record(record, batch.id)
                
                if result['status'] in [ImportStatusEnum.SUCCESS, ImportStatusEnum.DUPLICATE]:
                    processed_in_batch.append({
                        'normalized_isbn': normalized_isbn,
                        'title': title,
                        'raw_condition': raw_condition
                    })
                
                import_record = ImportRecord(
                    batch_id=batch.id,
                    row_number=idx,
                    raw_isbn=record.get('isbn'),
                    raw_title=record.get('title'),
                    raw_author=record.get('author'),
                    raw_publisher=record.get('publisher'),
                    raw_condition=record.get('condition'),
                    raw_grade=record.get('grade'),
                    raw_quantity=int(record.get('quantity', 1) or 1),
                    normalized_isbn=result['data'].get('normalized_isbn'),
                    status=result['status'],
                    process_message=result['message'],
                    processed_at=datetime.utcnow()
                )
                
                if result['status'] == ImportStatusEnum.SUCCESS:
                    book, inventory = cls.create_book_and_inventory(result['data'])
                    import_record.book_id = book.id
                    import_record.inventory_id = inventory.id
                    batch.success_count += 1
                    results['success'].append({
                        'row': idx,
                        'title': record.get('title'),
                        'message': result['message']
                    })
                elif result['status'] == ImportStatusEnum.DUPLICATE:
                    batch.duplicate_count += 1
                    results['duplicate'].append({
                        'row': idx,
                        'title': record.get('title'),
                        'message': result['message']
                    })
                else:
                    batch.failed_count += 1
                    results['failed'].append({
                        'row': idx,
                        'title': record.get('title'),
                        'message': result['message']
                    })
                
                db.session.add(import_record)
                
            except Exception as e:
                db.session.rollback()
                batch.failed_count += 1
                results['failed'].append({
                    'row': idx,
                    'title': record.get('title'),
                    'message': f'处理异常: {str(e)}'
                })
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise e
        
        return results

class ReviewService:
    @staticmethod
    def review_record(record_id, reviewer, action, remark=""):
        record = ImportRecord.query.get(record_id)
        if not record:
            return False, "记录不存在"
        
        old_status = record.status
        
        if action == "approve":
            record.status = ImportStatusEnum.REVIEWED
            message = f"记录已通过复核，状态从{old_status.value}变更为已复核"
        elif action == "reject":
            record.status = ImportStatusEnum.FAILED
            message = f"记录已被驳回，状态从{old_status.value}变更为失败"
        elif action == "force_import":
            try:
                normalized_isbn = record.normalized_isbn
                condition, _ = ConditionService.normalize_condition(record.raw_condition)
                grade, _ = GradeService.normalize_grade(record.raw_grade)
                
                book = Book.query.filter_by(
                    isbn=normalized_isbn,
                    title=record.raw_title
                ).first()
                
                if not book:
                    book = Book(
                        isbn=normalized_isbn,
                        isbn_valid=normalized_isbn is not None and isbnlib.is_isbn13(normalized_isbn) if normalized_isbn else False,
                        title=record.raw_title,
                        author=record.raw_author,
                        publisher=record.raw_publisher
                    )
                    db.session.add(book)
                    db.session.flush()
                
                inventory = BookInventory.query.filter_by(
                    book_id=book.id,
                    condition=condition,
                    grade=grade
                ).first()
                
                if inventory:
                    inventory.quantity += record.raw_quantity
                else:
                    inventory = BookInventory(
                        book_id=book.id,
                        condition=condition,
                        grade=grade,
                        quantity=record.raw_quantity
                    )
                    db.session.add(inventory)
                    db.session.flush()
                
                record.book_id = book.id
                record.inventory_id = inventory.id
                record.status = ImportStatusEnum.REVIEWED
                message = "强制导入成功，已创建库存记录"
                
            except Exception as e:
                db.session.rollback()
                return False, f"强制导入失败: {str(e)}"
        else:
            return False, f"不支持的操作: {action}"
        
        log = ReviewLog(
            record_id=record_id,
            reviewer=reviewer,
            action=action,
            remark=remark + "；" + message
        )
        db.session.add(log)
        
        try:
            db.session.commit()
            return True, message
        except Exception as e:
            db.session.rollback()
            return False, f"保存失败: {str(e)}"

class ExportService:
    @staticmethod
    def get_inventory_list():
        inventories = BookInventory.query.all()
        result = []
        for inv in inventories:
            result.append({
                'id': inv.id,
                'isbn': inv.book.isbn,
                'title': inv.book.title,
                'author': inv.book.author,
                'publisher': inv.book.publisher,
                'condition': inv.condition.value,
                'grade': inv.grade.value,
                'quantity': inv.quantity,
                'updated_at': inv.updated_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        return result

    @staticmethod
    def get_import_records(batch_id=None, status=None):
        query = ImportRecord.query
        if batch_id:
            query = query.filter_by(batch_id=batch_id)
        if status:
            query = query.filter_by(status=status)
        
        records = query.all()
        result = []
        for rec in records:
            result.append({
                'id': rec.id,
                'batch_no': rec.batch.batch_no,
                'row_number': rec.row_number,
                'raw_isbn': rec.raw_isbn,
                'normalized_isbn': rec.normalized_isbn,
                'title': rec.raw_title,
                'author': rec.raw_author,
                'condition': rec.raw_condition,
                'grade': rec.raw_grade,
                'quantity': rec.raw_quantity,
                'status': rec.status.value,
                'message': rec.process_message,
                'created_at': rec.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        return result
