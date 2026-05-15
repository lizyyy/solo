#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
import hashlib
from datetime import datetime
from pathlib import Path

VERSION = "1.0.0"


class CSVFieldLineage:
    def __init__(self, config=None):
        self.config = config or {}
        self.data_dir = Path(self.config.get('data_dir', './data'))
        self.report_dir = Path(self.config.get('report_dir', './reports'))
        self.failure_dir = Path(self.config.get('failure_dir', './failures'))
        self._ensure_dirs()
        self.run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    def _ensure_dirs(self):
        for dir_path in [self.data_dir, self.report_dir, self.failure_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def generate_run_mark(self, source_file, action):
        content = f"{source_file}|{action}|{self.run_id}"
        return hashlib.md5(content.encode()).hexdigest()[:8]

    def load_csv(self, file_path):
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            return list(reader), reader.fieldnames

    def save_csv(self, file_path, rows, fieldnames):
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    def save_failure(self, failure_type, data, reason):
        failure_file = self.failure_dir / f"failure_{self.run_id}_{failure_type}.json"
        failure_data = {
            "run_id": self.run_id,
            "timestamp": datetime.now().isoformat(),
            "failure_type": failure_type,
            "data": data,
            "reason": reason,
            "lineage": {
                "source": data.get('_source', 'unknown'),
                "original_fields": data.get('_original_fields', {}),
                "processed_fields": data.get('_processed_fields', {})
            }
        }
        with open(failure_file, 'w', encoding='utf-8') as f:
            json.dump(failure_data, f, ensure_ascii=False, indent=2)
        return failure_file

    def generate_cleanup_candidates(self, target_dir, pattern="*.csv"):
        candidates = []
        for file_path in Path(target_dir).rglob(pattern):
            stat = file_path.stat()
            candidates.append({
                "file": str(file_path),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "run_mark": self._extract_run_mark(file_path.name)
            })
        return candidates

    def _extract_run_mark(self, filename):
        parts = filename.replace('.csv', '').split('_')
        for part in parts:
            if len(part) == 8 and part.isalnum():
                return part
        return None

    def verify_evidence_chain(self, record, required_links):
        broken_links = []
        for link in required_links:
            if link not in record or not record[link]:
                broken_links.append(link)
        return broken_links

    def supplement_acceptance_form(self, source_file, output_file=None):
        rows, fieldnames = self.load_csv(source_file)
        run_mark = self.generate_run_mark(source_file, "supplement")
        
        result = {
            "success": [],
            "failed": [],
            "lineage": {},
            "run_mark": run_mark,
            "run_id": self.run_id
        }

        for idx, row in enumerate(rows):
            original_row = dict(row)
            row['_source'] = str(source_file)
            row['_row_index'] = idx
            row['_run_mark'] = run_mark
            row['_original_fields'] = json.dumps(original_row, ensure_ascii=False)

            required_links = ['项目编号', '外包人员姓名', '入场日期', '离场日期']
            broken = self.verify_evidence_chain(row, required_links)

            if broken:
                row['_failure_reason'] = f"证据链断开: 缺少字段 {', '.join(broken)}"
                result['failed'].append(row)
                self.save_failure("evidence_chain_broken", row, row['_failure_reason'])
            else:
                row = self._calculate_acceptance_fields(row, original_row)
                result['success'].append(row)

        if output_file:
            output_path = self.data_dir / output_file
            all_rows = result['success'] + result['failed']
            additional_fields = ['出勤天数', '验收金额', '_source', '_row_index', '_run_mark', '_original_fields', '_processed_fields', '_failure_reason']
            all_fieldnames = fieldnames + [f for f in additional_fields if f not in fieldnames]
            self.save_csv(output_path, all_rows, all_fieldnames)

        return result

    def _calculate_acceptance_fields(self, row, original_row):
        try:
            start_date = datetime.strptime(row['入场日期'], '%Y-%m-%d')
            end_date = datetime.strptime(row['离场日期'], '%Y-%m-%d')
            days = (end_date - start_date).days + 1
            row['出勤天数'] = str(days)
            
            if '人天单价' in row and row['人天单价']:
                row['验收金额'] = str(days * float(row['人天单价']))
            else:
                row['验收金额'] = '0'

            processed = {
                '出勤天数': {'formula': '离场日期 - 入场日期 + 1', 'source': ['入场日期', '离场日期']},
                '验收金额': {'formula': '出勤天数 * 人天单价', 'source': ['出勤天数', '人天单价']}
            }
            row['_processed_fields'] = json.dumps(processed, ensure_ascii=False)
            
        except Exception as e:
            row['_failure_reason'] = f"计算失败: {str(e)}"
        return row

    def generate_report(self, result, report_file=None):
        if not report_file:
            report_file = f"report_{self.run_id}.md"
        
        report_path = self.report_dir / report_file
        
        content = f"""# CSV字段血缘分析报告

**运行ID**: {result['run_id']}
**重跑标记**: {result['run_mark']}
**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 一、执行概览

| 指标 | 数值 |
|------|------|
| 成功记录数 | {len(result['success'])} |
| 失败记录数 | {len(result['failed'])} |
| 总记录数 | {len(result['success']) + len(result['failed'])} |

## 二、主流程说明

主流程：补录外包验收单

1. 读取原始CSV数据
2. 验证证据链（项目编号、外包人员姓名、入场日期、离场日期）
3. 计算派生字段（出勤天数、验收金额）
4. 保存带有完整血缘信息的结果

### 字段血缘追溯

每个字段均可追溯到原始输入：

- `出勤天数` = `离场日期` - `入场日期` + 1
- `验收金额` = `出勤天数` * `人天单价`

## 三、失败路径分析

共 {len(result['failed'])} 条失败记录，失败详情已保存至 failures 目录。

### 失败原因分类

"""
        if result['failed']:
            content += "| 失败类型 | 记录数 | 示例原因 |\n"
            content += "|----------|--------|----------|\n"
            failure_types = {}
            for f in result['failed']:
                reason = f.get('_failure_reason', '未知')
                ftype = reason.split(':')[0] if ':' in reason else reason
                if ftype not in failure_types:
                    failure_types[ftype] = {'count': 0, 'example': reason}
                failure_types[ftype]['count'] += 1
            
            for ftype, info in failure_types.items():
                content += f"| {ftype} | {info['count']} | {info['example'][:50]}... |\n"
        else:
            content += "无失败记录\n"

        content += """
## 四、夜间巡检复核样例

| 复核项 | 状态 | 说明 | 重跑标记 |
|--------|------|------|----------|
| 证据链完整性 | ☐待复核 | 验证必填字段是否完整 | """ + result['run_mark'] + """ |
| 计算逻辑正确性 | ☐待复核 | 验证出勤天数、验收金额计算 | """ + result['run_mark'] + """ |
| 字段血缘可追溯 | ☐待复核 | 验证派生字段来源可查 | """ + result['run_mark'] + """ |

### 复核说明
- 输入：原始CSV文件 + 重跑标记
- 动作：重新执行补录流程
- 结论：对比两次执行结果，确认一致性

## 五、清理候选清单

以下文件可作为清理/回滚候选（生成清单供人工确认）：

"""
        candidates = self.generate_cleanup_candidates(str(self.data_dir))
        if candidates:
            content += "| 文件 | 大小(字节) | 修改时间 | 重跑标记 |\n"
            content += "|------|-----------|----------|----------|\n"
            for c in candidates:
                content += f"| {c['file']} | {c['size']} | {c['modified']} | {c['run_mark'] or '-'} |\n"
        else:
            content += "暂无候选文件\n"

        content += f"""

## 六、失败记录索引

失败文件位置：{self.failure_dir}

"""
        if result['failed']:
            content += "| 记录位置 | 失败原因 |\n"
            content += "|----------|----------|\n"
            for f in result['failed']:
                content += f"| 第{f['_row_index'] + 1}行 | {f.get('_failure_reason', '-')} |\n"

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return report_path


def main():
    parser = argparse.ArgumentParser(description='CSV字段血缘命令行工具')
    parser.add_argument('--version', action='version', version=f'CSV Lineage CLI v{VERSION}')
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    supplement_parser = subparsers.add_parser('supplement', help='补录外包验收单')
    supplement_parser.add_argument('--input', required=True, help='输入CSV文件路径')
    supplement_parser.add_argument('--output', help='输出CSV文件名')
    supplement_parser.add_argument('--report', help='报告文件名')
    
    verify_parser = subparsers.add_parser('verify', help='验证证据链')
    verify_parser.add_argument('--input', required=True, help='输入CSV文件路径')
    
    cleanup_parser = subparsers.add_parser('cleanup', help='生成清理候选清单')
    cleanup_parser.add_argument('--dir', default='./data', help='目标目录')
    cleanup_parser.add_argument('--output', help='输出清单文件')
    
    args = parser.parse_args()
    
    lineage = CSVFieldLineage()
    
    if args.command == 'supplement':
        print(f"开始处理: {args.input}")
        result = lineage.supplement_acceptance_form(args.input, args.output)
        
        if args.report:
            report_path = lineage.generate_report(result, args.report)
            print(f"报告已生成: {report_path}")
        
        print(f"成功: {len(result['success'])}, 失败: {len(result['failed'])}")
        print(f"重跑标记: {result['run_mark']}")
        
    elif args.command == 'verify':
        rows, fieldnames = lineage.load_csv(args.input)
        required_links = ['项目编号', '外包人员姓名', '入场日期', '离场日期']
        all_valid = True
        for idx, row in enumerate(rows):
            broken = lineage.verify_evidence_chain(row, required_links)
            if broken:
                print(f"第{idx + 1}行证据链断开: {', '.join(broken)}")
                all_valid = False
        if all_valid:
            print("所有记录证据链完整")
    
    elif args.command == 'cleanup':
        candidates = lineage.generate_cleanup_candidates(args.dir)
        print(f"找到 {len(candidates)} 个候选文件:")
        for c in candidates:
            print(f"  - {c['file']} ({c['size']} bytes, {c['modified']})")
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(candidates, f, ensure_ascii=False, indent=2)
            print(f"清单已保存: {args.output}")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
