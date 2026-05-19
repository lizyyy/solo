import json
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
from contextlib import contextmanager
from sqlalchemy import create_engine, and_, or_
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from models import (
    Base, BookDonation, ISBNInfo, GradeLabel, ConditionRule,
    ShelfList, ShelfListItem, OperationLog, DonationStatus, ExceptionType
)


class StorageError(Exception):
    pass


class IdempotentViolationError(StorageError):
    pass


class BookStorage:
    def __init__(self, db_url: str = "sqlite:///book_library.db"):
        self.engine = create_engine(db_url, echo=False)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )
        Base.metadata.create_all(bind=self.engine)

    @contextmanager
    def get_session(self) -> Session:
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise StorageError(f"Database error: {str(e)}") from e
        finally:
            session.close()

    def generate_idempotency_key(self, data: Dict[str, Any]) -> str:
        sorted_data = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(sorted_data.encode("utf-8")).hexdigest()

    def check_idempotency(self, session: Session, key: str) -> Optional[OperationLog]:
        return session.query(OperationLog).filter(
            OperationLog.idempotency_key == key
        ).first()

    def batch_insert_donations(
        self,
        donations: List[Dict[str, Any]],
        volunteer: str,
        batch_id: str
    ) -> Tuple[List[int], List[Tuple[int, str]]]:
        success_ids = []
        failed_items = []

        with self.get_session() as session:
            for idx, item in enumerate(donations):
                try:
                    idempotency_data = {
                        "batch_id": batch_id,
                        "isbn": item.get("isbn", ""),
                        "title": item.get("title", ""),
                        "idx": idx
                    }
                    idempotency_key = self.generate_idempotency_key(idempotency_data)

                    existing = session.query(BookDonation).filter(
                        BookDonation.idempotency_key == idempotency_key
                    ).first()

                    if existing:
                        success_ids.append(existing.id)
                        continue

                    donation = BookDonation(
                        batch_id=batch_id,
                        isbn_raw=item.get("isbn", ""),
                        title_raw=item.get("title", ""),
                        author=item.get("author", ""),
                        publisher=item.get("publisher", ""),
                        grade_raw=item.get("grade", ""),
                        condition_raw=item.get("condition", ""),
                        donor_name=item.get("donor", ""),
                        volunteer=volunteer,
                        status=DonationStatus.IMPORTED.value,
                        idempotency_key=idempotency_key
                    )

                    session.add(donation)
                    session.flush()
                    success_ids.append(donation.id)

                except Exception as e:
                    failed_items.append((idx, str(e)))

            self._log_operation(
                session,
                operation_type="import",
                batch_id=batch_id,
                operator=volunteer,
                success_count=len(success_ids),
                fail_count=len(failed_items),
                total_count=len(donations),
                details=json.dumps({"failed": failed_items}, ensure_ascii=False)
            )

        return success_ids, failed_items

    def update_donation_standard_info(
        self,
        donation_id: int,
        updates: Dict[str, Any]
    ) -> bool:
        with self.get_session() as session:
            donation = session.query(BookDonation).get(donation_id)
            if not donation:
                return False

            for key, value in updates.items():
                if hasattr(donation, key):
                    setattr(donation, key, value)

            return True

    def mark_duplicate(
        self,
        duplicate_id: int,
        original_id: int,
        operator: str
    ) -> bool:
        with self.get_session() as session:
            duplicate = session.query(BookDonation).get(duplicate_id)
            original = session.query(BookDonation).get(original_id)

            if not duplicate or not original:
                return False

            duplicate.is_duplicate = True
            duplicate.duplicate_of = original_id
            duplicate.status = DonationStatus.DEDUPLICATED.value
            duplicate.exception_type = ExceptionType.DUPLICATE.value

            return True

    def find_potential_duplicates(
        self,
        batch_id: Optional[str] = None,
        threshold: int = 1
    ) -> List[Tuple[int, List[int]]]:
        with self.get_session() as session:
            query = session.query(BookDonation)

            if batch_id:
                query = query.filter(BookDonation.batch_id == batch_id)

            donations = query.filter(
                BookDonation.is_duplicate == False,
                BookDonation.isbn_standard.isnot(None)
            ).all()

            isbn_groups = {}
            for d in donations:
                key = d.isbn_standard
                if key not in isbn_groups:
                    isbn_groups[key] = []
                isbn_groups[key].append(d.id)

            duplicates = [
                (key, ids) for key, ids in isbn_groups.items()
                if len(ids) > threshold
            ]

            return duplicates

    def _donation_to_dict(self, donation) -> dict:
        return {
            'id': donation.id,
            'batch_id': donation.batch_id,
            'isbn_raw': donation.isbn_raw,
            'isbn_standard': donation.isbn_standard,
            'title_raw': donation.title_raw,
            'title_standard': donation.title_standard,
            'author': donation.author,
            'publisher': donation.publisher,
            'grade_raw': donation.grade_raw,
            'grade_standard': donation.grade_standard,
            'condition_raw': donation.condition_raw,
            'condition_standard': donation.condition_standard,
            'condition_score': donation.condition_score,
            'donor_name': donation.donor_name,
            'volunteer': donation.volunteer,
            'status': donation.status,
            'exception_type': donation.exception_type,
            'exception_detail': donation.exception_detail,
            'is_duplicate': donation.is_duplicate,
            'duplicate_of': donation.duplicate_of,
            'import_time': donation.import_time,
            'shelf_code': donation.shelf_code,
            'notes': donation.notes
        }

    def query_donations(
        self,
        volunteer: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        status: Optional[str] = None,
        exception_type: Optional[str] = None,
        batch_id: Optional[str] = None,
        is_duplicate: Optional[bool] = None,
        offset: int = 0,
        limit: int = 100
    ) -> Tuple[List[dict], int]:
        with self.get_session() as session:
            query = session.query(BookDonation)
            filters = []

            if volunteer:
                filters.append(BookDonation.volunteer == volunteer)
            if start_time:
                filters.append(BookDonation.import_time >= start_time)
            if end_time:
                filters.append(BookDonation.import_time <= end_time)
            if status:
                filters.append(BookDonation.status == status)
            if exception_type:
                filters.append(BookDonation.exception_type == exception_type)
            if batch_id:
                filters.append(BookDonation.batch_id == batch_id)
            if is_duplicate is not None:
                filters.append(BookDonation.is_duplicate == is_duplicate)

            if filters:
                query = query.filter(and_(*filters))

            total = query.count()
            donations = query.order_by(BookDonation.import_time.desc()) \
                .offset(offset).limit(limit).all()

            return [self._donation_to_dict(d) for d in donations], total

    def get_donation_by_id(self, donation_id: int) -> Optional[dict]:
        with self.get_session() as session:
            donation = session.query(BookDonation).get(donation_id)
            if not donation:
                return None
            return {
                'id': donation.id,
                'batch_id': donation.batch_id,
                'isbn_raw': donation.isbn_raw,
                'isbn_standard': donation.isbn_standard,
                'title_raw': donation.title_raw,
                'title_standard': donation.title_standard,
                'author': donation.author,
                'publisher': donation.publisher,
                'grade_raw': donation.grade_raw,
                'grade_standard': donation.grade_standard,
                'condition_raw': donation.condition_raw,
                'condition_standard': donation.condition_standard,
                'condition_score': donation.condition_score,
                'donor_name': donation.donor_name,
                'volunteer': donation.volunteer,
                'status': donation.status,
                'exception_type': donation.exception_type,
                'exception_detail': donation.exception_detail,
                'is_duplicate': donation.is_duplicate,
                'duplicate_of': donation.duplicate_of,
                'import_time': donation.import_time,
                'shelf_code': donation.shelf_code,
                'notes': donation.notes
            }

    def get_donations_by_ids(self, donation_ids: List[int]) -> List[dict]:
        with self.get_session() as session:
            donations = session.query(BookDonation).filter(
                BookDonation.id.in_(donation_ids)
            ).all()
            return [self._donation_to_dict(d) for d in donations]

    def add_grade_label(
        self,
        raw_label: str,
        standard_grade: str,
        grade_order: int,
        description: str = ""
    ) -> bool:
        with self.get_session() as session:
            try:
                existing = session.query(GradeLabel).filter(
                    GradeLabel.raw_label == raw_label
                ).first()

                if existing:
                    existing.standard_grade = standard_grade
                    existing.grade_order = grade_order
                    existing.description = description
                else:
                    label = GradeLabel(
                        raw_label=raw_label,
                        standard_grade=standard_grade,
                        grade_order=grade_order,
                        description=description
                    )
                    session.add(label)
                return True
            except IntegrityError:
                return False

    def get_grade_label(self, raw_label: str) -> Optional[dict]:
        with self.get_session() as session:
            label = session.query(GradeLabel).filter(
                GradeLabel.raw_label == raw_label
            ).first()
            if not label:
                return None
            return {
                'standard_grade': label.standard_grade,
                'grade_order': label.grade_order
            }

    def add_condition_rule(
        self,
        raw_description: str,
        standard_condition: str,
        condition_score: int,
        min_score: int,
        max_score: int,
        can_shelf: bool = True
    ) -> bool:
        with self.get_session() as session:
            try:
                existing = session.query(ConditionRule).filter(
                    ConditionRule.raw_description == raw_description
                ).first()

                if existing:
                    existing.standard_condition = standard_condition
                    existing.condition_score = condition_score
                    existing.min_score = min_score
                    existing.max_score = max_score
                    existing.can_shelf = can_shelf
                else:
                    rule = ConditionRule(
                        raw_description=raw_description,
                        standard_condition=standard_condition,
                        condition_score=condition_score,
                        min_score=min_score,
                        max_score=max_score,
                        can_shelf=can_shelf
                    )
                    session.add(rule)
                return True
            except IntegrityError:
                return False

    def get_condition_rule(self, raw_description: str) -> Optional[dict]:
        with self.get_session() as session:
            rule = session.query(ConditionRule).filter(
                ConditionRule.raw_description == raw_description
            ).first()
            if not rule:
                return None
            return {
                'standard_condition': rule.standard_condition,
                'condition_score': rule.condition_score,
                'can_shelf': rule.can_shelf
            }

    def add_isbn_info(
        self,
        isbn: str,
        title: str,
        author: str = "",
        publisher: str = "",
        publish_date: str = "",
        suggested_grades: str = "",
        category: str = ""
    ) -> bool:
        with self.get_session() as session:
            try:
                existing = session.query(ISBNInfo).filter(ISBNInfo.isbn == isbn).first()

                if existing:
                    existing.title = title
                    existing.author = author
                    existing.publisher = publisher
                    existing.publish_date = publish_date
                    existing.suggested_grades = suggested_grades
                    existing.category = category
                else:
                    info = ISBNInfo(
                        isbn=isbn,
                        title=title,
                        author=author,
                        publisher=publisher,
                        publish_date=publish_date,
                        suggested_grades=suggested_grades,
                        category=category
                    )
                    session.add(info)
                return True
            except IntegrityError:
                return False

    def get_isbn_info(self, isbn: str) -> Optional[dict]:
        with self.get_session() as session:
            info = session.query(ISBNInfo).filter(ISBNInfo.isbn == isbn).first()
            if not info:
                return None
            return {
                'title': info.title,
                'author': info.author,
                'publisher': info.publisher
            }

    def create_shelf_list(
        self,
        list_id: str,
        batch_id: str,
        generated_by: str,
        donation_ids: List[int],
        shelf_code: str = "",
        notes: str = ""
    ) -> Tuple[Optional[str], List[Tuple[int, str]]]:
        failed_items = []

        with self.get_session() as session:
            existing = session.query(ShelfList).filter(
                ShelfList.list_id == list_id
            ).first()

            if existing:
                return list_id, []

            shelf_list = ShelfList(
                list_id=list_id,
                batch_id=batch_id,
                generated_by=generated_by,
                total_books=len(donation_ids),
                shelf_code=shelf_code,
                notes=notes
            )
            session.add(shelf_list)
            session.flush()

            for sort_order, donation_id in enumerate(donation_ids):
                try:
                    donation = session.query(BookDonation).get(donation_id)
                    if not donation:
                        failed_items.append((donation_id, "Donation not found"))
                        continue

                    item = ShelfListItem(
                        shelf_list_id=shelf_list.id,
                        donation_id=donation_id,
                        sort_order=sort_order,
                        shelf_code=shelf_code
                    )
                    session.add(item)

                    donation.shelf_code = shelf_code
                    donation.status = DonationStatus.SHELVED.value

                except Exception as e:
                    failed_items.append((donation_id, str(e)))

            shelf_list.total_books = len(donation_ids) - len(failed_items)

            self._log_operation(
                session,
                operation_type="create_shelf_list",
                batch_id=batch_id,
                operator=generated_by,
                success_count=len(donation_ids) - len(failed_items),
                fail_count=len(failed_items),
                total_count=len(donation_ids),
                details=json.dumps({"failed": failed_items}, ensure_ascii=False)
            )

        return list_id, failed_items

    def get_shelf_list(self, list_id: str) -> Optional[dict]:
        with self.get_session() as session:
            shelf_list = session.query(ShelfList).filter(
                ShelfList.list_id == list_id
            ).first()
            if not shelf_list:
                return None
            return {
                'id': shelf_list.id,
                'list_id': shelf_list.list_id,
                'batch_id': shelf_list.batch_id,
                'generated_by': shelf_list.generated_by,
                'generate_time': shelf_list.generate_time,
                'total_books': shelf_list.total_books,
                'shelf_code': shelf_list.shelf_code,
                'status': shelf_list.status,
                'notes': shelf_list.notes
            }

    def get_shelf_list_items(self, list_id: str) -> List[dict]:
        with self.get_session() as session:
            shelf_list = session.query(ShelfList).filter(
                ShelfList.list_id == list_id
            ).first()

            if not shelf_list:
                return []

            items = session.query(ShelfListItem).filter(
                ShelfListItem.shelf_list_id == shelf_list.id
            ).order_by(ShelfListItem.sort_order).all()

            result = []
            for item in items:
                donation = session.query(BookDonation).get(item.donation_id)
                donation_dict = self._donation_to_dict(donation) if donation else {}
                result.append({
                    'id': item.id,
                    'shelf_list_id': item.shelf_list_id,
                    'donation_id': item.donation_id,
                    'donation': donation_dict,
                    'sort_order': item.sort_order,
                    'shelf_code': item.shelf_code
                })
            return result

    def _log_operation(
        self,
        session: Session,
        operation_type: str,
        batch_id: str,
        operator: str,
        success_count: int,
        fail_count: int,
        total_count: int,
        details: str = ""
    ) -> OperationLog:
        log = OperationLog(
            operation_type=operation_type,
            batch_id=batch_id,
            operator=operator,
            success_count=success_count,
            fail_count=fail_count,
            total_count=total_count,
            details=details
        )
        session.add(log)
        return log

    def log_operation(
        self,
        operation_type: str,
        batch_id: str,
        operator: str,
        success_count: int,
        fail_count: int,
        total_count: int,
        details: str = "",
        idempotency_key: Optional[str] = None
    ) -> int:
        with self.get_session() as session:
            log = OperationLog(
                operation_type=operation_type,
                batch_id=batch_id,
                operator=operator,
                success_count=success_count,
                fail_count=fail_count,
                total_count=total_count,
                details=details,
                idempotency_key=idempotency_key
            )
            session.add(log)
            session.flush()
            return log.id

    def query_operation_logs(
        self,
        operation_type: Optional[str] = None,
        batch_id: Optional[str] = None,
        operator: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        offset: int = 0,
        limit: int = 100
    ) -> Tuple[List[dict], int]:
        with self.get_session() as session:
            query = session.query(OperationLog)
            filters = []

            if operation_type:
                filters.append(OperationLog.operation_type == operation_type)
            if batch_id:
                filters.append(OperationLog.batch_id == batch_id)
            if operator:
                filters.append(OperationLog.operator == operator)
            if start_time:
                filters.append(OperationLog.operation_time >= start_time)
            if end_time:
                filters.append(OperationLog.operation_time <= end_time)

            if filters:
                query = query.filter(and_(*filters))

            total = query.count()
            logs = query.order_by(OperationLog.operation_time.desc()) \
                .offset(offset).limit(limit).all()

            result = []
            for log in logs:
                result.append({
                    'id': log.id,
                    'operation_type': log.operation_type,
                    'batch_id': log.batch_id,
                    'operator': log.operator,
                    'operation_time': log.operation_time,
                    'success_count': log.success_count,
                    'fail_count': log.fail_count,
                    'total_count': log.total_count,
                    'details': log.details
                })
            return result, total

    def bulk_update_status(
        self,
        donation_ids: List[int],
        status: str,
        operator: str,
        exception_updates: Optional[Dict[int, Tuple[str, str]]] = None
    ) -> Tuple[List[int], List[Tuple[int, str]]]:
        success_ids = []
        failed_items = []

        with self.get_session() as session:
            for donation_id in donation_ids:
                try:
                    donation = session.query(BookDonation).get(donation_id)
                    if not donation:
                        failed_items.append((donation_id, "Not found"))
                        continue

                    donation.status = status

                    if exception_updates and donation_id in exception_updates:
                        exc_type, exc_detail = exception_updates[donation_id]
                        donation.exception_type = exc_type
                        donation.exception_detail = exc_detail

                    success_ids.append(donation_id)
                except Exception as e:
                    failed_items.append((donation_id, str(e)))

            self._log_operation(
                session,
                operation_type=f"bulk_update_{status}",
                batch_id="bulk",
                operator=operator,
                success_count=len(success_ids),
                fail_count=len(failed_items),
                total_count=len(donation_ids),
                details=json.dumps({"failed": failed_items}, ensure_ascii=False)
            )

        return success_ids, failed_items
