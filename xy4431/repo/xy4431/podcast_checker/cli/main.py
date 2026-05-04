import sys
from datetime import date
from pathlib import Path
from typing import Optional, List, Dict, Any

import click

from podcast_checker.config import settings
from podcast_checker.models import (
    DatabaseManager,
    init_db,
    Episode,
    LoudnessCheckResult,
    AdAuthorization,
    MusicAuthorization,
    CoverImage,
    EpisodeCheckResult,
    CheckStatus,
)
from podcast_checker.services import (
    EpisodeCSVParser,
    LoudnessCSVParser,
    AdAuthorizationParser,
    MusicAuthorizationParser,
    CoverDirectoryParser,
    EpisodeChecker,
    ExportManager,
    MarkdownExporter,
    JSONExporter,
)


def load_data(
    episodes_csv: Path,
    loudness_csv: Optional[Path] = None,
    ad_auth_json: Optional[Path] = None,
    music_auth_dir: Optional[Path] = None,
    cover_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    
    click.echo(f"📂 读取节目单: {episodes_csv}")
    data["episodes"] = EpisodeCSVParser.parse(episodes_csv)
    click.echo(f"   ✓ 加载了 {len(data['episodes'])} 集")
    
    if loudness_csv and loudness_csv.exists():
        click.echo(f"📂 读取响度数据: {loudness_csv}")
        data["loudness_results"] = LoudnessCSVParser.parse(loudness_csv)
        click.echo(f"   ✓ 加载了 {len(data['loudness_results'])} 条响度记录")
    else:
        data["loudness_results"] = []
        click.echo(f"⚠️  响度数据文件未找到，将跳过响度检查")
    
    if ad_auth_json and ad_auth_json.exists():
        click.echo(f"📂 读取广告授权: {ad_auth_json}")
        data["ad_authorizations"] = AdAuthorizationParser.parse(ad_auth_json)
        click.echo(f"   ✓ 加载了 {len(data['ad_authorizations'])} 条广告授权")
    else:
        data["ad_authorizations"] = []
        click.echo(f"ℹ️  无广告授权数据")
    
    if music_auth_dir and music_auth_dir.exists():
        click.echo(f"📂 读取音乐授权目录: {music_auth_dir}")
        data["music_authorizations"] = MusicAuthorizationParser.parse_directory(music_auth_dir)
        if not data["music_authorizations"]:
            for json_file in music_auth_dir.glob("*.json"):
                try:
                    data["music_authorizations"].extend(MusicAuthorizationParser.parse(json_file))
                except Exception:
                    pass
        click.echo(f"   ✓ 加载了 {len(data['music_authorizations'])} 条音乐授权")
    else:
        data["music_authorizations"] = []
        click.echo(f"ℹ️  无音乐授权数据")
    
    if cover_dir and cover_dir.exists():
        click.echo(f"📂 扫描封面目录: {cover_dir}")
        data["covers"] = CoverDirectoryParser.parse(cover_dir)
        click.echo(f"   ✓ 发现了 {len(data['covers'])} 张封面图")
    else:
        data["covers"] = []
        click.echo(f"⚠️  封面目录未找到，将跳过封面检查")
    
    return data


def run_checks(
    episodes: List[Episode],
    loudness_results: List[LoudnessCheckResult],
    ad_authorizations: List[AdAuthorization],
    music_authorizations: List[MusicAuthorization],
    covers: List[CoverImage],
    check_date: Optional[date] = None,
) -> List[EpisodeCheckResult]:
    click.echo("\n🔍 开始检查...")
    
    from podcast_checker.services.checkers import (
        LoudnessChecker,
        AdChecker,
        MusicChecker,
        CoverChecker,
    )
    
    checker = EpisodeChecker(
        loudness_checker=LoudnessChecker(
            target_lufs=settings.LOUDNESS_TARGET,
            tolerance=settings.LOUDNESS_TOLERANCE,
            min_lufs=settings.LOUDNESS_MIN,
            max_lufs=settings.LOUDNESS_MAX,
        ),
        ad_checker=AdChecker(check_date=check_date),
        music_checker=MusicChecker(check_date=check_date),
        cover_checker=CoverChecker(
            min_width=settings.COVER_MIN_WIDTH,
            max_width=settings.COVER_MAX_WIDTH,
            min_height=settings.COVER_MIN_HEIGHT,
            max_height=settings.COVER_MAX_HEIGHT,
            aspect_ratio_tolerance=settings.COVER_ASPECT_RATIO_TOLERANCE,
        ),
    )
    
    results = checker.check_all(
        episodes=episodes,
        loudness_results=loudness_results,
        ad_authorizations=ad_authorizations,
        music_authorizations=music_authorizations,
        covers=covers,
    )
    
    pass_count = sum(1 for r in results if r.overall_status == CheckStatus.PASS)
    fail_count = sum(1 for r in results if r.overall_status == CheckStatus.FAIL)
    warning_count = sum(1 for r in results if r.overall_status == CheckStatus.WARNING)
    pending_count = sum(1 for r in results if r.overall_status == CheckStatus.PENDING)
    
    click.echo(f"\n📊 检查完成:")
    click.echo(f"   ✅ 通过: {pass_count}")
    click.echo(f"   ⚠️  警告: {warning_count}")
    click.echo(f"   ❌ 失败: {fail_count}")
    click.echo(f"   ⏳ 待定: {pending_count}")
    
    return results


def save_to_db(
    db: DatabaseManager,
    episodes: List[Episode],
    results: List[EpisodeCheckResult],
) -> None:
    click.echo("\n💾 保存到数据库...")
    
    for episode in episodes:
        db.save_episode(episode)
    
    for result in results:
        db.save_check_result(result)
    
    click.echo(f"   ✓ 保存了 {len(episodes)} 集信息和 {len(results)} 条检查结果")


def print_summary(results: List[EpisodeCheckResult]) -> None:
    click.echo("\n" + "=" * 60)
    click.echo("📋 详细结果")
    click.echo("=" * 60)
    
    for result in sorted(results, key=lambda r: r.episode_number):
        status_icon = {
            CheckStatus.PASS: "✅",
            CheckStatus.WARNING: "⚠️",
            CheckStatus.FAIL: "❌",
            CheckStatus.PENDING: "⏳",
        }[result.overall_status]
        
        click.echo(f"\n{status_icon} 第 {result.episode_number} 集: {result.title}")
        
        if result.issues:
            for issue in result.issues:
                issue_icon = "❌" if issue.severity == CheckStatus.FAIL else "⚠️"
                click.echo(f"   {issue_icon} {issue.message}")
        else:
            click.echo(f"   ✨ 无问题")


@click.group()
@click.option("--db", type=click.Path(path_type=Path), default=None, help="数据库路径")
@click.pass_context
def cli(ctx: click.Context, db: Optional[Path]):
    """播客上线前核对工具"""
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db or settings.DB_PATH


@cli.command()
@click.argument("episodes_csv", type=click.Path(exists=True, path_type=Path))
@click.option("--loudness", "-l", type=click.Path(exists=True, path_type=Path), help="响度检测结果 CSV")
@click.option("--ad-auth", "-a", type=click.Path(exists=True, path_type=Path), help="广告授权 JSON")
@click.option("--music-auth", "-m", type=click.Path(exists=True, path_type=Path), help="音乐授权目录")
@click.option("--covers", "-c", type=click.Path(exists=True, path_type=Path), help="封面图目录")
@click.option("--check-date", type=click.DateTime(formats=["%Y-%m-%d"]), default=None, help="检查日期 (默认今天)")
@click.option("--no-summary", is_flag=True, help="不显示详细结果")
@click.option("--save/--no-save", default=True, help="是否保存到数据库")
@click.pass_context
def scan(
    ctx: click.Context,
    episodes_csv: Path,
    loudness: Optional[Path],
    ad_auth: Optional[Path],
    music_auth: Optional[Path],
    covers: Optional[Path],
    check_date: Optional[date],
    no_summary: bool,
    save: bool,
):
    """扫描所有数据源并执行合规性检查"""
    click.echo("=" * 60)
    click.echo("🎙️  播客上线前核对工具 - 扫描模式")
    click.echo("=" * 60)
    
    try:
        data = load_data(
            episodes_csv=episodes_csv,
            loudness_csv=loudness,
            ad_auth_json=ad_auth,
            music_auth_dir=music_auth,
            cover_dir=covers,
        )
    except Exception as e:
        click.echo(f"\n❌ 读取数据失败: {e}", err=True)
        sys.exit(1)
    
    try:
        check_date_val = check_date.date() if check_date else date.today()
        results = run_checks(
            episodes=data["episodes"],
            loudness_results=data["loudness_results"],
            ad_authorizations=data["ad_authorizations"],
            music_authorizations=data["music_authorizations"],
            covers=data["covers"],
            check_date=check_date_val,
        )
    except Exception as e:
        click.echo(f"\n❌ 检查失败: {e}", err=True)
        sys.exit(1)
    
    if save:
        try:
            db = init_db(ctx.obj["db_path"])
            save_to_db(db, data["episodes"], results)
        except Exception as e:
            click.echo(f"\n⚠️  保存到数据库失败: {e}", err=True)
    
    if not no_summary:
        print_summary(results)
    
    fail_count = sum(1 for r in results if r.overall_status == CheckStatus.FAIL)
    if fail_count > 0:
        click.echo(f"\n⚠️  有 {fail_count} 集存在严重问题，无法发布")
        sys.exit(2)
    else:
        click.echo("\n✅ 所有检查通过 (或仅存在警告)")


@cli.command()
@click.argument("episode_number", type=int, required=False)
@click.option("--all", "-a", "recheck_all", is_flag=True, help="重新检查所有已保存的集")
@click.option("--check-date", type=click.DateTime(formats=["%Y-%m-%d"]), default=None, help="检查日期")
@click.pass_context
def recheck(
    ctx: click.Context,
    episode_number: Optional[int],
    recheck_all: bool,
    check_date: Optional[date],
):
    """重新检查已保存的集"""
    click.echo("=" * 60)
    click.echo("🎙️  播客上线前核对工具 - 复核模式")
    click.echo("=" * 60)
    
    db = init_db(ctx.obj["db_path"])
    
    if not episode_number and not recheck_all:
        click.echo("\n❌ 请指定集号或使用 --all 参数", err=True)
        sys.exit(1)
    
    episodes: List[Episode] = []
    if recheck_all:
        episodes = db.get_all_episodes()
        if not episodes:
            click.echo("\n⚠️  数据库中没有保存的集，请先运行 scan 命令")
            sys.exit(1)
        click.echo(f"\n📂 加载了 {len(episodes)} 集")
    else:
        episode = db.get_episode(episode_number)
        if not episode:
            click.echo(f"\n❌ 未找到第 {episode_number} 集", err=True)
            sys.exit(1)
        episodes = [episode]
    
    check_date_val = check_date.date() if check_date else date.today()
    
    from podcast_checker.services.checkers import (
        LoudnessChecker,
        AdChecker,
        MusicChecker,
        CoverChecker,
    )
    
    checker = EpisodeChecker(
        loudness_checker=LoudnessChecker(),
        ad_checker=AdChecker(check_date=check_date_val),
        music_checker=MusicChecker(check_date=check_date_val),
        cover_checker=CoverChecker(),
    )
    
    click.echo(f"\n🔍 重新检查中... (检查日期: {check_date_val})")
    
    results: List[EpisodeCheckResult] = []
    for episode in episodes:
        existing_result = db.get_check_result(episode.episode_number)
        
        result = checker.check_episode(
            episode=episode,
            loudness_results={},
            ad_authorizations=[],
            music_authorizations=[],
            covers={},
        )
        
        if existing_result:
            result.checked_at = None
            result.issues = [i for i in existing_result.issues if i.issue_type not in [
                IssueType.AD_AUTHORIZATION_MISSING,
                IssueType.AD_AUTHORIZATION_EXPIRED,
                IssueType.AD_NOT_COVERED,
                IssueType.MUSIC_AUTHORIZATION_MISSING,
                IssueType.MUSIC_AUTHORIZATION_EXPIRED,
            ]]
        
        db.save_check_result(result)
        results.append(result)
    
    pass_count = sum(1 for r in results if r.overall_status == CheckStatus.PASS)
    click.echo(f"\n✅ 复核完成: {pass_count}/{len(results)} 通过")
    print_summary(results)


@cli.command()
@click.option("--output", "-o", type=click.Path(path_type=Path), required=True, help="输出目录")
@click.option("--format", "-f", type=click.Choice(["md", "json", "all"]), default="all", help="导出格式")
@click.option("--episode", "-e", type=int, multiple=True, help="指定要导出的集号 (可多次指定)")
@click.option("--base-name", "-n", default="podcast_check", help="导出文件名基础")
@click.pass_context
def export(
    ctx: click.Context,
    output: Path,
    format: str,
    episode: tuple,
    base_name: str,
):
    """导出检查结果为 Markdown 发布清单或 JSON 审计包"""
    click.echo("=" * 60)
    click.echo("🎙️  播客上线前核对工具 - 导出模式")
    click.echo("=" * 60)
    
    db = init_db(ctx.obj["db_path"])
    
    click.echo(f"\n📂 从数据库加载数据...")
    results = db.get_all_check_results()
    
    if not results:
        click.echo("❌ 没有检查结果，请先运行 scan 命令", err=True)
        sys.exit(1)
    
    for result in results:
        result.review_notes = db.get_review_notes(result.episode_number)
    
    if episode:
        results = [r for r in results if r.episode_number in episode]
        if not results:
            click.echo(f"❌ 未找到指定的集号: {episode}", err=True)
            sys.exit(1)
    
    click.echo(f"   ✓ 加载了 {len(results)} 条检查结果")
    
    output.mkdir(parents=True, exist_ok=True)
    
    episodes = db.get_all_episodes() if format != "md" else None
    
    if format in ["md", "all"]:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        md_path = output / f"{base_name}_release_list_{timestamp}.md"
        
        click.echo(f"\n📄 导出 Markdown 发布清单: {md_path}")
        MarkdownExporter.export(md_path, results)
        click.echo("   ✓ 完成")
    
    if format in ["json", "all"]:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_path = output / f"{base_name}_audit_package_{timestamp}.json"
        
        click.echo(f"\n📦 导出 JSON 审计包: {json_path}")
        JSONExporter.export(json_path, results, episodes)
        click.echo("   ✓ 完成")
    
    click.echo(f"\n✅ 导出完成，输出目录: {output}")


@cli.command()
@click.option("--host", "-h", default="127.0.0.1", help="绑定地址")
@click.option("--port", "-p", default=8000, type=int, help="端口")
@click.option("--reload/--no-reload", default=False, help="自动重载")
@click.pass_context
def serve(ctx: click.Context, host: str, port: int, reload: bool):
    """启动本地 HTTP API 服务"""
    click.echo("=" * 60)
    click.echo("🎙️  播客上线前核对工具 - HTTP 服务")
    click.echo("=" * 60)
    
    import uvicorn
    import os
    
    os.environ["PODCAST_CHECKER_DB"] = str(ctx.obj["db_path"])
    
    click.echo(f"\n🚀 启动服务: http://{host}:{port}")
    click.echo(f"   API 文档: http://{host}:{port}/docs")
    click.echo(f"   数据库: {ctx.obj['db_path']}\n")
    
    uvicorn.run(
        "podcast_checker.api.main:app",
        host=host,
        port=port,
        reload=reload,
    )


from podcast_checker.models.schemas import IssueType

if __name__ == "__main__":
    cli()
