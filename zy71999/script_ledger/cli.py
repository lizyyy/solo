import argparse
import sys
import os
import subprocess
from datetime import datetime
from typing import List, Optional

from .ledger import Ledger, ScriptRecord
from .classifier import Classifier, Classification
from .detector import Detector


class CLI:
    def __init__(self):
        self.ledger_path = os.environ.get("SCRIPT_LEDGER_PATH", "script_ledger.json")
        self.ledger = Ledger(self.ledger_path)

    def run(self):
        parser = argparse.ArgumentParser(
            description="脚本运行账本 - 记录和管理批处理脚本执行情况",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  # 记录一条脚本运行
  ledger record --command "python batch.py --date 20240101" --cwd /data/scripts --exit-code 0 --output result.csv
  
  # 记录失败并添加原因
  ledger record --command "sh process.sh" --cwd /tmp --exit-code 1 --failure "网络超时"
  
  # 列出所有记录
  ledger list
  
  # 查看记录详情
  ledger show abc123
  
  # 添加备注
  ledger note abc123 "值班人张三已检查"
  
  # 标记补跑
  ledger rerun abc123 --command "sh process.sh" --exit-code 0
  
  # 生成报告
  ledger report
  
  # 导入其他账本（不覆盖失败原因）
  ledger import backup.json
            """
        )
        parser.add_argument("--ledger", default=self.ledger_path,
                           help="账本文件路径 (默认: script_ledger.json 或 SCRIPT_LEDGER_PATH)")
        
        subparsers = parser.add_subparsers(dest="command", required=True)
        
        self._add_record_parser(subparsers)
        self._add_list_parser(subparsers)
        self._add_show_parser(subparsers)
        self._add_note_parser(subparsers)
        self._add_failure_parser(subparsers)
        self._add_rerun_parser(subparsers)
        self._add_report_parser(subparsers)
        self._add_import_parser(subparsers)
        self._add_export_parser(subparsers)
        self._add_delete_parser(subparsers)
        
        if len(sys.argv) > 1 and sys.argv[1] == "exec":
            self._handle_exec_direct()
            return
        
        args = parser.parse_args()
        
        if args.ledger != self.ledger_path:
            self.ledger_path = args.ledger
            self.ledger = Ledger(self.ledger_path)
        
        handler = getattr(self, f"_handle_{args.command}", None)
        if handler:
            handler(args)
        else:
            parser.print_help()
            sys.exit(1)

    def _add_record_parser(self, subparsers):
        p = subparsers.add_parser("record", help="记录一条脚本运行")
        p.add_argument("--command", required=True, help="执行的命令")
        p.add_argument("--cwd", required=True, help="工作目录")
        p.add_argument("--args", nargs="*", default=[], help="命令参数")
        p.add_argument("--exit-code", type=int, default=None, help="退出码")
        p.add_argument("--output", nargs="*", default=[], help="关键输出文件路径")
        p.add_argument("--note", default="", help="人工说明/备注")
        p.add_argument("--failure", default="", help="失败原因")
        p.add_argument("--start-time", type=float, default=None, help="开始时间戳")
        p.add_argument("--end-time", type=float, default=None, help="结束时间戳")
        p.add_argument("--rollback-to", default=None, help="回滚到的记录ID")

    def _add_list_parser(self, subparsers):
        p = subparsers.add_parser("list", help="列出账本记录")
        p.add_argument("--limit", type=int, default=20, help="显示最近N条")
        p.add_argument("--command", default=None, help="按命令过滤 (支持通配符)")
        p.add_argument("--cwd", default=None, help="按工作目录过滤")
        p.add_argument("--all", action="store_true", help="显示所有记录")

    def _add_show_parser(self, subparsers):
        p = subparsers.add_parser("show", help="显示记录详情")
        p.add_argument("id", help="记录ID")

    def _add_note_parser(self, subparsers):
        p = subparsers.add_parser("note", help="添加备注")
        p.add_argument("id", help="记录ID")
        p.add_argument("note", help="备注内容")

    def _add_failure_parser(self, subparsers):
        p = subparsers.add_parser("failure", help="添加/更新失败原因")
        p.add_argument("id", help="记录ID")
        p.add_argument("reason", help="失败原因")

    def _add_rerun_parser(self, subparsers):
        p = subparsers.add_parser("rerun", help="记录补跑")
        p.add_argument("original_id", help="原始失败记录ID")
        p.add_argument("--command", required=True, help="补跑命令")
        p.add_argument("--cwd", default=None, help="工作目录（默认同原记录）")
        p.add_argument("--args", nargs="*", default=[], help="命令参数")
        p.add_argument("--exit-code", type=int, default=None, help="退出码")
        p.add_argument("--output", nargs="*", default=[], help="关键输出文件")
        p.add_argument("--note", default="", help="补跑说明")

    def _add_report_parser(self, subparsers):
        p = subparsers.add_parser("report", help="生成账本报告和问题清单")
        p.add_argument("--output", default="ledger_report", help="输出文件前缀")
        p.add_argument("--print", action="store_true", help="同时打印到控制台")

    def _add_import_parser(self, subparsers):
        p = subparsers.add_parser("import", help="导入其他账本")
        p.add_argument("file", help="要导入的账本文件")
        p.add_argument("--overwrite-failure", action="store_true",
                       help="覆盖已有失败原因（默认保留）")

    def _add_export_parser(self, subparsers):
        p = subparsers.add_parser("export", help="导出账本")
        p.add_argument("file", help="导出文件路径")

    def _add_delete_parser(self, subparsers):
        p = subparsers.add_parser("delete", help="删除记录")
        p.add_argument("id", help="记录ID")
        p.add_argument("--force", action="store_true", help="不提示确认")

    def _handle_exec_direct(self):
        args = sys.argv[2:]
        cwd = None
        output_files = []
        note = ""
        command = []
        
        i = 0
        while i < len(args):
            if args[i] == "--cwd" and i + 1 < len(args):
                cwd = args[i + 1]
                i += 2
            elif args[i] == "--ledger" and i + 1 < len(args):
                self.ledger_path = args[i + 1]
                self.ledger = Ledger(self.ledger_path)
                i += 2
            elif args[i] == "--output":
                i += 1
                while i < len(args) and not args[i].startswith("--"):
                    output_files.append(args[i])
                    i += 1
            elif args[i] == "--note" and i + 1 < len(args):
                note = args[i + 1]
                i += 2
            else:
                command = args[i:]
                break
        
        if not cwd:
            print("✗ 请指定 --cwd 参数")
            sys.exit(1)
        if not command:
            print("✗ 请指定要执行的命令")
            sys.exit(1)
        
        cmd_str = " ".join(command)
        start_time = datetime.now().timestamp()
        
        print(f"执行: {cmd_str}")
        print(f"工作目录: {cwd}")
        print("-" * 60)
        
        try:
            result = subprocess.run(
                command,
                cwd=cwd,
                capture_output=False,
                text=True
            )
            exit_code = result.returncode
        except Exception as e:
            print(f"✗ 执行异常: {e}")
            exit_code = -1
        
        end_time = datetime.now().timestamp()
        
        record = ScriptRecord(
            command=cmd_str,
            cwd=cwd,
            exit_code=exit_code,
            output_files=output_files,
            note=note,
            start_time=start_time,
            end_time=end_time
        )
        
        record_id = self.ledger.add_record(record)
        print("-" * 60)
        print(f"✓ 已记录，ID: {record_id}")
        print(f"  退出码: {exit_code}")
        print(f"  耗时: {end_time - start_time:.2f}s")

    def _handle_record(self, args):
        record = ScriptRecord(
            command=args.command,
            cwd=args.cwd,
            args=args.args,
            exit_code=args.exit_code,
            output_files=args.output,
            note=args.note,
            failure_reason=args.failure,
            start_time=args.start_time,
            end_time=args.end_time,
            rollback_to=args.rollback_to
        )
        record_id = self.ledger.add_record(record)
        print(f"✓ 已记录，ID: {record_id}")
        self._print_record_short(record)

    def _handle_list(self, args):
        if args.command:
            records = self.ledger.find_by_command(args.command)
        elif args.cwd:
            records = self.ledger.find_by_cwd(args.cwd)
        else:
            records = self.ledger.get_all_records()
        
        if not args.all:
            records = records[:args.limit]
        
        if not records:
            print("没有找到记录")
            return
        
        print(f"找到 {len(records)} 条记录（账本: {self.ledger_path}）")
        print("-" * 100)
        print(f"{'ID':<18} {'时间':<20} {'退出码':<8} {'命令'}")
        print("-" * 100)
        
        for r in records:
            time_str = datetime.fromtimestamp(r.start_time).strftime('%Y-%m-%d %H:%M:%S')
            exit_code = str(r.exit_code) if r.exit_code is not None else "?"
            status = "✓" if r.exit_code == 0 else ("✗" if r.exit_code is not None else "?")
            rerun_marker = " [重跑]" if r.is_rerun else ""
            cmd = r.command[:60] + "..." if len(r.command) > 60 else r.command
            print(f"{r.id:<18} {time_str:<20} {status} {exit_code:<5} {cmd}{rerun_marker}")

    def _handle_show(self, args):
        record = self.ledger.find_by_id(args.id)
        if not record:
            print(f"✗ 未找到记录: {args.id}")
            sys.exit(1)
        
        self._print_record_detail(record)
        
        detector = Detector(self.ledger)
        issues = detector.detect_all([record])
        if issues:
            print("\n问题检测:")
            for issue in issues:
                print(f"  {issue}")
        
        reruns = self.ledger.get_reruns_of(args.id)
        if reruns:
            print(f"\n补跑记录 ({len(reruns)} 条):")
            for r in reruns:
                print(f"  - {r.id}: {datetime.fromtimestamp(r.start_time).strftime('%Y-%m-%d %H:%M:%S')} "
                      f"(退出码: {r.exit_code})")

    def _handle_note(self, args):
        if self.ledger.add_note(args.id, args.note):
            print(f"✓ 已添加备注到记录 {args.id}")
        else:
            print(f"✗ 未找到记录: {args.id}")
            sys.exit(1)

    def _handle_failure(self, args):
        if self.ledger.update_failure_reason(args.id, args.reason):
            print(f"✓ 已更新失败原因到记录 {args.id}")
        else:
            print(f"✗ 未找到记录: {args.id}")
            sys.exit(1)

    def _handle_rerun(self, args):
        original = self.ledger.find_by_id(args.original_id)
        if not original:
            print(f"✗ 未找到原始记录: {args.original_id}")
            sys.exit(1)
        
        cwd = args.cwd or original.cwd
        rerun_record = ScriptRecord(
            command=args.command,
            cwd=cwd,
            args=args.args,
            exit_code=args.exit_code,
            output_files=args.output,
            note=args.note,
            is_rerun=True,
            rerun_of=args.original_id
        )
        
        new_id = self.ledger.mark_rerun(args.original_id, rerun_record)
        print(f"✓ 已记录补跑，新记录ID: {new_id}")
        print(f"  原始记录: {args.original_id}")

    def _handle_report(self, args):
        classifier = Classifier(self.ledger)
        ledger_file, issues_file = classifier.generate_report(args.output)
        
        print(f"✓ 账本报告已生成: {ledger_file}")
        print(f"✓ 问题清单已生成: {issues_file}")
        
        if args.print:
            with open(issues_file, 'r', encoding='utf-8') as f:
                print("\n" + f.read())
        
        with open(ledger_file, 'r', encoding='utf-8') as f:
            import json
            data = json.load(f)
            summary = data['summary']
            print(f"\n汇总: 总计 {summary['total']} 条, "
                  f"✓不用动 {summary['ok']}, "
                  f"⚠要补跑 {summary['rerun']}, "
                  f"✗找研发 {summary['ask_dev']}")

    def _handle_import(self, args):
        try:
            preserve = not args.overwrite_failure
            count = self.ledger.import_records(args.file, preserve_existing_failures=preserve)
            if preserve:
                print(f"✓ 已导入 {count} 条记录（保留原有失败原因）")
            else:
                print(f"✓ 已导入 {count} 条记录（覆盖原有失败原因）")
        except FileNotFoundError as e:
            print(f"✗ {e}")
            sys.exit(1)

    def _handle_export(self, args):
        self.ledger.export(args.file)
        print(f"✓ 账本已导出到: {args.file}")

    def _handle_delete(self, args):
        if not args.force:
            confirm = input(f"确定要删除记录 {args.id} 吗？(y/N): ")
            if confirm.lower() != 'y':
                print("已取消")
                return
        
        if self.ledger.delete_record(args.id):
            print(f"✓ 已删除记录: {args.id}")
        else:
            print(f"✗ 未找到记录: {args.id}")
            sys.exit(1)

    def _print_record_short(self, record: ScriptRecord):
        time_str = datetime.fromtimestamp(record.start_time).strftime('%Y-%m-%d %H:%M:%S')
        print(f"  时间: {time_str}")
        print(f"  命令: {record.command}")
        print(f"  目录: {record.cwd}")
        print(f"  退出码: {record.exit_code}")

    def _print_record_detail(self, record: ScriptRecord):
        print("=" * 60)
        print(f"记录ID: {record.id}")
        print("=" * 60)
        print(f"执行时间: {datetime.fromtimestamp(record.start_time).strftime('%Y-%m-%d %H:%M:%S')}")
        if record.end_time:
            duration = record.end_time - record.start_time
            print(f"耗时: {duration:.2f}s")
        print(f"工作目录: {record.cwd}")
        print(f"执行命令: {record.command}")
        if record.args:
            print(f"参数: {' '.join(record.args)}")
        print(f"退出码: {record.exit_code}")
        
        if record.is_rerun:
            print(f"补跑标记: 是 (原记录: {record.rerun_of})")
        
        if record.rollback_to:
            print(f"回滚标记: 是 (回滚到: {record.rollback_to})")
        
        if record.script_hash:
            print(f"脚本哈希: {record.script_hash[:16]}...")
        
        if record.output_files:
            print(f"输出文件:")
            for f in record.output_files:
                hash_val = record.file_hashes.get(f, "")
                hash_str = f" ({hash_val[:16]}...)" if hash_val else ""
                print(f"  - {f}{hash_str}")
        
        if record.failure_reason:
            print(f"失败原因: {record.failure_reason}")
        
        if record.note:
            print(f"备注: {record.note}")
        print("=" * 60)


def main():
    cli = CLI()
    cli.run()


if __name__ == "__main__":
    main()
