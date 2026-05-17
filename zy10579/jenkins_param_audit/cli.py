import click
import os
from .xml_parser import JenkinsXMLParser
from .risk_analyzer import RiskAnalyzer
from .report_generator import ReportGenerator


@click.group()
@click.version_option(version="0.1.0", prog_name="jenkins-param-audit")
def cli() -> None:
    """Jenkins 参数审计工具 - 分析Job配置中的参数风险"""
    pass


@cli.command()
@click.argument('xml_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--json', '-j', 'json_output', type=click.Path(), help='输出机器可读的JSON结果')
@click.option('--markdown', '-m', 'markdown_output', type=click.Path(), help='输出Markdown报告')
@click.option('--no-terminal', is_flag=True, help='不输出终端摘要')
def audit(xml_file: str, json_output: str, markdown_output: str, no_terminal: bool) -> None:
    """审计单个Jenkins Job的XML配置文件"""
    click.echo(f"正在解析: {xml_file}")
    
    try:
        parser = JenkinsXMLParser(xml_file)
        result = parser.parse()
        
        click.echo(f"解析完成: {len(result.parameters)} 个参数, {len(result.build_steps)} 个构建步骤")
        
        analyzer = RiskAnalyzer(result)
        analyzed_result = analyzer.analyze()
        
        report = ReportGenerator(analyzed_result)
        
        if not no_terminal:
            report.generate_terminal_summary()
        
        if json_output:
            report.generate_json(json_output)
            click.echo(f"\nJSON结果已保存到: {json_output}")
        
        if markdown_output:
            report.generate_markdown(markdown_output)
            click.echo(f"Markdown报告已保存到: {markdown_output}")
            
    except Exception as e:
        click.echo(f"错误: {str(e)}", err=True)
        raise click.Abort()


@cli.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output-dir', '-o', type=click.Path(), default='audit_results', help='输出目录')
@click.option('--no-terminal', is_flag=True, help='不输出终端摘要')
def batch(directory: str, output_dir: str, no_terminal: bool) -> None:
    """批量审计目录下所有config.xml文件"""
    xml_files = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file == 'config.xml':
                xml_files.append(os.path.join(root, file))
    
    if not xml_files:
        click.echo("未找到任何 config.xml 文件")
        return
    
    click.echo(f"找到 {len(xml_files)} 个配置文件")
    
    os.makedirs(output_dir, exist_ok=True)
    
    all_summaries = []
    
    for xml_file in xml_files:
        try:
            parser = JenkinsXMLParser(xml_file)
            result = parser.parse()
            
            analyzer = RiskAnalyzer(result)
            analyzed_result = analyzer.analyze()
            
            job_name = analyzed_result.job_name
            safe_job_name = "".join(c for c in job_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            
            json_path = os.path.join(output_dir, f"{safe_job_name}.json")
            md_path = os.path.join(output_dir, f"{safe_job_name}.md")
            
            report = ReportGenerator(analyzed_result)
            
            if not no_terminal:
                click.echo(f"\n{'='*60}")
            report.generate_json(json_path)
            report.generate_markdown(md_path)
            
            summary = {
                'job_name': job_name,
                'file_path': xml_file,
                'json_file': json_path,
                'md_file': md_path,
                'summary': analyzed_result.summary
            }
            all_summaries.append(summary)
            
            click.echo(f"✓ {job_name}: {analyzed_result.summary['total_parameters']} 参数, "
                      f"{analyzed_result.summary['dangerous_steps']} 危险步骤")
            
        except Exception as e:
            click.echo(f"✗ 处理 {xml_file} 失败: {str(e)}", err=True)
    
    index_path = os.path.join(output_dir, "index.json")
    import json
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(all_summaries, f, ensure_ascii=False, indent=2)
    
    click.echo(f"\n批量审计完成，结果已保存到目录: {output_dir}")
    click.echo(f"索引文件: {index_path}")


def main() -> None:
    cli()


if __name__ == '__main__':
    main()
