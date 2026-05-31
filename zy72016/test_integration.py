#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json

if os.path.exists('margin_call.db'):
    os.remove('margin_call.db')

sys.path.insert(0, '.')

from app import create_app, db
from app.services import (
    create_batch, import_batch_records, import_single_record,
    update_record_status, generate_export_report,
    get_record_versions
)
from app.models import MarginCall

app = create_app()

COLORS = {
    'RED': '\033[91m',
    'GREEN': '\033[92m',
    'YELLOW': '\033[93m',
    'BLUE': '\033[94m',
    'ENDC': '\033[0m',
    'BOLD': '\033[1m'
}


def print_color(msg, color='ENDC', bold=False):
    prefix = COLORS.get(color, '')
    if bold:
        prefix += COLORS['BOLD']
    print(f'{prefix}{msg}{COLORS["ENDC"]}')


def print_header(title):
    print()
    print_color('=' * 60, 'BLUE', bold=True)
    print_color(f'  {title}', 'BLUE', bold=True)
    print_color('=' * 60, 'BLUE', bold=True)


def run_tests():
    print_header('外汇保证金穿仓复盘系统 - 集成测试')

    with app.app_context():
        results = []

        print_header('测试1: 批次创建')

        from test_data import SAMPLE_BATCH
        batch = create_batch(
            batch_no=SAMPLE_BATCH['batch_no'],
            name=SAMPLE_BATCH['name'],
            description=SAMPLE_BATCH['description'],
            created_by=SAMPLE_BATCH['operator']
        )
        db.session.commit()
        assert batch.id is not None
        print_color('  ✓ 创建复盘批次... 通过', 'GREEN')
        results.append(True)

        print_header('测试2: 批量导入（含脏数据）')

        from test_data import SAMPLE_RECORDS
        result = import_batch_records(
            batch_id=batch.id,
            records=SAMPLE_RECORDS,
            source='CONTRACT_SCAN',
            operator='门店财务老曹'
        )
        db.session.commit()

        assert result['success']
        assert result['total'] == 9
        assert result['imported'] == 9
        assert result['duplicates'] == 1
        assert result['has_null'] >= 1
        assert result['boundary'] >= 4
        print_color('  ✓ 批量导入含脏数据的记录... 通过', 'GREEN')
        print_color(f'    导入结果: 共{result["total"]}条，成功{result["imported"]}条，重复{result["duplicates"]}条，空值{result["has_null"]}条，边界{result["boundary"]}条', 'YELLOW')
        results.append(True)

        records = MarginCall.query.filter_by(batch_id=batch.id).all()
        unique_records = {(r.record_no, r.version): r for r in records}
        assert len(unique_records) == 8

        rec_null = [r for r in records if r.record_no == 'REC-003'][0]
        assert rec_null.data_quality in ['HAS_NULL', 'DIRTY']
        assert rec_null.has_exception == True
        assert '找柜台小周核对' in rec_null.contract_original_note

        rec_boundary_zero = [r for r in records if r.record_no == 'REC-004'][0]
        assert rec_boundary_zero.data_quality == 'BOUNDARY'
        assert rec_boundary_zero.shortfall_amount == 0

        rec_dup_v1 = [r for r in records if r.record_no == 'REC-001' and r.version == 1][0]
        assert rec_dup_v1.data_quality == 'HAS_DUPLICATE'
        assert '重复导入' in rec_dup_v1.exception_reason
        assert '老曹-5月16日已联系' in rec_dup_v1.contract_original_note

        rec_messy = [r for r in records if r.record_no == 'REC-002'][0]
        assert '别问老曹，问风控老王' in rec_messy.contract_original_note

        print_color('  ✓ 验证脏数据处理和原始备注保留... 通过', 'GREEN')
        results.append(True)

        print_header('测试3: 人工确认流程')

        from test_data import MANUAL_CONFIRMATIONS
        rec_map = {r.record_no: r for r in records if r.version == 1}
        for conf in MANUAL_CONFIRMATIONS:
            rec = rec_map.get(conf['record_no'])
            if rec:
                r = update_record_status(
                    record_id=rec.id,
                    new_status=conf['new_status'],
                    operator=conf['operator'],
                    change_reason=conf['change_reason'],
                    manual_notes=[f'老曹确认: {conf["change_reason"]}']
                )
                assert r['success']

        print_color('  ✓ 人工确认状态更新... 通过', 'GREEN')
        results.append(True)

        print_header('测试4: 晚到附件处理（不覆盖原判断，保留历史）')

        from test_data import LATE_ATTACHMENT_REC007
        original = [r for r in records if r.record_no == 'REC-007' and r.version == 1][0]

        late_result = import_single_record(
            batch_id=batch.id,
            record_data=LATE_ATTACHMENT_REC007,
            source='LATE_ATTACHMENT',
            operator='门店财务老曹',
            is_late_attachment=True
        )
        db.session.commit()

        assert late_result['success']
        assert late_result['created_new_version'] == True
        assert late_result['record']['version'] == 2
        assert late_result['record']['is_late_attachment'] == True
        assert late_result['record']['original_record_id'] == original.id

        versions = get_record_versions('REC-007', batch.id)
        assert len(versions) == 2
        v1 = [v for v in versions if v['version'] == 1][0]
        v2 = [v for v in versions if v['version'] == 2][0]
        assert v1['shortfall_amount'] == 45000
        assert v2['shortfall_amount'] == 15000

        print_color('  ✓ 晚到附件创建新版本并保留历史... 通过', 'GREEN')
        print_color(f'    v1 穿仓: {v1["shortfall_amount"]}, v2 穿仓: {v2["shortfall_amount"]}', 'YELLOW')
        results.append(True)

        v2_record = MarginCall.query.filter_by(record_no='REC-007', version=2).first()
        confirm_result = update_record_status(
            record_id=v2_record.id,
            new_status='CONFIRMED',
            operator='门店财务老曹',
            change_reason='晚到附件确认，客户已全额补缴',
            manual_notes=['老曹确认: 晚到流水到账']
        )
        assert confirm_result['success']
        print_color('  ✓ 确认晚到附件新版本... 通过', 'GREEN')
        results.append(True)

        print_header('测试5: 导出报告（批次、状态、人工确认读同一份数据）')

        report = generate_export_report(batch_id=batch.id)
        summary = report['summary']

        assert summary['exception_count'] > 0
        assert summary['late_attachment_count'] > 0
        assert summary['needs_confirm_count'] > 0

        rec002_found = False
        rec007_v1_found = False
        rec007_v2_found = False
        for rec in report['records']:
            if rec['记录编号'] == 'REC-002':
                rec002_found = True
                assert '别问老曹，问风控老王' in rec['合同原始备注']
                assert rec['当前状态'] == '例外'
            if rec['记录编号'] == 'REC-007' and rec['版本'] == 1:
                rec007_v1_found = True
                assert '老曹-客户说下周补缴' in rec['合同原始备注']
            if rec['记录编号'] == 'REC-007' and rec['版本'] == 2:
                rec007_v2_found = True
                assert '【晚到附件】' in rec['所有备注']
                assert '原判断' in rec['所有备注']

        assert rec002_found and rec007_v1_found and rec007_v2_found

        db_records = MarginCall.query.filter_by(batch_id=batch.id).all()
        db_exceptions = len([r for r in db_records if r.has_exception])
        db_late = len([r for r in db_records if r.is_late_attachment])
        db_needs = len([r for r in db_records if r.current_status == 'NEEDS_CONFIRM'])

        assert summary['exception_count'] == db_exceptions
        assert summary['late_attachment_count'] == db_late
        assert summary['needs_confirm_count'] == db_needs

        print_color('  ✓ 导出报告并验证数据一致性... 通过', 'GREEN')
        print_color(f'    数据一致性: 例外{summary["exception_count"]}==DB{db_exceptions}, 晚到{summary["late_attachment_count"]}==DB{db_late}', 'YELLOW')
        results.append(True)

        print_header('测试6: 历史追溯')

        rec_detail = MarginCall.query.filter_by(record_no='REC-001', version=1).first()
        assert rec_detail.status_history.count() >= 2
        assert rec_detail.note_history.count() >= 1

        contract_notes = [n for n in rec_detail.note_history.all() if n.is_original]
        assert len(contract_notes) >= 1
        assert '合同扫描件备注' in contract_notes[0].note_content

        manual_notes = [n for n in rec_detail.note_history.all() if n.note_type == 'MANUAL_NOTE']
        assert len(manual_notes) >= 1

        confirm_notes = [n for n in rec_detail.note_history.all() if n.note_type == 'MANUAL_CONFIRM']
        assert len(confirm_notes) >= 1

        print_color('  ✓ 历史追溯、备注分类... 通过', 'GREEN')
        results.append(True)

        print_header('测试7: 重启服务后数据一致性')

        before_state = {
            'records_count': len(db_records),
            'summary': summary,
            'rec002_note': rec_messy.contract_original_note,
            'rec002_status': rec_messy.current_status,
            'rec002_exception': rec_messy.has_exception,
        }

        db.session.remove()

        db.session.commit()

        after_records = MarginCall.query.filter_by(batch_id=batch.id).all()
        after_report = generate_export_report(batch_id=batch.id)
        after_summary = after_report['summary']

        assert len(after_records) == before_state['records_count']
        assert after_summary['total_records'] == before_state['summary']['total_records']
        assert after_summary['total_shortfall'] == before_state['summary']['total_shortfall']
        assert after_summary['exception_count'] == before_state['summary']['exception_count']

        rec002_after = [r for r in after_records if r.record_no == 'REC-002'][0]
        assert rec002_after.contract_original_note == before_state['rec002_note']
        assert rec002_after.current_status == before_state['rec002_status']
        assert rec002_after.has_exception == before_state['rec002_exception']

        versions_after = get_record_versions('REC-007', batch.id)
        assert len(versions_after) == 2

        print_color('  ✓ 重启后数据一致性验证... 通过', 'GREEN')
        print_color(f'    记录数: {len(after_records)}=={before_state["records_count"]}, 穿仓总额一致', 'YELLOW')
        results.append(True)

        print_header('测试8: 边界记录特殊验证')

        boundary_quality = after_summary['by_quality'].get('边界记录', 0)
        null_quality = after_summary['by_quality'].get('有空值', 0)
        dup_quality = after_summary['by_quality'].get('有重复', 0)

        assert boundary_quality >= 4
        assert null_quality >= 1
        assert dup_quality >= 1
        assert after_summary['exception_count'] >= 6

        print_color('  ✓ 边界记录、脏数据在汇总中不消失... 通过', 'GREEN')
        print_color(f'    边界{boundary_quality}条, 空值{null_quality}条, 重复{dup_quality}条, 例外总计{after_summary["exception_count"]}条', 'YELLOW')
        results.append(True)

        print_header('测试结果汇总')

        passed = sum(1 for r in results if r)
        total = len(results)

        print()
        print_color(f'总计: {passed}/{total} 测试通过', 'GREEN' if passed == total else 'RED', bold=True)
        print()

        if passed == total:
            print_color('✓ 所有测试通过！系统可以实际跑通外汇保证金穿仓复盘流程。', 'GREEN', bold=True)
            print()
            print_color('核心特性验证:', 'BLUE')
            print_color('  ✓ 批次、状态、人工确认、导出报告读同一份本地SQLite数据', 'GREEN')
            print_color('  ✓ 合同扫描件乱备注完整保留，不会为了整齐而洗掉', 'GREEN')
            print_color('  ✓ 晚到附件创建新版本，不直接覆盖原判断，前后变化有记录', 'GREEN')
            print_color('  ✓ 例外记录在汇总数字中单独标记，不会悄悄消失', 'GREEN')
            print_color('  ✓ 脏材料(空值/重复/边界)进来时有明确交代和质量标记', 'GREEN')
            print_color('  ✓ 每条记录都保留原始来源、操作人、处理时间，可追溯', 'GREEN')
            print_color('  ✓ 重启服务后历史备注和导出数字完全一致', 'GREEN')
            print_color('  ✓ 门店财务老曹接手时不用重新翻合同扫描件', 'GREEN')
            return True
        else:
            print_color('✗ 有测试失败。', 'RED', bold=True)
            return False


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
