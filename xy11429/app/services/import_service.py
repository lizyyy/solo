import pandas as pd
import json
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from ..models import (
    VisitorLedger, OriginalEvidence, ImportBatch, DataSource, 
    LedgerStatus, PermissionResult, User
)


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_ledger_no(self) -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        uuid_str = str(uuid.uuid4())[:8].upper()
        return f"VL-{date_str}-{uuid_str}"

    def _calculate_file_hash(self, content: bytes) -> str:
        return hashlib.sha256(content).hexdigest()

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if pd.isna(value) or value is None or str(value).strip() == '':
            return None
        if isinstance(value, datetime):
            return value
        try:
            return pd.to_datetime(value).to_pydatetime()
        except (ValueError, TypeError):
            return None

    def _normalize_visitor_appointment(self, row: pd.Series, row_num: int) -> Tuple[Dict[str, Any], Dict[str, Any], Optional[str]]:
        raw_data = row.to_dict()
        parsed_data = {}
        error = None

        try:
            visitor_name = str(row.get('访客姓名', '')).strip()
            if not visitor_name:
                visitor_name = str(row.get('name', '')).strip()

            parsed_data = {
                'visitor_name': visitor_name,
                'visitor_phone': str(row.get('联系电话', row.get('phone', ''))).strip(),
                'visitor_id_card': str(row.get('身份证号', row.get('id_card', ''))).strip(),
                'visit_purpose': str(row.get('来访事由', row.get('purpose', ''))).strip(),
                'visited_person': str(row.get('被访人', row.get('visited_person', ''))).strip(),
                'visited_department': str(row.get('被访部门', row.get('department', ''))).strip(),
                'temp_plate_number': str(row.get('临时车牌', row.get('plate_number', ''))).strip(),
                'appointment_start_time': self._parse_datetime(row.get('预约开始时间', row.get('start_time'))),
                'appointment_end_time': self._parse_datetime(row.get('预约结束时间', row.get('end_time'))),
                'permission_granted_time': self._parse_datetime(row.get('权限开通时间', row.get('grant_time'))),
                'permission_revoked_time': self._parse_datetime(row.get('权限收回时间', row.get('revoke_time'))),
            }

            if not parsed_data['visitor_name']:
                error = "访客姓名不能为空"

        except Exception as e:
            error = f"解析失败: {str(e)}"

        return raw_data, parsed_data, error

    def _normalize_gate_record(self, row: pd.Series, row_num: int) -> Tuple[Dict[str, Any], Dict[str, Any], Optional[str]]:
        raw_data = row.to_dict()
        parsed_data = {}
        error = None

        try:
            parsed_data = {
                'visitor_name': str(row.get('访客姓名', row.get('name', ''))).strip(),
                'temp_plate_number': str(row.get('车牌号', row.get('plate', ''))).strip(),
                'actual_entry_time': self._parse_datetime(row.get('进入时间', row.get('entry_time'))),
                'actual_exit_time': self._parse_datetime(row.get('离开时间', row.get('exit_time'))),
            }
        except Exception as e:
            error = f"解析失败: {str(e)}"

        return raw_data, parsed_data, error

    def _normalize_temp_plate(self, row: pd.Series, row_num: int) -> Tuple[Dict[str, Any], Dict[str, Any], Optional[str]]:
        raw_data = row.to_dict()
        parsed_data = {}
        error = None

        try:
            parsed_data = {
                'temp_plate_number': str(row.get('临时车牌', row.get('plate_number', ''))).strip(),
                'visitor_name': str(row.get('车主姓名', row.get('owner', ''))).strip(),
                'permission_granted_time': self._parse_datetime(row.get('生效时间', row.get('valid_from'))),
                'permission_revoked_time': self._parse_datetime(row.get('失效时间', row.get('valid_to'))),
            }

            if not parsed_data['temp_plate_number']:
                error = "临时车牌号不能为空"

        except Exception as e:
            error = f"解析失败: {str(e)}"

        return raw_data, parsed_data, error

    def _detect_cross_day_issue(self, parsed_data: Dict[str, Any]) -> Tuple[bool, PermissionResult]:
        grant_time = parsed_data.get('permission_granted_time')
        revoke_time = parsed_data.get('permission_revoked_time')
        appointment_end = parsed_data.get('appointment_end_time')

        is_cross_day = False
        result = PermissionResult.PENDING

        if grant_time and revoke_time:
            grant_date = grant_time.date()
            revoke_date = revoke_time.date()
            if grant_date != revoke_date:
                is_cross_day = True
                result = PermissionResult.CROSS_DAY_ISSUE
        elif grant_time and appointment_end:
            grant_date = grant_time.date()
            end_date = appointment_end.date()
            if grant_date != end_date:
                is_cross_day = True
                result = PermissionResult.CROSS_DAY_ISSUE
        elif grant_time and not revoke_time:
            result = PermissionResult.UNCERTAIN

        return is_cross_day, result

    def _check_duplicate(self, parsed_data: Dict[str, Any]) -> Optional[VisitorLedger]:
        plate = parsed_data.get('temp_plate_number')
        name = parsed_data.get('visitor_name')
        grant_time = parsed_data.get('permission_granted_time')

        if plate and grant_time:
            existing = self.db.query(VisitorLedger).filter(
                VisitorLedger.temp_plate_number == plate,
                VisitorLedger.permission_granted_time == grant_time
            ).first()
            if existing:
                return existing

        if name and plate:
            existing = self.db.query(VisitorLedger).filter(
                VisitorLedger.visitor_name == name,
                VisitorLedger.temp_plate_number == plate
            ).first()
            if existing:
                return existing

        return None

    def import_from_excel(
        self,
        file_content: bytes,
        file_name: str,
        source_type: DataSource,
        current_user: User,
        skip_duplicates: bool = True
    ) -> ImportBatch:
        batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:6].upper()}"
        file_hash = self._calculate_file_hash(file_content)

        batch = ImportBatch(
            batch_id=batch_id,
            source_type=source_type,
            file_name=file_name,
            file_hash=file_hash,
            status="processing",
            imported_by=current_user.id
        )
        self.db.add(batch)
        self.db.flush()

        try:
            df = pd.read_excel(file_content)
            batch.total_rows = len(df)

            success_count = 0
            failed_count = 0
            skipped_count = 0

            for idx, row in df.iterrows():
                row_num = idx + 2

                if source_type == DataSource.VISITOR_APPOINTMENT:
                    raw_data, parsed_data, error = self._normalize_visitor_appointment(row, row_num)
                elif source_type == DataSource.GATE_RECORD:
                    raw_data, parsed_data, error = self._normalize_gate_record(row, row_num)
                elif source_type == DataSource.TEMP_PLATE_SCREENSHOT:
                    raw_data, parsed_data, error = self._normalize_temp_plate(row, row_num)
                else:
                    raw_data, parsed_data, error = row.to_dict(), {}, "不支持的数据源类型"

                if error:
                    failed_count += 1
                    self._create_failed_evidence(None, source_type, file_name, row_num, raw_data, error, batch_id)
                    continue

                duplicate = self._check_duplicate(parsed_data)
                if duplicate and skip_duplicates:
                    skipped_count += 1
                    self._create_failed_evidence(
                        duplicate.id, source_type, file_name, row_num, raw_data,
                        f"重复记录，已跳过 (台账编号: {duplicate.ledger_no})", batch_id
                    )
                    continue

                try:
                    ledger = self._create_ledger_from_parsed(
                        parsed_data, source_type, file_name, row_num,
                        raw_data, parsed_data, batch_id, current_user.id
                    )
                    success_count += 1
                except Exception as e:
                    failed_count += 1
                    self._create_failed_evidence(None, source_type, file_name, row_num, raw_data, str(e), batch_id)

            batch.success_count = success_count
            batch.failed_count = failed_count
            batch.skipped_count = skipped_count
            batch.status = "completed"
            batch.completed_at = datetime.now()

            self.db.commit()
            return batch

        except Exception as e:
            batch.status = "failed"
            batch.error_log = str(e)
            self.db.commit()
            raise

    def _create_ledger_from_parsed(
        self,
        parsed_data: Dict[str, Any],
        source_type: DataSource,
        file_name: str,
        row_num: int,
        raw_data: Dict[str, Any],
        parsed_for_evidence: Dict[str, Any],
        batch_id: str,
        user_id: int
    ) -> VisitorLedger:
        ledger_no = self._generate_ledger_no()
        is_cross_day, permission_result = self._detect_cross_day_issue(parsed_data)

        ledger = VisitorLedger(
            ledger_no=ledger_no,
            visitor_name=parsed_data.get('visitor_name'),
            visitor_phone=parsed_data.get('visitor_phone'),
            visitor_id_card=parsed_data.get('visitor_id_card'),
            visit_purpose=parsed_data.get('visit_purpose'),
            visited_person=parsed_data.get('visited_person'),
            visited_department=parsed_data.get('visited_department'),
            temp_plate_number=parsed_data.get('temp_plate_number'),
            appointment_start_time=parsed_data.get('appointment_start_time'),
            appointment_end_time=parsed_data.get('appointment_end_time'),
            actual_entry_time=parsed_data.get('actual_entry_time'),
            actual_exit_time=parsed_data.get('actual_exit_time'),
            permission_granted_time=parsed_data.get('permission_granted_time'),
            permission_revoked_time=parsed_data.get('permission_revoked_time'),
            is_cross_day=is_cross_day,
            permission_result=permission_result,
            status=LedgerStatus.DRAFT,
            created_by=user_id
        )

        self.db.add(ledger)
        self.db.flush()

        evidence = OriginalEvidence(
            ledger_id=ledger.id,
            source_type=source_type,
            source_file_name=file_name,
            original_row_number=row_num,
            raw_data=raw_data,
            parsed_data=parsed_for_evidence,
            import_batch_id=batch_id,
            is_valid=True
        )
        self.db.add(evidence)

        return ledger

    def _create_failed_evidence(
        self,
        ledger_id: Optional[int],
        source_type: DataSource,
        file_name: str,
        row_num: int,
        raw_data: Dict[str, Any],
        error: str,
        batch_id: str
    ):
        temp_ledger_id = ledger_id
        if not temp_ledger_id:
            temp_ledger = VisitorLedger(
                ledger_no=f"INVALID-{batch_id}-{row_num}",
                status=LedgerStatus.DRAFT,
                permission_result=PermissionResult.PENDING
            )
            self.db.add(temp_ledger)
            self.db.flush()
            temp_ledger_id = temp_ledger.id

        evidence = OriginalEvidence(
            ledger_id=temp_ledger_id,
            source_type=source_type,
            source_file_name=file_name,
            original_row_number=row_num,
            raw_data=raw_data,
            import_batch_id=batch_id,
            is_valid=False,
            validation_error=error
        )
        self.db.add(evidence)

    def merge_evidences(self, target_ledger_id: int, source_ledger_ids: List[int], current_user: User) -> VisitorLedger:
        target = self.db.query(VisitorLedger).filter(VisitorLedger.id == target_ledger_id).first()
        if not target:
            raise ValueError("目标台账不存在")

        for source_id in source_ledger_ids:
            if source_id == target_ledger_id:
                continue

            source = self.db.query(VisitorLedger).filter(VisitorLedger.id == source_id).first()
            if source:
                for evidence in source.evidences:
                    evidence.ledger_id = target_ledger_id

                self.db.delete(source)

        self.db.commit()
        self.db.refresh(target)
        return target
