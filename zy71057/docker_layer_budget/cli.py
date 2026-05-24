import os
import sys
from typing import Optional

import click
import yaml

from .budget_engine import BudgetEngine
from .config import BudgetRules, DEFAULT_BUDGET_RULES
from .dockerfile_analyzer import DockerfileAnalyzer
from .layer_parser import LayerParser
from .report_generator import ReportGenerator
from .utils import parse_size


EXIT_SUCCESS = 0
EXIT_VALIDATION_ERROR = 1
EXIT_BUDGET_VIOLATION = 2
EXIT_RUNTIME_ERROR = 3


def _validate_size_param(ctx, param, value):
    if value is None:
        return None
    try:
        return parse_size(value)
    except ValueError as e:
        raise click.BadParameter(
            f"无效的尺寸格式: '{value}'。\n"
            f"支持的格式: B, KB, MB, GB, TB (例如: 500MB, 2GB, 1.5TB)"
        ) from None


class CLIContext:
    def __init__(self):
        self.verbose = False
        self.output_dir = "./reports"
        self.budget_rules = DEFAULT_BUDGET_RULES
        self.parser = LayerParser()
        self.engine = None
        self.generator = None


pass_context = click.make_pass_decorator(CLIContext, ensure=True)


@click.group(invoke_without_command=True)
@click.version_option(version="0.1.0", prog_name="docker-layer-budget")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
@click.option("--output-dir", "-o", default="./reports", help="报告输出目录", type=click.Path(file_okay=False))
@click.option("--budget-rules", "-b", type=click.Path(exists=True, dir_okay=False), help="预算规则配置文件 (YAML/JSON)")
@click.option(
    "--total-max-size",
    type=str,
    callback=_validate_size_param,
    help="总大小预算上限 (例如: 2GB, 500MB)",
)
@click.option(
    "--layer-max-size",
    type=str,
    callback=_validate_size_param,
    help="单层大小预算上限 (例如: 500MB, 100MB)",
)
@pass_context
def main(
    ctx: CLIContext,
    verbose: bool,
    output_dir: str,
    budget_rules: Optional[str],
    total_max_size: Optional[int],
    layer_max_size: Optional[int],
):
    """Docker 镜像层预算 CLI - 分析镜像层大小并检测预算超限"""
    ctx.verbose = verbose
    ctx.output_dir = output_dir

    if budget_rules:
        try:
            with open(budget_rules, "r", encoding="utf-8") as f:
                if budget_rules.endswith((".yaml", ".yml")):
                    rules_data = yaml.safe_load(f)
                else:
                    import json
                    rules_data = json.load(f)
                ctx.budget_rules = BudgetRules.from_dict(rules_data)
        except ValueError as e:
            click.echo(f"❌ 预算规则配置错误: {e}", err=True)
            sys.exit(EXIT_VALIDATION_ERROR)
        except Exception as e:
            click.echo(f"❌ 无法读取预算规则文件: {e}", err=True)
            sys.exit(EXIT_VALIDATION_ERROR)

    if total_max_size is not None:
        ctx.budget_rules.total_max_size = total_max_size

    if layer_max_size is not None:
        ctx.budget_rules.layer_budget.max_size = layer_max_size

    ctx.engine = BudgetEngine(ctx.budget_rules)
    ctx.generator = ReportGenerator(output_dir)

    if ctx.verbose:
        click.echo(f"📁 输出目录: {output_dir}")
        click.echo(f"📐 总预算: {ctx.budget_rules.total_max_size / (1024*1024*1024):.2f} GB")
        click.echo(f"📐 单层预算: {ctx.budget_rules.layer_budget.max_size / (1024*1024):.2f} MB")


@main.command()
@click.argument("input_source")
@click.option("--dockerfile", "-f", type=click.Path(exists=True, dir_okay=False), help="关联的 Dockerfile 路径")
@click.option("--commit-info", type=click.Path(exists=True, dir_okay=False), help="提交信息文件路径")
@click.option("--format", "-F", "formats", multiple=True, default=["json", "markdown", "html"],
              type=click.Choice(["json", "markdown", "md", "html", "terminal"]),
              help="输出格式 (可指定多次)")
@click.option("--overwrite", is_flag=True, help="覆盖已存在的报告文件")
@click.option("--prefix", help="报告文件名前缀")
@click.option("--no-terminal", is_flag=True, help="不输出终端摘要")
@pass_context
def check(
    ctx: CLIContext,
    input_source: str,
    dockerfile: Optional[str],
    commit_info: Optional[str],
    formats: list,
    overwrite: bool,
    prefix: Optional[str],
    no_terminal: bool,
):
    """检查镜像层预算并生成报告

    INPUT_SOURCE 可以是:
    - Docker 镜像名称 (例如: myimage:latest)
    - 镜像元数据 JSON 文件
    - Layer 清单文件
    """
    try:
        if not _validate_input_source(input_source):
            click.echo(f"❌ 无效的输入源: {input_source}", err=True)
            sys.exit(EXIT_VALIDATION_ERROR)

        if ctx.verbose:
            click.echo(f"🔍 解析输入: {input_source}")

        metadata = ctx.parser.auto_detect_and_parse(input_source)

        if commit_info:
            metadata.commit_info = ctx.parser.parse_commit_info(commit_info)

        dockerfile_analysis = None
        if dockerfile:
            if ctx.verbose:
                click.echo(f"📝 分析 Dockerfile: {dockerfile}")
            analyzer = DockerfileAnalyzer()
            dockerfile_analysis = analyzer.analyze(dockerfile)
            metadata.base_image = dockerfile_analysis.base_image
            suggestions = analyzer.suggest_optimizations(dockerfile_analysis)
            dockerfile_analysis.__dict__["suggestions"] = suggestions

        if ctx.verbose:
            click.echo(f"⚖️  检查预算...")

        budget_result = ctx.engine.check_budget(metadata)

        if not no_terminal or "terminal" in formats:
            terminal_output = ctx.generator.generate_terminal_summary(
                metadata, budget_result, dockerfile_analysis
            )
            click.echo(terminal_output)

        file_formats = [f for f in formats if f != "terminal"]
        if file_formats:
            if ctx.verbose:
                click.echo(f"📄 生成报告...")

            report_prefix = prefix or metadata.image_name or "report"

            output_files = ctx.generator.write_reports(
                metadata,
                budget_result,
                dockerfile_analysis,
                formats=file_formats,
                overwrite=overwrite,
                prefix=report_prefix,
            )

            click.echo("")
            click.echo("📁 生成的报告文件:")
            for fmt, path in output_files.items():
                abs_path = os.path.abspath(path)
                click.echo(f"  ✅ {fmt.upper()}: {abs_path}")

        if budget_result.passed:
            sys.exit(EXIT_SUCCESS)
        else:
            sys.exit(EXIT_BUDGET_VIOLATION)

    except FileExistsError as e:
        click.echo(f"❌ {e}", err=True)
        sys.exit(EXIT_VALIDATION_ERROR)
    except FileNotFoundError as e:
        click.echo(f"❌ 文件不存在: {e}", err=True)
        sys.exit(EXIT_VALIDATION_ERROR)
    except ValueError as e:
        click.echo(f"❌ 数据错误: {e}", err=True)
        sys.exit(EXIT_VALIDATION_ERROR)
    except RuntimeError as e:
        click.echo(f"❌ 运行时错误: {e}", err=True)
        sys.exit(EXIT_RUNTIME_ERROR)
    except Exception as e:
        if ctx.verbose:
            import traceback
            traceback.print_exc()
        click.echo(f"❌ 未知错误: {e}", err=True)
        sys.exit(EXIT_RUNTIME_ERROR)


@main.command()
@click.option("--output", "-o", type=click.Path(dir_okay=False), help="输出配置文件路径")
@click.option("--format", "-F", "fmt", default="yaml", type=click.Choice(["yaml", "json"]), help="配置文件格式")
@pass_context
def init_config(ctx: CLIContext, output: Optional[str], fmt: str):
    """生成默认预算规则配置文件"""
    default_config = {
        "total_max_size": "2GB",
        "layer_budget": {
            "max_size": "500MB",
            "warning_threshold": 0.8
        },
        "path_patterns": {
            "**/*.pyc": "10MB",
            "**/.git": "100MB",
            "**/node_modules": "500MB",
            "**/__pycache__": "50MB"
        },
        "cached_dirs": [
            "/var/cache",
            "/root/.cache",
            "/root/.npm",
            "/root/.pip",
            "/tmp"
        ],
        "base_image_allowlist": []
    }

    output_path = output or f"dlb-config.{fmt}"

    if os.path.exists(output_path):
        click.echo(f"⚠️  配置文件已存在: {output_path}", err=True)
        sys.exit(EXIT_VALIDATION_ERROR)

    with open(output_path, "w", encoding="utf-8") as f:
        if fmt == "yaml":
            yaml.dump(default_config, f, default_flow_style=False, allow_unicode=True)
        else:
            import json
            json.dump(default_config, f, indent=2, ensure_ascii=False)

    click.echo(f"✅ 已生成配置文件: {os.path.abspath(output_path)}")
    click.echo("")
    click.echo("提示: 编辑此文件自定义预算规则，然后使用:")
    click.echo(f"  dlb check -b {output_path} <image>")


@main.command(name="list")
@click.argument("input_source")
@click.option("--details", "-d", is_flag=True, help="显示详细信息")
@pass_context
def list_layers(ctx: CLIContext, input_source: str, details: bool):
    """列出镜像层信息"""
    try:
        metadata = ctx.parser.auto_detect_and_parse(input_source)

        click.echo("")
        click.echo(f"📦 镜像: {metadata.image_name or 'N/A'}:{metadata.image_tag or 'N/A'}")
        click.echo(f"📊 总大小: {metadata.total_size / (1024*1024*1024):.2f} GB ({metadata.total_size} 字节)")
        click.echo(f"📚 层数: {metadata.layers_count}")
        click.echo("")

        click.echo("=" * 100)
        click.echo(f"{'ID':<4} {'类型':<6} {'大小':>12} {'命令'}")
        click.echo("=" * 100)

        for layer in metadata.layers:
            layer_type = "基础" if layer.is_base_image else "缓存" if layer.is_cached else "构建"
            if details:
                click.echo(
                    f"{layer.index:<4} {layer_type:<6} {layer.size / (1024*1024):>10.2f} MB {layer.created_by}"
                )
                if layer.files:
                    for f in layer.files[:3]:
                        click.echo(f"       → {f.path} ({f.size} 字节)")
                    if len(layer.files) > 3:
                        click.echo(f"       → ... 还有 {len(layer.files) - 3} 个文件")
            else:
                click.echo(
                    f"{layer.index:<4} {layer_type:<6} {layer.size / (1024*1024):>10.2f} MB {layer.command_summary}"
                )

        click.echo("=" * 100)

    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(EXIT_RUNTIME_ERROR)


@main.command()
@click.argument("input_source")
@click.option("--type", "-t", "violation_type", help="只显示指定类型的问题")
@pass_context
def explain(ctx: CLIContext, input_source: str, violation_type: Optional[str]):
    """解释预算违规问题并给出解决方案"""
    try:
        metadata = ctx.parser.auto_detect_and_parse(input_source)
        budget_result = ctx.engine.check_budget(metadata)

        all_violations = budget_result.violations + budget_result.warnings

        if violation_type:
            all_violations = [v for v in all_violations if v.type == violation_type]

        if not all_violations:
            click.echo("✅ 没有发现预算违规问题！")
            return

        for v in all_violations:
            click.echo("")
            click.echo("=" * 80)
            click.echo(f"⚠️  问题类型: {v.type}")
            click.echo(f"📝 描述: {v.message}")
            if v.layer_index is not None:
                click.echo(f"📍 位置: 第 {v.layer_index} 层")
            click.echo("=" * 80)
            click.echo(ctx.engine.get_explanation(v))

    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        sys.exit(EXIT_RUNTIME_ERROR)


def _validate_input_source(input_source: str) -> bool:
    if os.path.exists(input_source):
        return True

    import re
    if re.match(r"^[a-zA-Z0-9._/-]+:[a-zA-Z0-9._/-]+$", input_source):
        return True

    return False


if __name__ == "__main__":
    main()
