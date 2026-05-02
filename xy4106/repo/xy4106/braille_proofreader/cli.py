import click
import os
import json
from pathlib import Path
from typing import Optional

from .parser import MarkdownParser, CSVParser, JSONParser
from .braille_mapper import BrailleMapper
from .paginator import Paginator
from .validator import Validator
from .exporter import Exporter
from .sample_data import generate_sample_course


@click.group()
@click.version_option(version="0.1.0")
@click.pass_context
def cli(ctx):
    """盲文教材分页校对员 - 专为特教老师设计的盲文教材制作工具"""
    ctx.ensure_object(dict)


@cli.command()
@click.argument('course_name')
@click.option('--path', '-p', default='.', help='课程目录创建路径')
@click.option('--with-sample', '-s', is_flag=True, help='使用样例数据初始化')
@click.pass_context
def init(ctx, course_name, path, with_sample):
    """初始化课程目录结构
    
    创建标准的课程目录结构，包含课文、注音、图说明、模板等子目录。
    
    \b
    参数:
        course_name: 课程名称，将作为目录名
    """
    base_path = Path(path) / course_name
    
    if base_path.exists():
        click.echo(f'错误: 目录 {base_path} 已存在')
        return
    
    dirs_to_create = [
        '课文',
        '注音',
        '图说明',
        '模板',
        '输出',
        '草稿'
    ]
    
    for d in dirs_to_create:
        (base_path / d).mkdir(parents=True, exist_ok=True)
    
    click.echo(f'✓ 课程目录已创建: {base_path}')
    
    config = {
        '课程名称': course_name,
        '行宽': 32,
        '行数': 24,
        '盲文版本': '现行盲文',
        '页码格式': '第{page}页'
    }
    
    config_path = base_path / '课程配置.json'
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    click.echo(f'✓ 配置文件已创建: {config_path}')
    
    if with_sample:
        sample_data = generate_sample_course()
        
        lesson_path = base_path / '课文' / '第一课_春天.md'
        with open(lesson_path, 'w', encoding='utf-8') as f:
            f.write(sample_data['课文'])
        click.echo(f'✓ 样例课文已创建: {lesson_path}')
        
        pinyin_path = base_path / '注音' / '第一课_注音.csv'
        with open(pinyin_path, 'w', encoding='utf-8') as f:
            f.write(sample_data['注音'])
        click.echo(f'✓ 样例注音已创建: {pinyin_path}')
        
        figure_path = base_path / '图说明' / '第一课_图说明.json'
        with open(figure_path, 'w', encoding='utf-8') as f:
            f.write(sample_data['图说明'])
        click.echo(f'✓ 样例图说明已创建: {figure_path}')
        
        template_path = base_path / '模板' / '页码模板.txt'
        with open(template_path, 'w', encoding='utf-8') as f:
            f.write(sample_data['模板'])
        click.echo(f'✓ 页码模板已创建: {template_path}')
    
    click.echo('')
    click.echo('目录结构:')
    click.echo(f'  {course_name}/')
    for d in dirs_to_create:
        click.echo(f'    ├── {d}/')
    click.echo('    └── 课程配置.json')


@cli.command()
@click.option('--course', '-c', required=True, help='课程目录路径')
@click.option('--lesson', '-l', help='指定课文文件名（不指定则导入所有）')
@click.pass_context
def import_(ctx, course, lesson):
    """导入课文、注音和图说明数据
    
    解析Markdown课文、CSV注音表和JSON图说明，建立关联映射。
    """
    course_path = Path(course)
    
    if not course_path.exists():
        click.echo(f'错误: 课程目录不存在: {course_path}')
        return
    
    config_path = course_path / '课程配置.json'
    if not config_path.exists():
        click.echo(f'错误: 未找到课程配置文件: {config_path}')
        return
    
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)
    
    click.echo(f'课程: {config.get("课程名称", "未命名")}')
    click.echo('')
    
    lesson_dir = course_path / '课文'
    pinyin_dir = course_path / '注音'
    figure_dir = course_path / '图说明'
    
    md_files = list(lesson_dir.glob('*.md'))
    if not md_files:
        click.echo('警告: 未找到课文文件 (.md)')
        return
    
    imported_data = {
        '课文': [],
        '注音': [],
        '图说明': [],
        '配置': config
    }
    
    md_parser = MarkdownParser()
    csv_parser = CSVParser()
    json_parser = JSONParser()
    
    for md_file in md_files:
        if lesson and lesson not in md_file.name:
            continue
        
        click.echo(f'解析课文: {md_file.name}')
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            lesson_data = md_parser.parse(content, md_file.name)
            imported_data['课文'].append(lesson_data)
            click.echo(f'  ✓ 提取 {len(lesson_data["段落"])} 个段落')
        except Exception as e:
            click.echo(f'  ✗ 解析失败: {e}')
    
    csv_files = list(pinyin_dir.glob('*.csv'))
    for csv_file in csv_files:
        click.echo(f'解析注音表: {csv_file.name}')
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            pinyin_data = csv_parser.parse(content, csv_file.name)
            imported_data['注音'].append(pinyin_data)
            click.echo(f'  ✓ 提取 {len(pinyin_data["条目"])} 个注音条目')
        except Exception as e:
            click.echo(f'  ✗ 解析失败: {e}')
    
    json_files = list(figure_dir.glob('*.json'))
    for json_file in json_files:
        click.echo(f'解析图说明: {json_file.name}')
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            figure_data = json_parser.parse(content, json_file.name)
            imported_data['图说明'].append(figure_data)
            click.echo(f'  ✓ 提取 {len(figure_data["图片"])} 张图片说明')
        except Exception as e:
            click.echo(f'  ✗ 解析失败: {e}')
    
    draft_dir = course_path / '草稿'
    draft_path = draft_dir / '导入数据.json'
    with open(draft_path, 'w', encoding='utf-8') as f:
        json.dump(imported_data, f, ensure_ascii=False, indent=2)
    
    click.echo('')
    click.echo(f'✓ 导入数据已保存到: {draft_path}')
    click.echo('')
    click.echo('导入统计:')
    click.echo(f'  课文: {len(imported_data["课文"])} 篇')
    click.echo(f'  注音条目: {sum(len(p["条目"]) for p in imported_data["注音"])} 个')
    click.echo(f'  图片说明: {sum(len(f["图片"]) for f in imported_data["图说明"])} 张')


@cli.command()
@click.option('--course', '-c', required=True, help='课程目录路径')
@click.option('--line-width', '-w', type=int, default=32, help='盲文行宽（默认32方）')
@click.option('--lines', '-l', type=int, default=24, help='每页行数（默认24行）')
@click.pass_context
def compose(ctx, course, line_width, lines):
    """生成盲文分页草稿
    
    将课文转换为盲文点位，并根据行宽和页数进行分页排版。
    """
    course_path = Path(course)
    draft_dir = course_path / '草稿'
    import_data_path = draft_dir / '导入数据.json'
    
    if not import_data_path.exists():
        click.echo(f'错误: 未找到导入数据，请先运行 import 命令')
        return
    
    with open(import_data_path, 'r', encoding='utf-8') as f:
        imported_data = json.load(f)
    
    click.echo('开始生成盲文分页草稿...')
    click.echo(f'  行宽: {line_width} 方')
    click.echo(f'  每页: {lines} 行')
    click.echo('')
    
    mapper = BrailleMapper()
    paginator = Paginator(line_width=line_width, lines_per_page=lines)
    
    all_pinyin_map = {}
    for pinyin_data in imported_data['注音']:
        for item in pinyin_data['条目']:
            all_pinyin_map[item['词语']] = item['拼音']
    
    all_figure_map = {}
    for figure_data in imported_data['图说明']:
        for fig in figure_data['图片']:
            all_figure_map[fig['编号']] = fig
    
    composed_pages = []
    
    for lesson in imported_data['课文']:
        click.echo(f'处理课文: {lesson["标题"]}')
        
        lesson_content = []
        
        lesson_content.append({
            'type': '标题',
            '原文': lesson['标题'],
            '拼音': '',
            '盲文': mapper.map_text(lesson['标题'], '')
        })
        
        for para in lesson['段落']:
            text = para['内容']
            
            matched_pinyin = ''
            for word, pinyin in all_pinyin_map.items():
                if word in text:
                    matched_pinyin = pinyin
                    break
            
            braille = mapper.map_text(text, matched_pinyin)
            
            lesson_content.append({
                'type': '段落',
                '原文': text,
                '拼音': matched_pinyin,
                '盲文': braille,
                '盲文长度': len(braille)
            })
        
        for fig_ref in para.get('图片引用', []):
            if fig_ref in all_figure_map:
                fig = all_figure_map[fig_ref]
                fig_braille = mapper.map_text(fig['说明'], '')
                lesson_content.append({
                    'type': '图注',
                    '编号': fig['编号'],
                    '原文': fig['说明'],
                    '盲文': fig_braille
                })
        
        pages = paginator.paginate(lesson_content, lesson['标题'])
        composed_pages.extend(pages)
        
        click.echo(f'  ✓ 生成 {len(pages)} 页')
    
    for i, page in enumerate(composed_pages):
        page['页码'] = i + 1
    
    result = {
        '配置': {
            '行宽': line_width,
            '每页行数': lines
        },
        '总页数': len(composed_pages),
        '页面': composed_pages
    }
    
    draft_path = draft_dir / '分页草稿.json'
    with open(draft_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    click.echo('')
    click.echo(f'✓ 分页草稿已保存到: {draft_path}')
    click.echo('')
    click.echo('排版统计:')
    click.echo(f'  总页数: {len(composed_pages)}')
    click.echo(f'  行宽: {line_width} 方')
    click.echo(f'  每页行数: {lines}')


@cli.command()
@click.option('--course', '-c', required=True, help='课程目录路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细错误信息')
@click.pass_context
def check(ctx, course, verbose):
    """校对盲文教材问题
    
    检测未注音词、超行、图文引用断链、页码跳号和同音词歧义等问题。
    """
    course_path = Path(course)
    draft_dir = course_path / '草稿'
    draft_path = draft_dir / '分页草稿.json'
    import_path = draft_dir / '导入数据.json'
    
    if not draft_path.exists():
        click.echo(f'错误: 未找到分页草稿，请先运行 compose 命令')
        return
    
    with open(draft_path, 'r', encoding='utf-8') as f:
        draft_data = json.load(f)
    
    imported_data = None
    if import_path.exists():
        with open(import_path, 'r', encoding='utf-8') as f:
            imported_data = json.load(f)
    
    click.echo('开始校对...')
    click.echo('')
    
    validator = Validator()
    
    issues = []
    
    if imported_data:
        for lesson in imported_data['课文']:
            lesson_issues = validator.check_unmarked_words(
                lesson,
                imported_data['注音'],
                imported_data['图说明']
            )
            issues.extend(lesson_issues)
    
    line_issues = validator.check_line_overflow(draft_data)
    issues.extend(line_issues)
    
    if imported_data:
        figure_issues = validator.check_figure_references(
            imported_data['课文'],
            imported_data['图说明']
        )
        issues.extend(figure_issues)
    
    page_issues = validator.check_page_numbering(draft_data)
    issues.extend(page_issues)
    
    if imported_data:
        homonym_issues = validator.check_homonym_ambiguity(
            imported_data['注音']
        )
        issues.extend(homonym_issues)
    
    issues.sort(key=lambda x: x.get('严重程度', 0), reverse=True)
    
    by_severity = {
        '错误': [i for i in issues if i.get('严重程度') == '错误'],
        '警告': [i for i in issues if i.get('严重程度') == '警告'],
        '提示': [i for i in issues if i.get('严重程度') == '提示']
    }
    
    click.echo('校对结果:')
    click.echo(f'  错误: {len(by_severity["错误"])} 个')
    click.echo(f'  警告: {len(by_severity["警告"])} 个')
    click.echo(f'  提示: {len(by_severity["提示"])} 个')
    click.echo('')
    
    for severity in ['错误', '警告', '提示']:
        items = by_severity[severity]
        if items:
            click.echo(f'【{severity}】')
            for item in items:
                click.echo(f'  ▶ {item.get("问题类型", "未知问题")}')
                click.echo(f'    位置: {item.get("位置", "未知")}')
                click.echo(f'    描述: {item.get("描述", "")}')
                if verbose and '详情' in item:
                    click.echo(f'    详情: {item["详情"]}')
                if '建议' in item:
                    click.echo(f'    建议: {item["建议"]}')
                click.echo('')
    
    report = {
        '校对时间': __import__('datetime').datetime.now().isoformat(),
        '总问题数': len(issues),
        '按严重程度': {k: len(v) for k, v in by_severity.items()},
        '问题列表': issues
    }
    
    report_path = draft_dir / '校对报告.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    click.echo(f'✓ 详细报告已保存到: {report_path}')


@cli.command()
@click.option('--course', '-c', required=True, help='课程目录路径')
@click.option('--format', '-f', multiple=True, 
              type=click.Choice(['brf', 'txt', 'md', 'json', 'all']),
              default=['all'],
              help='导出格式（可多选）')
@click.option('--with-report', '-r', is_flag=True, help='同时导出校对报告')
@click.pass_context
def export(ctx, course, format, with_report):
    """导出校对包
    
    导出 BRF（盲文标准格式）、TXT、Markdown 和 JSON 校对包。
    """
    course_path = Path(course)
    draft_dir = course_path / '草稿'
    output_dir = course_path / '输出'
    draft_path = draft_dir / '分页草稿.json'
    report_path = draft_dir / '校对报告.json'
    
    if not draft_path.exists():
        click.echo(f'错误: 未找到分页草稿，请先运行 compose 命令')
        return
    
    with open(draft_path, 'r', encoding='utf-8') as f:
        draft_data = json.load(f)
    
    report_data = None
    if with_report and report_path.exists():
        with open(report_path, 'r', encoding='utf-8') as f:
            report_data = json.load(f)
    
    click.echo('开始导出...')
    click.echo('')
    
    exporter = Exporter()
    
    formats = list(format)
    if 'all' in formats:
        formats = ['brf', 'txt', 'md', 'json']
    
    for fmt in formats:
        click.echo(f'导出 {fmt.upper()} 格式...')
        
        try:
            if fmt == 'brf':
                content = exporter.export_brf(draft_data)
                filename = output_dir / '盲文教材.brf'
            elif fmt == 'txt':
                content = exporter.export_txt(draft_data)
                filename = output_dir / '盲文教材.txt'
            elif fmt == 'md':
                content = exporter.export_markdown(draft_data, report_data)
                filename = output_dir / '盲文教材.md'
            elif fmt == 'json':
                content = exporter.export_json(draft_data, report_data)
                filename = output_dir / '盲文教材.json'
            
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(content)
            
            click.echo(f'  ✓ 已保存: {filename}')
            
        except Exception as e:
            click.echo(f'  ✗ 导出失败: {e}')
    
    click.echo('')
    click.echo('导出完成！')
    click.echo(f'输出目录: {output_dir}')


if __name__ == '__main__':
    cli(obj={})
