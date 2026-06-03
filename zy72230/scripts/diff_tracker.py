import csv
import json
import os
import sys
from datetime import datetime
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


class DiffTracker:
    def __init__(self):
        self.runs = []
        self.diff_list = []

    def register_run(self, run_name, data_file, processor):
        summary = processor.get_summary()
        run_record = {
            'run_id': f"RUN{datetime.now().strftime('%Y%m%d%H%M%S')}",
            'run_name': run_name,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'data_file': os.path.basename(data_file),
            'summary': summary,
            'records': []
        }

        for record in processor.records:
            run_record['records'].append({
                '业务号': record['业务号'],
                '证券代码': record['证券代码'],
                '证券名称': record['证券名称'],
                '融资本金': float(record['融资本金']),
                '手续费': float(record['手续费']),
                '印花税': float(record['印花税']),
                '状态': record['_status'],
                '使用税率': record['_tax_rate_used'],
                '历史记录': record['_history']
            })

        self.runs.append(run_record)
        return run_record

    def compare_runs(self, run1_id=None, run2_id=None):
        if len(self.runs) < 2:
            return None

        run1 = self.runs[-2] if run1_id is None else next((r for r in self.runs if r['run_id'] == run1_id), None)
        run2 = self.runs[-1] if run2_id is None else next((r for r in self.runs if r['run_id'] == run2_id), None)

        if not run1 or not run2:
            return None

        diffs = []

        records1 = defaultdict(list)
        for r in run1['records']:
            records1[r['业务号']].append(r)

        records2 = defaultdict(list)
        for r in run2['records']:
            records2[r['业务号']].append(r)

        all_biz_ids = set(records1.keys()) | set(records2.keys())

        for biz_id in sorted(all_biz_ids):
            recs1 = records1.get(biz_id, [])
            recs2 = records2.get(biz_id, [])

            if len(recs1) != len(recs2):
                diffs.append({
                    '业务号': biz_id,
                    '差异类型': '行数差异',
                    '原值': f'{len(recs1)}行',
                    '现值': f'{len(recs2)}行',
                    '差额': None,
                    '说明': f'记录行数从{len(recs1)}变为{len(recs2)}'
                })
                continue

            for i, (r1, r2) in enumerate(zip(recs1, recs2)):
                line_tag = f"第{i+1}行" if len(recs1) > 1 else ""

                for field in ['印花税', '手续费', '融资本金']:
                    v1 = r1[field]
                    v2 = r2[field]
                    if v1 != v2:
                        diffs.append({
                            '业务号': f"{biz_id}{line_tag}",
                            '差异类型': f'{field}变更',
                            '原值': v1,
                            '现值': v2,
                            '差额': v2 - v1,
                            '说明': f'{field}从{v1:.2f}变为{v2:.2f}'
                        })

                if r1['状态'] != r2['状态']:
                    diffs.append({
                        '业务号': f"{biz_id}{line_tag}",
                        '差异类型': '状态变更',
                        '原值': r1['状态'],
                        '现值': r2['状态'],
                        '差额': None,
                        '说明': f"状态从「{r1['状态']}」变为「{r2['状态']}」"
                    })

                if r1['使用税率'] != r2['使用税率']:
                    diffs.append({
                        '业务号': f"{biz_id}{line_tag}",
                        '差异类型': '税率变更',
                        '原值': f"{r1['使用税率']*100:.4}%",
                        '现值': f"{r2['使用税率']*100:.4}%",
                        '差额': (r2['使用税率'] - r1['使用税率']) * 10000,
                        '说明': f"税率从{r1['使用税率']*100:.4}%变为{r2['使用税率']*100:.4}%"
                    })

        self.diff_list.append({
            'compare_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'run1': run1['run_name'],
            'run2': run2['run_name'],
            'diffs': diffs
        })

        return diffs

    def generate_diff_report(self, output_file=None):
        output_file = output_file or os.path.join(
            config.REPORT_DIR,
            f'diff_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        )

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('# 券商两融维保提醒 - 差异清单\n\n')
            f.write(f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n')
            f.write(f'税费率备注: {config.TAX_RATE_REMARK}\n\n')
            f.write('---\n\n')

            for compare_item in self.diff_list:
                f.write(f'## 对比: {compare_item["run1"]} vs {compare_item["run2"]}\n\n')
                f.write(f'对比时间: {compare_item["compare_time"]}\n\n')

                if not compare_item['diffs']:
                    f.write('> ✅ 无差异\n\n')
                    continue

                f.write(f'共发现 **{len(compare_item["diffs"])}** 处差异:\n\n')
                f.write('| 业务号 | 差异类型 | 原值 | 现值 | 差额 | 说明 |\n')
                f.write('|--------|----------|------|------|------|------|\n')

                for diff in compare_item['diffs']:
                    amount = f"{diff['差额']:+.2f}" if diff['差额'] is not None else '-'
                    f.write(f"| {diff['业务号']} | {diff['差异类型']} | {diff['原值']} | {diff['现值']} | {amount} | {diff['说明']} |\n")

                f.write('\n')

            f.write('---\n\n')
            f.write('## 运行记录历史\n\n')

            for run in self.runs:
                s = run['summary']
                f.write(f"### {run['run_name']} ({run['run_id']})\n\n")
                f.write(f"- 运行时间: {run['timestamp']}\n")
                f.write(f"- 数据文件: {run['data_file']}\n")
                f.write(f"- 总记录数: {s['total_records']} 条 / {s['total_biz']} 笔业务\n")
                f.write(f"- 正常: {s['normal']} 笔 | 待复核: {s['split_review']} 笔 | 已补录: {s['supplemented']} 笔 | 待处理: {s['pending']} 笔\n\n")

                f.write('#### 业务明细:\n\n')
                f.write('| 业务号 | 行数 | 状态 | 本金 | 手续费 | 印花税 | 税率 | 历史操作数 |\n')
                f.write('|--------|------|------|------|--------|--------|------|------------|\n')

                for detail in s['details']:
                    f.write(
                        f"| {detail['biz_id']} | {detail['line_count']} | {detail['status']} | "
                        f"{detail['total_principal']:,.2f} | {detail['total_fee']:,.2f} | "
                        f"{detail['total_tax']:,.2f} | {detail['tax_rate_used']*100:.4}% | "
                        f"{detail['history_records']} |\n"
                    )
                f.write('\n')

        print(f"差异报告已生成: {os.path.basename(output_file)}")
        return output_file

    def save_history(self, output_file=None):
        output_file = output_file or os.path.join(
            config.REPORT_DIR,
            f'history_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        )

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'runs': self.runs,
                'diffs': self.diff_list,
                'tax_rate_remark': config.TAX_RATE_REMARK
            }, f, ensure_ascii=False, indent=2)

        print(f"历史记录已保存: {os.path.basename(output_file)}")
        return output_file
