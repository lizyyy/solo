import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from tabulate import tabulate
from colorama import Fore, Style, init

from .executor import (
    TaskExecutionResult,
    RegionTaskResult,
    TaskStatus,
    RegionTaskStatus
)

init(autoreset=True)


class ConsoleReporter:
    STATUS_COLORS = {
        RegionTaskStatus.SUCCESS: Fore.GREEN,
        RegionTaskStatus.FAILED: Fore.RED,
        RegionTaskStatus.SKIPPED: Fore.YELLOW,
        RegionTaskStatus.INCONSISTENT: Fore.MAGENTA,
        RegionTaskStatus.DUPLICATE: Fore.CYAN,
        RegionTaskStatus.RETRYING: Fore.BLUE,
        RegionTaskStatus.PENDING: Fore.WHITE,
        RegionTaskStatus.IN_PROGRESS: Fore.BLUE,
    }

    STATUS_DISPLAY = {
        RegionTaskStatus.SUCCESS: "成功",
        RegionTaskStatus.FAILED: "失败",
        RegionTaskStatus.SKIPPED: "跳过",
        RegionTaskStatus.INCONSISTENT: "不一致",
        RegionTaskStatus.DUPLICATE: "重复",
        RegionTaskStatus.RETRYING: "重试中",
        RegionTaskStatus.PENDING: "待处理",
        RegionTaskStatus.IN_PROGRESS: "处理中",
    }

    TASK_STATUS_DISPLAY = {
        TaskStatus.SUCCESS: "全部成功",
        TaskStatus.FAILED: "部分失败",
        TaskStatus.INCONSISTENT: "数据不一致",
        TaskStatus.PARTIAL_SUCCESS: "部分成功",
        TaskStatus.PENDING: "待处理",
    }

    def print_pre_check(self, errors: List[str], warnings: List[str], info: List[str]):
        print("\n" + "=" * 60)
        print("预检结果")
        print("=" * 60)

        if info:
            print(f"\n{Fore.CYAN}信息:{Style.RESET_ALL}")
            for msg in info:
                print(f"  ✓ {msg}")

        if warnings:
            print(f"\n{Fore.YELLOW}警告:{Style.RESET_ALL}")
            for msg in warnings:
                print(f"  ⚠ {msg}")

        if errors:
            print(f"\n{Fore.RED}错误:{Style.RESET_ALL}")
            for msg in errors:
                print(f"  ✗ {msg}")

        print("\n" + "=" * 60)

    def print_task_result(self, task_result: TaskExecutionResult):
        task_status_color = {
            TaskStatus.SUCCESS: Fore.GREEN,
            TaskStatus.FAILED: Fore.RED,
            TaskStatus.INCONSISTENT: Fore.MAGENTA,
            TaskStatus.PARTIAL_SUCCESS: Fore.YELLOW,
        }.get(task_result.status, Fore.WHITE)

        print("\n" + "-" * 60)
        print(f"任务: {task_result.task_id}")
        print(f"模板: {task_result.template}")
        print(f"缓存键: {task_result.cache_key}")
        print(f"状态: {task_status_color}{self.TASK_STATUS_DISPLAY.get(task_result.status, task_result.status.value)}{Style.RESET_ALL}")

        if task_result.errors:
            print(f"\n{Fore.RED}任务错误:{Style.RESET_ALL}")
            for error in task_result.errors:
                print(f"  ✗ {error}")

        if task_result.warnings:
            print(f"\n{Fore.YELLOW}任务警告:{Style.RESET_ALL}")
            for warning in task_result.warnings:
                print(f"  ⚠ {warning}")

        print("\n区域处理状态:")
        table_data = []
        for region_id, region_result in sorted(task_result.region_results.items()):
            color = self.STATUS_COLORS.get(region_result.status, Fore.WHITE)
            status_display = self.STATUS_DISPLAY.get(region_result.status, region_result.status.value)
            
            failure_reason = region_result.failure_reason or ""
            skip_reason = region_result.skip_reason or ""
            
            table_data.append([
                region_result.region_name,
                color + status_display + Style.RESET_ALL,
                region_result.retry_count,
                failure_reason[:50] if failure_reason else "",
                skip_reason[:50] if skip_reason else "",
            ])

        headers = ["区域", "状态", "重试次数", "失败原因", "跳过原因"]
        print(tabulate(table_data, headers=headers, tablefmt="simple"))

    def print_summary(self, all_results: List[TaskExecutionResult]):
        total_tasks = len(all_results)
        success_tasks = sum(1 for r in all_results if r.status == TaskStatus.SUCCESS)
        failed_tasks = sum(1 for r in all_results if r.status == TaskStatus.FAILED)
        inconsistent_tasks = sum(1 for r in all_results if r.status == TaskStatus.INCONSISTENT)
        partial_tasks = sum(1 for r in all_results if r.status == TaskStatus.PARTIAL_SUCCESS)

        print("\n" + "=" * 60)
        print("执行汇总")
        print("=" * 60)
        print(f"总任务数: {total_tasks}")
        print(f"{Fore.GREEN}全部成功: {success_tasks}{Style.RESET_ALL}")
        print(f"{Fore.RED}部分失败: {failed_tasks}{Style.RESET_ALL}")
        print(f"{Fore.MAGENTA}数据不一致: {inconsistent_tasks}{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}部分成功: {partial_tasks}{Style.RESET_ALL}")
        print("=" * 60)


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.console_reporter = ConsoleReporter()

    def generate_report(
        self,
        results: List[TaskExecutionResult],
        pre_check_errors: List[str] = None,
        pre_check_warnings: List[str] = None,
        pre_check_info: List[str] = None,
        report_name: str = None
    ) -> str:
        if pre_check_errors or pre_check_warnings or pre_check_info:
            self.console_reporter.print_pre_check(
                pre_check_errors or [],
                pre_check_warnings or [],
                pre_check_info or []
            )

        for result in results:
            self.console_reporter.print_task_result(result)

        self.console_reporter.print_summary(results)

        report_name = report_name or f"cache_invalidation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        json_file = self.output_dir / f"{report_name}.json"
        txt_file = self.output_dir / f"{report_name}.txt"

        self._save_json_report(results, json_file)
        self._save_text_report(results, txt_file, pre_check_errors, pre_check_warnings, pre_check_info)

        print(f"\n报告已生成:")
        print(f"  JSON: {json_file}")
        print(f"  文本: {txt_file}")

        return str(txt_file)

    def _save_json_report(self, results: List[TaskExecutionResult], file_path: Path):
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "tasks": []
        }

        for result in results:
            task_data = {
                "task_id": result.task_id,
                "template": result.template,
                "cache_key": result.cache_key,
                "status": result.status.value,
                "errors": result.errors,
                "warnings": result.warnings,
                "start_time": result.start_time.isoformat() if result.start_time else None,
                "end_time": result.end_time.isoformat() if result.end_time else None,
                "regions": [],
                "recommendations": self._generate_recommendations(result)
            }

            for region_id, region_result in sorted(result.region_results.items()):
                region_data = {
                    "region_id": region_result.region_id,
                    "region_name": region_result.region_name,
                    "cache_key": region_result.cache_key,
                    "status": region_result.status.value,
                    "retry_count": region_result.retry_count,
                    "failure_reason": region_result.failure_reason,
                    "skip_reason": region_result.skip_reason,
                    "is_consistent": region_result.is_consistent,
                    "old_value": region_result.old_value,
                    "actual_value": region_result.actual_value,
                    "expected_value": region_result.expected_value,
                }
                task_data["regions"].append(region_data)

            report_data["tasks"].append(task_data)

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

    def _save_text_report(
        self,
        results: List[TaskExecutionResult],
        file_path: Path,
        errors: List[str] = None,
        warnings: List[str] = None,
        info: List[str] = None
    ):
        lines = []
        lines.append("=" * 70)
        lines.append("多区域缓存失效报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 70)

        if errors or warnings or info:
            lines.append("\n预检结果")
            lines.append("-" * 70)
            if info:
                lines.append("\n信息:")
                for msg in info:
                    lines.append(f"  ✓ {msg}")
            if warnings:
                lines.append("\n警告:")
                for msg in warnings:
                    lines.append(f"  ⚠ {msg}")
            if errors:
                lines.append("\n错误:")
                for msg in errors:
                    lines.append(f"  ✗ {msg}")

        for result in results:
            lines.append("\n" + "-" * 70)
            lines.append(f"任务: {result.task_id}")
            lines.append(f"模板: {result.template}")
            lines.append(f"缓存键: {result.cache_key}")
            lines.append(f"状态: {result.status.value}")

            if result.errors:
                lines.append("\n任务错误:")
                for error in result.errors:
                    lines.append(f"  ✗ {error}")

            if result.warnings:
                lines.append("\n任务警告:")
                for warning in result.warnings:
                    lines.append(f"  ⚠ {warning}")

            inconsistent_regions = [
                r for r in result.region_results.values()
                if not r.is_consistent or r.status == RegionTaskStatus.INCONSISTENT
            ]

            if inconsistent_regions:
                lines.append("\n旧值残留区域:")
                for r in inconsistent_regions:
                    lines.append(f"\n  区域: {r.region_name} ({r.region_id})")
                    lines.append(f"  状态: {r.status.value}")
                    lines.append(f"  缓存键: {r.cache_key}")
                    if r.old_value:
                        lines.append(f"  旧值: {r.old_value}")
                    if r.actual_value:
                        lines.append(f"  当前值: {r.actual_value}")
                    if r.expected_value:
                        lines.append(f"  期望值: {r.expected_value}")
                    if r.failure_reason:
                        lines.append(f"  失败原因: {r.failure_reason}")

            recommendations = self._generate_recommendations(result)
            if recommendations:
                lines.append("\n下一步建议:")
                for rec in recommendations:
                    lines.append(f"  → {rec}")

        lines.append("\n" + "=" * 70)
        lines.append("执行汇总")
        lines.append("=" * 70)
        total_tasks = len(results)
        success_tasks = sum(1 for r in results if r.status == TaskStatus.SUCCESS)
        failed_tasks = sum(1 for r in results if r.status == TaskStatus.FAILED)
        inconsistent_tasks = sum(1 for r in results if r.status == TaskStatus.INCONSISTENT)
        partial_tasks = sum(1 for r in results if r.status == TaskStatus.PARTIAL_SUCCESS)

        lines.append(f"总任务数: {total_tasks}")
        lines.append(f"全部成功: {success_tasks}")
        lines.append(f"部分失败: {failed_tasks}")
        lines.append(f"数据不一致: {inconsistent_tasks}")
        lines.append(f"部分成功: {partial_tasks}")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    def _generate_recommendations(self, result: TaskExecutionResult) -> List[str]:
        recommendations = []

        if result.status == TaskStatus.SUCCESS:
            return recommendations

        failed_regions = [
            r for r in result.region_results.values()
            if r.status == RegionTaskStatus.FAILED
        ]
        inconsistent_regions = [
            r for r in result.region_results.values()
            if r.status == RegionTaskStatus.INCONSISTENT or not r.is_consistent
        ]
        skipped_without_reason = [
            r for r in result.region_results.values()
            if r.status == RegionTaskStatus.SKIPPED and r.skip_reason == "未提供跳过原因"
        ]

        if failed_regions:
            recommendations.append(
                f"以下区域失效失败，请检查网络连接和缓存服务状态: {', '.join(r.region_name for r in failed_regions)}"
            )
            recommendations.append(
                "建议: 1) 检查缓存服务是否正常运行 2) 验证网络连通性 3) 确认权限配置"
            )

        if inconsistent_regions:
            recommendations.append(
                f"以下区域存在旧值残留，请手动清理或排查失效机制: {', '.join(r.region_name for r in inconsistent_regions)}"
            )
            recommendations.append(
                "建议: 1) 检查是否存在缓存写入 race condition 2) 手动执行 DELETE 命令清理残留键 3) 验证缓存过期策略"
            )

        if skipped_without_reason:
            recommendations.append(
                f"以下区域被跳过但未提供原因，请补充文档: {', '.join(r.region_name for r in skipped_without_reason)}"
            )

        if result.warnings:
            recommendations.append(
                "存在重复任务或配置警告，请检查任务清单避免重复执行"
            )

        return recommendations
