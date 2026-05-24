import json
import os
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import asdict
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TextColumn

from .exif_processor import ExifRecord, ExifStatus


console = Console()


class ReportGenerator:
    def __init__(self, records: List[ExifRecord]):
        self.records = records
        self.stats = self._calculate_stats()

    def _calculate_stats(self) -> Dict[str, Any]:
        total = len(self.records)
        success = sum(1 for r in self.records if r.status == ExifStatus.SUCCESS)
        corrupted = sum(1 for r in self.records if r.status == ExifStatus.CORRUPTED)
        errors = sum(1 for r in self.records if r.status == ExifStatus.ERROR)
        no_exif = sum(1 for r in self.records if r.status == ExifStatus.NO_EXIF)
        gps_found = sum(1 for r in self.records if r.gps_found)
        thumbnail_issues = sum(1 for r in self.records if r.thumbnail_issue)
        total_removed = sum(len(r.removed_fields) for r in self.records)
        total_preserved = sum(len(r.preserved_fields) for r in self.records)
        avg_time = sum(r.processing_time for r in self.records) / total if total > 0 else 0

        camera_models = {}
        for r in self.records:
            if r.camera_model:
                camera_models[r.camera_model] = camera_models.get(r.camera_model, 0) + 1

        return {
            "total": total,
            "success": success,
            "corrupted": corrupted,
            "errors": errors,
            "no_exif": no_exif,
            "gps_found": gps_found,
            "thumbnail_issues": thumbnail_issues,
            "total_removed_fields": total_removed,
            "total_preserved_fields": total_preserved,
            "avg_processing_time": avg_time,
            "camera_models": camera_models,
        }

    def print_terminal_summary(self) -> None:
        console.print()
        console.print(Panel.fit(
            "[bold blue]图片 EXIF 合规清理报告[/bold blue]",
            subtitle=f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            border_style="blue"
        ))
        console.print()

        stats_table = Table(title="处理统计", show_header=True, header_style="bold magenta")
        stats_table.add_column("指标", style="cyan")
        stats_table.add_column("数值", justify="right")
        stats_table.add_row("总处理文件数", str(self.stats["total"]))
        stats_table.add_row("成功清理", f"[green]{self.stats['success']}[/green]")
        stats_table.add_row("无 EXIF 数据", str(self.stats["no_exif"]))
        stats_table.add_row("损坏图片", f"[yellow]{self.stats['corrupted']}[/yellow]")
        stats_table.add_row("处理错误", f"[red]{self.stats['errors']}[/red]")
        stats_table.add_row("发现 GPS 数据", f"[bold red]{self.stats['gps_found']}[/bold red]")
        stats_table.add_row("发现缩略图元数据", str(self.stats["thumbnail_issues"]))
        stats_table.add_row("移除字段总数", str(self.stats["total_removed_fields"]))
        stats_table.add_row("保留字段总数", f"[green]{self.stats['total_preserved_fields']}[/green]")
        stats_table.add_row("平均处理时间", f"{self.stats['avg_processing_time']:.3f}s")
        console.print(stats_table)
        console.print()

        if self.stats["camera_models"]:
            camera_table = Table(title="相机型号分布", show_header=True, header_style="bold magenta")
            camera_table.add_column("相机型号", style="cyan")
            camera_table.add_column("数量", justify="right")
            for model, count in sorted(self.stats["camera_models"].items(), key=lambda x: -x[1]):
                camera_table.add_row(model, str(count))
            console.print(camera_table)
            console.print()

        error_records = [r for r in self.records if r.status in (ExifStatus.ERROR, ExifStatus.CORRUPTED)]
        if error_records:
            error_table = Table(
                title="无法处理的文件（点击路径可定位）",
                show_header=True,
                header_style="bold red",
                caption="注意: 行号对应处理顺序，损坏文件已保留原始位置"
            )
            error_table.add_column("行号", style="yellow", justify="right")
            error_table.add_column("状态", style="red")
            error_table.add_column("文件路径", style="cyan", overflow="fold")
            error_table.add_column("错误信息", style="magenta", overflow="fold")
            
            for r in error_records:
                status_text = "损坏" if r.status == ExifStatus.CORRUPTED else "错误"
                error_table.add_row(
                    str(r.line_number),
                    status_text,
                    r.file_path,
                    r.error_message[:80] + "..." if len(r.error_message) > 80 else r.error_message
                )
            console.print(error_table)
            console.print()

        exit_code = self._get_exit_code()
        if exit_code == 0:
            console.print(Panel("[green]✓ 处理完成，所有图片已合规[/green]", border_style="green"))
        elif exit_code == 1:
            console.print(Panel("[yellow]⚠ 处理完成，但存在部分警告（损坏图片已保留）[/yellow]", border_style="yellow"))
        else:
            console.print(Panel("[red]✗ 处理失败，存在错误[/red]", border_style="red"))
        console.print()

    def generate_json(self, output_path: str) -> None:
        data = {
            "generated_at": datetime.now().isoformat(),
            "statistics": self.stats,
            "records": []
        }

        for record in self.records:
            record_dict = asdict(record)
            record_dict["status"] = record.status.value
            record_dict.pop("original_exif", None)
            record_dict.pop("cleaned_exif", None)
            data["records"].append(record_dict)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def generate_markdown(self, output_path: str) -> None:
        lines = []
        lines.append("# 图片 EXIF 合规清理报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("## 处理统计")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总处理文件数 | {self.stats['total']} |")
        lines.append(f"| 成功清理 | {self.stats['success']} |")
        lines.append(f"| 无 EXIF 数据 | {self.stats['no_exif']} |")
        lines.append(f"| 损坏图片 | {self.stats['corrupted']} |")
        lines.append(f"| 处理错误 | {self.stats['errors']} |")
        lines.append(f"| 发现 GPS 数据 | {self.stats['gps_found']} |")
        lines.append(f"| 发现缩略图元数据 | {self.stats['thumbnail_issues']} |")
        lines.append(f"| 移除字段总数 | {self.stats['total_removed_fields']} |")
        lines.append(f"| 保留字段总数 | {self.stats['total_preserved_fields']} |")
        lines.append(f"| 平均处理时间 | {self.stats['avg_processing_time']:.3f}s |")
        lines.append("")

        if self.stats["camera_models"]:
            lines.append("## 相机型号分布")
            lines.append("")
            lines.append("| 相机型号 | 数量 |")
            lines.append("|----------|------|")
            for model, count in sorted(self.stats["camera_models"].items(), key=lambda x: -x[1]):
                lines.append(f"| {model} | {count} |")
            lines.append("")

        lines.append("## 清理规则说明")
        lines.append("")
        lines.append("### 已移除的字段类型")
        lines.append("- **GPS 定位信息**: 所有 GPS 相关字段（经纬度、海拔、时间戳等）")
        lines.append("- **设备信息**: 相机厂商、型号、序列号、镜头信息等")
        lines.append("- **软件信息**: 拍摄软件、编辑软件版本等")
        lines.append("- **缩略图元数据**: 内嵌缩略图及其 EXIF 信息")
        lines.append("")
        lines.append("### 保留的字段类型")
        lines.append("- **拍摄日期**: DateTimeOriginal, DateTimeDigitized 用于归档")
        lines.append("- **方向信息**: 图片旋转方向（可配置）")
        lines.append("")

        gps_records = [r for r in self.records if r.gps_found]
        if gps_records:
            lines.append("## GPS 数据清理详情")
            lines.append("")
            lines.append("| 行号 | 文件 | 相机型号 | 移除的GPS字段数 |")
            lines.append("|------|------|----------|----------------|")
            for r in gps_records:
                gps_removed = sum(1 for f in r.removed_fields if f.startswith("GPS:"))
                lines.append(f"| {r.line_number} | `{os.path.basename(r.file_path)}` | {r.camera_model or '-'} | {gps_removed} |")
            lines.append("")

        error_records = [r for r in self.records if r.status in (ExifStatus.ERROR, ExifStatus.CORRUPTED)]
        if error_records:
            lines.append("## 无法处理的文件记录")
            lines.append("")
            lines.append("> **注意**: 损坏的图片不会被修改，保留在原始位置以便人工处理")
            lines.append("")
            lines.append("| 行号 | 状态 | 文件路径 | 错误信息 |")
            lines.append("|------|------|----------|----------|")
            for r in error_records:
                status = "文件损坏" if r.status == ExifStatus.CORRUPTED else "处理错误"
                lines.append(f"| {r.line_number} | {status} | `{r.file_path}` | {r.error_message} |")
            lines.append("")

        lines.append("## 处理详情")
        lines.append("")
        lines.append("| 行号 | 文件 | 状态 | 移除字段 | 保留字段 | 输出路径 |")
        lines.append("|------|------|------|----------|----------|----------|")
        for r in self.records:
            removed = ", ".join(r.removed_fields[:3])
            if len(r.removed_fields) > 3:
                removed += f" (+{len(r.removed_fields)-3})"
            preserved = ", ".join(r.preserved_fields[:3])
            if len(r.preserved_fields) > 3:
                preserved += f" (+{len(r.preserved_fields)-3})"
            lines.append(f"| {r.line_number} | `{os.path.basename(r.file_path)}` | {r.status.value} | {removed or '-'} | {preserved or '-'} | `{os.path.basename(r.output_path) if r.output_path else '-'}` |")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*报告由 EXIF 合规清理工具自动生成*")

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def generate_detailed_json(self, output_path: str) -> None:
        data = {
            "generated_at": datetime.now().isoformat(),
            "statistics": self.stats,
            "records": []
        }

        for record in self.records:
            record_dict = {
                "line_number": record.line_number,
                "file_path": record.file_path,
                "output_path": record.output_path,
                "status": record.status.value,
                "gps_found": record.gps_found,
                "thumbnail_issue": record.thumbnail_issue,
                "camera_model": record.camera_model,
                "removed_fields": record.removed_fields,
                "preserved_fields": record.preserved_fields,
                "error_message": record.error_message,
                "processing_time": record.processing_time,
                "original_exif_summary": {
                    k: list(v.keys()) for k, v in record.original_exif.items() if v
                },
            }
            data["records"].append(record_dict)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _get_exit_code(self) -> int:
        if self.stats["errors"] > 0:
            return 2
        if self.stats["corrupted"] > 0:
            return 1
        return 0

    def get_exit_code(self) -> int:
        return self._get_exit_code()
