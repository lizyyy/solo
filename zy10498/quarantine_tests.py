#!/usr/bin/env python3
"""
测试隔离名单CLI - Test Quarantine Manager CLI
管理被隔离(quarantine)的测试用例，支持到期提醒、负责人汇总和报告生成。
"""

import argparse
import csv
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Optional, Any
from collections import defaultdict


DATE_FORMAT = "%Y-%m-%d"


@dataclass
class TestCase:
    test_name: str
    quarantine_reason: str
    owner: str
    due_date: str
    last_result: str
    source_file: str
    line_number: int
    is_valid: bool = True
    parse_errors: List[str] = field(default_factory=list)

    def get_due_date_obj(self) -> Optional[date]:
        try:
            return datetime.strptime(self.due_date, DATE_FORMAT).date()
        except (ValueError, TypeError):
            return None

    def is_overdue(self) -> Optional[bool]:
        due = self.get_due_date_obj()
        if due:
            return due < date.today()
        return None

    def days_until_due(self) -> Optional[int]:
        due = self.get_due_date_obj()
        if due:
            return (due - date.today()).days
        return None


@dataclass
class ParseError:
    source_file: str
    line_number: int
    raw_content: str
    error_message: str


@dataclass
class ReportData:
    total_tests: int = 0
    valid_tests: int = 0
    invalid_tests: int = 0
    overdue_tests: int = 0
    due_soon_tests: int = 0
    tests_by_owner: Dict[str, List[TestCase]] = field(default_factory=lambda: defaultdict(list))
    tests_by_reason: Dict[str, List[TestCase]] = field(default_factory=lambda: defaultdict(list))
    parse_errors: List[ParseError] = field(default_factory=list)
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())


class InputValidator:
    @staticmethod
    def validate_file_path(path: str) -> Path:
        p = Path(path)
        if not p.exists():
            raise ValueError(f"文件不存在: {path}")
        if not p.is_file():
            raise ValueError(f"不是文件: {path}")
        return p

    @staticmethod
    def validate_output_dir(path: str, create: bool = True) -> Path:
        p = Path(path)
        if create:
            p.mkdir(parents=True, exist_ok=True)
        elif not p.exists():
            raise ValueError(f"输出目录不存在: {path}")
        if not p.is_dir():
            raise ValueError(f"不是目录: {path}")
        return p

    @staticmethod
    def validate_date(date_str: str) -> bool:
        try:
            datetime.strptime(date_str, DATE_FORMAT)
            return True
        except ValueError:
            return False


class TestCaseParser:
    REQUIRED_FIELDS = ["test_name", "quarantine_reason", "owner", "due_date", "last_result"]

    def __init__(self):
        self.errors: List[ParseError] = []

    def parse_file(self, file_path: Path) -> List[TestCase]:
        test_cases = []
        file_path = Path(file_path)

        if file_path.suffix.lower() == ".json":
            test_cases.extend(self._parse_json(file_path))
        elif file_path.suffix.lower() == ".csv":
            test_cases.extend(self._parse_csv(file_path))
        else:
            raise ValueError(f"不支持的文件格式: {file_path.suffix}")

        return test_cases

    def _parse_csv(self, file_path: Path) -> List[TestCase]:
        test_cases = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                test_case = self._parse_row(row, file_path, line_num)
                test_cases.append(test_case)
        return test_cases

    def _parse_json(self, file_path: Path) -> List[TestCase]:
        test_cases = []
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, list):
            for line_num, item in enumerate(data, start=1):
                test_case = self._parse_row(item, file_path, line_num)
                test_cases.append(test_case)
        elif isinstance(data, dict) and "tests" in data:
            for line_num, item in enumerate(data["tests"], start=1):
                test_case = self._parse_row(item, file_path, line_num)
                test_cases.append(test_case)
        
        return test_cases

    def _parse_row(self, row: Dict[str, Any], source_file: Path, line_num: int) -> TestCase:
        errors = []
        is_valid = True

        row_lower = {k.lower().strip(): v for k, v in row.items()}

        test_name = str(row_lower.get("test_name", "")).strip()
        quarantine_reason = str(row_lower.get("quarantine_reason", "")).strip()
        owner = str(row_lower.get("owner", "")).strip()
        due_date = str(row_lower.get("due_date", "")).strip()
        last_result = str(row_lower.get("last_result", "")).strip()

        if not test_name:
            errors.append("缺少 test_name 或为空")
            is_valid = False
        if not quarantine_reason:
            errors.append("缺少 quarantine_reason 或为空")
            is_valid = False
        if not owner:
            errors.append("缺少 owner 或为空")
            is_valid = False
        if not due_date:
            errors.append("缺少 due_date 或为空")
            is_valid = False
        elif not InputValidator.validate_date(due_date):
            errors.append(f"日期格式无效: {due_date} (应为 YYYY-MM-DD)")
            is_valid = False
        if not last_result:
            errors.append("缺少 last_result 或为空")
            is_valid = False

        if not is_valid:
            self.errors.append(ParseError(
                source_file=str(source_file),
                line_number=line_num,
                raw_content=json.dumps(row, ensure_ascii=False),
                error_message="; ".join(errors)
            ))

        return TestCase(
            test_name=test_name,
            quarantine_reason=quarantine_reason,
            owner=owner,
            due_date=due_date,
            last_result=last_result,
            source_file=str(source_file),
            line_number=line_num,
            is_valid=is_valid,
            parse_errors=errors
        )


class ReportGenerator:
    def __init__(self, report_data: ReportData, output_dir: Path):
        self.report_data = report_data
        self.output_dir = Path(output_dir)

    def generate_terminal_summary(self) -> str:
        rd = self.report_data
        lines = []
        lines.append("=" * 60)
        lines.append("        测试隔离名单 - 摘要报告")
        lines.append("=" * 60)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append(f"总测试数:    {rd.total_tests}")
        lines.append(f"有效测试:    {rd.valid_tests}")
        lines.append(f"无效测试:    {rd.invalid_tests}")
        lines.append(f"已超期:      {rd.overdue_tests} 🔴")
        lines.append(f"即将到期:    {rd.due_soon_tests} 🟡")
        lines.append("")

        if rd.tests_by_owner:
            lines.append("按负责人统计:")
            for owner, tests in sorted(rd.tests_by_owner.items()):
                overdue = sum(1 for t in tests if t.is_overdue())
                lines.append(f"  - {owner}: {len(tests)}个测试 (超期: {overdue})")
            lines.append("")

        if rd.parse_errors:
            lines.append(f"解析错误: {len(rd.parse_errors)} 个")
            for err in rd.parse_errors[:5]:
                lines.append(f"  - {err.source_file}:{err.line_number} - {err.error_message}")
            if len(rd.parse_errors) > 5:
                lines.append(f"  ... 还有 {len(rd.parse_errors) - 5} 个错误")

        lines.append("=" * 60)
        return "\n".join(lines)

    def generate_json_report(self) -> str:
        rd = self.report_data
        result = {
            "summary": {
                "total_tests": rd.total_tests,
                "valid_tests": rd.valid_tests,
                "invalid_tests": rd.invalid_tests,
                "overdue_tests": rd.overdue_tests,
                "due_soon_tests": rd.due_soon_tests,
                "generated_at": rd.generated_at,
            },
            "tests_by_owner": {
                owner: [asdict(t) for t in tests]
                for owner, tests in rd.tests_by_owner.items()
            },
            "tests_by_reason": {
                reason: [asdict(t) for t in tests]
                for reason, tests in rd.tests_by_reason.items()
            },
            "parse_errors": [asdict(e) for e in rd.parse_errors],
        }
        return json.dumps(result, ensure_ascii=False, indent=2)

    def generate_html_report(self) -> str:
        rd = self.report_data
        
        overdue_rows = []
        for owner, tests in rd.tests_by_owner.items():
            for t in tests:
                if t.is_overdue():
                    overdue_rows.append(f"""
                        <tr>
                            <td>{t.test_name}</td>
                            <td>{t.quarantine_reason}</td>
                            <td><strong>{t.owner}</strong></td>
                            <td class="danger">{t.due_date}</td>
                            <td>{t.last_result}</td>
                            <td><code>{t.source_file}:{t.line_number}</code></td>
                        </tr>
                    """)

        due_soon_rows = []
        for owner, tests in rd.tests_by_owner.items():
            for t in tests:
                days = t.days_until_due()
                if days is not None and 0 <= days <= 7:
                    due_soon_rows.append(f"""
                        <tr>
                            <td>{t.test_name}</td>
                            <td>{t.quarantine_reason}</td>
                            <td><strong>{t.owner}</strong></td>
                            <td class="warning">{t.due_date} ({days}天后)</td>
                            <td>{t.last_result}</td>
                            <td><code>{t.source_file}:{t.line_number}</code></td>
                        </tr>
                    """)

        error_rows = []
        for err in rd.parse_errors:
            error_rows.append(f"""
                <tr>
                    <td><code>{err.source_file}</code></td>
                    <td>{err.line_number}</td>
                    <td>{err.error_message}</td>
                    <td><code>{err.raw_content[:100]}</code></td>
                </tr>
            """)

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>测试隔离名单报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }}
        h2 {{ color: #555; margin-top: 30px; }}
        .summary {{ display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }}
        .card {{ flex: 1; min-width: 120px; padding: 15px; border-radius: 6px; text-align: center; }}
        .card-total {{ background: #e3f2fd; }}
        .card-overdue {{ background: #ffebee; }}
        .card-soon {{ background: #fff3e0; }}
        .card-valid {{ background: #e8f5e9; }}
        .number {{ font-size: 2em; font-weight: bold; }}
        .label {{ font-size: 0.9em; color: #666; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f8f9fa; font-weight: 600; }}
        tr:hover {{ background: #f5f5f5; }}
        .danger {{ color: #dc3545; font-weight: bold; }}
        .warning {{ color: #ff9800; font-weight: bold; }}
        code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 0.85em; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 测试隔离名单报告</h1>
        <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <div class="summary">
            <div class="card card-total">
                <div class="number">{rd.total_tests}</div>
                <div class="label">总测试数</div>
            </div>
            <div class="card card-valid">
                <div class="number">{rd.valid_tests}</div>
                <div class="label">有效测试</div>
            </div>
            <div class="card card-overdue">
                <div class="number">{rd.overdue_tests}</div>
                <div class="label">🔴 已超期</div>
            </div>
            <div class="card card-soon">
                <div class="number">{rd.due_soon_tests}</div>
                <div class="label">🟡 7天内到期</div>
            </div>
        </div>

        <h2>🔴 已超期的测试 (需要立即处理)</h2>
        <table>
            <tr>
                <th>测试名称</th>
                <th>隔离原因</th>
                <th>负责人</th>
                <th>到期日期</th>
                <th>最近结果</th>
                <th>来源</th>
            </tr>
            {''.join(overdue_rows) if overdue_rows else '<tr><td colspan="6" style="text-align:center;color:#999;">无超期测试 🎉</td></tr>'}
        </table>

        <h2>🟡 7天内即将到期的测试</h2>
        <table>
            <tr>
                <th>测试名称</th>
                <th>隔离原因</th>
                <th>负责人</th>
                <th>到期日期</th>
                <th>最近结果</th>
                <th>来源</th>
            </tr>
            {''.join(due_soon_rows) if due_soon_rows else '<tr><td colspan="6" style="text-align:center;color:#999;">无即将到期的测试</td></tr>'}
        </table>

        {'''
        <h2>⚠️ 解析错误</h2>
        <table>
            <tr>
                <th>文件</th>
                <th>行号</th>
                <th>错误信息</th>
                <th>原始内容</th>
            </tr>
            ''' + ''.join(error_rows) + '''
        </table>
        ''' if rd.parse_errors else ''}

        <div class="footer">
            此报告由 quarantine-tests CLI 工具自动生成 | 请及时清理过期的隔离测试
        </div>
    </div>
</body>
</html>"""
        return html

    def save_all_reports(self):
        terminal_summary = self.generate_terminal_summary()
        print(terminal_summary)

        json_path = self.output_dir / "quarantine_report.json"
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(self.generate_json_report())
        print(f"\n📄 JSON报告已保存: {json_path}")

        html_path = self.output_dir / "quarantine_report.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(self.generate_html_report())
        print(f"🌐 HTML报告已保存: {html_path}")

        errors_path = self.output_dir / "parse_errors.json"
        with open(errors_path, "w", encoding="utf-8") as f:
            json.dump([asdict(e) for e in self.report_data.parse_errors], f, ensure_ascii=False, indent=2)


class QuarantineManager:
    def __init__(self):
        self.parser = TestCaseParser()

    def process_files(self, file_paths: List[Path]) -> ReportData:
        all_tests = []
        for path in file_paths:
            tests = self.parser.parse_file(path)
            all_tests.extend(tests)

        rd = ReportData()
        rd.total_tests = len(all_tests)
        rd.parse_errors = self.parser.errors

        valid_tests = [t for t in all_tests if t.is_valid]
        rd.valid_tests = len(valid_tests)
        rd.invalid_tests = len([t for t in all_tests if not t.is_valid])

        for test in valid_tests:
            if test.owner:
                rd.tests_by_owner[test.owner].append(test)
            if test.quarantine_reason:
                rd.tests_by_reason[test.quarantine_reason].append(test)

            overdue = test.is_overdue()
            if overdue:
                rd.overdue_tests += 1
            
            days = test.days_until_due()
            if days is not None and 0 <= days <= 7:
                rd.due_soon_tests += 1

        return rd


class SelfTester:
    @staticmethod
    def generate_test_data(output_dir: Path) -> Dict[str, Path]:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        csv_content = """test_name,quarantine_reason,owner,due_date,last_result
test_login_success,依赖外部服务不稳定,张三,2026-05-10,失败
test_payment_flow,第三方API变更未同步,李四,2026-05-20,失败
test_user_profile,数据库连接偶尔超时,张三,2026-05-25,跳过
test_search_function,ES索引重建中,王五,2026-06-01,失败
test_email_notification,邮件服务限流,赵六,2026-05-18,失败
test_invalid_date,日期格式错误测试,李四,invalid-date,失败
,缺少test_name,王五,2026-05-20,失败
"""

        json_content = {
            "tests": [
                {"test_name": "api_v2_check", "quarantine_reason": "v2接口下线", "owner": "李四", "due_date": "2026-05-15", "last_result": "失败"},
                {"test_name": "mobile_auth", "quarantine_reason": "短信服务降级", "owner": "王五", "due_date": "2026-05-22", "last_result": "跳过"},
                {"test_name": "invalid_row"},
            ]
        }

        csv_path = output_dir / "sample_tests.csv"
        json_path = output_dir / "sample_tests.json"

        with open(csv_path, "w", encoding="utf-8") as f:
            f.write(csv_content)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_content, f, ensure_ascii=False, indent=2)

        return {"csv": csv_path, "json": json_path}

    @classmethod
    def run_selftest(cls, output_dir: Path) -> bool:
        print("🧪 开始自检...")
        print()

        test_data_dir = output_dir / "test_data"
        files = cls.generate_test_data(test_data_dir)
        
        print(f"✅ 生成测试数据:")
        print(f"   - CSV: {files['csv']}")
        print(f"   - JSON: {files['json']}")
        print()

        manager = QuarantineManager()
        
        try:
            report_data = manager.process_files([files["csv"], files["json"]])
        except Exception as e:
            print(f"❌ 处理文件失败: {e}")
            return False

        print(f"✅ 文件解析完成:")
        print(f"   - 总测试数: {report_data.total_tests}")
        print(f"   - 有效测试: {report_data.valid_tests}")
        print(f"   - 无效测试: {report_data.invalid_tests}")
        print(f"   - 解析错误: {len(report_data.parse_errors)}")
        print()

        if report_data.total_tests < 5:
            print("❌ 测试数量过少，可能解析有问题")
            return False

        if len(report_data.parse_errors) < 2:
            print("❌ 应该有至少2个解析错误（边界样本）")
            return False

        report_dir = output_dir / "self_test_output"
        generator = ReportGenerator(report_data, report_dir)
        
        try:
            terminal = generator.generate_terminal_summary()
            json_report = generator.generate_json_report()
            html_report = generator.generate_html_report()
        except Exception as e:
            print(f"❌ 生成报告失败: {e}")
            return False

        print(f"✅ 报告生成完成:")
        print(f"   - 终端摘要长度: {len(terminal)}")
        print(f"   - JSON报告长度: {len(json_report)}")
        print(f"   - HTML报告长度: {len(html_report)}")
        print()

        if "张三" in terminal and "李四" in terminal and "已超期" in terminal:
            print("✅ 终端摘要包含预期内容")
        else:
            print("❌ 终端摘要缺少预期内容")
            return False

        parsed_json = json.loads(json_report)
        if "summary" in parsed_json and "tests_by_owner" in parsed_json:
            print("✅ JSON报告结构正确")
        else:
            print("❌ JSON报告结构有问题")
            return False

        if "<!DOCTYPE html>" in html_report and "已超期" in html_report:
            print("✅ HTML报告格式正确")
        else:
            print("❌ HTML报告格式有问题")
            return False

        print()
        print("🎉 所有自检通过!")
        print()
        print(f"📁 测试数据目录: {test_data_dir}")
        print(f"📁 报告输出目录: {report_dir}")
        return True


def main():
    parser = argparse.ArgumentParser(
        description="测试隔离名单CLI - 管理和清理被隔离的测试用例",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  %(prog)s --input tests.csv --output ./reports
  %(prog)s --input tests.csv --input more_tests.json
  %(prog)s --selftest
        """
    )

    parser.add_argument(
        "--input", "-i",
        action="append",
        dest="inputs",
        help="输入文件路径 (CSV或JSON格式)，可多次指定",
        metavar="FILE"
    )

    parser.add_argument(
        "--output", "-o",
        default="./quarantine_reports",
        help="输出目录 (默认: ./quarantine_reports)",
        metavar="DIR"
    )

    parser.add_argument(
        "--selftest",
        action="store_true",
        help="运行自检命令，生成测试数据并验证所有功能"
    )

    args = parser.parse_args()

    if args.selftest:
        success = SelfTester.run_selftest(Path(args.output) / "selftest")
        sys.exit(0 if success else 1)

    if not args.inputs:
        parser.error("必须指定至少一个 --input 文件，或使用 --selftest 进行自检")

    try:
        input_paths = [InputValidator.validate_file_path(f) for f in args.inputs]
        output_dir = InputValidator.validate_output_dir(args.output)
    except ValueError as e:
        print(f"❌ 参数错误: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"📂 处理 {len(input_paths)} 个文件...")
    for p in input_paths:
        print(f"  - {p}")
    print()

    manager = QuarantineManager()
    
    try:
        report_data = manager.process_files(input_paths)
    except Exception as e:
        print(f"❌ 处理失败: {e}", file=sys.stderr)
        sys.exit(1)

    generator = ReportGenerator(report_data, output_dir)
    generator.save_all_reports()

    print("\n✨ 处理完成!")


if __name__ == "__main__":
    main()
