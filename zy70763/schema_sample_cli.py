#!/usr/bin/env python3
"""
JSON Schema 边界样本排查 CLI

后端同学写了 JSON Schema，却没有成套的正常、边界和非法样本给联调用。
这个工具自动生成各类测试样本，包含：
- 正常输入样本 (valid)
- 边界条件样本 (boundary)
- 非法输入样本 - 脏数据 (invalid)
- 边缘案例 - 空值、冲突等 (edge_case)
"""

import json
import os
import sys

import click

from schema_tester.generator import SchemaSampleGenerator
from schema_tester.reporter import Reporter


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """JSON Schema 边界样本排查 CLI - 为联调生成成套测试样本"""
    pass


@cli.command()
@click.argument("schema_file", type=click.Path(exists=True, readable=True))
@click.option("--output", "-o", default="./test_samples", help="输出目录", show_default=True)
@click.option("--seed", "-s", default=42, type=int, help="随机种子，保证重复生成稳定", show_default=True)
@click.option("--name", "-n", help="Schema名称（默认使用文件名）")
def generate(schema_file, output, seed, name):
    """从 Schema 生成全套测试样本"""
    try:
        with open(schema_file, "r", encoding="utf-8") as f:
            schema = json.load(f)
    except json.JSONDecodeError as e:
        click.echo(f"❌ Schema 文件解析失败: {e}", err=True)
        sys.exit(1)

    schema_name = name or os.path.splitext(os.path.basename(schema_file))[0]

    click.echo(f"📘 加载 Schema: {schema_name}")
    click.echo(f"🌱 随机种子: {seed}")
    click.echo("")

    generator = SchemaSampleGenerator(schema, seed=seed)
    samples = generator.generate_all()

    validated_samples = []
    for sample in samples:
        is_valid, error_msg = generator.validate_sample(sample)
        validated_samples.append(sample)

    reporter = Reporter(validated_samples, output, schema_name)
    reporter.generate_all()
    reporter.print_summary()

    click.echo("\n✅ 样本生成完成！")


@cli.command()
@click.argument("index_file", type=click.Path(exists=True, readable=True))
@click.option("--type", "-t", "filter_type", help="按类型过滤: valid/boundary/invalid/edge_case")
@click.option("--field", "-f", help="按字段名过滤")
def list_samples(index_file, filter_type, field):
    """列出已生成的样本索引"""
    try:
        with open(index_file, "r", encoding="utf-8") as f:
            index = json.load(f)
    except json.JSONDecodeError as e:
        click.echo(f"❌ 索引文件解析失败: {e}", err=True)
        sys.exit(1)

    samples = index["samples"]

    if filter_type:
        samples = [s for s in samples if s["type"] == filter_type]

    if field:
        samples = [s for s in samples if s.get("field") == field]

    click.echo(f"📋 Schema: {index['schema']}")
    click.echo(f"📊 匹配样本: {len(samples)}/{index['total_samples']}")
    click.echo("")

    type_markers = {
        "valid": "✅",
        "boundary": "⚠️",
        "invalid": "❌",
        "edge_case": "🔲",
    }

    for i, sample in enumerate(samples, 1):
        marker = type_markers.get(sample["type"], "?")
        click.echo(f"{i:3d}. {marker} [{sample['type']:8s}] {sample['id']}")
        if sample.get("field"):
            click.echo(f"     字段: {sample['field']}")
        if sample.get("reason"):
            click.echo(f"     说明: {sample['reason']}")
        click.echo("")


@cli.command()
@click.argument("sample_dir", type=click.Path(exists=True))
@click.argument("sample_id")
def show(sample_dir, sample_id):
    """查看单个样本详情"""
    index_file = os.path.join(sample_dir, "index.json")

    try:
        with open(index_file, "r", encoding="utf-8") as f:
            index = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        click.echo(f"❌ 读取索引失败: {e}", err=True)
        sys.exit(1)

    sample = next((s for s in index["samples"] if s["id"] == sample_id), None)

    if not sample:
        click.echo(f"❌ 未找到样本: {sample_id}", err=True)
        sys.exit(1)

    sample_file = os.path.join(sample_dir, sample["type"], f"{sample['id']}.json")

    try:
        with open(sample_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        click.echo(f"❌ 样本文件不存在: {sample_file}", err=True)
        sys.exit(1)

    type_markers = {
        "valid": "✅",
        "boundary": "⚠️",
        "invalid": "❌",
        "edge_case": "🔲",
    }

    marker = type_markers.get(sample["type"], "?")

    click.echo(f"{marker} [bold]{sample['id']}[/bold]")
    click.echo(f"   类型: {sample['type']}")
    if sample.get("field"):
        click.echo(f"   字段: {sample['field']}")
    if sample.get("reason"):
        click.echo(f"   说明: {sample['reason']}")
    click.echo("")
    click.echo("📄 数据内容:")
    click.echo(json.dumps(data, indent=2, ensure_ascii=False))


@cli.command()
def example():
    """生成示例 Schema 用于测试"""
    example_schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "title": "用户注册请求 Schema",
        "required": ["username", "email", "age"],
        "properties": {
            "username": {
                "type": "string",
                "minLength": 3,
                "maxLength": 20,
                "description": "用户名"
            },
            "email": {
                "type": "string",
                "format": "email",
                "description": "邮箱地址"
            },
            "age": {
                "type": "integer",
                "minimum": 18,
                "maximum": 120,
                "description": "年龄"
            },
            "status": {
                "type": "string",
                "enum": ["active", "inactive", "pending"],
                "description": "账户状态"
            },
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 0,
                "maxItems": 10,
                "description": "标签列表"
            }
        }
    }

    output_file = "user_schema.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(example_schema, f, indent=2, ensure_ascii=False)

    click.echo(f"✅ 示例 Schema 已生成: {output_file}")
    click.echo("")
    click.echo("下一步操作:")
    click.echo(f"  python schema_sample_cli.py generate {output_file}")
    click.echo("")
    click.echo("示例 Schema 包含字段:")
    click.echo("  - username (3-20字符字符串)")
    click.echo("  - email (email格式)")
    click.echo("  - age (18-120整数)")
    click.echo("  - status (枚举: active/inactive/pending)")
    click.echo("  - tags (最多10个字符串的数组)")


if __name__ == "__main__":
    cli()
