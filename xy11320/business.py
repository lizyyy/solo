import uuid
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import asdict

from storage import (
    DatabaseManager, WorkRecord, ImportBatch, ImportResult,
    RecordStatus, BillingType, ExceptionType
)


class BillingService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def calculate_total(self, billing_type: str,
                       hours: Optional[float] = None,
                       hourly_rate: Optional[float] = None,
                       area: Optional[float] = None,
                       area_rate: Optional[float] = None,
                       fuel_consumption: Optional[float] = None,
                       fuel_price: Optional[float] = None) -> Tuple[float, List[str]]:
        total = 0.0
        errors = []

        if billing_type == BillingType.HOURLY.value:
            if hours is None or hourly_rate is None:
                errors.append("按时计费需要提供小时数和小时单价")
            else:
                if hours <= 0:
                    errors.append("小时数必须大于0")
                if hourly_rate <= 0:
                    errors.append("小时单价必须大于0")
                if not errors:
                    total = hours * hourly_rate

        elif billing_type == BillingType.BY_AREA.value:
            if area is None or area_rate is None:
                errors.append("按亩计费需要提供亩数和亩单价")
            else:
                if area <= 0:
                    errors.append("亩数必须大于0")
                if area_rate <= 0:
                    errors.append("亩单价必须大于0")
                if not errors:
                    total = area * area_rate

        elif billing_type == BillingType.FUEL.value:
            if fuel_consumption is None or fuel_price is None:
                errors.append("按油计费需要提供油耗和油价")
            else:
                if fuel_consumption <= 0:
                    errors.append("油耗必须大于0")
                if fuel_price <= 0:
                    errors.append("油价必须大于0")
                if not errors:
                    total = fuel_consumption * fuel_price

        elif billing_type == BillingType.MIXED.value:
            has_valid_component = False

            if hours is not None and hourly_rate is not None:
                if hours > 0 and hourly_rate > 0:
                    total += hours * hourly_rate
                    has_valid_component = True
                elif hours is not None or hourly_rate is not None:
                    errors.append("按时计费参数不完整或无效")

            if area is not None and area_rate is not None:
                if area > 0 and area_rate > 0:
                    total += area * area_rate
                    has_valid_component = True
                elif area is not None or area_rate is not None:
                    errors.append("按亩计费参数不完整或无效")

            if fuel_consumption is not None and fuel_price is not None:
                if fuel_consumption > 0 and fuel_price > 0:
                    total += fuel_consumption * fuel_price
                    has_valid_component = True
                elif fuel_consumption is not None or fuel_price is not None:
                    errors.append("按油计费参数不完整或无效")

            if not has_valid_component:
                errors.append("混合计费至少需要一种有效的计费方式")

        else:
            errors.append(f"未知的计费类型: {billing_type}")

        return round(total, 2), errors

    def validate_record(self, data: Dict) -> Tuple[bool, List[str], Optional[str]]:
        errors = []
        exception_type = None

        required_fields = ['record_no', 'tractor_no', 'operator', 'work_date', 'work_type', 'billing_type']
        missing_fields = [f for f in required_fields if not data.get(f)]
        
        if missing_fields:
            errors.append(f"缺少必填字段: {', '.join(missing_fields)}")
            exception_type = ExceptionType.MISSING_FIELD.value

        if data.get('billing_type') not in [t.value for t in BillingType]:
            errors.append(f"计费类型无效: {data.get('billing_type')}")
            exception_type = ExceptionType.INVALID_VALUE.value

        if data.get('work_date'):
            try:
                datetime.strptime(str(data['work_date']), '%Y-%m-%d')
            except ValueError:
                errors.append(f"日期格式错误，应为YYYY-MM-DD: {data.get('work_date')}")
                if not exception_type:
                    exception_type = ExceptionType.INVALID_VALUE.value

        if errors:
            return False, errors, exception_type

        return True, [], None

    def create_record(self, data: Dict, import_batch_id: Optional[str] = None) -> Tuple[WorkRecord, List[str]]:
        now = datetime.now().isoformat()
        
        is_valid, validation_errors, exception_type = self.validate_record(data)
        
        calculated_total, calc_errors = self.calculate_total(
            billing_type=data.get('billing_type', ''),
            hours=self._safe_float(data.get('hours')),
            hourly_rate=self._safe_float(data.get('hourly_rate')),
            area=self._safe_float(data.get('area')),
            area_rate=self._safe_float(data.get('area_rate')),
            fuel_consumption=self._safe_float(data.get('fuel_consumption')),
            fuel_price=self._safe_float(data.get('fuel_price'))
        )

        all_errors = validation_errors + calc_errors
        provided_total = self._safe_float(data.get('total_amount'))

        if provided_total is not None and abs(provided_total - calculated_total) > 0.01 and not all_errors:
            all_errors.append(f"金额不匹配: 提供值 {provided_total} != 计算值 {calculated_total}")
            if not exception_type:
                exception_type = ExceptionType.CALCULATION_ERROR.value

        exception_detail = '; '.join(all_errors) if all_errors else None

        record = WorkRecord(
            id=None,
            record_no=str(data['record_no']),
            tractor_no=str(data['tractor_no']),
            operator=str(data['operator']),
            work_date=str(data['work_date']),
            work_type=str(data['work_type']),
            billing_type=str(data['billing_type']),
            hours=self._safe_float(data.get('hours')),
            hourly_rate=self._safe_float(data.get('hourly_rate')),
            area=self._safe_float(data.get('area')),
            area_rate=self._safe_float(data.get('area_rate')),
            fuel_consumption=self._safe_float(data.get('fuel_consumption')),
            fuel_price=self._safe_float(data.get('fuel_price')),
            total_amount=provided_total if provided_total is not None else calculated_total,
            status=RecordStatus.IMPORTED.value if not all_errors else RecordStatus.DRAFT.value,
            reviewer=None,
            review_time=None,
            review_comment=None,
            created_at=now,
            updated_at=now,
            import_batch_id=import_batch_id,
            exception_type=exception_type,
            exception_detail=exception_detail
        )

        return record, all_errors

    def _safe_float(self, value) -> Optional[float]:
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None


class ImportService:
    def __init__(self, db_manager: DatabaseManager, billing_service: BillingService):
        self.db = db_manager
        self.billing_service = billing_service

    def import_from_excel(self, file_path: str, created_by: str) -> Dict:
        batch_id = str(uuid.uuid4())
        
        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            return {
                'success': False,
                'error': f'读取Excel文件失败: {str(e)}',
                'exception_type': ExceptionType.IMPORT_ERROR.value
            }

        total_count = len(df)
        
        batch = ImportBatch(
            batch_id=batch_id,
            file_name=file_path.split('/')[-1],
            total_count=total_count,
            success_count=0,
            failed_count=0,
            status='processing',
            created_by=created_by,
            created_at=datetime.now().isoformat(),
            completed_at=None
        )
        self.db.create_import_batch(batch)

        success_count = 0
        failed_count = 0
        success_records = []
        failed_records = []

        for idx, row in df.iterrows():
            data = row.to_dict()
            data = {k: (v if pd.notna(v) else None) for k, v in data.items()}
            
            existing = self.db.get_work_record_by_no(str(data.get('record_no', '')))
            
            if existing:
                result = ImportResult(
                    batch_id=batch_id,
                    record_no=str(data.get('record_no', f'row_{idx}')),
                    success=False,
                    exception_type=ExceptionType.DUPLICATE.value,
                    exception_detail=f"记录编号已存在: {data.get('record_no')}",
                    record_id=None
                )
                self.db.add_import_result(result)
                failed_count += 1
                failed_records.append({
                    'row': idx + 2,
                    'record_no': data.get('record_no'),
                    'exception_type': ExceptionType.DUPLICATE.value,
                    'exception_detail': f"记录编号已存在"
                })
                continue

            record, errors = self.billing_service.create_record(data, batch_id)

            if not errors:
                try:
                    record_id = self.db.insert_work_record(record)
                    result = ImportResult(
                        batch_id=batch_id,
                        record_no=record.record_no,
                        success=True,
                        exception_type=None,
                        exception_detail=None,
                        record_id=record_id
                    )
                    self.db.add_import_result(result)
                    success_count += 1
                    success_records.append({
                        'row': idx + 2,
                        'record_no': record.record_no,
                        'record_id': record_id
                    })
                except Exception as e:
                    result = ImportResult(
                        batch_id=batch_id,
                        record_no=record.record_no,
                        success=False,
                        exception_type=ExceptionType.IMPORT_ERROR.value,
                        exception_detail=str(e),
                        record_id=None
                    )
                    self.db.add_import_result(result)
                    failed_count += 1
                    failed_records.append({
                        'row': idx + 2,
                        'record_no': record.record_no,
                        'exception_type': ExceptionType.IMPORT_ERROR.value,
                        'exception_detail': str(e)
                    })
            else:
                record.exception_detail = '; '.join(errors)
                record_id = self.db.insert_work_record(record)
                result = ImportResult(
                    batch_id=batch_id,
                    record_no=record.record_no,
                    success=False,
                    exception_type=record.exception_type,
                    exception_detail=record.exception_detail,
                    record_id=record_id
                )
                self.db.add_import_result(result)
                failed_count += 1
                failed_records.append({
                    'row': idx + 2,
                    'record_no': record.record_no,
                    'record_id': record_id,
                    'exception_type': record.exception_type,
                    'exception_detail': record.exception_detail
                })

        completed_at = datetime.now().isoformat()
        batch_status = 'completed' if failed_count == 0 else 'completed_with_errors'
        self.db.update_import_batch(batch_id, success_count, failed_count, batch_status, completed_at)

        self.db.add_action_log(
            action_type='import',
            operator=created_by,
            batch_id=batch_id,
            details={
                'file_name': batch.file_name,
                'total_count': total_count,
                'success_count': success_count,
                'failed_count': failed_count
            }
        )

        return {
            'success': True,
            'batch_id': batch_id,
            'summary': {
                'total': total_count,
                'success': success_count,
                'failed': failed_count
            },
            'success_records': success_records,
            'failed_records': failed_records
        }

    def retry_failed_records(self, batch_id: str, operator: str) -> Dict:
        import_results = self.db.get_import_results(batch_id)
        failed_results = [r for r in import_results if not r.success and r.record_id is not None]

        if not failed_results:
            return {
                'success': True,
                'message': '没有需要重试的失败记录',
                'retry_count': 0,
                'success_count': 0
            }

        retry_count = 0
        success_count = 0
        retry_details = []

        for result in failed_results:
            record = self.db.get_work_record_by_id(result.record_id)
            if not record:
                continue

            retry_count += 1
            
            data = asdict(record)
            
            is_valid, errors, exception_type = self.billing_service.validate_record(data)
            
            calculated_total, calc_errors = self.billing_service.calculate_total(
                billing_type=record.billing_type,
                hours=record.hours,
                hourly_rate=record.hourly_rate,
                area=record.area,
                area_rate=record.area_rate,
                fuel_consumption=record.fuel_consumption,
                fuel_price=record.fuel_price
            )

            all_errors = errors + calc_errors

            if not all_errors:
                record.status = RecordStatus.VALIDATED.value
                record.exception_type = None
                record.exception_detail = None
                record.total_amount = calculated_total
                record.updated_at = datetime.now().isoformat()
                self.db.update_work_record(record)
                
                result.success = True
                result.exception_type = None
                result.exception_detail = None
                self.db.add_import_result(result)
                
                success_count += 1
                retry_details.append({
                    'record_no': record.record_no,
                    'status': 'success',
                    'message': '验证通过'
                })
            else:
                retry_details.append({
                    'record_no': record.record_no,
                    'status': 'failed',
                    'message': '; '.join(all_errors)
                })

        self.db.add_action_log(
            action_type='retry_import',
            operator=operator,
            batch_id=batch_id,
            details={
                'retry_count': retry_count,
                'success_count': success_count
            }
        )

        return {
            'success': True,
            'retry_count': retry_count,
            'success_count': success_count,
            'details': retry_details
        }


class ReviewService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def review_record(self, record_id: int, reviewer: str, 
                     approved: bool, comment: str = '') -> Dict:
        record = self.db.get_work_record_by_id(record_id)
        if not record:
            return {
                'success': False,
                'error': '记录不存在',
                'exception_type': ExceptionType.REVIEW_ERROR.value
            }

        if approved:
            record.status = RecordStatus.REVIEWED.value
        else:
            record.status = RecordStatus.REJECTED.value

        record.reviewer = reviewer
        record.review_time = datetime.now().isoformat()
        record.review_comment = comment
        record.updated_at = datetime.now().isoformat()

        self.db.update_work_record(record)

        self.db.add_action_log(
            action_type='review',
            operator=reviewer,
            record_id=record_id,
            details={
                'approved': approved,
                'comment': comment,
                'previous_status': record.status
            }
        )

        return {
            'success': True,
            'record_id': record_id,
            'record_no': record.record_no,
            'status': record.status
        }

    def batch_review(self, record_ids: List[int], reviewer: str, 
                    approved: bool, comment: str = '') -> Dict:
        success_count = 0
        failed_count = 0
        results = []

        for record_id in record_ids:
            result = self.review_record(record_id, reviewer, approved, comment)
            if result['success']:
                success_count += 1
                results.append({
                    'record_id': record_id,
                    'status': 'success'
                })
            else:
                failed_count += 1
                results.append({
                    'record_id': record_id,
                    'status': 'failed',
                    'error': result.get('error', '')
                })

        return {
            'success': True,
            'summary': {
                'total': len(record_ids),
                'success': success_count,
                'failed': failed_count
            },
            'details': results
        }

    def get_records_for_review(self, operator: Optional[str] = None,
                              start_date: Optional[str] = None,
                              end_date: Optional[str] = None) -> List[WorkRecord]:
        return self.db.query_work_records(
            operator=operator,
            start_date=start_date,
            end_date=end_date,
            status=RecordStatus.IMPORTED.value
        )


class ExportService:
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def query_and_export(self, output_path: str,
                        operator: Optional[str] = None,
                        start_date: Optional[str] = None,
                        end_date: Optional[str] = None,
                        status: Optional[str] = None,
                        exception_type: Optional[str] = None,
                        tractor_no: Optional[str] = None,
                        work_type: Optional[str] = None) -> Dict:
        records = self.db.query_work_records(
            operator=operator,
            start_date=start_date,
            end_date=end_date,
            status=status,
            exception_type=exception_type,
            tractor_no=tractor_no,
            work_type=work_type
        )

        if not records:
            return {
                'success': False,
                'error': '没有符合条件的记录'
            }

        data = []
        for r in records:
            data.append({
                '记录编号': r.record_no,
                '拖拉机号': r.tractor_no,
                '机手': r.operator,
                '作业日期': r.work_date,
                '作业类型': r.work_type,
                '计费类型': r.billing_type,
                '小时数': r.hours if r.hours else '',
                '小时单价': r.hourly_rate if r.hourly_rate else '',
                '亩数': r.area if r.area else '',
                '亩单价': r.area_rate if r.area_rate else '',
                '油耗(升)': r.fuel_consumption if r.fuel_consumption else '',
                '油价(元/升)': r.fuel_price if r.fuel_price else '',
                '总金额': r.total_amount,
                '状态': r.status,
                '复核人': r.reviewer if r.reviewer else '',
                '复核时间': r.review_time if r.review_time else '',
                '复核意见': r.review_comment if r.review_comment else '',
                '异常类型': r.exception_type if r.exception_type else '',
                '异常详情': r.exception_detail if r.exception_detail else '',
                '创建时间': r.created_at,
                '导入批次': r.import_batch_id if r.import_batch_id else ''
            })

        df = pd.DataFrame(data)
        df.to_excel(output_path, index=False)

        for r in records:
            if r.status != RecordStatus.EXPORTED.value:
                r.status = RecordStatus.EXPORTED.value
                r.updated_at = datetime.now().isoformat()
                self.db.update_work_record(r)

        total_amount = sum(r.total_amount for r in records)

        return {
            'success': True,
            'export_path': output_path,
            'summary': {
                'record_count': len(records),
                'total_amount': total_amount,
                'query_criteria': {
                    'operator': operator,
                    'start_date': start_date,
                    'end_date': end_date,
                    'status': status,
                    'exception_type': exception_type,
                    'tractor_no': tractor_no,
                    'work_type': work_type
                }
            }
        }

    def export_batch_summary(self, batch_id: str, output_path: str) -> Dict:
        batch = self.db.get_import_batch(batch_id)
        if not batch:
            return {
                'success': False,
                'error': '批次不存在'
            }

        results = self.db.get_import_results(batch_id)
        records = self.db.query_work_records()
        batch_records = [r for r in records if r.import_batch_id == batch_id]

        data = []
        for r in batch_records:
            result = next((res for res in results if res.record_no == r.record_no), None)
            data.append({
                '记录编号': r.record_no,
                '拖拉机号': r.tractor_no,
                '机手': r.operator,
                '作业日期': r.work_date,
                '作业类型': r.work_type,
                '计费类型': r.billing_type,
                '总金额': r.total_amount,
                '状态': r.status,
                '导入状态': '成功' if (result and result.success) else '失败',
                '异常类型': r.exception_type if r.exception_type else '',
                '异常详情': r.exception_detail if r.exception_detail else ''
            })

        df = pd.DataFrame(data)
        df.to_excel(output_path, index=False)

        return {
            'success': True,
            'export_path': output_path,
            'summary': {
                'batch_id': batch_id,
                'file_name': batch.file_name,
                'total_count': batch.total_count,
                'success_count': batch.success_count,
                'failed_count': batch.failed_count,
                'exported_count': len(batch_records)
            }
        }
