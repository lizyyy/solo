import os
import sys
import traceback
from pathlib import Path
import click
from .core import SQLiteBackupChecker
from .reporter import ReportGenerator


class CustomClickGroup(click.Group):
    def __call__(self, *args, **kwargs):
        try:
            return self.main(*args, **kwargs)
        except Exception as e:
            click.echo("")
            click.echo(click.style("=" * 70, fg="red"))
            click.echo(click.style("  程序执行出错", fg="red", bold=True))
            click.echo(click.style("=" * 70, fg="red"))
            click.echo("")
            click.echo(f"错误类型: {type(e).__name__}")
            click.echo(f"错误消息: {str(e)}")
            click.echo("")
            click.echo("如果您认为这是一个bug，请将以下信息发送给开发者:")
            click.echo("-" * 70)
            traceback.print_exc()
            sys.exit(1)


@click.group(cls=CustomClickGroup)
@click.version_option(version="1.0.0", prog_name="sqlite-backup-checker")
def main():
    """SQLite备份一致性检查工具
    
    验证SQLite数据库文件和WAL文件的完整性，确保备份文件可以安全恢复。
    """
    pass


@main.command()
@click.argument("db_path", type=click.Path(exists=False))
@click.option("--wal", "-w", type=click.Path(exists=False), help="WAL文件路径 (默认自动查找)")
@click.option("--output", "-o", type=click.Path(), help="报告输出目录")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，只输出结果")
@click.option("--try-restore", is_flag=True, help="尝试恢复数据库")
def check(db_path, wal, output, quiet, try_restore):
    """检查SQLite备份文件的一致性"""
    
    db_path = Path(db_path)
    
    if wal is None:
        wal_candidates = [
            db_path.with_suffix(".db-wal"),
            db_path.parent / f"{db_path.name}-wal",
        ]
        for candidate in wal_candidates:
            if candidate.exists():
                wal = str(candidate)
                if not quiet:
                    click.echo(f"找到WAL文件: {wal}")
                break
    
    if not quiet:
        click.echo(f"正在检查: {db_path}")
        if wal:
            click.echo(f"WAL文件: {wal}")
        click.echo("")
    
    checker = SQLiteBackupChecker(str(db_path), wal)
    result = checker.check_database()
    
    reporter = ReportGenerator(result)
    
    if not quiet:
        click.echo(reporter.generate_terminal_summary())
    else:
        if result.is_valid:
            click.echo("OK")
        else:
            click.echo("FAIL")
            for err in result.errors:
                click.echo(f"  - {err['message']}")
    
    if output:
        base_name = db_path.stem
        files = reporter.save_reports(output, base_name)
        if not quiet:
            click.echo("")
            click.echo("报告已保存:")
            for name, path in files.items():
                click.echo(f"  - {name}: {path}")
    
    if try_restore:
        if not quiet:
            click.echo("")
            click.echo("正在尝试恢复数据库...")
        output_path = Path(output) / f"{db_path.stem}_restored.db" if output else None
        success, messages = checker.try_restore(str(output_path) if output_path else None)
        for msg in messages:
            status_icon = "✅" if "通过" in msg or "已保存" in msg else "⚠️" if success else "❌"
            click.echo(f"  {status_icon} {msg}")
    
    sys.exit(0 if result.is_valid else 2)


@main.command()
@click.argument("backup_dir", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="报告输出目录")
def scandir(backup_dir, output):
    """扫描备份目录，检查所有SQLite文件"""
    
    backup_path = Path(backup_dir)
    click.echo(f"扫描目录: {backup_path}")
    click.echo("")
    
    db_files = []
    for ext in ["*.db", "*.sqlite", "*.sqlite3"]:
        db_files.extend(backup_path.glob(ext))
        db_files.extend(backup_path.rglob(ext))
    
    db_files = list(set(db_files))
    
    if not db_files:
        click.echo("未找到SQLite数据库文件")
        return
    
    click.echo(f"找到 {len(db_files)} 个数据库文件")
    click.echo("")
    
    results = []
    for db_file in sorted(db_files):
        wal_candidate = db_file.with_suffix(".db-wal")
        wal_path = str(wal_candidate) if wal_candidate.exists() else None
        
        checker = SQLiteBackupChecker(str(db_file), wal_path)
        result = checker.check_database()
        
        status = click.style("✓", fg="green") if result.is_valid else click.style("✗", fg="red")
        click.echo(f"  {status} {db_file.name} - {result.page_count} 页, {result.valid_pages} 有效")
        
        results.append({
            "file": str(db_file),
            "result": result
        })
    
    click.echo("")
    valid_count = sum(1 for r in results if r["result"].is_valid)
    all_valid = valid_count == len(results)
    click.echo(f"总计: {valid_count}/{len(results)} 个文件通过检查")
    
    if output:
        out_dir = Path(output)
        out_dir.mkdir(parents=True, exist_ok=True)
        
        import json
        from datetime import datetime
        summary = {
            "scanned_at": datetime.now().isoformat(),
            "total_files": len(results),
            "valid_files": valid_count,
            "all_valid": all_valid,
            "files": []
        }
        
        for r in results:
            res = r["result"]
            summary["files"].append({
                "path": r["file"],
                "is_valid": res.is_valid,
                "page_count": res.page_count,
                "valid_pages": res.valid_pages,
                "errors": res.errors,
                "warnings": res.warnings
            })
        
        summary_path = out_dir / "scan_summary.json"
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        click.echo(f"扫描报告已保存到: {summary_path}")
    
    sys.exit(0 if all_valid else 2)


@main.command()
@click.argument("db_path", type=click.Path(exists=True))
@click.argument("output_path", type=click.Path())
def restore(db_path, output_path):
    """尝试恢复损坏的SQLite数据库"""
    
    db_path = Path(db_path)
    wal_path = db_path.with_suffix(".db-wal")
    
    if wal_path.exists():
        click.echo(f"找到WAL文件: {wal_path}")
        wal = str(wal_path)
    else:
        wal = None
        click.echo("未找到WAL文件")
    
    click.echo(f"正在尝试恢复: {db_path}")
    click.echo("")
    
    checker = SQLiteBackupChecker(str(db_path), wal)
    success, messages = checker.try_restore(output_path)
    
    for msg in messages:
        status_icon = "✅" if "通过" in msg or "已保存" in msg else "⚠️" if success else "❌"
        click.echo(f"{status_icon} {msg}")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
