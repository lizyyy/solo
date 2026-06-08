import csv
import json
import os
import sys
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


class MarginDataProcessor:
    def __init__(self, data_file=None):
        self.data_file = data_file or os.path.join(config.RAW_DATA_DIR, 'broker_margin_data.csv')
        self.records = []
        self.history = []
        self.load_data()

    def load_data(self):
        self.records = []
        with open(self.data_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                row['_status'] = config.REVIEW_STATUS['PENDING']
                principal = float(row['融资本金'])
                tax = float(row['印花税'])
                if principal > 0:
                    calculated_rate = tax / principal
                    if abs(calculated_rate - config.TAX_RATE_OLD) < 0.00001:
                        row['_tax_rate_used'] = config.TAX_RATE_OLD
                    elif abs(calculated_rate - config.TAX_RATE_NEW) < 0.00001:
                        row['_tax_rate_used'] = config.TAX_RATE_NEW
                    else:
                        row['_tax_rate_used'] = config.TAX_RATE_NEW
                else:
                    row['_tax_rate_used'] = config.TAX_RATE_NEW
                row['_history'] = []
                self.records.append(row)
        self._log_operation(f'加载数据文件: {os.path.basename(self.data_file)}, 共{len(self.records)}条记录')

    def group_by_biz_id(self):
        groups = defaultdict(list)
        for record in self.records:
            groups[record['业务号']].append(record)
        return groups

    def detect_split_records(self):
        groups = self.group_by_biz_id()
        split_biz = []
        for biz_id, records in groups.items():
            if len(records) > 1:
                has_principal = any(float(r['融资本金']) > 0 for r in records)
                has_fee_only = any(float(r['融资本金']) == 0 and float(r['手续费']) > 0 for r in records)
                if has_principal and has_fee_only:
                    split_biz.append(biz_id)
                    for r in records:
                        r['_status'] = config.REVIEW_STATUS['SPLIT_REVIEW']
                        r['_history'].append({
                            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            'action': '检测拆分行',
                            'operator': '系统',
                            'remark': f'同一业务号拆成{len(records)}行，留待主管复核'
                        })
                    self._log_operation(f'检测到拆行业务: {biz_id}, 共{len(records)}行，已标记待主管复核')
        return split_biz

    def detect_tax_rate_issue(self, supplement_file=None):
        supplement_file = supplement_file or os.path.join(config.RAW_DATA_DIR, 'supplement_data.json')
        if not os.path.exists(supplement_file):
            return []

        with open(supplement_file, 'r', encoding='utf-8') as f:
            supplement_data = json.load(f)

        corrected_biz = []
        for sup in supplement_data.get('supplemented_biz', []):
            biz_id = sup['biz_id']
            for record in self.records:
                if record['业务号'] == biz_id:
                    old_tax = float(record['印花税'])
                    new_tax = sup['corrected_tax']
                    old_rate = record['_tax_rate_used']
                    new_rate = sup['corrected_tax_rate']

                    if old_tax != new_tax:
                        record['印花税'] = f"{new_tax:.2f}"
                        record['_tax_rate_used'] = new_rate
                        record['_status'] = config.REVIEW_STATUS['SUPPLEMENTED']
                        old_calc = sup.get('original_calculation', f'{old_tax:.2f}')
                        new_calc = sup.get('corrected_calculation', f'{new_tax:.2f}')
                        old_rate_label = sup.get('original_tax_rate_label', f'{old_rate*100:.4}%')
                        new_rate_label = sup.get('corrected_tax_rate_label', f'{new_rate*100:.4}%')
                        record['_history'].append({
                            'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            'action': '税费率补录修正',
                            'operator': '小周',
                            'old_value': f'印花税{old_tax:.2f}(税率{old_rate_label}, {old_calc})',
                            'new_value': f'印花税{new_tax:.2f}(税率{new_rate_label}, {new_calc})',
                            'diff': f'{new_tax - old_tax:+.2f}',
                            'remark': sup['remark']
                        })
                        corrected_biz.append(biz_id)
                        self._log_operation(
                            f'税费率修正: {biz_id} 印花税 {old_tax:.2f}({old_calc}) → {new_tax:.2f}({new_calc}) '
                            f'(税率 {old_rate_label} → {new_rate_label})'
                        )
        return corrected_biz

    def apply_manual_correction(self, supplement_file=None):
        supplement_file = supplement_file or os.path.join(config.RAW_DATA_DIR, 'supplement_data.json')
        if not os.path.exists(supplement_file):
            return []

        with open(supplement_file, 'r', encoding='utf-8') as f:
            supplement_data = json.load(f)

        corrections = []
        for corr in supplement_data.get('manual_corrections', []):
            biz_id = corr['biz_id']
            for record in self.records:
                if record['业务号'] == biz_id:
                    if corr['field'] == 'review_status':
                        record['_status'] = corr['new_value']
                    record['_history'].append({
                        'time': corr['timestamp'],
                        'action': corr['correction_type'],
                        'operator': corr['operator'],
                        'old_value': corr['old_value'],
                        'new_value': corr['new_value'],
                        'remark': corr['remark']
                    })
                    corrections.append(corr)
                    self._log_operation(
                        f'人工修正: {biz_id} {corr["field"]} '
                        f'{corr["old_value"]} → {corr["new_value"]}'
                    )
        return corrections

    def mark_normal_records(self):
        groups = self.group_by_biz_id()
        normal_count = 0
        for biz_id, records in groups.items():
            if len(records) == 1 and records[0]['_status'] == config.REVIEW_STATUS['PENDING']:
                for r in records:
                    r['_status'] = config.REVIEW_STATUS['NORMAL']
                    r['_history'].append({
                        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        'action': '正常处理完成',
                        'operator': '系统',
                        'remark': '数据校验通过，无异常'
                    })
                normal_count += 1
                self._log_operation(f'正常记录: {biz_id} 标记为正常')
        return normal_count

    def save_processed_data(self, output_file=None):
        output_file = output_file or os.path.join(
            config.PROCESSED_DATA_DIR,
            f'processed_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        )

        fieldnames = [
            '业务日期', '业务号', '证券代码', '证券名称', '维护比例',
            '融资本金', '融资利息', '手续费', '印花税', '过户费',
            '操作员', '备注', '_状态', '_使用税率', '_历史记录'
        ]

        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in self.records:
                row = {
                    '业务日期': record['业务日期'],
                    '业务号': record['业务号'],
                    '证券代码': record['证券代码'],
                    '证券名称': record['证券名称'],
                    '维护比例': record['维护比例'],
                    '融资本金': record['融资本金'],
                    '融资利息': record['融资利息'],
                    '手续费': record['手续费'],
                    '印花税': record['印花税'],
                    '过户费': record['过户费'],
                    '操作员': record['操作员'],
                    '备注': record['备注'],
                    '_状态': record['_status'],
                    '_使用税率': f"{record['_tax_rate_used']*100:.4}%",
                    '_历史记录': json.dumps(record['_history'], ensure_ascii=False)
                }
                writer.writerow(row)

        self._log_operation(f'处理结果已保存至: {os.path.basename(output_file)}')
        return output_file

    def _log_operation(self, message):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f'[{timestamp}] {message}'
        self.history.append(log_entry)
        print(log_entry)

    def get_summary(self):
        groups = self.group_by_biz_id()
        summary = {
            'total_records': len(self.records),
            'total_biz': len(groups),
            'normal': 0,
            'split_review': 0,
            'supplemented': 0,
            'pending': 0,
            'details': []
        }

        for biz_id, records in groups.items():
            status = records[0]['_status']
            if status == config.REVIEW_STATUS['NORMAL']:
                summary['normal'] += 1
            elif status == config.REVIEW_STATUS['SPLIT_REVIEW']:
                summary['split_review'] += 1
            elif status == config.REVIEW_STATUS['SUPPLEMENTED']:
                summary['supplemented'] += 1
            else:
                summary['pending'] += 1

            total_principal = sum(float(r['融资本金']) for r in records)
            total_fee = sum(float(r['手续费']) for r in records)
            total_tax = sum(float(r['印花税']) for r in records)

            summary['details'].append({
                'biz_id': biz_id,
                'line_count': len(records),
                'status': status,
                'total_principal': total_principal,
                'total_fee': total_fee,
                'total_tax': total_tax,
                'tax_rate_used': records[0]['_tax_rate_used'],
                'history_records': len(records[0]['_history'])
            })

        return summary
