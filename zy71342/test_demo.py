#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lyrics_checker import LyricsChecker

def demo_basic_check():
    print("=" * 70)
    print("  演示1: 基本歌词检查")
    print("=" * 70)
    
    lyrics = """我走在城市的黄昏
看夕阳慢慢地沉沦
街道上拥挤的人们
各自奔向回家的门"""
    
    checker = LyricsChecker()
    result = checker.check(
        lyrics_text=lyrics,
        song_title="demo_简单示例",
        author="演示作者",
        save_version=False,
        save_report=False,
    )
    
    print(f"\n综合评分: {result['overall_score']['score']}分 ({result['overall_score']['grade']}级)")
    print(f"判断理由: {result['overall_score']['reason']}\n")
    
    print("韵脚检测结果:")
    for lf in result['rhyme']['line_finals'][:4]:
        print(f"  第{lf['line_index']+1}行: {lf['line']}")
        print(f"    {lf['reason']}")
    
    return result

def demo_mixed_language():
    print("\n" + "=" * 70)
    print("  演示2: 中英文混合场景")
    print("=" * 70)
    
    lyrics = """Oh my friend, don't you cry
擦干眼泪继续往前飞
我们都一样 都曾有迷茫
但心中的光 永远在闪亮"""
    
    checker = LyricsChecker()
    result = checker.check(
        lyrics_text=lyrics,
        song_title="demo_中英文混合",
        save_version=False,
        save_report=False,
    )
    
    print("\n中英文混合检测:")
    mixed = result['polyphone']['mixed_language']
    print(f"  发现 {mixed['total_mixed_lines']} 行混合内容")
    for line in mixed['mixed_lines']:
        print(f"  第{line['line_index']+1}行: {line['reason']}")
        print(f"    影响等级: {line['impact_level']}")
    
    return result

def demo_polyphone():
    print("\n" + "=" * 70)
    print("  演示3: 多音字检测")
    print("=" * 70)
    
    lyrics = """我长大了
也懂得了
生活的快乐
需要努力获得"""
    
    checker = LyricsChecker()
    result = checker.check(
        lyrics_text=lyrics,
        song_title="demo_多音字",
        save_version=False,
        save_report=False,
    )
    
    print("\n多音字检测:")
    poly = result['polyphone']['polyphones']
    print(f"  发现 {poly['total_count']} 个多音字")
    for p in poly['polyphones'][:5]:
        print(f"  第{p['line_index']+1}行「{p['char']}」: {p['reason']}")
    
    return result

def demo_chorus_detection():
    print("\n" + "=" * 70)
    print("  演示4: 副歌重复检测")
    print("=" * 70)
    
    with open('examples/示例歌词.txt', 'r', encoding='utf-8') as f:
        lyrics = f.read()
    
    checker = LyricsChecker()
    result = checker.check(
        lyrics_text=lyrics,
        song_title="demo_副歌检测",
        save_version=False,
        save_report=False,
    )
    
    print("\n重复检测结果:")
    line_rep = result['repetition']['line_repetition']
    print(f"  重复行组: {line_rep['summary']['exact_repeat_groups']} 组")
    print(f"  疑似副歌: {len(line_rep['chorus_candidates'])} 组")
    
    for chorus in line_rep['chorus_candidates']:
        print(f"  副歌候选: 「{chorus['clean_line'][:15]}...」 出现{chorus['count']}次")
    
    return result

def demo_version_control():
    print("\n" + "=" * 70)
    print("  演示5: 版本管理功能")
    print("=" * 70)
    
    checker = LyricsChecker()
    
    v1_lyrics = """我走在城市的黄昏
看夕阳慢慢地沉沦
街道上拥挤的人们
各自奔向回家的门"""
    
    v2_lyrics = """我走在城市的黄昏
看夕阳慢慢地沉沦
街道上忙碌的人们
各自奔向温暖的门"""
    
    print("\n保存第一版...")
    r1 = checker.check(
        lyrics_text=v1_lyrics,
        song_title="version_demo",
        version_notes="初稿",
        save_report=False,
    )
    print(f"  版本ID: {r1['version_info']['version_id']}")
    v1_id = r1['version_info']['version_id']
    
    print("\n保存修改版...")
    r2 = checker.check(
        lyrics_text=v2_lyrics,
        song_title="version_demo",
        version_notes="修改了第三、四句",
        save_report=False,
    )
    print(f"  版本ID: {r2['version_info']['version_id']}")
    v2_id = r2['version_info']['version_id']
    
    print("\n版本对比:")
    diff = checker.compare_versions("version_demo", v1_id, v2_id)
    for change in diff['line_changes']:
        if change['type'] == 'modified':
            print(f"  第{change['line_index']+1}行修改:")
            print(f"    - {change['old']}")
            print(f"    + {change['new']}")
    
    return checker

def demo_forbidden_words():
    print("\n" + "=" * 70)
    print("  演示6: 禁用词检查")
    print("=" * 70)
    
    lyrics = """我感到很痛苦
生活充满了悲伤
每一天都好累
不知道该怎么办"""
    
    checker = LyricsChecker()
    result = checker.check(
        lyrics_text=lyrics,
        song_title="demo_禁用词",
        forbidden_words=["痛苦", "悲伤", "好累"],
        save_version=False,
        save_report=False,
    )
    
    print("\n禁用词检查结果:")
    forbidden = result['repetition']['forbidden_words']
    if forbidden and forbidden['found_forbidden']:
        for fw in forbidden['found_forbidden']:
            print(f"  「{fw['word']}」 出现 {fw['count']} 次")
            for pos in fw['positions']:
                print(f"    第{pos['line']+1}行: {pos['context']}")
    
    return result

if __name__ == '__main__':
    print("\n" + "*" * 70)
    print("*" + " " * 68 + "*")
    print("*" + " " * 15 + "歌词押韵检查CLI - 功能演示" + " " * 24 + "*")
    print("*" + " " * 68 + "*")
    print("*" * 70)
    
    try:
        demo_basic_check()
        demo_mixed_language()
        demo_polyphone()
        demo_chorus_detection()
        demo_version_control()
        demo_forbidden_words()
        
        print("\n" + "=" * 70)
        print("  所有演示完成！")
        print("  生成的报告和版本保存在 ./reports 和 ./versions 目录")
        print("  使用命令行工具: python cli.py --help 查看更多用法")
        print("=" * 70 + "\n")
        
    except Exception as e:
        print(f"\n演示出错: {e}")
        print("请先安装依赖: pip install pypinyin jieba")
        import traceback
        traceback.print_exc()
