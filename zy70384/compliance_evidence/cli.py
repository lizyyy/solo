import click
import json
import shutil
from datetime import datetime
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from rich import box

from .config import EvidenceConfig, create_sample_config, DEFAULT_CONFIG_FILE, DEFAULT_FREEZE_DIR, DEFAULT_REPORT_DIR
from .validator import EvidenceValidator, calculate_file_hash

console = Console()


@click.group()
@click.version_option(package_name='compliance-evidence-cli')
def cli():
    """本地合规证据包 CLI - 管理、验证和冻结合规审计证据"""
    pass


@cli.command()
@click.option('--force', '-f', is_flag=True, help='覆盖已存在的配置文件')
def init(force):
    """初始化合规证据项目，创建示例配置和目录结构"""
    config_file = Path(DEFAULT_CONFIG_FILE)
    
    if config_file.exists() and not force:
        console.print(f"[red]配置文件已存在: {config_file}[/red]")
        console.print("使用 --force 选项覆盖")
        return
    
    sample_config = create_sample_config()
    base_dir = sample_config.get("evidence_base_dir", "evidence")
    
    config = EvidenceConfig(str(config_file))
    config.save(sample_config)
    
    base_path = Path(base_dir)
    for ev in sample_config.get("evidence", []):
        ev_path = base_path / ev["path"]
        ev_path.parent.mkdir(parents=True, exist_ok=True)
    
    console.print("[green]✓ 初始化完成[/green]")
    console.print(f"  配置文件: {config_file}")
    console.print(f"  证据目录: {base_dir}/")
    console.print("")
    console.print("创建了以下审计主题的示例配置:")
    topics = set(ev["audit_topic"] for ev in sample_config["evidence"] if ev.get("audit_topic"))
    for topic in sorted(topics):
        console.print(f"  • {topic}")
    
    console.print("")
    console.print("下一步:")
    console.print("  1. 将实际证据文件放入 evidence/ 目录")
    console.print("  2. 运行 [cyan]cecli check[/cyan] 验证证据完整性")


@cli.command()
@click.option('--config', '-c', default=DEFAULT_CONFIG_FILE, help='配置文件路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.option('--freeze', '-f', 'freeze_tag', help='与冻结快照对比检查文件完整性')
def check(config, verbose, freeze_tag):
    """检查所有证据文件的状态"""
    if freeze_tag:
        _check_against_freeze(freeze_tag, verbose)
        return
    
    try:
        cfg = EvidenceConfig(config)
        cfg.load()
    except FileNotFoundError as e:
        console.print(f"[red]错误: {e}[/red]")
        console.print("请先运行 [cyan]cecli init[/cyan] 初始化项目")
        return
    
    base_dir = cfg.data.get("evidence_base_dir", "evidence")
    validator = EvidenceValidator(base_dir)
    
    results = validator.check_all(cfg.get_evidence_list())
    stats = results["stats"]
    
    _display_check_results(results, verbose)
    
    return stats["fail"]


def _check_against_freeze(freeze_tag: str, verbose: bool):
    freeze_dir = Path(DEFAULT_FREEZE_DIR) / freeze_tag
    freeze_manifest = freeze_dir / "freeze-manifest.json"
    
    if not freeze_manifest.exists():
        console.print(f"[red]冻结快照不存在: {freeze_tag}[/red]")
        console.print(f"  期望路径: {freeze_manifest}")
        return
    
    with open(freeze_manifest, 'r', encoding='utf-8') as f:
        freeze_data = json.load(f)
    
    base_dir = Path(freeze_data["base_dir"])
    console.print()
    console.print(Panel.fit(
        f"[bold]重放冻结检查[/bold]\n"
        f"冻结标签: {freeze_tag}\n"
        f"冻结时间: {freeze_data['frozen_at']}",
        border_style="magenta"
    ))
    console.print()
    
    issues = []
    pass_count = 0
    fail_count = 0
    
    for record in freeze_data["evidence"]:
        ev_id = record["id"]
        ev_path = base_dir / record["path"]
        frozen_hash = record["file_hash"]
        
        if not record["file_exists"]:
            console.print(f"  [dim]○ {ev_id}: 冻结时文件不存在，跳过检查[/dim]")
            continue
        
        if not ev_path.exists():
            fail_count += 1
            issues.append({
                "id": ev_id,
                "type": "DELETED",
                "message": f"文件在冻结后被删除: {record['path']}"
            })
            console.print(f"  [red]✗[/red] {ev_id}: [red]文件被删除[/red]")
            continue
        
        current_hash = calculate_file_hash(ev_path)
        
        if current_hash == frozen_hash:
            pass_count += 1
            console.print(f"  [green]✓[/green] {ev_id}: 未变更")
        else:
            fail_count += 1
            issues.append({
                "id": ev_id,
                "type": "MODIFIED",
                "message": f"文件在冻结后被修改\n    冻结哈希: {frozen_hash[:16]}...\n    当前哈希: {current_hash[:16]}..."
            })
            console.print(f"  [red]✗[/red] {ev_id}: [red]文件被替换/修改[/red]")
    
    console.print()
    console.print(f"[bold]完整性检查结果:[/bold]")
    console.print(f"  通过: [green]{pass_count}[/green]")
    console.print(f"  失败: [red]{fail_count}[/red]")
    
    if issues and verbose:
        console.print()
        console.print("[bold]详细问题:[/bold]")
        for issue in issues:
            console.print(f"  [cyan]{issue['id']}[/cyan]: [{issue['type'].lower()}] {issue['message']}")
    
    return fail_count


def _display_check_results(results: dict, verbose: bool):
    stats = results["stats"]
    
    console.print()
    console.print(Panel.fit(
        f"[bold]合规证据检查结果[/bold]\n"
        f"检查时间: {results['checked_at']}",
        border_style="cyan"
    ))
    console.print()
    
    console.print(f"[bold]统计摘要:[/bold]")
    console.print(f"  总证据数: [cyan]{stats['total']}[/cyan]")
    console.print(f"  通过: [green]{stats['pass']}[/green]")
    console.print(f"  失败: [red]{stats['fail']}[/red]")
    
    if stats.get("duplicate_ids"):
        console.print(f"  重复ID: [yellow]{stats['duplicate_ids']}[/yellow]")
    if stats.get("duplicate_paths"):
        console.print(f"  重复路径: [yellow]{stats['duplicate_paths']}[/yellow]")
    
    issues = stats.get("issues", {})
    if issues:
        console.print()
        console.print("[bold]问题分布:[/bold]")
        for key, count in sorted(issues.items()):
            if key.startswith("severity_"):
                continue
            color = "red" if count > 0 else "green"
            console.print(f"  {key}: [{color}]{count}[/{color}]")
    
    console.print()
    
    by_topic = {}
    for r in results["results"]:
        topic = r.get("audit_topic", "未分类")
        if topic not in by_topic:
            by_topic[topic] = []
        by_topic[topic].append(r)
    
    for topic, items in by_topic.items():
        table = Table(title=f"[bold]{topic}[/bold]", box=box.SIMPLE)
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="white")
        table.add_column("状态", justify="center")
        table.add_column("问题数", justify="right")
        
        for item in items:
            status_style = "green" if item["status"] == "PASS" else "red"
            status = f"[{status_style}]{item['status']}[/{status_style}]"
            issue_count = len(item["issues"])
            table.add_row(
                item["id"],
                item["name"],
                status,
                str(issue_count)
            )
        
        console.print(table)
        
        if verbose:
            for item in items:
                if item["issues"]:
                    console.print(f"\n  [bold]{item['id']} - {item['name']}[/bold]")
                    for issue in item["issues"]:
                        sev_color = {
                            "critical": "red",
                            "high": "yellow",
                            "medium": "yellow",
                            "info": "cyan"
                        }.get(issue["severity"], "white")
                        console.print(f"    [{sev_color}]•[/{sev_color}] [{sev_color}]{issue['type']}[/{sev_color}]: {issue['message']}")


@cli.command()
@click.option('--config', '-c', default=DEFAULT_CONFIG_FILE, help='配置文件路径')
@click.option('--tag', '-t', help='冻结标签')
def freeze(config, tag):
    """冻结当前证据，记录文件摘要防止被替换"""
    try:
        cfg = EvidenceConfig(config)
        cfg.load()
    except FileNotFoundError as e:
        console.print(f"[red]错误: {e}[/red]")
        return
    
    base_dir = Path(cfg.data.get("evidence_base_dir", "evidence"))
    
    if not tag:
        tag = datetime.now().strftime("%Y%m%d-%H%M%S")
    
    freeze_dir = Path(DEFAULT_FREEZE_DIR) / tag
    freeze_dir.mkdir(parents=True, exist_ok=True)
    
    console.print(f"[bold]冻结证据快照: {tag}[/bold]")
    console.print(f"  目录: {freeze_dir}")
    console.print()
    
    freeze_data = {
        "tag": tag,
        "frozen_at": datetime.now().isoformat(),
        "manifest_file": config,
        "base_dir": str(base_dir),
        "evidence": []
    }
    
    success_count = 0
    fail_count = 0
    
    for ev in cfg.get_evidence_list():
        ev_path = base_dir / ev.get("path", "")
        
        record = {
            "id": ev.get("id"),
            "name": ev.get("name"),
            "audit_topic": ev.get("audit_topic"),
            "path": ev.get("path"),
            "required": ev.get("required", True),
            "owner": ev.get("owner"),
            "expiry_date": ev.get("expiry_date"),
            "remediation_status": ev.get("remediation_status"),
            "file_exists": False,
            "file_size": 0,
            "file_hash": None,
            "hash_algorithm": "sha256"
        }
        
        if ev_path.exists() and ev_path.is_file():
            record["file_exists"] = True
            record["file_size"] = ev_path.stat().st_size
            record["file_hash"] = calculate_file_hash(ev_path)
            success_count += 1
            console.print(f"  [green]✓[/green] {ev['id']}: {ev['name']}")
        else:
            fail_count += 1
            console.print(f"  [red]✗[/red] {ev['id']}: {ev['name']} [red](文件不存在)[/red]")
        
        freeze_data["evidence"].append(record)
    
    freeze_manifest = freeze_dir / "freeze-manifest.json"
    with open(freeze_manifest, 'w', encoding='utf-8') as f:
        json.dump(freeze_data, f, indent=2, ensure_ascii=False)
    
    shutil.copy2(config, freeze_dir / "evidence-manifest.yaml")
    
    console.print()
    console.print(f"[bold]冻结完成[/bold]")
    console.print(f"  成功记录: [green]{success_count}[/green]")
    console.print(f"  缺失文件: [red]{fail_count}[/red]")
    console.print()
    console.print(f"  使用 [cyan]cecli check --freeze {tag}[/cyan] 重放检查")
    
    return fail_count


@cli.command('explain-missing')
@click.option('--config', '-c', default=DEFAULT_CONFIG_FILE, help='配置文件路径')
@click.option('--topic', '-t', help='按审计主题过滤')
def explain_missing(config, topic):
    """解释缺失的证据，按审计主题分组"""
    try:
        cfg = EvidenceConfig(config)
        cfg.load()
    except FileNotFoundError as e:
        console.print(f"[red]错误: {e}[/red]")
        return
    
    base_dir = cfg.data.get("evidence_base_dir", "evidence")
    validator = EvidenceValidator(base_dir)
    
    results = validator.check_all(cfg.get_evidence_list())
    
    by_topic = {}
    for r in results["results"]:
        if r["status"] != "PASS" or r["issues"]:
            t = r.get("audit_topic", "未分类")
            if topic and t != topic:
                continue
            if t not in by_topic:
                by_topic[t] = []
            by_topic[t].append(r)
    
    if not by_topic:
        console.print("[green]所有证据状态良好，没有需要解释的缺口[/green]")
        return
    
    console.print()
    console.print(Panel.fit("[bold]缺口证据详细说明[/bold]", border_style="yellow"))
    console.print()
    
    for topic_name, items in by_topic.items():
        tree = Tree(f"[bold yellow]{topic_name}[/bold yellow]")
        
        for item in items:
            item_node = tree.add(f"[cyan]{item['id']}[/cyan] - {item['name']}")
            
            if not (Path(base_dir) / item['path']).exists():
                item_node.add(f"[red]✗ 文件缺失:[/red] {item['path']}")
            
            for issue in item["issues"]:
                sev_color = {
                    "critical": "red",
                    "high": "yellow",
                    "medium": "yellow",
                    "info": "cyan"
                }.get(issue["severity"], "white")
                
                item_node.add(f"[{sev_color}]•[/{sev_color}] {issue['message']}")
            
            for ev in cfg.get_evidence_list():
                if ev.get("id") == item["id"]:
                    item_node.add(f"[dim]说明: {ev.get('description', '无描述')}[/dim]")
                    item_node.add(f"[dim]负责人: {ev.get('owner', '未指定')}[/dim]")
                    item_node.add(f"[dim]类型: {ev.get('type', '未分类')}[/dim]")
                    if ev.get("required"):
                        item_node.add("[dim]必需: 是[/dim]")
        
        console.print(tree)
        console.print()


@cli.command()
@click.option('--config', '-c', default=DEFAULT_CONFIG_FILE, help='配置文件路径')
@click.option('--output', '-o', default=DEFAULT_REPORT_DIR, help='输出目录')
@click.option('--freeze', '-f', 'freeze_tag', help='使用冻结快照生成报告')
def report(config, output, freeze_tag):
    """生成证据索引和缺口报告"""
    if freeze_tag:
        freeze_dir = Path(DEFAULT_FREEZE_DIR) / freeze_tag
        freeze_manifest = freeze_dir / "freeze-manifest.json"
        
        if not freeze_manifest.exists():
            console.print(f"[red]冻结快照不存在: {freeze_tag}[/red]")
            return
        
        with open(freeze_manifest, 'r', encoding='utf-8') as f:
            freeze_data = json.load(f)
        
        base_dir = freeze_data["base_dir"]
        evidence_list = []
        for rec in freeze_data["evidence"]:
            evidence_list.append({
                "id": rec["id"],
                "name": rec["name"],
                "audit_topic": rec["audit_topic"],
                "path": rec["path"],
                "owner": rec["owner"],
                "expiry_date": rec["expiry_date"],
                "remediation_status": rec["remediation_status"],
                "required": rec["required"]
            })
        source_tag = freeze_tag
    else:
        try:
            cfg = EvidenceConfig(config)
            cfg.load()
        except FileNotFoundError as e:
            console.print(f"[red]错误: {e}[/red]")
            return
        
        base_dir = cfg.data.get("evidence_base_dir", "evidence")
        evidence_list = cfg.get_evidence_list()
        source_tag = "current"
    
    validator = EvidenceValidator(base_dir)
    results = validator.check_all(evidence_list)
    
    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    
    index_file = output_dir / f"evidence-index-{source_tag}-{timestamp}.json"
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    gap_report = _generate_gap_report(results)
    gap_file = output_dir / f"gap-report-{source_tag}-{timestamp}.json"
    with open(gap_file, 'w', encoding='utf-8') as f:
        json.dump(gap_report, f, indent=2, ensure_ascii=False)
    
    console.print()
    console.print(Panel.fit("[bold]证据报告生成[/bold]", border_style="cyan"))
    console.print()
    
    stats = results["stats"]
    console.print(f"  来源: [cyan]{source_tag}[/cyan]")
    console.print(f"  时间: {results['checked_at']}")
    console.print()
    console.print(f"  证据索引: [green]{index_file}[/green]")
    console.print(f"  缺口报告: [green]{gap_file}[/green]")
    console.print()
    
    console.print("[bold]缺口摘要 (按审计主题):[/bold]")
    for topic, data in gap_report["by_topic"].items():
        console.print(f"\n  [cyan]{topic}[/cyan]:")
        console.print(f"    总数: {data['total']}, 通过: [green]{data['pass']}[/green], 失败: [red]{data['fail']}[/red]")
        if data["failing_ids"]:
            console.print(f"    问题项: {', '.join(data['failing_ids'])}")


def _generate_gap_report(results: dict) -> dict:
    by_topic = {}
    
    for r in results["results"]:
        topic = r.get("audit_topic", "未分类")
        if topic not in by_topic:
            by_topic[topic] = {
                "total": 0,
                "pass": 0,
                "fail": 0,
                "items": [],
                "failing_ids": []
            }
        
        by_topic[topic]["total"] += 1
        if r["status"] == "PASS" and not r["issues"]:
            by_topic[topic]["pass"] += 1
        else:
            by_topic[topic]["fail"] += 1
            by_topic[topic]["failing_ids"].append(r["id"])
        
        by_topic[topic]["items"].append(r)
    
    return {
        "generated_at": results["checked_at"],
        "stats": results["stats"],
        "by_topic": by_topic,
        "all_failing": [r for r in results["results"] if r["status"] != "PASS" or r["issues"]]
    }


def main():
    cli()


if __name__ == "__main__":
    main()
