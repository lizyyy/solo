#!/usr/bin/env python3
"""盲文教材分页校对员 - 完整工作流程测试脚本"""

import os
import sys
import json
import shutil
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from braille_proofreader.sample_data import generate_sample_course
from braille_proofreader.parser import MarkdownParser, CSVParser, JSONParser
from braille_proofreader.braille_mapper import BrailleMapper
from braille_proofreader.paginator import Paginator
from braille_proofreader.validator import Validator
from braille_proofreader.exporter import Exporter


def test_full_workflow():
    """测试完整工作流程"""
    
    print("=" * 60)
    print("盲文教材分页校对员 - 完整工作流程测试")
    print("=" * 60)
    print()
    
    test_dir = project_root / "test_course"
    if test_dir.exists():
        shutil.rmtree(test_dir)
    
    dirs_to_create = [
        '课文',
        '注音',
        '图说明',
        '模板',
        '输出',
        '草稿'
    ]
    
    for d in dirs_to_create:
        (test_dir / d).mkdir(parents=True, exist_ok=True)
    
    print("【步骤1】生成样例数据...")
    sample = generate_sample_course()
    
    lesson_path = test_dir / '课文' / '第一课_春天.md'
    with open(lesson_path, 'w', encoding='utf-8') as f:
        f.write(sample['课文'])
    print(f"  ✓ 课文已保存: {lesson_path}")
    
    pinyin_path = test_dir / '注音' / '第一课_注音.csv'
    with open(pinyin_path, 'w', encoding='utf-8') as f:
        f.write(sample['注音'])
    print(f"  ✓ 注音表已保存: {pinyin_path}")
    
    figure_path = test_dir / '图说明' / '第一课_图说明.json'
    with open(figure_path, 'w', encoding='utf-8') as f:
        f.write(sample['图说明'])
    print(f"  ✓ 图说明已保存: {figure_path}")
    print()
    
    print("【步骤2】解析数据...")
    
    with open(lesson_path, 'r', encoding='utf-8') as f:
        lesson_content = f.read()
    
    md_parser = MarkdownParser()
    lesson_data = md_parser.parse(lesson_content, '第一课_春天.md')
    print(f"  ✓ 课文解析: {lesson_data['总段落数']} 个段落")
    print(f"  ✓ 标题: {lesson_data['标题']}")
    print(f"  ✓ 图片引用: {len(lesson_data['图片引用'])} 个")
    
    with open(pinyin_path, 'r', encoding='utf-8') as f:
        pinyin_content = f.read()
    
    csv_parser = CSVParser()
    pinyin_data = csv_parser.parse(pinyin_content, '第一课_注音.csv')
    print(f"  ✓ 注音表解析: {pinyin_data['总数']} 个条目")
    
    with open(figure_path, 'r', encoding='utf-8') as f:
        figure_content = f.read()
    
    json_parser = JSONParser()
    figure_data = json_parser.parse(figure_content, '第一课_图说明.json')
    print(f"  ✓ 图说明解析: {figure_data['总数']} 张图片")
    print()
    
    print("【步骤3】测试盲文映射...")
    
    mapper = BrailleMapper()
    
    test_words = [
        ('春天', 'chun tian'),
        ('大地', 'da di'),
        ('小草', 'xiao cao'),
        ('花朵', 'hua duo'),
    ]
    
    for word, pinyin in test_words:
        braille = mapper.map_text(word, pinyin)
        unicode_braille = ''.join([chr(0x2800 + sum(1 << (int(d) - 1) for d in parts)) if parts != '0' else '⠀' 
                                   for parts in braille.split()])
        print(f"  {word} ({pinyin}) -> {braille} -> {unicode_braille}")
    
    print()
    
    print("【步骤4】生成分页草稿...")
    
    all_pinyin_map = {}
    for item in pinyin_data['条目']:
        all_pinyin_map[item['词语']] = item['拼音']
    
    lesson_content_list = []
    
    lesson_content_list.append({
        'type': '标题',
        '原文': lesson_data['标题'],
        '拼音': '',
        '盲文': mapper.map_text(lesson_data['标题'], '')
    })
    
    for para in lesson_data['段落']:
        text = para['内容']
        
        matched_pinyin = ''
        for word, pinyin in all_pinyin_map.items():
            if word in text:
                matched_pinyin = pinyin
                break
        
        braille = mapper.map_text(text, matched_pinyin)
        
        lesson_content_list.append({
            'type': '段落',
            '原文': text,
            '拼音': matched_pinyin,
            '盲文': braille,
            '盲文长度': len(braille.split())
        })
    
    paginator = Paginator(line_width=32, lines_per_page=24)
    pages = paginator.paginate(lesson_content_list, lesson_data['标题'])
    
    print(f"  ✓ 生成 {len(pages)} 页")
    
    for i, page in enumerate(pages[:2], 1):
        print(f"  第{i}页: {page['行数']} 行")
    
    draft_data = {
        '配置': {'行宽': 32, '每页行数': 24},
        '总页数': len(pages),
        '页面': pages
    }
    
    draft_path = test_dir / '草稿' / '分页草稿.json'
    with open(draft_path, 'w', encoding='utf-8') as f:
        json.dump(draft_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 草稿已保存: {draft_path}")
    print()
    
    print("【步骤5】校对检查...")
    
    validator = Validator()
    issues = []
    
    print("  检查未注音词...")
    lesson_issues = validator.check_unmarked_words(
        lesson_data,
        [pinyin_data],
        [figure_data]
    )
    issues.extend(lesson_issues)
    print(f"    发现 {len(lesson_issues)} 个未注音词警告")
    
    print("  检查超行...")
    line_issues = validator.check_line_overflow(draft_data)
    issues.extend(line_issues)
    print(f"    发现 {len(line_issues)} 个超行问题")
    
    print("  检查图文引用...")
    figure_issues = validator.check_figure_references(
        [lesson_data],
        [figure_data]
    )
    issues.extend(figure_issues)
    print(f"    发现 {len(figure_issues)} 个图文引用问题")
    
    print("  检查页码...")
    page_issues = validator.check_page_numbering(draft_data)
    issues.extend(page_issues)
    print(f"    发现 {len(page_issues)} 个页码问题")
    
    print("  检查同音词歧义...")
    homonym_issues = validator.check_homonym_ambiguity([pinyin_data])
    issues.extend(homonym_issues)
    print(f"    发现 {len(homonym_issues)} 个同音词问题")
    
    by_severity = {
        '错误': [i for i in issues if i.get('严重程度') == '错误'],
        '警告': [i for i in issues if i.get('严重程度') == '警告'],
        '提示': [i for i in issues if i.get('严重程度') == '提示']
    }
    
    print()
    print("  校对结果:")
    print(f"    错误: {len(by_severity['错误'])} 个")
    print(f"    警告: {len(by_severity['警告'])} 个")
    print(f"    提示: {len(by_severity['提示'])} 个")
    
    report = {
        '校对时间': __import__('datetime').datetime.now().isoformat(),
        '总问题数': len(issues),
        '按严重程度': {k: len(v) for k, v in by_severity.items()},
        '问题列表': issues
    }
    
    report_path = test_dir / '草稿' / '校对报告.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 报告已保存: {report_path}")
    print()
    
    print("【步骤6】导出文件...")
    
    exporter = Exporter()
    
    output_dir = test_dir / '输出'
    
    brf_content = exporter.export_brf(draft_data)
    brf_path = output_dir / '盲文教材.brf'
    with open(brf_path, 'w', encoding='utf-8') as f:
        f.write(brf_content)
    print(f"  ✓ BRF格式: {brf_path}")
    
    txt_content = exporter.export_txt(draft_data)
    txt_path = output_dir / '盲文教材.txt'
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(txt_content)
    print(f"  ✓ TXT格式: {txt_path}")
    
    md_content = exporter.export_markdown(draft_data, report)
    md_path = output_dir / '盲文教材.md'
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"  ✓ Markdown格式: {md_path}")
    
    json_content = exporter.export_json(draft_data, report)
    json_path = output_dir / '盲文教材.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(json_content)
    print(f"  ✓ JSON格式: {json_path}")
    print()
    
    print("=" * 60)
    print("测试完成！")
    print("=" * 60)
    print()
    print(f"测试目录: {test_dir}")
    print()
    print("目录结构:")
    print(f"  {test_dir.name}/")
    for d in sorted(test_dir.iterdir()):
        if d.is_dir():
            print(f"    ├── {d.name}/")
            for f in sorted(d.iterdir()):
                if f.is_file():
                    size = f.stat().st_size
                    print(f"    │   └── {f.name} ({size} bytes)")
    
    print()
    print("所有模块测试通过！")
    print()
    
    return True


if __name__ == '__main__':
    try:
        test_full_workflow()
    except Exception as e:
        import traceback
        print(f"测试失败: {e}")
        traceback.print_exc()
        sys.exit(1)
