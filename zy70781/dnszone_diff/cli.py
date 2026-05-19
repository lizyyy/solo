import click
import sys
from typing import List, Tuple
from .parser import parse_zone_file, ZoneParseResult
from .comparator import compare_zones
from .reporter import generate_report


def parse_env_file_pairs(pairs: List[str]) -> List[Tuple[str, str]]:
    env_files = []
    for pair in pairs:
        if ":" not in pair:
            raise click.BadParameter(f"无效的格式: {pair}，需要 env:file 格式")
        env, file = pair.split(":", 1)
        env_files.append((env.strip(), file.strip()))
    return env_files


@click.group()
def cli():
    pass


@cli.command()
@click.argument("env_file_pairs", nargs=-1, required=True)
@click.option("--output", "-o", type=click.Path(), help="输出报告文件路径")
@click.option("--format", "-f", "fmt", type=click.Choice(["text", "json", "yaml", "html"]), default="text", help="输出格式")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，只返回退出码")
def diff(env_file_pairs, output, fmt, quiet):
    """对比多个环境的DNS zone文件差异
    
    ENV_FILE_PAINS: 环境名和文件路径的配对，格式为 env:file
    
    示例:
      dnszone-diff diff prod:prod.zone staging:staging.zone dev:dev.zone
    """
    try:
        env_files = parse_env_file_pairs(env_file_pairs)
    except click.BadParameter as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)

    parse_results: List[ZoneParseResult] = []
    for env, file_path in env_files:
        try:
            result = parse_zone_file(env, file_path)
            parse_results.append(result)
        except FileNotFoundError:
            click.echo(f"错误: 文件不存在 - {file_path}", err=True)
            sys.exit(1)
        except Exception as e:
            click.echo(f"错误: 解析文件失败 {file_path} - {str(e)}", err=True)
            sys.exit(1)

    diff_result = compare_zones(parse_results)
    report = generate_report(diff_result, output, fmt)

    if not quiet:
        if fmt == "html" and output:
            click.echo(f"HTML报告已生成: {output}")
        else:
            click.echo(report)

    exit_code = 1 if diff_result.has_issues() else 0
    sys.exit(exit_code)


@cli.command()
@click.argument("zone_file", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="输出解析结果文件")
@click.option("--format", "-f", "fmt", type=click.Choice(["text", "json"]), default="text", help="输出格式")
def parse(zone_file, output, fmt):
    """解析单个zone文件并显示解析结果
    
    ZONE_FILE: zone文件路径
    """
    try:
        result = parse_zone_file("single", zone_file)
    except Exception as e:
        click.echo(f"错误: 解析文件失败 - {str(e)}", err=True)
        sys.exit(1)

    if fmt == "json":
        import json
        data = {
            "env": result.env,
            "file_path": result.file_path,
            "origin": result.origin,
            "default_ttl": result.default_ttl,
            "records_count": len(result.records),
            "bad_lines_count": len(result.bad_lines),
            "records": [
                {
                    "name": r.name,
                    "normalized_name": r.normalized_name(),
                    "type": r.record_type,
                    "value": r.value,
                    "ttl": r.ttl,
                    "source": {
                        "line": r.sources[0].line_number,
                        "raw": r.sources[0].raw_line,
                    }
                }
                for r in result.records
            ],
            "bad_lines": [
                {
                    "line": bl.source.line_number,
                    "raw": bl.source.raw_line,
                    "error": bl.error,
                }
                for bl in result.bad_lines
            ],
        }
        content = json.dumps(data, indent=2, ensure_ascii=False)
    else:
        lines = []
        lines.append(f"解析文件: {zone_file}")
        lines.append(f"Origin: {result.origin or 'N/A'}")
        lines.append(f"默认TTL: {result.default_ttl or 'N/A'}")
        lines.append("")
        lines.append(f"成功解析 {len(result.records)} 条记录:")
        lines.append("-" * 60)
        for r in result.records:
            ttl = r.ttl if r.ttl else "default"
            lines.append(f"  [{r.sources[0].line_number}] {r.name:<20} {r.record_type:<6} {ttl:<8} {r.value}")
        
        if result.bad_lines:
            lines.append("")
            lines.append(f"发现 {len(result.bad_lines)} 条解析错误:")
            lines.append("-" * 60)
            for bl in result.bad_lines:
                lines.append(f"  [{bl.source.line_number}] 错误: {bl.error}")
                lines.append(f"      原文: {bl.source.raw_line}")
        
        content = "\n".join(lines)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(content)
        click.echo(f"解析结果已保存到: {output}")
    else:
        click.echo(content)


def main():
    cli()


if __name__ == "__main__":
    main()
