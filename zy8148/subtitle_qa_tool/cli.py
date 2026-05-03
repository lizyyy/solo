#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字幕质检工具 - 命令行版本
用于在无法使用 GUI 时进行字幕质量检查
"""

import os
import sys
import argparse
from typing import List, Dict, Any

# 添加模块路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.parser import SubtitleParser, SegmentsParser, ConfigParser
from modules.rules_engine import RulesEngine, IssueType, IssueSeverity
from modules.state_storage import StateStorage, ConfirmationStatus
from modules.exporter import Exporter


def format_time(seconds: float) -> str:
    """格式化时间"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds * 1000) % 1000)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
    else:
        return f"{minutes:02d}:{secs:02d}.{millis:03d}"


def print_separator(char: str = "=", length: int = 60):
    """打印分隔线"""
    print(char * length)


def print_header(title: str):
    """打印标题"""
    print_separator()
    print(f"  {title}")
    print_separator()


def run_qa(subtitle_file: str, 
           segments_file: str = None, 
           config_file: str = None,
           output_dir: str = None,
           verbose: bool = False) -> Dict[str, Any]:
    """
    运行字幕质检
    
    Args:
        subtitle_file: 字幕文件路径
        segments_file: 片段清单文件路径（可选）
        config_file: 配置文件路径（可选）
        output_dir: 输出目录（可选）
        verbose: 是否显示详细信息
    
    Returns:
        包含检查结果的字典
    """
    results = {
        'success': False,
        'subtitle_file': subtitle_file,
        'segments_file': segments_file,
        'config_file': config_file,
        'subtitles': [],
        'segments': [],
        'issues': [],
        'stats': {}
    }
    
    try:
        # 1. 解析字幕文件
        print_header("解析字幕文件")
        print(f"文件: {os.path.basename(subtitle_file)}")
        
        subtitle_parser = SubtitleParser()
        subtitles = subtitle_parser.parse(subtitle_file)
        results['subtitles'] = subtitles
        
        print(f"解析完成: {len(subtitles)} 条字幕")
        
        if subtitle_parser.warnings:
            print(f"\n警告 ({len(subtitle_parser.warnings)} 个):")
            for warning in subtitle_parser.warnings[:5]:
                print(f"  ⚠️  {warning}")
            if len(subtitle_parser.warnings) > 5:
                print(f"  ... 还有 {len(subtitle_parser.warnings) - 5} 个警告")
        
        # 2. 解析片段清单（可选）
        segments = []
        if segments_file and os.path.exists(segments_file):
            print_header("解析片段清单")
            print(f"文件: {os.path.basename(segments_file)}")
            
            segments_parser = SegmentsParser()
            segments = segments_parser.parse(segments_file)
            results['segments'] = segments
            
            print(f"解析完成: {len(segments)} 个片段")
        
        # 3. 解析配置文件（可选）
        config_parser = ConfigParser()
        config = config_parser.get_default_config()
        
        if config_file and os.path.exists(config_file):
            print_header("解析配置文件")
            print(f"文件: {os.path.basename(config_file)}")
            
            config = config_parser.parse(config_file)
            print(f"说话人列表: {len(config.speakers)} 个")
            print(f"敏感词列表: {len(config.sensitive_words)} 个")
            print(f"每秒最大字符数: {config.max_chars_per_second}")
            print(f"最小字幕时长: {config.min_subtitle_duration} 秒")
        
        # 4. 运行质检规则
        print_header("运行质检规则")
        
        engine = RulesEngine(config)
        issues = engine.check_all(subtitles, segments)
        results['issues'] = issues
        
        print(f"检查完成: {len(issues)} 个问题")
        
        # 5. 显示统计信息
        stats = engine.get_statistics()
        results['stats'] = stats
        
        print_header("质检统计")
        
        print(f"\n总问题数: {stats['total_issues']}")
        print(f"\n按严重程度分布:")
        print(f"  🔴 错误 (Error):   {stats['by_severity']['error']}")
        print(f"  🟡 警告 (Warning): {stats['by_severity']['warning']}")
        print(f"  🔵 提示 (Info):    {stats['by_severity']['info']}")
        
        print(f"\n按问题类型分布:")
        type_names = {
            'time_overlap': "时间重叠",
            'high_chars_per_second': "每秒字数过高",
            'empty_subtitle': "空字幕",
            'speaker_missing': "说话人缺失",
            'sensitive_word': "敏感词命中",
            'short_duration': "字幕时长过短"
        }
        
        for issue_type, count in stats['by_type'].items():
            if count > 0:
                name = type_names.get(issue_type, issue_type)
                print(f"  {name}: {count}")
        
        # 6. 显示问题详情
        if issues:
            print_header("问题详情")
            
            # 按严重程度分组
            error_issues = [i for i in issues if i.severity == IssueSeverity.ERROR]
            warning_issues = [i for i in issues if i.severity == IssueSeverity.WARNING]
            info_issues = [i for i in issues if i.severity == IssueSeverity.INFO]
            
            # 显示错误
            if error_issues:
                print(f"\n🔴 错误 ({len(error_issues)} 个):")
                for i, issue in enumerate(error_issues[:10], 1):
                    type_name = type_names.get(issue.issue_type.value, issue.issue_type.value)
                    print(f"\n  {i}. [{type_name}]")
                    print(f"     字幕序号: {issue.subtitle_index}")
                    print(f"     时间: {format_time(issue.start_time)} - {format_time(issue.end_time)}")
                    print(f"     描述: {issue.message}")
                    if verbose:
                        print(f"     文本: {issue.subtitle_text[:50]}{'...' if len(issue.subtitle_text) > 50 else ''}")
                
                if len(error_issues) > 10:
                    print(f"\n  ... 还有 {len(error_issues) - 10} 个错误")
            
            # 显示警告
            if warning_issues:
                print(f"\n🟡 警告 ({len(warning_issues)} 个):")
                for i, issue in enumerate(warning_issues[:5], 1):
                    type_name = type_names.get(issue.issue_type.value, issue.issue_type.value)
                    print(f"\n  {i}. [{type_name}]")
                    print(f"     字幕序号: {issue.subtitle_index}")
                    print(f"     时间: {format_time(issue.start_time)} - {format_time(issue.end_time)}")
                    print(f"     描述: {issue.message}")
                
                if len(warning_issues) > 5:
                    print(f"\n  ... 还有 {len(warning_issues) - 5} 个警告")
            
            # 显示提示
            if info_issues:
                print(f"\n🔵 提示 ({len(info_issues)} 个):")
                for i, issue in enumerate(info_issues[:3], 1):
                    type_name = type_names.get(issue.issue_type.value, issue.issue_type.value)
                    print(f"\n  {i}. [{type_name}]")
                    print(f"     字幕序号: {issue.subtitle_index}")
                    print(f"     描述: {issue.message}")
                
                if len(info_issues) > 3:
                    print(f"\n  ... 还有 {len(info_issues) - 3} 个提示")
        
        # 7. 导出结果
        if output_dir and issues:
            print_header("导出结果")
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            # 导出 Markdown 报告
            md_file = os.path.join(output_dir, "review_report.md")
            if Exporter.export_markdown(issues, subtitles, md_file):
                print(f"✅ Markdown 报告已导出: {md_file}")
            else:
                print(f"❌ Markdown 报告导出失败")
            
            # 导出 CSV 列表
            csv_file = os.path.join(output_dir, "issues.csv")
            if Exporter.export_csv(issues, csv_file):
                print(f"✅ CSV 列表已导出: {csv_file}")
            else:
                print(f"❌ CSV 列表导出失败")
        
        results['success'] = True
        
        # 8. 总结
        print_separator()
        if stats['total'] == 0:
            print("🎉 太棒了！没有发现任何问题！")
        else:
            print(f"📋 检查完成，共发现 {stats['total']} 个问题")
            if stats['by_severity']['error'] > 0:
                print(f"   ⚠️  包含 {stats['by_severity']['error']} 个错误，建议优先处理")
        print_separator()
        
    except Exception as e:
        print(f"\n❌ 质检过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        results['success'] = False
        results['error'] = str(e)
    
    return results


def interactive_mode():
    """
    交互模式 - 提示用户输入文件路径
    """
    print_header("字幕质检工具 - 交互模式")
    
    # 选择字幕文件
    print("\n请输入字幕文件路径（支持 .srt 和 .vtt）:")
    subtitle_file = input("> ").strip().strip('"').strip("'")
    
    if not subtitle_file or not os.path.exists(subtitle_file):
        print("❌ 文件不存在，请检查路径是否正确")
        return
    
    # 选择片段清单（可选）
    print("\n是否需要导入片段清单？(y/N):")
    use_segments = input("> ").strip().lower()
    
    segments_file = None
    if use_segments == 'y' or use_segments == 'yes':
        print("请输入片段清单文件路径（.json）:")
        segments_file = input("> ").strip().strip('"').strip("'")
        if not os.path.exists(segments_file):
            print("⚠️  片段清单文件不存在，将跳过")
            segments_file = None
    
    # 选择配置文件（可选）
    print("\n是否需要导入配置文件？(y/N):")
    use_config = input("> ").strip().lower()
    
    config_file = None
    if use_config == 'y' or use_config == 'yes':
        print("请输入配置文件路径（.yaml 或 .yml）:")
        config_file = input("> ").strip().strip('"').strip("'")
        if not os.path.exists(config_file):
            print("⚠️  配置文件不存在，将使用默认配置")
            config_file = None
    
    # 是否导出结果
    print("\n是否需要导出结果？(y/N):")
    export_results = input("> ").strip().lower()
    
    output_dir = None
    if export_results == 'y' or export_results == 'yes':
        print("请输入输出目录路径（直接回车使用当前目录）:")
        output_dir = input("> ").strip().strip('"').strip("'")
        if not output_dir:
            output_dir = os.getcwd()
    
    # 是否显示详细信息
    print("\n是否显示详细信息？(y/N):")
    verbose = input("> ").strip().lower() == 'y'
    
    # 运行质检
    run_qa(
        subtitle_file=subtitle_file,
        segments_file=segments_file,
        config_file=config_file,
        output_dir=output_dir,
        verbose=verbose
    )


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='字幕质检工具 - 检查字幕质量问题',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  # 交互模式
  python cli.py
  
  # 命令行模式
  python cli.py -s subtitle.srt
  python cli.py -s subtitle.srt -c config.yaml -o output/
  python cli.py -s subtitle.srt --segments segments.json --config config.yaml --verbose
        '''
    )
    
    parser.add_argument('-s', '--subtitle', type=str, help='字幕文件路径（.srt 或 .vtt）')
    parser.add_argument('--segments', type=str, help='片段清单文件路径（.json）')
    parser.add_argument('-c', '--config', type=str, help='配置文件路径（.yaml 或 .yml）')
    parser.add_argument('-o', '--output', type=str, help='输出目录路径')
    parser.add_argument('-v', '--verbose', action='store_true', help='显示详细信息')
    parser.add_argument('--test', action='store_true', help='使用示例数据运行测试')
    
    args = parser.parse_args()
    
    # 测试模式
    if args.test:
        print_header("测试模式 - 使用示例数据")
        
        sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
        
        sample_subtitle = os.path.join(sample_dir, 'sample_subtitle.srt')
        sample_segments = os.path.join(sample_dir, 'sample_segments.json')
        sample_config = os.path.join(sample_dir, 'sample_config.yaml')
        
        if os.path.exists(sample_subtitle):
            run_qa(
                subtitle_file=sample_subtitle,
                segments_file=sample_segments if os.path.exists(sample_segments) else None,
                config_file=sample_config if os.path.exists(sample_config) else None,
                output_dir=args.output,
                verbose=args.verbose
            )
        else:
            print(f"❌ 示例文件不存在: {sample_subtitle}")
        return
    
    # 命令行模式
    if args.subtitle:
        if not os.path.exists(args.subtitle):
            print(f"❌ 字幕文件不存在: {args.subtitle}")
            sys.exit(1)
        
        run_qa(
            subtitle_file=args.subtitle,
            segments_file=args.segments,
            config_file=args.config,
            output_dir=args.output,
            verbose=args.verbose
        )
        return
    
    # 交互模式（默认）
    interactive_mode()


if __name__ == "__main__":
    main()
