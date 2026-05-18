import os
import json
import time
import traceback
from pathlib import Path
from typing import Dict, List, Any

import click
import pandas as pd

from .audit_logic import SchoolBusAuditor, AuditCategory, AuditResult


@click.group()
def cli():
    pass


@cli.command()
@click.option(
    "--input",
    "-i",
    required=True,
    type=click.Path(exists=True, file_okay=True, dir_okay=True),
    help="输入文件或目录路径（支持 CSV、Excel）",
)
@click.option(
    "--output",
    "-o",
    required=True,
    type=click.Path(file_okay=False, dir_okay=True),
    help="输出目录路径",
)
@click.option(
    "--dry-run",
    "-n",
    is_flag=True,
    default=False,
    help="试运行模式，不写入文件，仅显示统计结果",
)
@click.option(
    "--overwrite",
    "-f",
    is_flag=True,
    default=False,
    help="覆盖已存在的输出文件",
)
@click.option(
    "--format",
    "-t",
    type=click.Choice(["csv", "excel", "json"]),
    default="excel",
    help="输出文件格式",
)
def audit(input: str, output: str, dry_run: bool, overwrite: bool, format: str):
    click.echo("=" * 60)
    click.echo("         校车运营队校车站点稽核 CLI 工具")
    click.echo("=" * 60)
    click.echo(f"开始时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo(f"输入路径: {input}")
    click.echo(f"输出路径: {output}")
    click.echo(f"试运行模式: {'是' if dry_run else '否'}")
    click.echo(f"覆盖模式: {'是' if overwrite else '否'}")
    click.echo(f"输出格式: {format}")
    click.echo("-" * 60)

    input_path = Path(input)
    output_path = Path(output)

    if not dry_run:
        try:
            output_path.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            click.echo(f"错误: 创建输出目录失败 - {str(e)}", err=True)
            raise click.Abort()

    files_to_process: List[Path] = []
    if input_path.is_file():
        files_to_process.append(input_path)
    else:
        for ext in [".csv", ".xlsx", ".xls"]:
            files_to_process.extend(input_path.glob(f"*{ext}"))

    if not files_to_process:
        click.echo("错误: 未找到任何支持的输入文件（.csv, .xlsx, .xls）", err=True)
        raise click.Abort()

    click.echo(f"找到 {len(files_to_process)} 个文件待处理")
    for i, f in enumerate(files_to_process, 1):
        click.echo(f"  {i}. {f.name}")
    click.echo("-" * 60)

    overall_results = {
        "total_files": len(files_to_process),
        "success_files": 0,
        "failed_files": 0,
        "failed_details": [],
        "file_results": {},
        "total_rows": 0,
        "normal_rows": 0,
        "position_drift_rows": 0,
        "temporary_site_rows": 0,
        "rerun_available_rows": 0,
    }

    auditor = SchoolBusAuditor()

    category_results: Dict[AuditCategory, List[Dict[str, Any]]] = {
        AuditCategory.NORMAL: [],
        AuditCategory.POSITION_DRIFT: [],
        AuditCategory.TEMPORARY_SITE: [],
        AuditCategory.RERUN_AVAILABLE: [],
    }

    for idx, file_path in enumerate(files_to_process, 1):
        file_name = file_path.name
        click.echo(f"\n[{idx}/{len(files_to_process)}] 处理文件: {file_name}")

        try:
            if file_path.suffix.lower() == ".csv":
                df = pd.read_csv(file_path)
            else:
                df = pd.read_excel(file_path)

            click.echo(f"  读取成功，共 {len(df)} 条记录")

            file_auditor = SchoolBusAuditor()
            file_category_results: Dict[AuditCategory, List[Dict[str, Any]]] = {
                AuditCategory.NORMAL: [],
                AuditCategory.POSITION_DRIFT: [],
                AuditCategory.TEMPORARY_SITE: [],
                AuditCategory.RERUN_AVAILABLE: [],
            }

            for _, row in df.iterrows():
                row_dict = row.to_dict()
                result = file_auditor.audit_row(row_dict)

                enriched_data = result.data.copy()
                enriched_data["稽核分类"] = result.category.value
                enriched_data["稽核原因"] = result.reason
                enriched_data["来源文件"] = file_name

                file_category_results[result.category].append(enriched_data)
                category_results[result.category].append(enriched_data)

            stats = file_auditor.get_statistics()
            click.echo(f"  稽核完成:")
            click.echo(f"    - 正常站点: {stats['normal']}")
            click.echo(f"    - 定位漂移: {stats['position_drift']}")
            click.echo(f"    - 临时站点: {stats['temporary_site']}")
            click.echo(f"    - 可复跑输出: {stats['rerun_available']}")

            overall_results["success_files"] += 1
            overall_results["file_results"][file_name] = {
                "status": "success",
                "total_rows": stats["total"],
                "normal_rows": stats["normal"],
                "position_drift_rows": stats["position_drift"],
                "temporary_site_rows": stats["temporary_site"],
                "rerun_available_rows": stats["rerun_available"],
            }

            overall_results["total_rows"] += stats["total"]
            overall_results["normal_rows"] += stats["normal"]
            overall_results["position_drift_rows"] += stats["position_drift"]
            overall_results["temporary_site_rows"] += stats["temporary_site"]
            overall_results["rerun_available_rows"] += stats["rerun_available"]

        except Exception as e:
            error_msg = str(e)
            click.echo(f"  错误: {error_msg}", err=True)
            click.echo(f"  该文件处理失败，继续处理下一个文件...", err=True)

            overall_results["failed_files"] += 1
            overall_results["failed_details"].append(
                {"file": file_name, "error": error_msg, "traceback": traceback.format_exc()}
            )
            overall_results["file_results"][file_name] = {
                "status": "failed",
                "error": error_msg,
            }

    click.echo("\n" + "=" * 60)
    click.echo("                     稽核结果汇总")
    click.echo("=" * 60)

    click.echo(f"\n文件处理情况:")
    click.echo(f"  总文件数: {overall_results['total_files']}")
    click.echo(f"  成功处理: {overall_results['success_files']}")
    click.echo(f"  处理失败: {overall_results['failed_files']}")

    if overall_results["failed_files"] > 0:
        click.echo(f"\n失败文件列表:")
        for fail in overall_results["failed_details"]:
            click.echo(f"  - {fail['file']}: {fail['error']}")

    click.echo(f"\n数据稽核情况:")
    click.echo(f"  总记录数: {overall_results['total_rows']}")
    click.echo(f"  正常站点: {overall_results['normal_rows']}")
    click.echo(f"  定位漂移: {overall_results['position_drift_rows']}")
    click.echo(f"  临时站点: {overall_results['temporary_site_rows']}")
    click.echo(f"  可复跑输出: {overall_results['rerun_available_rows']}")

    if not dry_run:
        click.echo("\n" + "-" * 60)
        click.echo("正在写入输出文件...")

        output_files = {
            AuditCategory.NORMAL: output_path / f"正常站点.{format}",
            AuditCategory.POSITION_DRIFT: output_path / f"定位漂移.{format}",
            AuditCategory.TEMPORARY_SITE: output_path / f"临时站点.{format}",
            AuditCategory.RERUN_AVAILABLE: output_path / f"可复跑输出.{format}",
        }

        for category, results in category_results.items():
            if results:
                df_out = pd.DataFrame(results)
                file_path = output_files[category]

                if file_path.exists() and not overwrite:
                    click.echo(
                        f"  警告: 文件 {file_path.name} 已存在，跳过（使用 --overwrite 强制覆盖）"
                    )
                    continue

                if format == "csv":
                    df_out.to_csv(file_path, index=False, encoding="utf-8-sig")
                elif format == "excel":
                    df_out.to_excel(file_path, index=False)
                else:
                    with open(file_path, "w", encoding="utf-8") as f:
                        json.dump(results, f, ensure_ascii=False, indent=2)

                click.echo(f"  已写入: {file_path.name} ({len(results)} 条)")

        summary_file = output_path / "稽核汇总报告.json"
        if summary_file.exists() and not overwrite:
            click.echo(f"  警告: 汇总报告已存在，跳过")
        else:
            summary_data = {
                "稽核时间": time.strftime("%Y-%m-%d %H:%M:%S"),
                "输入路径": str(input_path),
                "输出路径": str(output_path),
                "文件处理情况": {
                    "总文件数": overall_results["total_files"],
                    "成功处理": overall_results["success_files"],
                    "处理失败": overall_results["failed_files"],
                },
                "数据稽核情况": {
                    "总记录数": overall_results["total_rows"],
                    "正常站点": overall_results["normal_rows"],
                    "定位漂移": overall_results["position_drift_rows"],
                    "临时站点": overall_results["temporary_site_rows"],
                    "可复跑输出": overall_results["rerun_available_rows"],
                },
                "未处理文件": [
                    f["file"] for f in overall_results["failed_details"]
                ],
                "失败详情": [
                    {"文件": f["file"], "错误": f["error"]}
                    for f in overall_results["failed_details"]
                ],
            }
            with open(summary_file, "w", encoding="utf-8") as f:
                json.dump(summary_data, f, ensure_ascii=False, indent=2)
            click.echo(f"  已写入: {summary_file.name}")

        click.echo("\n输出文件列表:")
        for f in output_path.iterdir():
            if f.is_file():
                click.echo(f"  - {f.name}")

    click.echo("\n" + "=" * 60)
    click.echo(f"完成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("=" * 60)

    if overall_results["failed_files"] > 0:
        click.echo(
            f"\n注意: 有 {overall_results['failed_files']} 个文件处理失败，"
            f"详情请查看 {output_path / '稽核汇总报告.json'}"
        )


@cli.command()
def version():
    from . import __version__

    click.echo(f"校车运营队校车站点稽核 CLI v{__version__}")


def main():
    cli()


if __name__ == "__main__":
    main()
