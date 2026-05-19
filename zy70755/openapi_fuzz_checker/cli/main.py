import click
import json
from pathlib import Path
from typing import Optional

from ..core.schema_reader import OpenAPISchemaReader
from ..core.mutator import ExampleMutator
from ..core.validator import SchemaValidator
from ..core.reporter import ReportGenerator
from ..utils.logger import get_logger

logger = get_logger(__name__)


@click.group()
def cli():
    """OpenAPI 示例扰动兼容校验排查工具"""
    pass


@cli.command()
@click.argument("openapi_file", type=click.Path(exists=True))
@click.option("--schema-name", "-s", help="要校验的Schema名称")
@click.option("--example-file", "-e", type=click.Path(exists=True), help="示例JSON文件")
@click.option("--output", "-o", help="输出报告路径")
@click.option("--format", "-f", "output_format", type=click.Choice(["json", "html", "markdown"]), default="json", help="报告格式")
@click.option("--limit", "-l", type=int, help="限制扰动数量")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def check(
    openapi_file: str,
    schema_name: Optional[str],
    example_file: Optional[str],
    output: Optional[str],
    output_format: str,
    limit: Optional[int],
    verbose: bool,
):
    """对OpenAPI Schema进行示例扰动兼容校验"""
    try:
        click.echo(f"加载OpenAPI规范: {openapi_file}")
        reader = OpenAPISchemaReader(openapi_file)

        if schema_name:
            schema = reader.get_schema_by_name(schema_name)
            if not schema:
                click.echo(f"错误: 找不到Schema '{schema_name}'", err=True)
                available_schemas = list(reader.get_all_schemas().keys())
                click.echo(f"可用的Schema: {', '.join(available_schemas)}", err=True)
                return
        else:
            all_schemas = reader.get_all_schemas()
            if not all_schemas:
                click.echo("错误: OpenAPI文件中没有定义任何Schema", err=True)
                return
            schema_name = list(all_schemas.keys())[0]
            schema = all_schemas[schema_name]
            click.echo(f"使用默认Schema: {schema_name}")

        if example_file:
            with open(example_file, "r", encoding="utf-8") as f:
                example = json.load(f)
            click.echo(f"加载示例文件: {example_file}")
        else:
            example = reader.extract_example_from_schema(schema)
            click.echo("从Schema中提取默认示例")

        if verbose:
            click.echo(f"原始示例:\n{json.dumps(example, indent=2, ensure_ascii=False)}")

        click.echo("生成扰动示例...")
        mutator = ExampleMutator(schema)
        mutations = mutator.generate_all_mutations(example)

        if limit:
            mutations = mutations[:limit]

        click.echo(f"生成了 {len(mutations)} 个扰动示例")

        click.echo("执行Schema校验...")
        validator = SchemaValidator(schema)
        results = [validator.validate_mutated_example(m) for m in mutations]

        click.echo("生成报告...")
        reporter = ReportGenerator(schema_name)
        report = reporter.generate_report(example, results, output_format)

        if output:
            reporter.save_report(report, output, output_format)
            click.echo(f"报告已保存到: {output}")
        else:
            default_output = Path("fuzz_report.json")
            reporter.save_report(report, str(default_output), "json")
            click.echo(f"报告已保存到: {default_output}")

        reporter.print_console_summary(report)

    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        raise click.Abort()


@cli.command()
@click.argument("openapi_file", type=click.Path(exists=True))
def list_schemas(openapi_file: str):
    """列出OpenAPI文件中的所有Schema"""
    try:
        reader = OpenAPISchemaReader(openapi_file)
        schemas = reader.get_all_schemas()

        click.echo(f"找到 {len(schemas)} 个Schema:")
        for name in schemas.keys():
            click.echo(f"  - {name}")

    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.argument("openapi_file", type=click.Path(exists=True))
def list_endpoints(openapi_file: str):
    """列出OpenAPI文件中的所有API端点"""
    try:
        reader = OpenAPISchemaReader(openapi_file)
        endpoints = reader.list_all_endpoints()

        click.echo(f"找到 {len(endpoints)} 个API端点:")
        for endpoint in endpoints:
            click.echo(f"  {endpoint['method']:6} {endpoint['path']}")

    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.argument("openapi_file", type=click.Path(exists=True))
@click.option("--schema-name", "-s", help="Schema名称")
@click.option("--output", "-o", help="输出文件路径")
def extract_example(openapi_file: str, schema_name: Optional[str], output: Optional[str]):
    """从Schema中提取示例"""
    try:
        reader = OpenAPISchemaReader(openapi_file)

        if schema_name:
            schema = reader.get_schema_by_name(schema_name)
            if not schema:
                click.echo(f"错误: 找不到Schema '{schema_name}'", err=True)
                return
        else:
            all_schemas = reader.get_all_schemas()
            if not all_schemas:
                click.echo("错误: OpenAPI文件中没有定义任何Schema", err=True)
                return
            schema_name = list(all_schemas.keys())[0]
            schema = all_schemas[schema_name]

        example = reader.extract_example_from_schema(schema)
        example_json = json.dumps(example, indent=2, ensure_ascii=False)

        if output:
            with open(output, "w", encoding="utf-8") as f:
                f.write(example_json)
            click.echo(f"示例已保存到: {output}")
        else:
            click.echo(example_json)

    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        raise click.Abort()


@cli.command()
@click.argument("openapi_file", type=click.Path(exists=True))
@click.option("--output-dir", "-o", default="examples", help="输出目录")
def generate_test_data(openapi_file: str, output_dir: str):
    """生成测试样例材料"""
    try:
        reader = OpenAPISchemaReader(openapi_file)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        schemas = reader.get_all_schemas()

        for schema_name, schema in schemas.items():
            click.echo(f"为Schema '{schema_name}' 生成测试样例...")

            example = reader.extract_example_from_schema(schema)
            mutator = ExampleMutator(schema)
            mutations = mutator.generate_all_mutations(example)

            test_cases = {
                "normal_input": example,
                "dirty_data": [],
                "boundary_conflict": [],
                "empty_results": [],
            }

            for m in mutations:
                if m.mutation_type.value == "dirty_data":
                    test_cases["dirty_data"].append(
                        {
                            "description": m.description,
                            "path": m.path,
                            "value": m.mutated,
                        }
                    )
                elif m.mutation_type.value in [
                    "boundary_value",
                    "wrong_enum",
                    "type_mismatch",
                ]:
                    test_cases["boundary_conflict"].append(
                        {
                            "description": m.description,
                            "path": m.path,
                            "value": m.mutated,
                        }
                    )
                elif m.mutation_type.value in [
                    "null_value",
                    "empty_string",
                    "empty_array",
                    "empty_object",
                    "remove_required_field",
                ]:
                    test_cases["empty_results"].append(
                        {
                            "description": m.description,
                            "path": m.path,
                            "value": m.mutated,
                        }
                    )

            schema_output_dir = output_path / schema_name
            schema_output_dir.mkdir(exist_ok=True)

            for category, data in test_cases.items():
                file_path = schema_output_dir / f"{category}.json"
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

            click.echo(
                f"  正常输入: 1 个, 脏数据: {len(test_cases['dirty_data'])} 个, "
                f"边界冲突: {len(test_cases['boundary_conflict'])} 个, "
                f"空结果: {len(test_cases['empty_results'])} 个"
            )

        click.echo(f"测试样例已生成到: {output_path}")

    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        import traceback
        traceback.print_exc()
        raise click.Abort()


if __name__ == "__main__":
    cli()
