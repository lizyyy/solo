import click
import yaml
import json
import sys
import traceback
from pathlib import Path
from typing import Optional, Dict, List

from ..core import HeaderMapper
from ..output import ConsoleOutput, JsonOutput, HtmlReport


def load_yaml_file(file_path: str) -> dict:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        raise click.ClickException(f"无法读取配置文件 {file_path}: {str(e)}")


def load_json_file(file_path: str) -> dict:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f) or {}
    except Exception as e:
        raise click.ClickException(f"无法读取JSON文件 {file_path}: {str(e)}")


def load_synonyms(synonyms_file: Optional[str]) -> Dict[str, List[str]]:
    if not synonyms_file:
        return {}
    
    path = Path(synonyms_file)
    if path.suffix in ('.yaml', '.yml'):
        return load_yaml_file(synonyms_file)
    elif path.suffix == '.json':
        return load_json_file(synonyms_file)
    else:
        raise click.ClickException("同义词文件只支持 .yaml/.yml 或 .json 格式")


def load_standard_fields(fields_file: str) -> List[str]:
    path = Path(fields_file)
    if path.suffix in ('.yaml', '.yml'):
        data = load_yaml_file(fields_file)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'fields' in data:
            return data['fields']
        else:
            raise click.ClickException("标准字段配置格式错误")
    elif path.suffix == '.json':
        data = load_json_file(fields_file)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and 'fields' in data:
            return data['fields']
        else:
            raise click.ClickException("标准字段配置格式错误")
    elif path.suffix == '.txt':
        with open(path, 'r', encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    else:
        raise click.ClickException("标准字段文件只支持 .yaml/.yml、.json 或 .txt 格式")


@click.group()
@click.version_option(version='0.1.0', prog_name='header-mapper')
def cli():
    """电子表头映射CLI - 自动匹配Excel表头到标准字段"""
    pass


@cli.command()
@click.argument('excel_file', type=click.Path(exists=True, readable=True))
@click.option('--fields', '-f', required=True, type=click.Path(exists=True), help='标准字段配置文件')
@click.option('--synonyms', '-s', type=click.Path(exists=True), help='同义词配置文件')
@click.option('--sheet', '-S', default='Sheet1', help='工作表名称 (默认: Sheet1)')
@click.option('--header-row', '-r', default=0, type=int, help='表头所在行号 (从0开始, 默认: 0)')
@click.option('--threshold', '-t', default=80, type=int, help='模糊匹配阈值 (0-100, 默认: 80)')
@click.option('--case-sensitive', is_flag=True, help='区分大小写')
@click.option('--json-output', '-j', type=click.Path(), help='JSON结果输出路径')
@click.option('--html-output', '-H', type=click.Path(), help='HTML报告输出路径')
@click.option('--quiet', '-q', is_flag=True, help='不输出终端摘要')
def map(
    excel_file: str,
    fields: str,
    synonyms: Optional[str],
    sheet: str,
    header_row: int,
    threshold: int,
    case_sensitive: bool,
    json_output: Optional[str],
    html_output: Optional[str],
    quiet: bool
):
    """对Excel文件进行表头映射分析"""
    try:
        standard_fields = load_standard_fields(fields)
        synonyms_dict = load_synonyms(synonyms)
        
        mapper = HeaderMapper(
            standard_fields=standard_fields,
            synonyms=synonyms_dict,
            fuzzy_threshold=threshold,
            case_sensitive=case_sensitive
        )
        
        result = mapper.map_excel(
            file_path=excel_file,
            sheet_name=sheet,
            header_row=header_row
        )
        
        if not quiet:
            console = ConsoleOutput()
            console.print_summary(result)
        
        if json_output:
            JsonOutput.generate(result, json_output)
            if not quiet:
                click.echo(f"JSON结果已保存至: {json_output}")
        
        if html_output:
            HtmlReport.generate(result, html_output)
            if not quiet:
                click.echo(f"HTML报告已保存至: {html_output}")
        
        if result.unmatched_count > 0 or result.conflict_count > 0:
            sys.exit(2)
            
    except click.ClickException:
        raise
    except Exception as e:
        click.echo(f"\n❌ 发生错误: {str(e)}", err=True)
        click.echo(f"   请检查输入文件格式是否正确", err=True)
        sys.exit(1)


@cli.command()
@click.option('--output-dir', '-o', default='.', help='输出目录 (默认: 当前目录)')
def init(output_dir: str):
    """初始化示例配置文件"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    example_fields = [
        "姓名",
        "手机号",
        "邮箱",
        "身份证号",
        "地址",
        "订单号",
        "订单金额",
        "下单时间"
    ]
    
    example_synonyms = {
        "姓名": ["名字", "客户姓名", "用户名", "联系人"],
        "手机号": ["电话", "手机号码", "联系电话", "手机"],
        "邮箱": ["电子邮箱", "email", "邮件地址", "E-mail"],
        "身份证号": ["身份证", "证件号码", "ID号码"],
        "订单号": ["订单编号", "订单ID"],
        "订单金额": ["金额", "总价", "总金额", "费用"],
        "下单时间": ["订单时间", "创建时间", "成交时间"]
    }
    
    fields_file = output_path / 'standard_fields.yaml'
    synonyms_file = output_path / 'synonyms.yaml'
    
    with open(fields_file, 'w', encoding='utf-8') as f:
        yaml.dump({'fields': example_fields}, f, allow_unicode=True, default_flow_style=False)
    
    with open(synonyms_file, 'w', encoding='utf-8') as f:
        yaml.dump(example_synonyms, f, allow_unicode=True, default_flow_style=False)
    
    click.echo(f"✅ 示例配置文件已创建:")
    click.echo(f"   - {fields_file}")
    click.echo(f"   - {synonyms_file}")
    click.echo(f"\n💡 使用示例:")
    click.echo(f"   header-mapper map 数据.xlsx -f standard_fields.yaml -s synonyms.yaml")


def main():
    try:
        cli()
    except KeyboardInterrupt:
        click.echo("\n操作已取消")
        sys.exit(0)
    except Exception as e:
        click.echo(f"\n❌ 程序异常: {str(e)}", err=True)
        click.echo(f"   请联系开发人员或提交issue", err=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
