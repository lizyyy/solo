#!/usr/bin/env python3
import argparse
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lyrics_checker import LyricsChecker

def main():
    parser = argparse.ArgumentParser(
        description='歌词押韵检查CLI - 快速检查押韵、字数、重复词',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python cli.py check 歌词.txt -t "歌名" -a "作者"
  python cli.py check 歌词.txt --scheme abab --forbidden "痛苦,悲伤"
  python cli.py list
  python cli.py versions "歌名"
  python cli.py compare "歌名" v1 v2
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    check_parser = subparsers.add_parser('check', help='检查歌词文件')
    check_parser.add_argument('file', help='歌词文件路径')
    check_parser.add_argument('-t', '--title', default='未命名', help='歌曲标题')
    check_parser.add_argument('-a', '--author', default='未知', help='作者')
    check_parser.add_argument('-s', '--scheme', default='aabb', choices=['aabb', 'abab'], help='押韵方案')
    check_parser.add_argument('-f', '--forbidden', help='禁用词，逗号分隔')
    check_parser.add_argument('--no-save', action='store_true', help='不保存版本和报告')
    check_parser.add_argument('--notes', default='', help='版本备注')
    
    list_parser = subparsers.add_parser('list', help='列出所有歌曲')
    
    versions_parser = subparsers.add_parser('versions', help='查看歌曲版本历史')
    versions_parser.add_argument('title', help='歌曲标题')
    
    compare_parser = subparsers.add_parser('compare', help='比较两个版本')
    compare_parser.add_argument('title', help='歌曲标题')
    compare_parser.add_argument('v1', help='版本ID1')
    compare_parser.add_argument('v2', help='版本ID2')
    
    args = parser.parse_args()
    
    checker = LyricsChecker()
    
    if args.command == 'check':
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"错误: 文件 {args.file} 不存在")
            sys.exit(1)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            lyrics_text = f.read()
        
        forbidden_words = None
        if args.forbidden:
            forbidden_words = [w.strip() for w in args.forbidden.split(',')]
        
        print(f"\n正在检查: {args.title}")
        print("=" * 60)
        
        result = checker.check(
            lyrics_text=lyrics_text,
            song_title=args.title,
            author=args.author,
            rhyme_scheme=args.scheme,
            forbidden_words=forbidden_words,
            save_version=not args.no_save,
            save_report=not args.no_save,
            version_notes=args.notes,
        )
        
        checker.print_report(result)
        
        if not args.no_save:
            print(f"\n文件已保存:")
            if 'report_files' in result:
                for fmt, path in result['report_files'].items():
                    print(f"  {fmt.upper()}: {path}")
            if 'version_info' in result:
                print(f"  版本ID: {result['version_info'].get('version_id', 'N/A')}")
    
    elif args.command == 'list':
        songs = checker.list_songs()
        if not songs:
            print("暂无保存的歌曲")
            return
        
        print("\n已保存的歌曲:")
        print("-" * 60)
        for song in songs:
            print(f"  {song['title']} - {song['author']}")
            print(f"    版本数: {song['version_count']}, 最新: {song.get('current_version', 'N/A')}")
            print()
    
    elif args.command == 'versions':
        versions = checker.get_song_versions(args.title)
        if not versions:
            print(f"未找到歌曲: {args.title}")
            return
        
        print(f"\n{args.title} 的版本历史:")
        print("-" * 60)
        for v in versions:
            summary = v.get('check_result_summary', {})
            print(f"  {v['version_id']}")
            print(f"    创建时间: {v['created_at']}")
            print(f"    行数: {v['line_count']}, 字数: {summary.get('total_chinese_chars', 0)}")
            print(f"    问题数: {summary.get('total_issues', 0)}")
            if v.get('notes'):
                print(f"    备注: {v['notes']}")
            print()
    
    elif args.command == 'compare':
        diff = checker.compare_versions(args.title, args.v1, args.v2)
        if 'error' in diff:
            print(diff['error'])
            return
        
        print(f"\n比较 {args.title}: {args.v1} vs {args.v2}")
        print("=" * 60)
        print(f"总行数变化: {diff['total_changes']} 处")
        print(f"问题数变化: {diff['check_result_diff']['issues_change']:+d}")
        print()
        
        if diff['line_changes']:
            print("行变化:")
            for change in diff['line_changes']:
                line_num = change['line_index'] + 1
                if change['type'] == 'added':
                    print(f"  + L{line_num}: {change['new']}")
                elif change['type'] == 'deleted':
                    print(f"  - L{line_num}: {change['old']}")
                else:
                    print(f"  M L{line_num}:")
                    print(f"    - {change['old']}")
                    print(f"    + {change['new']}")
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
