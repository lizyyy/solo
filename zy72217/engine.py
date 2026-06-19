import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from models import (
    AdjustmentEntry, ProcessingStatus, AbnormalType, EntrySource,
    PositionGapWarning, CustodianConfirmation
)
from store import store


class SelfCheckEngine:
    @staticmethod
    def check_duplicate_import(file_name: str, warning_id: str) -> Dict[str, Any]:
        is_duplicate = store.is_duplicate_import(file_name, warning_id)
        return {
            'check_name': '重复导入检测',
            'passed': not is_duplicate,
            'message': f'{file_name} 已导入过，本次未写入明细' if is_duplicate else '无重复导入',
            'level': 'error' if is_duplicate else 'info'
        }

    @staticmethod
    def check_mixed_currency(amount_str: str) -> Tuple[bool, Optional[str], Optional[float], Optional[str]]:
        if not amount_str or not isinstance(amount_str, str):
            return False, None, None, None

        amount_str = amount_str.strip()
        currency_pattern = r'(HKD|HK\$|RMB|CNY|¥|\$)'
        currencies = re.findall(currency_pattern, amount_str)

        if len(set(currencies)) > 1:
            number_pattern = r'[\d,]+\.?\d*'
            numbers = re.findall(number_pattern, amount_str)
            if numbers:
                try:
                    main_amount = float(numbers[0].replace(',', ''))
                    return True, amount_str, main_amount, '混合币种'
                except (ValueError, IndexError):
                    pass
            return True, amount_str, None, '混合币种'

        return False, None, None, None

    @staticmethod
    def check_single_row_mixed_currency(row_data: Dict[str, Any]) -> Dict[str, Any]:
        amount_fields = ['amount', '金额', '发生额', '余额', '头寸']
        mixed_found = False
        mixed_details = []

        for field in amount_fields:
            if field in row_data and row_data[field]:
                is_mixed, raw_value, amount, note = SelfCheckEngine.check_mixed_currency(str(row_data[field]))
                if is_mixed:
                    mixed_found = True
                    mixed_details.append({
                        'field': field,
                        'raw_value': raw_value,
                        'parsed_amount': amount,
                        'note': note
                    })

        return {
            'check_name': '币种同列检测',
            'passed': not mixed_found,
            'message': '存在港币/人民币混合同列' if mixed_found else '币种格式正常',
            'details': mixed_details,
            'level': 'warning' if mixed_found else 'info'
        }

    @staticmethod
    def check_export_consistency(warning: PositionGapWarning) -> Dict[str, Any]:
        export_data = PositionGapService.get_export_data(warning.id)
        page_data = PositionGapService.get_page_display_data(warning.id)
        api_data = PositionGapService.get_api_response_data(warning.id)

        entry_count_match = (
            len(export_data.get('entries', [])) ==
            len(page_data.get('entries', [])) ==
            len(api_data.get('entries', []))
        )

        abnormal_match = (
            export_data.get('abnormal_count', 0) ==
            page_data.get('abnormal_count', 0) ==
            api_data.get('abnormal_count', 0)
        )

        return {
            'check_name': '导出一致性校验',
            'passed': entry_count_match and abnormal_match,
            'message': '数据一致' if (entry_count_match and abnormal_match) else '导出/页面/接口数据不一致',
            'details': {
                'export_entries': len(export_data.get('entries', [])),
                'page_entries': len(page_data.get('entries', [])),
                'api_entries': len(api_data.get('entries', []))
            },
            'level': 'error' if not (entry_count_match and abnormal_match) else 'info'
        }

    @staticmethod
    def run_all_checks(warning: PositionGapWarning, file_name: str = None, include_duplicate_check: bool = False) -> List[Dict[str, Any]]:
        results = []

        if include_duplicate_check:
            for record in store._import_history:
                if record['warning_id'] == warning.id:
                    count = sum(
                        1 for r in store._import_history
                        if r['file_name'] == record['file_name'] and r['warning_id'] == warning.id
                    )
                    if count > 1:
                        results.append({
                            'check_name': '重复导入检测',
                            'passed': False,
                            'message': f'文件 {record["file_name"]} 被导入了 {count} 次',
                            'level': 'error'
                        })
                        break
            if not any(r['check_name'] == '重复导入检测' for r in results):
                results.append({
                    'check_name': '重复导入检测',
                    'passed': True,
                    'message': '无重复导入',
                    'level': 'info'
                })

        for entry in warning.entries:
            if AbnormalType.MIXED_CURRENCY in entry.abnormal_types:
                row_check = SelfCheckEngine.check_single_row_mixed_currency(entry.raw_import_data)
                if not row_check['passed']:
                    results.append({
                        **row_check,
                        'entry_id': entry.id,
                        'row_number': entry.original_row_number
                    })

        results.append(SelfCheckEngine.check_export_consistency(warning))

        warning.self_check_results = results
        store.update_warning(warning)

        return results


class PositionGapService:
    @staticmethod
    def parse_amount(amount_str: Any) -> Tuple[float, str, Optional[str]]:
        if isinstance(amount_str, (int, float)):
            return float(amount_str), 'CNY', None

        if not amount_str:
            return 0.0, 'CNY', None

        amount_str = str(amount_str).strip()

        is_mixed, raw_value, parsed_amount, note = SelfCheckEngine.check_mixed_currency(amount_str)
        if is_mixed:
            return parsed_amount or 0.0, 'MIXED', raw_value

        currency = 'CNY'
        clean_amount = amount_str

        if 'HKD' in amount_str.upper() or 'HK$' in amount_str:
            currency = 'HKD'
            clean_amount = re.sub(r'(HKD|HK\$)', '', amount_str, flags=re.IGNORECASE)
        elif '¥' in amount_str or 'CNY' in amount_str.upper() or 'RMB' in amount_str.upper():
            currency = 'CNY'
            clean_amount = re.sub(r'(¥|CNY|RMB)', '', amount_str, flags=re.IGNORECASE)

        clean_amount = clean_amount.replace(',', '').replace('$', '').strip()

        try:
            return float(clean_amount) if clean_amount else 0.0, currency, None
        except ValueError:
            return 0.0, currency, None

    @staticmethod
    def import_adjustment_entries(warning_id: str, rows: List[Dict[str, Any]], file_name: str) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {'success': False, 'message': '预警记录不存在'}

        duplicate_check = SelfCheckEngine.check_duplicate_import(file_name, warning_id)
        if not duplicate_check['passed']:
            return {
                'success': False,
                'message': duplicate_check['message'],
                'check_result': duplicate_check
            }

        imported_entries = []
        abnormal_entries = []

        for idx, row in enumerate(rows, start=1):
            security_code = str(row.get('security_code', row.get('证券代码', f'UNKNOWN-{idx}')))
            security_name = str(row.get('security_name', row.get('证券名称', '未知证券')))
            raw_amount = row.get('amount', row.get('金额', '0'))

            amount, currency, mixed_note = PositionGapService.parse_amount(raw_amount)

            entry = AdjustmentEntry(
                id=str(uuid.uuid4()),
                original_row_number=idx,
                security_code=security_code,
                security_name=security_name,
                original_amount=amount,
                original_currency=currency,
                raw_import_data=row
            )

            if currency == 'MIXED':
                entry.abnormal_types.append(AbnormalType.MIXED_CURRENCY)
                entry.mixed_currency_note = mixed_note
                entry.current_status = ProcessingStatus.NEEDS_REVIEW
                abnormal_entries.append(entry)
            else:
                entry.current_status = ProcessingStatus.IMPORTED

            store.add_audit_trail(entry, '系统', '导入尾差调整条',
                                  before_value=None,
                                  after_value=f'金额: {amount} {currency}')

            imported_entries.append(entry)
            store.add_adjustment_entry(warning_id, entry)

        store.record_import(file_name, len(rows), warning_id)
        warning.status = ProcessingStatus.IMPORTED
        store.update_warning(warning)

        SelfCheckEngine.run_all_checks(warning)

        return {
            'success': True,
            'message': f'成功导入 {len(imported_entries)} 条记录',
            'imported_count': len(imported_entries),
            'abnormal_count': len(abnormal_entries),
            'abnormal_entries': abnormal_entries
        }

    @staticmethod
    def apply_manual_adjustment(entry_id: str, warning_id: str, operator: str,
                                adjustment_amount: float, remark: str = None) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {'success': False, 'message': '预警记录不存在'}

        entry = next((e for e in warning.entries if e.id == entry_id), None)
        if not entry:
            return {'success': False, 'message': '调整记录不存在'}

        before_amount = entry.adjusted_amount if entry.adjusted_amount is not None else entry.original_amount
        entry.manual_adjustment = adjustment_amount
        entry.adjusted_amount = entry.original_amount + adjustment_amount

        store.add_audit_trail(entry, operator, '人工调整尾差',
                              before_value=f'{before_amount} {entry.original_currency}',
                              after_value=f'{entry.adjusted_amount} {entry.original_currency}',
                              remark=remark)

        store.update_warning(warning)

        return {
            'success': True,
            'message': '调整已应用',
            'original_amount': entry.original_amount,
            'adjustment': adjustment_amount,
            'final_amount': entry.adjusted_amount
        }

    @staticmethod
    def custodian_confirm(entry_id: str, warning_id: str, custodian_operator: str,
                          confirmed_amount: float, confirmed_currency: str,
                          remark: str = None, is_correction: bool = False) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {'success': False, 'message': '预警记录不存在'}

        entry = next((e for e in warning.entries if e.id == entry_id), None)
        if not entry:
            return {'success': False, 'message': '调整记录不存在'}

        confirmation = CustodianConfirmation(
            id=str(uuid.uuid4()),
            adjustment_id=entry_id,
            custodian_operator=custodian_operator,
            confirm_time=datetime.now(),
            confirmed_amount=confirmed_amount,
            confirmed_currency=confirmed_currency,
            remark=remark,
            is_manual_correction=is_correction
        )

        warning.custodian_confirmations.append(confirmation)

        if AbnormalType.MIXED_CURRENCY in entry.abnormal_types and is_correction:
            entry.original_currency = confirmed_currency
            entry.original_amount = confirmed_amount
            entry.abnormal_types.remove(AbnormalType.MIXED_CURRENCY)
            if not entry.abnormal_types:
                entry.current_status = ProcessingStatus.CUSTODIAN_CONFIRMED

        store.add_audit_trail(entry, custodian_operator, '托管确认',
                              before_value=f'{entry.original_amount} {entry.original_currency}',
                              after_value=f'{confirmed_amount} {confirmed_currency}',
                              remark=remark)

        store.update_warning(warning)

        return {
            'success': True,
            'message': '托管确认已记录',
            'confirmation_id': confirmation.id
        }

    @staticmethod
    def update_audit_details(warning_id: str, operator: str) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {'success': False, 'message': '预警记录不存在'}

        updated_count = 0
        for entry in warning.entries:
            if entry.current_status == ProcessingStatus.CUSTODIAN_CONFIRMED:
                old_status = entry.current_status
                entry.current_status = ProcessingStatus.AUDIT_UPDATED
                store.add_audit_trail(entry, operator, '审计明细更新',
                                      before_value=old_status,
                                      after_value=ProcessingStatus.AUDIT_UPDATED)
                updated_count += 1

        warning.status = ProcessingStatus.AUDIT_UPDATED
        store.update_warning(warning)

        SelfCheckEngine.check_export_consistency(warning)

        return {
            'success': True,
            'message': f'审计明细已更新，涉及 {updated_count} 条记录',
            'updated_count': updated_count
        }

    @staticmethod
    def supplement_entries(warning_id: str, rows: List[Dict[str, Any]], operator: str,
                           remark: str = None) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {'success': False, 'message': '预警记录不存在'}

        if warning.status == ProcessingStatus.PENDING:
            return {'success': False, 'message': '请先完成首次导入，再进行补录'}

        batch_id = str(uuid.uuid4())
        max_row = max((e.original_row_number for e in warning.entries), default=0)
        supplemented_entries = []
        abnormal_entries = []

        for idx, row in enumerate(rows, start=1):
            row_number = max_row + idx
            security_code = str(row.get('security_code', row.get('证券代码', f'SUPP-{idx}')))
            security_name = str(row.get('security_name', row.get('证券名称', '补录证券')))
            raw_amount = row.get('amount', row.get('金额', '0'))

            amount, currency, mixed_note = PositionGapService.parse_amount(raw_amount)

            entry = AdjustmentEntry(
                id=str(uuid.uuid4()),
                original_row_number=row_number,
                security_code=security_code,
                security_name=security_name,
                original_amount=amount,
                original_currency=currency,
                raw_import_data=row,
                source=EntrySource.SUPPLEMENT,
                supplement_batch_id=batch_id
            )

            if currency == 'MIXED':
                entry.abnormal_types.append(AbnormalType.MIXED_CURRENCY)
                entry.mixed_currency_note = mixed_note
                entry.current_status = ProcessingStatus.NEEDS_REVIEW
                abnormal_entries.append(entry)
            else:
                entry.current_status = ProcessingStatus.IMPORTED

            store.add_audit_trail(entry, operator, '补录尾差调整条',
                                  before_value=None,
                                  after_value=f'金额: {amount} {currency}',
                                  remark=remark)

            supplemented_entries.append(entry)
            store.add_adjustment_entry(warning_id, entry)

        store.update_warning(warning)

        SelfCheckEngine.run_all_checks(warning)

        return {
            'success': True,
            'message': f'补录 {len(supplemented_entries)} 条记录，异常 {len(abnormal_entries)} 条',
            'supplemented_count': len(supplemented_entries),
            'abnormal_count': len(abnormal_entries),
            'batch_id': batch_id
        }

    @staticmethod
    def recalculate(warning_id: str, operator: str) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {'success': False, 'message': '预警记录不存在'}

        before_gap = warning.total_gap_amount
        before_abnormal = sum(1 for e in warning.entries if e.abnormal_types)

        recalculated_count = 0
        for entry in warning.entries:
            if entry.manual_adjustment is not None and entry.adjusted_amount != entry.original_amount + entry.manual_adjustment:
                old_adjusted = entry.adjusted_amount
                entry.adjusted_amount = entry.original_amount + entry.manual_adjustment
                store.add_audit_trail(entry, operator, '重算调整后金额',
                                      before_value=str(old_adjusted),
                                      after_value=str(entry.adjusted_amount))
                recalculated_count += 1
            elif entry.manual_adjustment is not None and entry.adjusted_amount is None:
                entry.adjusted_amount = entry.original_amount + entry.manual_adjustment
                recalculated_count += 1

        total_gap = 0.0
        for entry in warning.entries:
            effective_amount = entry.adjusted_amount if entry.adjusted_amount is not None else entry.original_amount
            total_gap += effective_amount

        warning.total_gap_amount = total_gap
        warning.last_recalculate_time = datetime.now().isoformat()
        after_abnormal = sum(1 for e in warning.entries if e.abnormal_types)

        store.add_audit_trail(
            warning.entries[0] if warning.entries else AdjustmentEntry(
                id='recalc', original_row_number=0, security_code='N/A',
                security_name='N/A', original_amount=0, original_currency='CNY'
            ),
            operator, '重算',
            before_value=f'缺口总额: {before_gap}, 异常数: {before_abnormal}',
            after_value=f'缺口总额: {total_gap}, 异常数: {after_abnormal}, 重算条目: {recalculated_count}'
        )

        store.update_warning(warning)

        SelfCheckEngine.run_all_checks(warning, include_duplicate_check=True)

        export_data = PositionGapService.get_export_data(warning.id)
        page_data = PositionGapService.get_page_display_data(warning.id)
        api_data = PositionGapService.get_api_response_data(warning.id)
        consistency_ok = (
            len(export_data.get('entries', [])) == len(page_data.get('entries', [])) == len(api_data.get('entries', []))
            and export_data.get('abnormal_count', 0) == page_data.get('abnormal_count', 0) == api_data.get('abnormal_count', 0)
            and export_data.get('total_entries', 0) == page_data.get('total_entries', 0) == api_data.get('total_entries', 0)
        )

        return {
            'success': True,
            'message': f'重算完成，修正 {recalculated_count} 条，缺口总额 {before_gap} → {total_gap}',
            'recalculated_count': recalculated_count,
            'before_gap': before_gap,
            'after_gap': total_gap,
            'before_abnormal': before_abnormal,
            'after_abnormal': after_abnormal,
            'consistency_ok': consistency_ok,
            'total_entries': len(warning.entries)
        }

    @staticmethod
    def _serialize_entry(entry: AdjustmentEntry) -> Dict[str, Any]:
        return {
            'id': entry.id,
            'original_row_number': entry.original_row_number,
            'security_code': entry.security_code,
            'security_name': entry.security_name,
            'original_amount': entry.original_amount,
            'original_currency': entry.original_currency,
            'manual_adjustment': entry.manual_adjustment,
            'adjusted_amount': entry.adjusted_amount,
            'current_status': entry.current_status,
            'abnormal_types': [t for t in entry.abnormal_types],
            'mixed_currency_note': entry.mixed_currency_note,
            'custodian_note': entry.custodian_note,
            'source': entry.source,
            'supplement_batch_id': entry.supplement_batch_id,
            'audit_trails': [
                {
                    'timestamp': t.timestamp.isoformat(),
                    'operator': t.operator,
                    'action': t.action,
                    'before_value': t.before_value,
                    'after_value': t.after_value,
                    'remark': t.remark
                }
                for t in entry.audit_trails
            ]
        }

    @staticmethod
    def get_export_data(warning_id: str) -> Dict[str, Any]:
        warning = store.get_warning(warning_id)
        if not warning:
            return {}

        entries = [PositionGapService._serialize_entry(e) for e in warning.entries]
        abnormal_count = sum(1 for e in warning.entries if e.abnormal_types)

        return {
            'warning_id': warning.id,
            'report_date': warning.report_date,
            'fund_code': warning.fund_code,
            'fund_name': warning.fund_name,
            'entries': entries,
            'total_entries': len(entries),
            'abnormal_count': abnormal_count,
            'total_gap_amount': warning.total_gap_amount,
            'last_recalculate_time': warning.last_recalculate_time,
            'export_time': datetime.now().isoformat()
        }

    @staticmethod
    def get_page_display_data(warning_id: str) -> Dict[str, Any]:
        return PositionGapService.get_export_data(warning_id)

    @staticmethod
    def get_api_response_data(warning_id: str) -> Dict[str, Any]:
        return PositionGapService.get_export_data(warning_id)
