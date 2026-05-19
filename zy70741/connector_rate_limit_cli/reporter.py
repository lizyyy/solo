import json
import csv
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

from .tracker import AnalysisResult


class ConsoleReporter:
    def __init__(self, use_colors: bool = True):
        self.use_colors = use_colors

    def _colorize(self, text: str, color: str) -> str:
        if not self.use_colors:
            return text
        colors = {
            'red': '\033[91m',
            'green': '\033[92m',
            'yellow': '\033[93m',
            'blue': '\033[94m',
            'purple': '\033[95m',
            'cyan': '\033[96m',
            'reset': '\033[0m',
        }
        return f"{colors.get(color, '')}{text}{colors['reset']}"

    def _get_severity_color(self, severity: str) -> str:
        return {
            'critical': 'red',
            'high': 'red',
            'medium': 'yellow',
            'low': 'cyan',
        }.get(severity, 'cyan')

    def print_summary(self, result: AnalysisResult) -> None:
        summary = result.to_dict()['summary']

        print("\n" + "=" * 80)
        print(self._colorize("连接器限速休眠恢复分析报告", 'purple'))
        print("=" * 80)

        print("\n" + "-" * 60)
        print(self._colorize("📊 运行摘要", 'blue'))
        print("-" * 60)
        print(f"  总记录数: {summary['total_records']}")
        print(f"  休眠会话数: {summary['total_sessions']}")
        print(f"  成功恢复: {summary['recovered_sessions']}")
        print(f"  非幂等会话: {self._colorize(str(summary['non_idempotent_sessions']), 'red' if summary['non_idempotent_sessions'] > 0 else 'green')}")

        print("\n" + "-" * 60)
        print(self._colorize("📈 事件统计", 'blue'))
        print("-" * 60)
        print(f"  限流事件: {summary['rate_limit_count']}")
        print(f"  休眠事件: {summary['sleep_count']}")
        print(f"  恢复事件: {summary['recovery_count']}")
        print(f"  重试事件: {summary['retry_count']}")
        print(f"  错误事件: {summary['error_count']}")
        print(f"  坏行记录: {self._colorize(str(summary['bad_line_count']), 'yellow' if summary['bad_line_count'] > 0 else 'green')}")

    def print_sessions(self, result: AnalysisResult) -> None:
        if not result.sessions:
            return

        print("\n" + "-" * 60)
        print(self._colorize("🔄 休眠会话详情", 'blue'))
        print("-" * 60)

        for i, session in enumerate(result.sessions, 1):
            status_color = 'green' if session.is_recovered else 'red'
            idem_color = 'green' if session.is_idempotent else 'red'

            print(f"\n  会话 {i}: {self._colorize(session.session_id, 'cyan')}")
            print(f"    连接器: {session.connector}")
            print(f"    供应商: {session.supplier}")
            print(f"    状态: {self._colorize(session.state.value, status_color)}")
            print(f"    恢复: {'是' if session.is_recovered else '否'}")
            print(f"    幂等: {self._colorize('是' if session.is_idempotent else '否', idem_color)}")
            print(f"    限流次数: {session.rate_limit_count}")
            print(f"    休眠次数: {session.sleep_count}")
            print(f"    总休眠时长: {session.total_sleep_duration:.2f}s")
            print(f"    重试次数: {session.retry_count}")

            if session.transitions:
                print(f"    状态转换:")
                for t in session.transitions:
                    arrow = self._colorize(" → ", 'yellow')
                    print(f"      [{t.timestamp.strftime('%H:%M:%S')}] {t.from_state.value}{arrow}{t.to_state.value} ({t.reason})")

    def print_failure_causes(self, result: AnalysisResult) -> None:
        if not result.failure_causes:
            print("\n" + self._colorize("✅ 未检测到明显问题", 'green'))
            return

        print("\n" + "-" * 60)
        print(self._colorize("⚠️  失败归因分析", 'red'))
        print("-" * 60)

        for i, cause in enumerate(result.failure_causes, 1):
            color = self._get_severity_color(cause.severity)
            print(f"\n  {i}. {self._colorize(f'[{cause.severity.upper()}]', color)} {cause.cause_type}")
            print(f"     描述: {cause.description}")
            print(f"     置信度: {cause.confidence * 100:.0f}%")
            print(f"     证据数: {len(cause.evidence)} 条记录")

    def print_bad_lines(self, result: AnalysisResult) -> None:
        bad_lines = [t for t in result.traces if t.record.is_bad_line]
        if not bad_lines:
            return

        print("\n" + "-" * 60)
        print(self._colorize("❌ 坏行记录 (保留原始位置)", 'yellow'))
        print("-" * 60)

        for trace in bad_lines[:10]:
            print(f"\n  文件: {trace.source_file}")
            print(f"  行号: {trace.line_number}")
            print(f"  内容: {trace.raw_content[:100]}...")
            print(f"  哈希: {trace.trace_hash}")

        if len(bad_lines) > 10:
            print(f"\n  ... 还有 {len(bad_lines) - 10} 条坏行记录")

    def print_full_report(self, result: AnalysisResult) -> None:
        self.print_summary(result)
        self.print_sessions(result)
        self.print_failure_causes(result)
        self.print_bad_lines(result)

        print("\n" + "=" * 80)


class FileReporter:
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _generate_filename(self, result: AnalysisResult) -> str:
        input_files = result.metadata.get('input_files', [])
        if input_files:
            import hashlib
            content = '|'.join(sorted(input_files))
            file_hash = hashlib.md5(content.encode()).hexdigest()[:8]
            return f"rate_limit_analysis_{file_hash}"
        return "rate_limit_analysis"

    def export_json(self, result: AnalysisResult, filename: str = None) -> str:
        filename = filename or f"{self._generate_filename(result)}.json"
        filepath = self.output_dir / filename

        data = result.to_dict()
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)

        return str(filepath)

    def export_csv(self, result: AnalysisResult, filename: str = None) -> Dict[str, str]:
        base_name = filename or self._generate_filename(result)
        files = {}

        summary_path = self.output_dir / f"{base_name}_summary.csv"
        with open(summary_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            summary = result.to_dict()['summary']
            writer.writerow(['指标', '数值'])
            for key, value in summary.items():
                writer.writerow([key, value])
        files['summary'] = str(summary_path)

        sessions_path = self.output_dir / f"{base_name}_sessions.csv"
        with open(sessions_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '会话ID', '连接器', '供应商', '开始时间', '结束时间',
                '持续时间(s)', '状态', '限流次数', '休眠次数',
                '总休眠时长(s)', '重试次数', '恢复次数', '错误次数',
                '已恢复', '幂等'
            ])
            for session in result.sessions:
                writer.writerow([
                    session.session_id,
                    session.connector,
                    session.supplier,
                    session.start_time.isoformat(),
                    session.end_time.isoformat() if session.end_time else '',
                    session.duration_seconds() or '',
                    session.state.value,
                    session.rate_limit_count,
                    session.sleep_count,
                    session.total_sleep_duration,
                    session.retry_count,
                    session.recovery_count,
                    session.error_count,
                    session.is_recovered,
                    session.is_idempotent,
                ])
        files['sessions'] = str(sessions_path)

        failures_path = self.output_dir / f"{base_name}_failures.csv"
        with open(failures_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['原因类型', '描述', '置信度', '严重程度', '证据数'])
            for cause in result.failure_causes:
                writer.writerow([
                    cause.cause_type,
                    cause.description,
                    cause.confidence,
                    cause.severity,
                    len(cause.evidence),
                ])
        files['failures'] = str(failures_path)

        bad_lines_path = self.output_dir / f"{base_name}_bad_lines.csv"
        with open(bad_lines_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(['源文件', '行号', '原始内容', '追踪哈希'])
            for trace in result.traces:
                if trace.record.is_bad_line:
                    writer.writerow([
                        trace.source_file,
                        trace.line_number,
                        trace.raw_content,
                        trace.trace_hash,
                    ])
        files['bad_lines'] = str(bad_lines_path)

        return files

    def export_excel(self, result: AnalysisResult, filename: str = None) -> str:
        if not PANDAS_AVAILABLE:
            raise ImportError("pandas is required for Excel export. Install with 'pip install pandas openpyxl'")

        filename = filename or f"{self._generate_filename(result)}.xlsx"
        filepath = self.output_dir / filename

        data = result.to_dict()

        summary_items = sorted(data['summary'].items())
        summary_df = pd.DataFrame(summary_items, columns=['指标', '数值'])

        sessions_df = pd.DataFrame(data['sessions'])

        failures_df = pd.DataFrame(data['failure_causes'])

        bad_lines_df = pd.DataFrame(data['bad_lines'])

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            summary_df.to_excel(writer, sheet_name='摘要', index=False)
            sessions_df.to_excel(writer, sheet_name='休眠会话', index=False)
            failures_df.to_excel(writer, sheet_name='失败归因', index=False)
            bad_lines_df.to_excel(writer, sheet_name='坏行记录', index=False)

        return str(filepath)

    def export_all(self, result: AnalysisResult, base_filename: str = None) -> Dict[str, Any]:
        base = base_filename or self._generate_filename(result)

        outputs = {
            'json': self.export_json(result, f"{base}.json"),
            'csv': self.export_csv(result, base),
        }

        if PANDAS_AVAILABLE:
            outputs['excel'] = self.export_excel(result, f"{base}.xlsx")

        return outputs
