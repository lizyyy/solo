"""多语字幕交付校对员 - CLI 入口"""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import click

from .aligner import Aligner
from .config import ConfigManager
from .exporter import Exporter
from .fix_planner import FixPlanner
from .history import HistoryManager
from .manifest_parser import ManifestParser, ScriptParser
from .models import (
    AlignmentResult,
    ChangeLog,
    FixPlan,
    IssueSeverity,
    IssueType,
    Language,
    ManifestFile,
    Quarantine,
    ReviewAction,
    ScriptFile,
    SubtitleFile,
)
from .review_store import ReviewStore
from .subtitle_parser import SubtitleParser
from .validator import Validator


@click.group()
@click.version_option()
def main():
    """多语字幕交付校对员 - 短剧译制和字幕交付自动化工具"""
    pass


@main.command()
@click.option(
    "--languages",
    "-l",
    multiple=True,
    default=["zh", "en"],
    help="支持的语言列表 (默认: zh, en)",
)
@click.option(
    "--frame-rate",
    "-f",
    type=float,
    default=25.0,
    help="视频帧率 (默认: 25.0)",
)
@click.option(
    "--max-speed-zh",
    type=float,
    default=6.0,
    help="中文字幕最大读速 (字符/秒, 默认: 6.0)",
)
@click.option(
    "--max-speed-en",
    type=float,
    default=12.0,
    help="英文字幕最大读速 (字符/秒, 默认: 12.0)",
)
@click.option(
    "--min-gap",
    type=int,
    default=40,
    help="最小字幕间隔 (毫秒, 默认: 40)",
)
@click.option(
    "--output-dir",
    "-o",
    default="dist",
    help="输出目录 (默认: dist)",
)
@click.option(
    "--platform-template",
    "-p",
    multiple=True,
    help="平台命名模板 (格式: 平台名=模板)",
)
def init(
    languages,
    frame_rate,
    max_speed_zh,
    max_speed_en,
    min_gap,
    output_dir,
    platform_template,
):
    """初始化字幕校对项目"""
    config_manager = ConfigManager()

    if config_manager.is_initialized():
        click.confirm("项目已存在，是否覆盖?", abort=True)

    lang_enum = []
    for lang in languages:
        try:
            lang_enum.append(Language(lang.lower()))
        except ValueError:
            click.echo(f"警告: 不支持的语言 '{lang}', 已跳过", err=True)

    if not lang_enum:
        lang_enum = [Language.ZH, Language.EN]

    platform_templates = {}
    for template in platform_template:
        if "=" in template:
            platform, tmpl = template.split("=", 1)
            platform_templates[platform.strip()] = tmpl.strip()

    config = config_manager.init_project(
        languages=lang_enum,
        frame_rate=frame_rate,
        max_reading_speed_zh=max_speed_zh,
        max_reading_speed_en=max_speed_en,
        min_subtitle_gap_ms=min_gap,
        output_directory=output_dir,
        platform_templates=platform_templates,
    )

    click.echo("✅ 项目初始化完成!")
    click.echo(f"   支持语言: {', '.join(l.value for l in config.languages)}")
    click.echo(f"   帧率: {config.frame_rate} fps")
    click.echo(f"   中文最大读速: {config.max_reading_speed_zh} 字符/秒")
    click.echo(f"   英文最大读速: {config.max_reading_speed_en} 字符/秒")
    click.echo(f"   最小间隔: {config.min_subtitle_gap_ms}ms")


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option(
    "--language",
    "-l",
    type=click.Choice([l.value for l in Language]),
    help="指定文件语言 (自动检测)",
)
@click.option(
    "--episode",
    "-e",
    type=int,
    help="指定集数 (自动检测)",
)
@click.option(
    "--copy",
    "-c",
    is_flag=True,
    help="复制文件到 imports 目录",
)
def import_(files, language, episode, copy):
    """导入字幕、台本和交付清单文件"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    if not files:
        click.echo("❌ 请指定要导入的文件", err=True)
        raise click.Abort()

    lang = Language(language) if language else None
    import_dir = config_manager.get_import_dir()

    imported = {
        "subtitles": [],
        "scripts": [],
        "manifests": [],
    }

    for filepath in files:
        suffix = filepath.suffix.lower()

        if suffix in [".srt", ".vtt"]:
            sub_file = SubtitleParser.parse_file(filepath, language=lang, episode=episode)
            imported["subtitles"].append(sub_file)

            if copy:
                dest = import_dir / filepath.name
                shutil.copy2(filepath, dest)
                click.echo(f"📋 导入字幕: {filepath.name} -> {sub_file.language.value} (集数: {sub_file.episode or '未检测到'})")
            else:
                click.echo(f"📋 解析字幕: {filepath.name} -> {sub_file.language.value} (集数: {sub_file.episode or '未检测到'})")

        elif suffix == ".csv":
            content = filepath.read_text(encoding="utf-8-sig", errors="ignore")
            if "episode" in content.lower() or "集数" in content or "filename" in content.lower():
                manifest = ManifestParser.parse_file(filepath)
                imported["manifests"].append(manifest)
                if copy:
                    dest = import_dir / filepath.name
                    shutil.copy2(filepath, dest)
                click.echo(f"📋 导入交付清单: {filepath.name} ({len(manifest.items)} 条)")
            else:
                script = ScriptParser.parse_file(filepath, language=lang, episode=episode)
                imported["scripts"].append(script)
                if copy:
                    dest = import_dir / filepath.name
                    shutil.copy2(filepath, dest)
                click.echo(f"📋 导入台本: {filepath.name} -> {script.language.value} (集数: {script.episode or '未检测到'}, {len(script.entries)} 条)")

        else:
            click.echo(f"⚠️ 不支持的文件格式: {filepath.name}", err=True)

    total = sum(len(v) for v in imported.values())
    click.echo(f"\n✅ 导入完成! 共 {total} 个文件")
    if imported["subtitles"]:
        click.echo(f"   字幕文件: {len(imported['subtitles'])} 个")
    if imported["scripts"]:
        click.echo(f"   台本文件: {len(imported['scripts'])} 个")
    if imported["manifests"]:
        click.echo(f"   交付清单: {len(imported['manifests'])} 个")


def _load_imported_files(
    config_manager: ConfigManager,
) -> tuple[list[SubtitleFile], list[ScriptFile], Optional[ManifestFile]]:
    import_dir = config_manager.get_import_dir()
    subtitle_files = []
    script_files = []
    manifest_file = None

    if not import_dir.exists():
        return subtitle_files, script_files, manifest_file

    for filepath in import_dir.iterdir():
        if not filepath.is_file():
            continue

        suffix = filepath.suffix.lower()

        if suffix in [".srt", ".vtt"]:
            try:
                sub_file = SubtitleParser.parse_file(filepath)
                subtitle_files.append(sub_file)
            except Exception as e:
                click.echo(f"⚠️ 解析字幕文件失败: {filepath.name} - {e}", err=True)

        elif suffix == ".csv":
            try:
                content = filepath.read_text(encoding="utf-8-sig", errors="ignore")
                if "episode" in content.lower() or "集数" in content or "filename" in content.lower():
                    if manifest_file is None:
                        manifest_file = ManifestParser.parse_file(filepath)
                else:
                    script = ScriptParser.parse_file(filepath)
                    script_files.append(script)
            except Exception as e:
                click.echo(f"⚠️ 解析 CSV 文件失败: {filepath.name} - {e}", err=True)

    return subtitle_files, script_files, manifest_file


def _save_quarantine(
    quarantine: Quarantine,
    quarantine_dir: Path,
) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"quarantine_{timestamp}.json"
    filepath = quarantine_dir / filename

    data = {
        "generated_at": quarantine.generated_at.isoformat() if quarantine.generated_at else None,
        "issues": [
            {
                "id": i.id,
                "issue_type": i.issue_type.value,
                "severity": i.severity.value,
                "message": i.message,
                "language": i.language.value if i.language else None,
                "episode": i.episode,
                "subtitle_index": i.subtitle_index,
                "filename": i.filename,
                "details": i.details,
                "review_action": i.review_action.value,
                "review_note": i.review_note,
                "reviewed_at": i.reviewed_at.isoformat() if i.reviewed_at else None,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in quarantine.issues
        ],
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return filepath


@main.command()
@click.option(
    "--files",
    "-f",
    multiple=True,
    type=click.Path(exists=True, path_type=Path),
    help="指定检查的文件 (默认使用 imports 目录)",
)
@click.option(
    "--save/--no-save",
    default=True,
    help="是否保存到 quarantine.json (默认: 是)",
)
def check(files, save):
    """检查字幕问题 (时间码、重叠、读速、占位符等)"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    config = config_manager.load_config()
    validator = Validator(config)

    subtitle_files = []
    script_files = []
    manifest_file = None

    if files:
        for filepath in files:
            suffix = filepath.suffix.lower()
            if suffix in [".srt", ".vtt"]:
                sub_file = SubtitleParser.parse_file(filepath)
                subtitle_files.append(sub_file)
            elif suffix == ".csv":
                content = filepath.read_text(encoding="utf-8-sig", errors="ignore")
                if "episode" in content.lower() or "集数" in content or "filename" in content.lower():
                    if manifest_file is None:
                        manifest_file = ManifestParser.parse_file(filepath)
                else:
                    script = ScriptParser.parse_file(filepath)
                    script_files.append(script)
    else:
        subtitle_files, script_files, manifest_file = _load_imported_files(config_manager)

    if not subtitle_files:
        click.echo("❌ 未找到字幕文件，请先运行 'subtitle-checker import'", err=True)
        raise click.Abort()

    click.echo("🔍 开始检查字幕...")
    click.echo("")

    all_issues = []

    for sub_file in subtitle_files:
        click.echo(f"📄 检查: {sub_file.filename} ({sub_file.language.value})")
        issues = validator.validate_subtitle_file(sub_file)
        all_issues.extend(issues)

        if issues:
            critical = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
            warning = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
            click.echo(f"   发现问题: {len(issues)} 个 (严重: {critical}, 警告: {warning})")
        else:
            click.echo("   ✅ 未发现问题")

    if len(subtitle_files) > 1 or script_files:
        click.echo("")
        click.echo("🌐 检查多语言一致性...")
        multilingual_issues = validator.validate_multilingual(subtitle_files, script_files)
        all_issues.extend(multilingual_issues)
        if multilingual_issues:
            click.echo(f"   发现一致性问题: {len(multilingual_issues)} 个")

    if manifest_file:
        click.echo("")
        click.echo("📋 检查交付清单一致性...")
        manifest_issues = validator.validate_manifest(subtitle_files, manifest_file)
        all_issues.extend(manifest_issues)
        if manifest_issues:
            click.echo(f"   发现清单问题: {len(manifest_issues)} 个")

    quarantine = validator.create_quarantine(all_issues)

    review_store = ReviewStore(config_manager.get_quarantine_dir())
    quarantine = review_store.apply_reviews_to_quarantine(quarantine)

    history_manager = HistoryManager(config_manager.get_history_dir())
    history_manager.save_check_result(quarantine, subtitle_files, config.model_dump())

    if save:
        quarantine_path = _save_quarantine(quarantine, config_manager.get_quarantine_dir())
        click.echo("")
        click.echo(f"💾 问题已保存到: {quarantine_path}")

    click.echo("")
    click.echo("=" * 50)
    click.echo("📊 检查结果汇总:")

    critical = sum(1 for i in all_issues if i.severity == IssueSeverity.CRITICAL)
    warning = sum(1 for i in all_issues if i.severity == IssueSeverity.WARNING)
    info = sum(1 for i in all_issues if i.severity == IssueSeverity.INFO)

    click.echo(f"   总计问题: {len(all_issues)} 个")
    click.echo(f"   严重: {critical} 个")
    click.echo(f"   警告: {warning} 个")
    click.echo(f"   信息: {info} 个")

    if all_issues:
        click.echo("")
        click.echo("问题类型分布:")
        type_counts = {}
        for issue in all_issues:
            t = issue.issue_type.value
            if t not in type_counts:
                type_counts[t] = 0
            type_counts[t] += 1

        for issue_type, count in type_counts.items():
            click.echo(f"   - {issue_type}: {count} 个")


@main.command()
@click.option(
    "--source-lang",
    "-s",
    type=click.Choice([l.value for l in Language]),
    default="zh",
    help="源语言 (默认: zh)",
)
@click.option(
    "--target-lang",
    "-t",
    type=click.Choice([l.value for l in Language]),
    default="en",
    help="目标语言 (默认: en)",
)
@click.option(
    "--method",
    "-m",
    type=click.Choice(["timecode", "index", "script"]),
    default="timecode",
    help="对齐方式 (timecode: 时间码, index: 序号, script: 台本)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path),
    help="输出对齐结果的 JSON 文件路径",
)
def align(source_lang, target_lang, method, output):
    """按原文台本对齐多语言字幕段落"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    subtitle_files, script_files, _ = _load_imported_files(config_manager)

    if not subtitle_files:
        click.echo("❌ 未找到字幕文件，请先运行 'subtitle-checker import'", err=True)
        raise click.Abort()

    source_lang_enum = Language(source_lang)
    target_lang_enum = Language(target_lang)

    source_files = [s for s in subtitle_files if s.language == source_lang_enum]
    target_files = [s for s in subtitle_files if s.language == target_lang_enum]

    if not source_files:
        click.echo(f"❌ 未找到 {source_lang} 语言的字幕文件", err=True)
        raise click.Abort()
    if not target_files:
        click.echo(f"❌ 未找到 {target_lang} 语言的字幕文件", err=True)
        raise click.Abort()

    aligner = Aligner()
    all_results = []

    episodes = set()
    for sf in source_files:
        if sf.episode:
            episodes.add(sf.episode)
    for tf in target_files:
        if tf.episode:
            episodes.add(tf.episode)

    if not episodes:
        episodes.add(None)

    click.echo(f"🔗 开始对齐: {source_lang} -> {target_lang} (方法: {method})")
    click.echo("")

    for episode in episodes:
        source_file = next(
            (s for s in source_files if s.episode == episode),
            source_files[0] if episode is None else None,
        )
        target_file = next(
            (t for t in target_files if t.episode == episode),
            target_files[0] if episode is None else None,
        )

        if not source_file or not target_file:
            continue

        ep_label = f"第 {episode} 集" if episode else "未知集数"
        click.echo(f"📄 {ep_label}:")

        if method == "timecode":
            result = aligner.align_by_timecode(source_file, target_file)
        elif method == "index":
            result = aligner.align_by_index(source_file, target_file)
        else:
            if script_files:
                script = next(
                    (s for s in script_files if s.episode == episode),
                    script_files[0] if script_files else None,
                )
                if script:
                    results = aligner.align_with_script([source_file, target_file], script)
                    result = results[0] if results else None
                else:
                    click.echo("   ⚠️ 未找到台本文件，使用时间码对齐")
                    result = aligner.align_by_timecode(source_file, target_file)
            else:
                click.echo("   ⚠️ 未找到台本文件，使用时间码对齐")
                result = aligner.align_by_timecode(source_file, target_file)

        if result:
            all_results.append(result)

            high_conf = sum(1 for p in result.pairs if p.confidence >= 0.8)
            medium_conf = sum(1 for p in result.pairs if 0.5 <= p.confidence < 0.8)
            low_conf = sum(1 for p in result.pairs if p.confidence < 0.5)

            click.echo(f"   对齐对数: {len(result.pairs)}")
            click.echo(f"   高置信度 (>=0.8): {high_conf}")
            click.echo(f"   中置信度 (0.5-0.8): {medium_conf}")
            click.echo(f"   低置信度 (<0.5): {low_conf}")

            if result.pairs and click.get_current_context().params.get("verbose", False):
                for pair in result.pairs[:5]:
                    click.echo(f"      [{pair.confidence:.0%}] {pair.source_text[:30]}... -> {pair.target_text[:30]}...")

    if output and all_results:
        output_data = {
            "source_language": source_lang,
            "target_language": target_lang,
            "method": method,
            "generated_at": datetime.now().isoformat(),
            "results": [
                {
                    "episode": r.episode,
                    "source_language": r.source_language.value,
                    "target_language": r.target_language.value,
                    "pairs": [
                        {
                            "source_index": p.source_index,
                            "target_index": p.target_index,
                            "source_text": p.source_text,
                            "target_text": p.target_text,
                            "confidence": p.confidence,
                            "language_pair": p.language_pair,
                        }
                        for p in r.pairs
                    ],
                }
                for r in all_results
            ],
        }

        with open(output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        click.echo("")
        click.echo(f"💾 对齐结果已保存到: {output}")


@main.command("plan-fix")
@click.option(
    "--quarantine",
    "-q",
    type=click.Path(exists=True, path_type=Path),
    help="指定 quarantine.json 文件 (默认使用最新的)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path),
    help="输出修复计划的 JSON 文件路径",
)
def plan_fix(quarantine, output):
    """生成 dry-run 修复计划 (不直接修改文件)"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    config = config_manager.load_config()
    subtitle_files, script_files, manifest_file = _load_imported_files(config_manager)

    quarantine_dir = config_manager.get_quarantine_dir()

    if quarantine:
        quarantine_path = quarantine
    else:
        quarantine_files = sorted(
            quarantine_dir.glob("quarantine_*.json"),
            key=lambda p: p.name,
            reverse=True,
        )
        if not quarantine_files:
            click.echo("❌ 未找到 quarantine 文件，请先运行 'subtitle-checker check'", err=True)
            raise click.Abort()
        quarantine_path = quarantine_files[0]

    click.echo(f"📋 使用 quarantine 文件: {quarantine_path.name}")

    with open(quarantine_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    issues = []
    for issue_data in data.get("issues", []):
        issues.append(
            Issue(
                id=issue_data["id"],
                issue_type=IssueType(issue_data["issue_type"]),
                severity=IssueSeverity(issue_data["severity"]),
                message=issue_data["message"],
                language=Language(issue_data["language"]) if issue_data.get("language") else None,
                episode=issue_data.get("episode"),
                subtitle_index=issue_data.get("subtitle_index"),
                filename=issue_data.get("filename"),
                details=issue_data.get("details", {}),
                review_action=ReviewAction(issue_data.get("review_action", ReviewAction.PENDING)),
                review_note=issue_data.get("review_note"),
            )
        )

    quarantine_obj = Quarantine(issues=issues)

    fix_planner = FixPlanner(config)
    fix_plan = fix_planner.generate_fix_plan(
        quarantine_obj, subtitle_files, script_files, manifest_file
    )

    click.echo("")
    click.echo("📋 修复计划:")
    click.echo("")

    auto_fixes = [i for i in fix_plan.items if not i.requires_manual]
    manual_fixes = [i for i in fix_plan.items if i.requires_manual]

    if auto_fixes:
        click.echo("✅ 可自动修复项:")
        for item in auto_fixes:
            click.echo(f"   [{item.action.value}] {item.description}")
            if item.current_value and item.proposed_value:
                click.echo(f"      {item.current_value} -> {item.proposed_value}")
        click.echo("")

    if manual_fixes:
        click.echo("⚠️ 需要人工处理项:")
        for item in manual_fixes:
            click.echo(f"   {item.description}")
            if item.filename:
                click.echo(f"      文件: {item.filename}")

    click.echo("")
    click.echo(f"总计: {len(fix_plan.items)} 项修复建议")
    click.echo(f"   可自动修复: {len(auto_fixes)} 项")
    click.echo(f"   需要人工处理: {len(manual_fixes)} 项")

    if output:
        plan_data = {
            "generated_at": fix_plan.generated_at.isoformat() if fix_plan.generated_at else None,
            "is_dry_run": fix_plan.is_dry_run,
            "items": [
                {
                    "id": item.id,
                    "action": item.action.value,
                    "description": item.description,
                    "language": item.language.value if item.language else None,
                    "episode": item.episode,
                    "filename": item.filename,
                    "current_value": item.current_value,
                    "proposed_value": item.proposed_value,
                    "requires_manual": item.requires_manual,
                    "issue_ids": item.issue_ids,
                }
                for item in fix_plan.items
            ],
        }

        with open(output, "w", encoding="utf-8") as f:
            json.dump(plan_data, f, ensure_ascii=False, indent=2)

        click.echo("")
        click.echo(f"💾 修复计划已保存到: {output}")


@main.command("apply-fix")
@click.option(
    "--plan",
    "-p",
    type=click.Path(exists=True, path_type=Path),
    help="修复计划 JSON 文件 (默认使用最新检查结果)",
)
@click.option(
    "--yes",
    "-y",
    is_flag=True,
    help="跳过确认提示",
)
def apply_fix(plan, yes):
    """确认后应用修复并写入 dist 目录"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    config = config_manager.load_config()
    subtitle_files, script_files, manifest_file = _load_imported_files(config_manager)

    if not subtitle_files:
        click.echo("❌ 未找到字幕文件", err=True)
        raise click.Abort()

    fix_planner = FixPlanner(config)

    if plan:
        with open(plan, "r", encoding="utf-8") as f:
            plan_data = json.load(f)

        fix_plan = FixPlan(
            items=[
                FixPlanItem(
                    id=item["id"],
                    action=FixAction(item["action"]),
                    description=item["description"],
                    language=Language(item["language"]) if item.get("language") else None,
                    episode=item.get("episode"),
                    filename=item.get("filename"),
                    current_value=item.get("current_value"),
                    proposed_value=item.get("proposed_value"),
                    requires_manual=item.get("requires_manual", False),
                    issue_ids=item.get("issue_ids", []),
                )
                for item in plan_data.get("items", [])
            ],
            is_dry_run=plan_data.get("is_dry_run", True),
        )
    else:
        history_manager = HistoryManager(config_manager.get_history_dir())
        latest = history_manager.get_latest_check()

        if not latest:
            click.echo("❌ 未找到检查记录，请先运行 'subtitle-checker check'", err=True)
            raise click.Abort()

        quarantine_data = latest.get("quarantine", {})
        issues_data = quarantine_data.get("issues", [])

        issues = []
        for issue_data in issues_data:
            issues.append(
                Issue(
                    id=issue_data["id"],
                    issue_type=IssueType(issue_data["issue_type"]),
                    severity=IssueSeverity(issue_data["severity"]),
                    message=issue_data["message"],
                    language=Language(issue_data["language"]) if issue_data.get("language") else None,
                    episode=issue_data.get("episode"),
                    subtitle_index=issue_data.get("subtitle_index"),
                    filename=issue_data.get("filename"),
                    details=issue_data.get("details", {}),
                )
            )

        quarantine = Quarantine(issues=issues)
        fix_plan = fix_planner.generate_fix_plan(
            quarantine, subtitle_files, script_files, manifest_file
        )

    auto_count = sum(1 for i in fix_plan.items if not i.requires_manual)
    if auto_count == 0:
        click.echo("✅ 没有需要自动修复的项")
        return

    if not yes:
        click.echo(f"即将应用 {auto_count} 项自动修复到以下文件:")
        for sf in subtitle_files:
            click.echo(f"   - {sf.filename}")
        click.echo("")
        click.confirm("是否继续?", abort=True)

    click.echo("🔧 应用修复...")

    modified_files, change_log = fix_planner.apply_fix_plan(
        fix_plan, subtitle_files, manifest_file
    )

    output_dir = config_manager.get_output_dir()
    output_paths = fix_planner.write_fixed_subtitles(modified_files, output_dir)

    click.echo("")
    click.echo("✅ 修复已应用!")
    click.echo(f"   输出目录: {output_dir}")
    for path in output_paths:
        click.echo(f"   - {path.name}")

    if change_log.entries:
        click.echo("")
        click.echo("📝 变更日志:")
        for entry in change_log.entries:
            click.echo(f"   [{entry.action}] {entry.description}")
            if entry.before or entry.after:
                click.echo(f"      {entry.before or '-'} -> {entry.after or '-'}")

        changelog_path = output_dir / f"changelog_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        changelog_data = {
            "generated_at": change_log.generated_at.isoformat() if change_log.generated_at else None,
            "entries": [
                {
                    "id": e.id,
                    "action": e.action,
                    "description": e.description,
                    "language": e.language.value if e.language else None,
                    "episode": e.episode,
                    "filename": e.filename,
                    "before": e.before,
                    "after": e.after,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                }
                for e in change_log.entries
            ],
        }

        with open(changelog_path, "w", encoding="utf-8") as f:
            json.dump(changelog_data, f, ensure_ascii=False, indent=2)

        click.echo("")
        click.echo(f"💾 变更日志已保存到: {changelog_path}")


@main.command()
@click.argument("issue_id", required=False)
@click.option(
    "--action",
    "-a",
    type=click.Choice(["confirm", "dismiss", "pending"]),
    help="复核动作 (confirm: 确认, dismiss: 驳回, pending: 待处理)",
)
@click.option(
    "--note",
    "-n",
    help="复核备注",
)
@click.option(
    "--list",
    "-l",
    is_flag=True,
    help="列出所有问题",
)
def review(issue_id, action, note, list):
    """人工复核问题 (确认/驳回)"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    quarantine_dir = config_manager.get_quarantine_dir()
    review_store = ReviewStore(quarantine_dir)

    history_manager = HistoryManager(config_manager.get_history_dir())
    latest = history_manager.get_latest_check()

    if not latest:
        click.echo("❌ 未找到检查记录，请先运行 'subtitle-checker check'", err=True)
        raise click.Abort()

    quarantine_data = latest.get("quarantine", {})
    issues_data = quarantine_data.get("issues", [])

    issues = {}
    for issue_data in issues_data:
        issues[issue_data["id"]] = Issue(
            id=issue_data["id"],
            issue_type=IssueType(issue_data["issue_type"]),
            severity=IssueSeverity(issue_data["severity"]),
            message=issue_data["message"],
            language=Language(issue_data["language"]) if issue_data.get("language") else None,
            episode=issue_data.get("episode"),
            subtitle_index=issue_data.get("subtitle_index"),
            filename=issue_data.get("filename"),
            details=issue_data.get("details", {}),
        )

    if list:
        click.echo("📋 问题列表:")
        click.echo("")

        for issue_id_full, issue in issues.items():
            review = review_store.get_review(issue_id_full)
            status = "pending"
            if review:
                status = review.get("action", "pending")

            status_icon = "⏳"
            if status == "confirm":
                status_icon = "✅"
            elif status == "dismiss":
                status_icon = "❌"

            short_id = issue_id_full[:8]
            ep_label = f"EP{issue.episode}" if issue.episode else ""
            lang_label = issue.language.value if issue.language else ""
            filename_label = issue.filename or ""

            click.echo(f"{status_icon} [{short_id}...] {issue.issue_type.value}")
            click.echo(f"   {issue.message}")
            if ep_label or lang_label or filename_label:
                click.echo(f"   {ep_label} {lang_label} {filename_label}")
            click.echo("")
        return

    if not issue_id:
        click.echo("❌ 请指定问题 ID 或使用 --list 选项", err=True)
        raise click.Abort()

    matched_issue = None
    for full_id, issue in issues.items():
        if full_id.startswith(issue_id):
            matched_issue = issue
            issue_id = full_id
            break

    if not matched_issue:
        click.echo(f"❌ 未找到问题: {issue_id}", err=True)
        raise click.Abort()

    if not action:
        review = review_store.get_review(issue_id)
        click.echo("📋 问题详情:")
        click.echo(f"   ID: {issue_id}")
        click.echo(f"   类型: {matched_issue.issue_type.value}")
        click.echo(f"   严重程度: {matched_issue.severity.value}")
        click.echo(f"   消息: {matched_issue.message}")
        if matched_issue.episode:
            click.echo(f"   集数: 第 {matched_issue.episode} 集")
        if matched_issue.language:
            click.echo(f"   语言: {matched_issue.language.value}")
        if matched_issue.filename:
            click.echo(f"   文件: {matched_issue.filename}")

        if review:
            click.echo("")
            click.echo("📝 复核状态:")
            click.echo(f"   动作: {review.get('action', 'pending')}")
            if review.get("note"):
                click.echo(f"   备注: {review.get('note')}")
            if review.get("reviewed_at"):
                click.echo(f"   时间: {review.get('reviewed_at')}")
        else:
            click.echo("")
            click.echo("📝 复核状态: 待处理")

        click.echo("")
        click.echo("使用 --action 选项进行复核:")
        click.echo("   --action confirm: 确认问题需要修复")
        click.echo("   --action dismiss: 驳回问题 (忽略)")
        click.echo("   --action pending: 重置为待处理")
        return

    action_enum = ReviewAction(action)
    review_store.review_issue(issue_id, action_enum, note)

    action_text = "确认" if action == "confirm" else "驳回" if action == "dismiss" else "重置为待处理"
    click.echo(f"✅ 已 {action_text} 问题: {issue_id}")
    if note:
        click.echo(f"   备注: {note}")


@main.command()
@click.option(
    "--format",
    "-f",
    type=click.Choice(["all", "markdown", "csv", "json"]),
    default="all",
    help="导出格式 (默认: 全部)",
)
@click.option(
    "--output",
    "-o",
    type=click.Path(path_type=Path),
    help="输出目录 (默认使用项目的 dist 目录)",
)
def export(format, output):
    """导出 Markdown 交付复盘、CSV 问题清单和 JSON 审计包"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    config = config_manager.load_config()
    subtitle_files, script_files, manifest_file = _load_imported_files(config_manager)

    quarantine_dir = config_manager.get_quarantine_dir()
    review_store = ReviewStore(quarantine_dir)

    history_manager = HistoryManager(config_manager.get_history_dir())
    latest = history_manager.get_latest_check()

    if not latest:
        click.echo("❌ 未找到检查记录，请先运行 'subtitle-checker check'", err=True)
        raise click.Abort()

    quarantine_data = latest.get("quarantine", {})
    issues_data = quarantine_data.get("issues", [])

    issues = []
    for issue_data in issues_data:
        issues.append(
            Issue(
                id=issue_data["id"],
                issue_type=IssueType(issue_data["issue_type"]),
                severity=IssueSeverity(issue_data["severity"]),
                message=issue_data["message"],
                language=Language(issue_data["language"]) if issue_data.get("language") else None,
                episode=issue_data.get("episode"),
                subtitle_index=issue_data.get("subtitle_index"),
                filename=issue_data.get("filename"),
                details=issue_data.get("details", {}),
            )
        )

    quarantine = Quarantine(issues=issues)
    quarantine = review_store.apply_reviews_to_quarantine(quarantine)

    review_stats = review_store.get_stats(quarantine)

    if output:
        output_dir = Path(output)
        output_dir.mkdir(parents=True, exist_ok=True)
    else:
        output_dir = config_manager.get_output_dir()

    exporter = Exporter(output_dir)

    click.echo(f"📤 导出到: {output_dir}")
    click.echo("")

    exported_files = []

    if format in ["all", "markdown"]:
        md_path = exporter.export_markdown_report(
            quarantine,
            subtitle_files=subtitle_files,
            review_stats=review_stats,
        )
        exported_files.append(md_path)
        click.echo(f"✅ Markdown 报告: {md_path.name}")

    if format in ["all", "csv"]:
        csv_path = exporter.export_issues_csv(quarantine)
        exported_files.append(csv_path)
        click.echo(f"✅ CSV 问题清单: {csv_path.name}")

    if format in ["all", "json"]:
        json_path = exporter.export_audit_json(
            quarantine,
            subtitle_files=subtitle_files,
            config=config.model_dump(),
        )
        exported_files.append(json_path)
        click.echo(f"✅ JSON 审计包: {json_path.name}")

    click.echo("")
    click.echo(f"📊 导出统计:")
    click.echo(f"   总计问题: {review_stats['total']}")
    click.echo(f"   待处理: {review_stats['pending']}")
    click.echo(f"   已确认: {review_stats['confirmed']}")
    click.echo(f"   已驳回: {review_stats['dismissed']}")


@main.command()
@click.option(
    "--episode",
    "-e",
    type=int,
    help="按集数筛选",
)
@click.option(
    "--language",
    "-l",
    type=click.Choice([lang.value for lang in Language]),
    help="按语言筛选",
)
@click.option(
    "--issue-type",
    "-t",
    type=click.Choice([t.value for t in IssueType]),
    help="按问题类型筛选",
)
@click.option(
    "--limit",
    "-n",
    type=int,
    default=50,
    help="显示条数限制 (默认: 50)",
)
@click.option(
    "--summary",
    "-s",
    is_flag=True,
    help="显示汇总统计",
)
def history(episode, language, issue_type, limit, summary):
    """按剧集、语言和问题类型查询历史检查结果"""
    config_manager = ConfigManager()
    if not config_manager.is_initialized():
        click.echo("❌ 项目未初始化，请先运行 'subtitle-checker init'", err=True)
        raise click.Abort()

    history_dir = config_manager.get_history_dir()
    history_manager = HistoryManager(history_dir)

    if summary:
        lang_enum = Language(language) if language else None
        issue_type_enum = IssueType(issue_type) if issue_type else None

        summary_data = history_manager.get_history_summary(
            episode=episode,
            language=lang_enum,
        )

        click.echo("📊 历史检查汇总:")
        click.echo(f"   总计记录: {summary_data['total_records']}")
        click.echo(f"   检查日期: {summary_data['unique_dates']} 天")
        if summary_data["check_dates"]:
            click.echo(f"   日期范围: {summary_data['check_dates'][0]} ~ {summary_data['check_dates'][-1]}")

        if summary_data["by_episode"]:
            click.echo("")
            click.echo("按集数分布:")
            for ep, count in sorted(summary_data["by_episode"].items()):
                click.echo(f"   {ep}: {count} 个问题")

        if summary_data["by_language"]:
            click.echo("")
            click.echo("按语言分布:")
            for lang, count in sorted(summary_data["by_language"].items()):
                click.echo(f"   {lang}: {count} 个问题")

        if summary_data["by_issue_type"]:
            click.echo("")
            click.echo("按问题类型分布:")
            for typ, count in sorted(summary_data["by_issue_type"].items()):
                click.echo(f"   {typ}: {count} 个问题")

        return

    sessions = history_manager.list_check_sessions(limit=10)

    if not sessions:
        click.echo("ℹ️ 暂无历史检查记录")
        return

    click.echo("📋 最近检查会话:")
    click.echo("")
    for session in sessions[:5]:
        click.echo(f"   📅 {session['timestamp']}")
        click.echo(f"      总计: {session['total_issues']} 个问题")
        click.echo(f"      严重: {session['critical']}, 警告: {session['warning']}, 信息: {session['info']}")
        click.echo("")

    lang_enum = Language(language) if language else None
    issue_type_enum = IssueType(issue_type) if issue_type else None

    records = history_manager.query_history(
        episode=episode,
        language=lang_enum,
        issue_type=issue_type_enum,
        limit=limit,
    )

    if not records:
        click.echo("ℹ️ 没有符合条件的记录")
        return

    click.echo(f"📋 查询结果 (显示前 {min(limit, len(records))} 条):")
    click.echo("")

    for record in records[:limit]:
        ep_label = f"EP{record.episode}" if record.episode else ""
        lang_label = record.language.value if record.language else ""
        type_label = record.issue_type.value if record.issue_type else ""

        click.echo(f"[{record.check_timestamp.strftime('%Y-%m-%d %H:%M')}]")
        click.echo(f"   {type_label}: {record.summary}")
        if ep_label or lang_label:
            click.echo(f"   {ep_label} {lang_label}")
        click.echo("")


if __name__ == "__main__":
    main()
