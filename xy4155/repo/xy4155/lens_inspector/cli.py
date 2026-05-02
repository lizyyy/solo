"""镜头瑕疵分拣台 - 命令行交互界面"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.prompt import Prompt, Confirm

from .models import (
    SessionState,
    LensInspection,
    ImageFeatures,
    DefectDetection,
    InspectionStatus,
    DefectType,
)
from .validator import DataValidator, ValidationError
from .image_features import ImageFeatureExtractor
from .clustering import ClusteringPipeline, AnomalyScorer, DefectClusterer
from .storage import StateStorage, StateStorageError
from .reporter import ReportGenerator


console = Console()


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                    镜头瑕疵分拣台                              ║
║         LENS DEFECT SORTING STATION - v0.1.0                 ║
╠══════════════════════════════════════════════════════════════╣
║  二手相机检测师专用AI工具                                       ║
║  支持: 清晰度/暗角/色偏/坏点检测 + 缺陷聚类 + 人工确认         ║
╚══════════════════════════════════════════════════════════════╝
"""
    console.print(banner, style="cyan")


def get_storage() -> StateStorage:
    storage_dir = os.environ.get("LENS_INSPECTOR_STORAGE", None)
    return StateStorage(storage_dir)


@click.group()
@click.version_option(version="0.1.0", prog_name="lens-inspector")
def cli():
    """镜头瑕疵分拣台 - 二手相机检测AI工具"""
    pass


@cli.command(name="import", help="导入图片目录和备注CSV")
@click.option("--images", "-i", required=True, type=click.Path(exists=True), help="图片目录路径")
@click.option("--notes", "-n", type=click.Path(exists=True), default="", help="备注CSV文件路径")
@click.option("--session", "-s", help="指定会话ID（可选，自动生成）")
def import_data(images: str, notes: str, session: Optional[str]):
    """导入图片目录和备注CSV，创建新的检测会话"""
    print_banner()

    storage = get_storage()

    try:
        console.print(f"\n[bold blue]正在导入数据...[/bold blue]")
        console.print(f"  图片目录: {images}")
        if notes:
            console.print(f"  备注CSV: {notes}")

        grouped_images, notes_dict, errors = DataValidator.validate_session(
            images, notes if notes else None
        )

        if errors:
            console.print("\n[yellow]⚠️  警告信息:[/yellow]")
            for err in errors:
                console.print(f"    - {err}")

        console.print(f"\n[green]✓ 数据验证通过[/green]")
        console.print(f"  发现 {len(grouped_images)} 个镜头组:")

        for lens_id, image_paths in sorted(grouped_images.items()):
            console.print(f"    - {lens_id}: {len(image_paths)} 张图片")

        state = storage.create_new_session(images, notes, session)

        for lens_id, image_paths in grouped_images.items():
            inspection = LensInspection(
                lens_id=lens_id,
                images=[str(p) for p in image_paths],
                status=InspectionStatus.PENDING,
            )

            if lens_id in notes_dict:
                inspection.note = notes_dict[lens_id]

            state.inspections[lens_id] = inspection

        saved_path = storage.save_session(state)

        console.print(f"\n[bold green]✓ 会话创建成功[/bold green]")
        console.print(f"  会话ID: {state.session_id}")
        console.print(f"  保存位置: {saved_path}")

    except ValidationError as e:
        console.print(f"\n[bold red]✗ 数据验证失败: {e}[/bold red]")
        if e.errors:
            for err in e.errors:
                console.print(f"    - {err}")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[bold red]✗ 导入失败: {e}[/bold red]")
        raise


@cli.command(name="analyze", help="运行图像分析，提取特征并计算异常评分")
@click.option("--session", "-s", required=True, help="会话ID")
@click.option("--resize", "-r", type=int, default=1024, help="图像最大尺寸(像素)，默认1024")
@click.option("--parallel", "-p", is_flag=True, help="并行处理(实验性功能)")
def analyze_images(session: str, resize: int, parallel: bool):
    """运行图像特征提取和异常评分"""
    print_banner()

    storage = get_storage()

    try:
        console.print(f"\n[bold blue]加载会话: {session}[/bold blue]")
        state = storage.load_session(session)

        if not state.inspections:
            console.print("[yellow]⚠️  会话中没有检测数据[/yellow]")
            return

        pending_count = sum(
            1 for insp in state.inspections.values()
            if insp.status == InspectionStatus.PENDING
        )

        if pending_count == 0:
            console.print("[green]所有镜头已完成分析[/green]")
            return

        console.print(f"\n[bold]待分析镜头数量: {pending_count}[/bold]")

        extractor = ImageFeatureExtractor(resize_max_dim=resize)
        scorer = AnomalyScorer()

        total_lenses = len(state.inspections)
        processed = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
        ) as progress:
            main_task = progress.add_task(
                "分析中...",
                total=total_lenses,
            )

            for lens_id, inspection in state.inspections.items():
                if inspection.status == InspectionStatus.PENDING:
                    progress.update(
                        main_task,
                        description=f"分析镜头: {lens_id}",
                    )

                    for image_path in inspection.images:
                        image_id = Path(image_path).stem
                        try:
                            features, defects = extractor.extract_all_features(
                                image_path, image_id
                            )
                            inspection.image_features[image_id] = features
                            inspection.defects.extend(defects)
                        except Exception as e:
                            console.print(f"\n[yellow]⚠️  处理图片失败 {image_path}: {e}[/yellow]")

                    anomaly_score, breakdown = scorer.score_lens_inspection(inspection)
                    inspection.anomaly_score = anomaly_score
                    inspection.anomaly_score_breakdown = breakdown
                    inspection.status = InspectionStatus.COMPLETED

                    processed += 1

                progress.update(main_task, advance=1)

        console.print(f"\n[bold blue]运行缺陷聚类...[/bold blue]")

        pipeline = ClusteringPipeline()
        state.inspections = pipeline.process_inspections(state.inspections)
        summary = pipeline.get_anomaly_summary(state.inspections)

        storage.save_session(state)

        console.print(f"\n[bold green]✓ 分析完成[/bold green]")
        console.print(f"  总镜头数: {summary['count']}")
        console.print(f"  平均异常评分: {summary['mean_score']:.3f}")
        console.print(f"  高异常镜头数: {summary['high_anomaly_count']}")

        if summary["clusters"]:
            console.print(f"\n[bold]聚类分布:[/bold]")
            for cid, info in summary["clusters"].items():
                console.print(
                    f"  {info['label']}: {info['count']} 个镜头 "
                    f"(平均评分: {info['avg_score']:.3f})"
                )

    except StateStorageError as e:
        console.print(f"\n[bold red]✗ 存储错误: {e}[/bold red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[bold red]✗ 分析失败: {e}[/bold red]")
        raise


@cli.command(name="list", help="列出所有检测会话")
def list_sessions():
    """列出所有检测会话"""
    print_banner()

    storage = get_storage()

    try:
        sessions = storage.list_sessions()

        if not sessions:
            console.print("\n[yellow]没有找到任何检测会话[/yellow]")
            return

        table = Table(title="检测会话列表")
        table.add_column("会话ID", style="cyan")
        table.add_column("检测目录", style="green")
        table.add_column("镜头数", style="magenta")
        table.add_column("创建时间", style="yellow")
        table.add_column("更新时间", style="yellow")

        for sess in sessions:
            table.add_row(
                sess.get("session_id", "N/A"),
                sess.get("inspection_dir", "N/A")[:40] + "..." if len(sess.get("inspection_dir", "")) > 40 else sess.get("inspection_dir", "N/A"),
                str(sess.get("inspection_count", 0)),
                sess.get("created_at", "N/A")[:19] if "T" in sess.get("created_at", "") else sess.get("created_at", "N/A"),
                sess.get("updated_at", "N/A")[:19] if "T" in sess.get("updated_at", "") else sess.get("updated_at", "N/A"),
            )

        console.print(table)

    except StateStorageError as e:
        console.print(f"\n[bold red]✗ 读取会话列表失败: {e}[/bold red]")
        sys.exit(1)


@cli.command(name="status", help="查看会话检测状态")
@click.option("--session", "-s", required=True, help="会话ID")
@click.option("--lens", "-l", help="指定镜头ID查看详情")
@click.option("--show-all", "-a", is_flag=True, help="显示所有镜头（包括正常的）")
def show_status(session: str, lens: Optional[str], show_all: bool):
    """查看检测状态和详情"""
    print_banner()

    storage = get_storage()

    try:
        state = storage.load_session(session)

        if lens:
            if lens not in state.inspections:
                console.print(f"\n[bold red]✗ 未找到镜头: {lens}[/bold red]")
                sys.exit(1)

            inspection = state.inspections[lens]

            console.print(f"\n[bold]镜头详情: {lens}[/bold]")
            console.print(f"  状态: {inspection.status.value}")
            console.print(f"  异常评分: {inspection.anomaly_score:.3f}")
            console.print(f"  聚类: {inspection.cluster_label or '未聚类'}")
            console.print(f"  图片数量: {len(inspection.images)}")

            if inspection.human_verified:
                console.print(f"  人工确认: ✅ 已确认")
                if inspection.human_notes:
                    console.print(f"  人工备注: {inspection.human_notes}")

            if inspection.anomaly_score_breakdown:
                console.print(f"\n[bold]评分详情:[/bold]")
                for key, value in inspection.anomaly_score_breakdown.items():
                    label = {
                        "sharpness": "清晰度",
                        "dark_corner": "暗角",
                        "color_shift": "色偏",
                        "dead_pixel": "坏点",
                        "hot_pixel": "热点",
                        "noise": "噪点",
                    }.get(key, key)
                    console.print(f"  {label}: {value:.3f}")

            if inspection.defects:
                console.print(f"\n[bold]检测到的缺陷 ({len(inspection.defects)} 个):[/bold]")
                for defect in inspection.defects:
                    severity_style = "red" if defect.severity == "高" else "yellow" if defect.severity == "中" else "green"
                    console.print(
                        f"  [{severity_style}]●[/{severity_style}] "
                        f"{defect.defect_type.value} "
                        f"(置信度: {defect.confidence:.2f}, 严重程度: {defect.severity})"
                    )
                    console.print(f"    描述: {defect.description}")

            if inspection.similar_defects:
                console.print(f"\n[bold]相似缺陷镜头:[/bold]")
                console.print(f"  {', '.join(inspection.similar_defects)}")

            if inspection.note:
                console.print(f"\n[bold]原始备注:[/bold]")
                if inspection.note.notes:
                    console.print(f"  备注: {inspection.note.notes}")
                if inspection.note.body_id:
                    console.print(f"  机身编号: {inspection.note.body_id}")
                if inspection.note.inspector:
                    console.print(f"  检测员: {inspection.note.inspector}")

        else:
            inspections = state.inspections

            if not show_all:
                inspections = {
                    k: v
                    for k, v in inspections.items()
                    if v.anomaly_score > 0.1 or v.defects or v.human_verified
                }

            if not inspections:
                console.print("\n[green]所有镜头检测正常，无明显缺陷[/green]")
                return

            sorted_inspections = sorted(
                inspections.items(),
                key=lambda x: x[1].anomaly_score,
                reverse=True,
            )

            table = Table(title=f"检测结果 - 会话 {session}")
            table.add_column("镜头ID", style="cyan")
            table.add_column("异常评分", style="magenta")
            table.add_column("状态", style="green")
            table.add_column("聚类", style="yellow")
            table.add_column("缺陷数", style="red")
            table.add_column("人工确认", style="blue")

            for lens_id, inspection in sorted_inspections:
                score_style = "bold red" if inspection.anomaly_score > 0.7 else "red" if inspection.anomaly_score > 0.4 else "yellow" if inspection.anomaly_score > 0.1 else "green"
                table.add_row(
                    lens_id,
                    f"[{score_style}]{inspection.anomaly_score:.3f}[/{score_style}]",
                    inspection.status.value,
                    inspection.cluster_label or "-",
                    str(len(inspection.defects)),
                    "✅" if inspection.human_verified else "-",
                )

            console.print(table)

            console.print(f"\n[bold]统计:[/bold]")
            console.print(f"  总镜头数: {len(state.inspections)}")
            console.print(f"  本报告显示: {len(inspections)}")

            status_counts: Dict[str, int] = {}
            for insp in state.inspections.values():
                status = insp.status.value
                status_counts[status] = status_counts.get(status, 0) + 1

            console.print(f"  状态分布: {status_counts}")

    except StateStorageError as e:
        console.print(f"\n[bold red]✗ 加载会话失败: {e}[/bold red]")
        sys.exit(1)


@cli.command(name="confirm", help="人工确认检测结果")
@click.option("--session", "-s", required=True, help="会话ID")
@click.option("--lens", "-l", help="指定镜头ID，不指定则进入交互模式")
@click.option("--notes", "-n", default="", help="人工备注")
@click.option("--flag", "-f", is_flag=True, help="标记为需要复检")
def confirm_results(session: str, lens: Optional[str], notes: str, flag: bool):
    """人工确认或标记复检"""
    print_banner()

    storage = get_storage()

    try:
        state = storage.load_session(session)

        if lens:
            if lens not in state.inspections:
                console.print(f"\n[bold red]✗ 未找到镜头: {lens}[/bold red]")
                sys.exit(1)

            if flag:
                storage.flag_for_review(state, lens, notes)
                console.print(f"\n[yellow]⚠️  镜头 {lens} 已标记为需要复检[/yellow]")
            else:
                storage.confirm_inspection(state, lens, notes)
                console.print(f"\n[green]✓ 镜头 {lens} 已人工确认[/green]")

            storage.save_session(state)

        else:
            need_attention = {
                k: v
                for k, v in state.inspections.items()
                if v.anomaly_score > 0.1 and not v.human_verified
            }

            if not need_attention:
                console.print("\n[green]所有需要关注的镜头都已确认[/green]")
                return

            console.print(f"\n[bold]待确认镜头 ({len(need_attention)} 个):[/bold]")

            sorted_lenses = sorted(
                need_attention.items(),
                key=lambda x: x[1].anomaly_score,
                reverse=True,
            )

            for i, (lens_id, inspection) in enumerate(sorted_lenses, 1):
                score_style = "bold red" if inspection.anomaly_score > 0.7 else "red" if inspection.anomaly_score > 0.4 else "yellow"
                console.print(
                    f"  {i}. {lens_id} - "
                    f"[{score_style}]评分: {inspection.anomaly_score:.3f}[/{score_style}], "
                    f"缺陷数: {len(inspection.defects)}"
                )

            while True:
                choice = Prompt.ask(
                    "\n请选择操作",
                    choices=["confirm", "flag", "skip", "quit"],
                    default="confirm",
                )

                if choice == "quit":
                    break

                if choice == "skip":
                    continue

                target_lens = Prompt.ask("请输入镜头ID或序号")

                selected_lens = None
                if target_lens.isdigit():
                    idx = int(target_lens) - 1
                    if 0 <= idx < len(sorted_lenses):
                        selected_lens = sorted_lenses[idx][0]
                else:
                    if target_lens in need_attention:
                        selected_lens = target_lens

                if not selected_lens:
                    console.print("[red]无效的镜头ID或序号[/red]")
                    continue

                if choice == "confirm":
                    notes_input = Prompt.ask("输入备注（可选）", default="")
                    storage.confirm_inspection(state, selected_lens, notes_input)
                    console.print(f"[green]✓ {selected_lens} 已确认[/green]")

                elif choice == "flag":
                    notes_input = Prompt.ask("输入复检备注（可选）", default="")
                    storage.flag_for_review(state, selected_lens, notes_input)
                    console.print(f"[yellow]⚠️  {selected_lens} 已标记复检[/yellow]")

                storage.save_session(state)

                if selected_lens in need_attention:
                    del need_attention[selected_lens]
                    sorted_lenses = [
                        (k, v) for k, v in sorted_lenses if k != selected_lens
                    ]

                if not need_attention:
                    console.print("\n[green]所有镜头都已处理[/green]")
                    break

    except StateStorageError as e:
        console.print(f"\n[bold red]✗ 存储错误: {e}[/bold red]")
        sys.exit(1)


@cli.command(name="export", help="导出检测报告")
@click.option("--session", "-s", required=True, help="会话ID")
@click.option("--format", "-f", type=click.Choice(["markdown", "csv", "json", "all"]), default="all", help="导出格式")
@click.option("--output", "-o", required=True, help="输出目录路径")
@click.option("--include-all", "-a", is_flag=True, help="包含所有镜头（包括正常的）")
def export_reports(session: str, format: str, output: str, include_all: bool):
    """导出检测报告"""
    print_banner()

    storage = get_storage()
    reporter = ReportGenerator()

    try:
        state = storage.load_session(session)
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        console.print(f"\n[bold blue]导出报告到: {output_path}[/bold blue]")

        if format in ["markdown", "all"]:
            md_path = output_path / f"inspection_report_{timestamp}.md"
            reporter.generate_markdown_report(
                state, str(md_path), include_all=include_all, include_normal=include_all
            )
            console.print(f"[green]✓ Markdown报告: {md_path}[/green]")

        if format in ["csv", "all"]:
            csv_path = output_path / f"inspection_summary_{timestamp}.csv"
            reporter.generate_csv_report(state, str(csv_path))
            console.print(f"[green]✓ CSV摘要: {csv_path}[/green]")

            defects_csv = output_path / f"defect_details_{timestamp}.csv"
            reporter.generate_defect_details_csv(state, str(defects_csv))
            console.print(f"[green]✓ 缺陷明细CSV: {defects_csv}[/green]")

        if format in ["json", "all"]:
            json_path = output_path / f"audit_package_{timestamp}.json"
            reporter.generate_json_audit(state, str(json_path))
            console.print(f"[green]✓ JSON审计包: {json_path}[/green]")

        console.print(f"\n[bold green]✓ 导出完成[/bold green]")

    except StateStorageError as e:
        console.print(f"\n[bold red]✗ 存储错误: {e}[/bold red]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[bold red]✗ 导出失败: {e}[/bold red]")
        raise


@cli.command(name="delete", help="删除检测会话")
@click.option("--session", "-s", required=True, help="会话ID")
@click.option("--yes", "-y", is_flag=True, help="跳过确认")
def delete_session(session: str, yes: bool):
    """删除检测会话"""
    print_banner()

    storage = get_storage()

    try:
        if not yes:
            confirm = Confirm.ask(f"\n确定要删除会话 {session} 吗？", default=False)
            if not confirm:
                console.print("[yellow]操作已取消[/yellow]")
                return

        if storage.delete_session(session):
            console.print(f"[green]✓ 会话 {session} 已删除[/green]")
        else:
            console.print(f"[yellow]会话 {session} 不存在[/yellow]")

    except StateStorageError as e:
        console.print(f"\n[bold red]✗ 删除失败: {e}[/bold red]")
        sys.exit(1)


def main():
    cli()


if __name__ == "__main__":
    main()
