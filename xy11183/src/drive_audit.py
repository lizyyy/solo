#!/usr/bin/env python3
import csv
import os
import sys
import argparse
from datetime import datetime
from collections import defaultdict

NORMAL_SPEED_KMH = 60
MAX_MILEAGE_PER_HOUR = 80

class TestDriveAuditor:
    def __init__(self):
        self.issues = {
            'duplicate_records': [],
            'unfinished_drives': [],
            'suspicious_detour': [],
            'empty_files': []
        }
        self.summary = []
        self.valid_records = []

    def audit_file(self, filepath):
        filename = os.path.basename(filepath)
        file_issues = []

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if not content:
                    self.issues['empty_files'].append({
                        'file': filename,
                        'line': 0,
                        'message': '文件完全为空，无任何数据'
                    })
                    return

                lines = content.split('\n')
                if len(lines) <= 1:
                    self.issues['empty_files'].append({
                        'file': filename,
                        'line': 1,
                        'message': '文件只有表头，无试驾记录'
                    })
                    return

                reader = csv.DictReader(lines)
                id_records = defaultdict(list)

                for line_num, row in enumerate(reader, start=2):
                    drive_id = row.get('试驾ID', '').strip()
                    if drive_id:
                        id_records[drive_id].append((line_num, row))

                for drive_id, records in id_records.items():
                    if len(records) > 1:
                        for line_num, row in records:
                            self.issues['duplicate_records'].append({
                                'file': filename,
                                'line': line_num,
                                '试驾ID': drive_id,
                                '试驾员': row.get('试驾员', ''),
                                '客户姓名': row.get('客户姓名', ''),
                                '车型': row.get('车型', ''),
                                '结束时间': row.get('结束时间', ''),
                                '结束里程': row.get('结束里程(km)', ''),
                                'message': f'试驾ID [{drive_id}] 被反复修改 {len(records)} 次，最后只剩一个结果'
                            })

                for line_num, row in enumerate(reader, start=2):
                    pass

                reader = csv.DictReader(lines)
                for line_num, row in enumerate(reader, start=2):
                    check_out_status = row.get('签退状态', '').strip()
                    end_time = row.get('结束时间', '').strip()
                    end_mileage = row.get('结束里程(km)', '').strip()

                    if check_out_status == '未签退' or not end_time or not end_mileage:
                        self.issues['unfinished_drives'].append({
                            'file': filename,
                            'line': line_num,
                            '试驾ID': row.get('试驾ID', ''),
                            '试驾员': row.get('试驾员', ''),
                            '客户姓名': row.get('客户姓名', ''),
                            '车型': row.get('车型', ''),
                            '开始时间': row.get('开始时间', ''),
                            'message': '试驾结束未签退，缺少结束时间或结束里程'
                        })

                    start_mileage = row.get('开始里程(km)', '')
                    start_time_str = row.get('开始时间', '')
                    end_time_str = row.get('结束时间', '')

                    if start_mileage and end_mileage and start_time_str and end_time_str:
                        try:
                            start_m = float(start_mileage)
                            end_m = float(end_mileage)
                            mileage = end_m - start_m

                            start_t = datetime.strptime(start_time_str, '%Y-%m-%d %H:%M:%S')
                            end_t = datetime.strptime(end_time_str, '%Y-%m-%d %H:%M:%S')
                            duration_hours = (end_t - start_t).total_seconds() / 3600

                            if duration_hours > 0 and mileage > 0:
                                speed = mileage / duration_hours
                                if speed > MAX_MILEAGE_PER_HOUR or mileage > duration_hours * NORMAL_SPEED_KMH * 1.5:
                                    route = row.get('行驶路线', '')
                                    route_points = len(route.split('-')) if route else 0
                                    
                                    self.issues['suspicious_detour'].append({
                                        'file': filename,
                                        'line': line_num,
                                        '试驾ID': row.get('试驾ID', ''),
                                        '试驾员': row.get('试驾员', ''),
                                        '客户姓名': row.get('客户姓名', ''),
                                        '车型': row.get('车型', ''),
                                        '行驶里程': f'{mileage:.1f}km',
                                        '行驶时长': f'{duration_hours:.1f}小时',
                                        '平均时速': f'{speed:.1f}km/h',
                                        '路线站点数': route_points,
                                        '行驶路线': route,
                                        'message': f'疑似私自绕路：里程{mileage:.1f}km，时速{speed:.1f}km/h，路线经{route_points}个站点'
                                    })
                        except (ValueError, ZeroDivisionError):
                            pass

                    if row.get('签退状态', '') == '已签退' and row.get('结束时间', '') and row.get('结束里程(km)', ''):
                        self.valid_records.append({
                            'file': filename,
                            'line': line_num,
                            **row
                        })

        except Exception as e:
            print(f"处理文件 {filename} 时出错: {e}")

    def audit_directory(self, directory):
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.endswith('.csv'):
                    filepath = os.path.join(root, file)
                    self.audit_file(filepath)

    def generate_report(self, output_dir):
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        report_path = os.path.join(output_dir, f'试驾里程审计报告_{timestamp}.txt')
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("                   汽车试驾中心 - 试驾里程审计报告\n")
            f.write("=" * 80 + "\n")
            f.write(f"审计时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")

            f.write("【 一、反复修改同一条记录问题 】\n")
            f.write("-" * 80 + "\n")
            if self.issues['duplicate_records']:
                seen_ids = set()
                for issue in self.issues['duplicate_records']:
                    drive_id = issue['试驾ID']
                    if drive_id not in seen_ids:
                        seen_ids.add(drive_id)
                        f.write(f"\n来源文件: {issue['file']} (第{issue['line']}行)\n")
                        f.write(f"  试驾ID: {issue['试驾ID']}\n")
                        f.write(f"  试驾员: {issue['试驾员']}\n")
                        f.write(f"  客户: {issue['客户姓名']}\n")
                        f.write(f"  车型: {issue['车型']}\n")
                        f.write(f"  问题: {issue['message']}\n")
            else:
                f.write("  无此问题 ✓\n")
            f.write("\n")

            f.write("【 二、试驾结束未签退问题 】\n")
            f.write("-" * 80 + "\n")
            if self.issues['unfinished_drives']:
                for issue in self.issues['unfinished_drives']:
                    f.write(f"\n来源文件: {issue['file']} (第{issue['line']}行)\n")
                    f.write(f"  试驾ID: {issue['试驾ID']}\n")
                    f.write(f"  试驾员: {issue['试驾员']}\n")
                    f.write(f"  客户: {issue['客户姓名']}\n")
                    f.write(f"  车型: {issue['车型']}\n")
                    f.write(f"  开始时间: {issue['开始时间']}\n")
                    f.write(f"  问题: {issue['message']}\n")
            else:
                f.write("  无此问题 ✓\n")
            f.write("\n")

            f.write("【 三、疑似私自绕路问题 】\n")
            f.write("-" * 80 + "\n")
            if self.issues['suspicious_detour']:
                for issue in self.issues['suspicious_detour']:
                    f.write(f"\n来源文件: {issue['file']} (第{issue['line']}行)\n")
                    f.write(f"  试驾ID: {issue['试驾ID']}\n")
                    f.write(f"  试驾员: {issue['试驾员']}\n")
                    f.write(f"  客户: {issue['客户姓名']}\n")
                    f.write(f"  车型: {issue['车型']}\n")
                    f.write(f"  行驶里程: {issue['行驶里程']}\n")
                    f.write(f"  行驶时长: {issue['行驶时长']}\n")
                    f.write(f"  平均时速: {issue['平均时速']}\n")
                    f.write(f"  路线站点数: {issue['路线站点数']}\n")
                    f.write(f"  行驶路线: {issue['行驶路线']}\n")
                    f.write(f"  问题: {issue['message']}\n")
            else:
                f.write("  无此问题 ✓\n")
            f.write("\n")

            f.write("【 四、空文件或无效文件问题 】\n")
            f.write("-" * 80 + "\n")
            if self.issues['empty_files']:
                for issue in self.issues['empty_files']:
                    f.write(f"\n来源文件: {issue['file']} (第{issue['line']}行)\n")
                    f.write(f"  问题: {issue['message']}\n")
            else:
                f.write("  无此问题 ✓\n")
            f.write("\n")

            f.write("=" * 80 + "\n")
            f.write("                   审计统计摘要\n")
            f.write("=" * 80 + "\n")
            total_issues = sum(len(v) for v in self.issues.values())
            f.write(f"有效试驾记录数: {len(self.valid_records)} 条\n")
            f.write(f"发现问题总数: {total_issues} 个\n")
            f.write(f"  - 反复修改记录: {len(self.issues['duplicate_records'])} 条\n")
            f.write(f"  - 结束未签退: {len(self.issues['unfinished_drives'])} 条\n")
            f.write(f"  - 疑似私自绕路: {len(self.issues['suspicious_detour'])} 条\n")
            f.write(f"  - 空文件问题: {len(self.issues['empty_files'])} 个\n")
            f.write("=" * 80 + "\n")

        rerun_path = os.path.join(output_dir, f'可复跑修复清单_{timestamp}.csv')
        with open(rerun_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['问题类型', '来源文件', '行号', '试驾ID', '试驾员', '客户姓名', '车型', '问题描述', '修复建议'])
            
            for issue in self.issues['duplicate_records']:
                writer.writerow(['反复修改记录', issue['file'], issue['line'], issue['试驾ID'], issue['试驾员'], issue['客户姓名'], issue['车型'], issue['message'], '保留最新一条记录，删除重复修改项'])
            
            for issue in self.issues['unfinished_drives']:
                writer.writerow(['结束未签退', issue['file'], issue['line'], issue['试驾ID'], issue['试驾员'], issue['客户姓名'], issue['车型'], issue['message'], '补充结束时间和结束里程，更新签退状态'])
            
            for issue in self.issues['suspicious_detour']:
                writer.writerow(['疑似私自绕路', issue['file'], issue['line'], issue['试驾ID'], issue['试驾员'], issue['客户姓名'], issue['车型'], issue['message'], '核实实际行驶路线和里程，确认是否绕路'])
            
            for issue in self.issues['empty_files']:
                writer.writerow(['空文件问题', issue['file'], issue['line'], '', '', '', '', issue['message'], '补充试驾数据或删除无效文件'])

        print(f"\n审计完成！")
        print(f"审计报告: {report_path}")
        print(f"修复清单: {rerun_path}")
        print(f"\n问题统计:")
        print(f"  反复修改记录: {len(self.issues['duplicate_records'])} 条")
        print(f"  结束未签退: {len(self.issues['unfinished_drives'])} 条")
        print(f"  疑似私自绕路: {len(self.issues['suspicious_detour'])} 条")
        print(f"  空文件问题: {len(self.issues['empty_files'])} 个")

        return report_path, rerun_path

def main():
    parser = argparse.ArgumentParser(description='汽车试驾中心试驾里程审计 CLI')
    parser.add_argument('-i', '--input', required=True, help='输入目录或文件路径')
    parser.add_argument('-o', '--output', default='./output', help='输出目录 (默认: ./output)')
    
    args = parser.parse_args()

    auditor = TestDriveAuditor()

    if os.path.isfile(args.input):
        print(f"正在审计文件: {args.input}")
        auditor.audit_file(args.input)
    elif os.path.isdir(args.input):
        print(f"正在审计目录: {args.input}")
        auditor.audit_directory(args.input)
    else:
        print(f"错误: 输入路径不存在 - {args.input}")
        sys.exit(1)

    auditor.generate_report(args.output)

if __name__ == '__main__':
    main()
