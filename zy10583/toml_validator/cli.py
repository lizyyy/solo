import os
import sys
import tempfile
import click
from . import __version__
from .validator import TomlValidator
from .reporter import Reporter


def create_test_samples() -> dict:
    valid_toml = """
[project]
name = "test-project"
version = "1.0.0"
enabled = true
port = 8080
env = "production"
tags = ["python", "rust"]

[database]
host = "localhost"
max_connections = 10
"""

    invalid_toml = """
[project]
name = 12345
version = "1.0.0"
enabled = "yes"
port = 99999
env = "unknown"

[database]
host = "localhost"
max_connections = -5
"""

    boundary_toml = """
[project]
name = ""
version = "0.0.1"
enabled = false
port = 1024
"""

    schema = {
        "name": "Test Schema",
        "version": "1.0",
        "fields": [
            {"path": "project.name", "type": "string", "required": True},
            {"path": "project.version", "type": "string", "required": True},
            {"path": "project.enabled", "type": "boolean", "required": True},
            {"path": "project.port", "type": "integer", "required": True, "min_value": 1024, "max_value": 65535},
            {"path": "project.env", "type": "string", "required": False, "default": "development", "enum": ["development", "staging", "production"]},
            {"path": "database.host", "type": "string", "required": True},
            {"path": "database.max_connections", "type": "integer", "required": True, "min_value": 1},
        ]
    }

    return {
        "valid_toml": valid_toml,
        "invalid_toml": invalid_toml,
        "boundary_toml": boundary_toml,
        "schema": schema
    }


def run_self_test():
    click.echo("🧪 运行自检程序...")
    samples = create_test_samples()
    passed = 0
    total = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        valid_path = os.path.join(tmpdir, "valid.toml")
        invalid_path = os.path.join(tmpdir, "invalid.toml")
        boundary_path = os.path.join(tmpdir, "boundary.toml")
        schema_path = os.path.join(tmpdir, "schema.json")

        with open(valid_path, "w") as f:
            f.write(samples["valid_toml"])
        with open(invalid_path, "w") as f:
            f.write(samples["invalid_toml"])
        with open(boundary_path, "w") as f:
            f.write(samples["boundary_toml"])
        import json
        with open(schema_path, "w") as f:
            json.dump(samples["schema"], f)

        click.echo("\n1️⃣ 测试 TOML 解析...")
        validator = TomlValidator.from_schema_file(schema_path)
        total += 1
        try:
            result = validator.validate(valid_path)
            if result.is_valid:
                click.echo("   ✅ 解析正常配置通过")
                passed += 1
            else:
                click.echo("   ❌ 解析正常配置失败")
        except Exception as e:
            click.echo(f"   ❌ 解析异常: {e}")

        click.echo("\n2️⃣ 测试无效配置校验...")
        total += 1
        try:
            result = validator.validate(invalid_path)
            if not result.is_valid and len(result.errors) >= 4:
                click.echo(f"   ✅ 校验发现 {len(result.errors)} 个错误，符合预期")
                passed += 1
            else:
                click.echo(f"   ❌ 校验失败，发现 {len(result.errors)} 个错误")
        except Exception as e:
            click.echo(f"   ❌ 校验异常: {e}")

        click.echo("\n3️⃣ 测试边界值校验...")
        total += 1
        try:
            result = validator.validate(boundary_path)
            boundary_errors = [e for e in result.errors if e.field_path == "project.port"]
            if not boundary_errors:
                click.echo("   ✅ 边界值 (port=1024) 校验通过")
                passed += 1
            else:
                click.echo("   ❌ 边界值校验失败")
        except Exception as e:
            click.echo(f"   ❌ 边界值校验异常: {e}")

        click.echo("\n4️⃣ 测试默认值补全...")
        total += 1
        try:
            result = validator.validate(boundary_path, apply_defaults=True)
            if "project.env" in result.defaults_applied and result.defaults_applied["project.env"] == "development":
                click.echo("   ✅ 默认值补全功能正常")
                passed += 1
            else:
                click.echo("   ❌ 默认值补全功能异常")
        except Exception as e:
            click.echo(f"   ❌ 默认值补全异常: {e}")

        click.echo("\n5️⃣ 测试报告导出...")
        total += 1
        try:
            result = validator.validate(invalid_path)
            reporter = Reporter(result)
            json_report = reporter.to_json()
            md_report = reporter.to_markdown()
            if json_report and md_report and len(json_report) > 100 and len(md_report) > 100:
                click.echo("   ✅ JSON 和 Markdown 报告导出正常")
                passed += 1
            else:
                click.echo("   ❌ 报告导出生成内容不足")
        except Exception as e:
            click.echo(f"   ❌ 报告导出异常: {e}")

        click.echo("\n" + "=" * 50)
        click.echo(f"自检结果: {passed}/{total} 通过")
        if passed == total:
            click.echo("🎉 所有测试通过！")
            return 0
        else:
            click.echo("⚠️  部分测试失败")
            return 1


@click.group()
@click.version_option(version=__version__)
def main():
    """TOML 配置校验 CLI 工具"""
    pass


@main.command()
@click.argument("toml_path", type=click.Path(exists=True))
@click.option("--schema", "-s", type=click.Path(exists=True), required=True, help="Schema JSON 文件路径")
@click.option("--json-output", "-j", type=click.Path(), help="输出 JSON 报告的文件路径")
@click.option("--md-output", "-m", type=click.Path(), help="输出 Markdown 报告的文件路径")
@click.option("--no-defaults", is_flag=True, help="不应用默认值补全")
def validate(toml_path, schema, json_output, md_output, no_defaults):
    """校验 TOML 配置文件"""
    validator = TomlValidator.from_schema_file(schema)
    result = validator.validate(toml_path, apply_defaults=not no_defaults)

    reporter = Reporter(result)
    reporter.print_terminal_summary()

    if json_output:
        reporter.save_json(json_output)
        click.echo(f"\n📄 JSON 报告已保存至: {json_output}")

    if md_output:
        reporter.save_markdown(md_output)
        click.echo(f"📄 Markdown 报告已保存至: {md_output}")

    sys.exit(0 if result.is_valid else 1)


@main.command()
@click.argument("toml_path", type=click.Path(exists=True))
@click.argument("field_path")
@click.option("--schema", "-s", type=click.Path(exists=True), help="Schema JSON 文件路径")
def get(toml_path, field_path, schema):
    """获取 TOML 文件中指定字段的值"""
    from .parser import TomlParser
    parser = TomlParser()

    with open(toml_path, "r") as f:
        content = f.read()

    data, error = parser.parse(content)
    if error:
        click.echo(f"解析错误: {error}", err=True)
        sys.exit(1)

    value = parser.get_nested_value(data, field_path)
    line, column = parser.get_location(field_path)

    click.echo(f"字段: {field_path}")
    click.echo(f"值: {value}")
    if line:
        click.echo(f"位置: 第 {line} 行")


@main.command()
def self_test():
    """运行自检程序，验证所有功能"""
    exit_code = run_self_test()
    sys.exit(exit_code)


@main.command()
def init_schema():
    """创建示例 Schema 文件"""
    schema = {
        "name": "My Config Schema",
        "version": "1.0",
        "fields": [
            {
                "path": "project.name",
                "type": "string",
                "required": True,
                "description": "项目名称"
            },
            {
                "path": "project.version",
                "type": "string",
                "required": True,
                "default": "0.1.0",
                "description": "项目版本"
            },
            {
                "path": "server.port",
                "type": "integer",
                "required": True,
                "min_value": 1024,
                "max_value": 65535,
                "default": 8000
            },
            {
                "path": "server.host",
                "type": "string",
                "required": True,
                "default": "localhost"
            },
            {
                "path": "env",
                "type": "string",
                "required": False,
                "enum": ["dev", "test", "prod"],
                "default": "dev"
            }
        ]
    }

    import json
    output = "schema.json"
    with open(output, "w") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    click.echo(f"✅ 示例 Schema 已创建: {output}")


if __name__ == "__main__":
    main()
