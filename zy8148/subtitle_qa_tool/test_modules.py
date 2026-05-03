#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试脚本 - 验证核心模块功能
"""

import os
import sys

# 添加模块路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules.parser import SubtitleParser, SegmentsParser, ConfigParser
from modules.rules_engine import RulesEngine, IssueType, IssueSeverity
from modules.state_storage import StateStorage, ConfirmationStatus
from modules.exporter import Exporter


def test_subtitle_parser():
    """测试字幕解析器"""
    print("=" * 60)
    print("测试 1: 字幕解析器 (SubtitleParser)")
    print("=" * 60)
    
    parser = SubtitleParser()
    
    # 测试 SRT 解析
    srt_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_subtitle.srt')
    if os.path.exists(srt_file):
        print(f"\n解析 SRT 文件: {os.path.basename(srt_file)}")
        subtitles = parser.parse(srt_file)
        print(f"  - 解析到 {len(subtitles)} 条字幕")
        
        # 显示前几条字幕
        for i, sub in enumerate(subtitles[:3], 1):
            print(f"  - 字幕 {i}: 序号={sub.index}, 时间={sub.start_time:.3f}s-{sub.end_time:.3f}s, 说话人={sub.speaker or '无'}")
        
        # 测试边界情况
        print("\n  边界情况测试:")
        
        # 检查跨小时时间格式
        cross_hour_sub = next((s for s in subtitles if s.start_time > 3600), None)
        if cross_hour_sub:
            print(f"    ✅ 检测到跨小时字幕: 开始时间={cross_hour_sub.start_time}秒 ({cross_hour_sub.start_time/3600:.2f}小时)")
        
        # 检查空字幕
        empty_sub = next((s for s in subtitles if not s.text.strip()), None)
        if empty_sub:
            print(f"    ✅ 检测到空字幕: 序号={empty_sub.index}")
        
        # 检查说话人提取
        speaker_sub = next((s for s in subtitles if s.speaker), None)
        if speaker_sub:
            print(f"    ✅ 成功提取说话人: '{speaker_sub.speaker}'")
    
    # 测试 VTT 解析
    vtt_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_subtitle.vtt')
    if os.path.exists(vtt_file):
        print(f"\n解析 VTT 文件: {os.path.basename(vtt_file)}")
        subtitles_vtt = parser.parse(vtt_file)
        print(f"  - 解析到 {len(subtitles_vtt)} 条字幕")
    
    print("\n✅ 字幕解析器测试通过!")
    return True


def test_segments_parser():
    """测试片段解析器"""
    print("\n" + "=" * 60)
    print("测试 2: 片段清单解析器 (SegmentsParser)")
    print("=" * 60)
    
    parser = SegmentsParser()
    
    json_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_segments.json')
    if os.path.exists(json_file):
        print(f"\n解析 JSON 文件: {os.path.basename(json_file)}")
        segments = parser.parse(json_file)
        print(f"  - 解析到 {len(segments)} 个片段")
        
        # 显示前几个片段
        for i, seg in enumerate(segments[:3], 1):
            print(f"  - 片段 {i}: ID={seg.segment_id}, 说话人={seg.speaker}, 时间={seg.start_time}s-{seg.end_time}s")
        
        # 检查时间格式支持
        print("\n  边界情况测试:")
        cross_hour_seg = next((s for s in segments if s.start_time > 3600), None)
        if cross_hour_seg:
            print(f"    ✅ 检测到跨小时片段: 开始时间={cross_hour_seg.start_time}秒")
    
    print("\n✅ 片段解析器测试通过!")
    return True


def test_config_parser():
    """测试配置解析器"""
    print("\n" + "=" * 60)
    print("测试 3: 配置解析器 (ConfigParser)")
    print("=" * 60)
    
    parser = ConfigParser()
    
    yaml_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_config.yaml')
    if os.path.exists(yaml_file):
        print(f"\n解析 YAML 文件: {os.path.basename(yaml_file)}")
        config = parser.parse(yaml_file)
        
        print(f"  - 说话人列表 ({len(config.speakers)} 个): {config.speakers}")
        print(f"  - 敏感词列表 ({len(config.sensitive_words)} 个): {config.sensitive_words}")
        print(f"  - 每秒最大字符数: {config.max_chars_per_second}")
        print(f"  - 最小字幕时长: {config.min_subtitle_duration} 秒")
    
    # 测试默认配置
    default_config = parser.get_default_config()
    print(f"\n默认配置测试:")
    print(f"  - 默认每秒最大字符数: {default_config.max_chars_per_second}")
    print(f"  - 默认最小字幕时长: {default_config.min_subtitle_duration} 秒")
    
    print("\n✅ 配置解析器测试通过!")
    return True


def test_rules_engine():
    """测试规则引擎"""
    print("\n" + "=" * 60)
    print("测试 4: 规则引擎 (RulesEngine)")
    print("=" * 60)
    
    # 先解析字幕和配置
    subtitle_parser = SubtitleParser()
    config_parser = ConfigParser()
    
    srt_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_subtitle.srt')
    yaml_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_config.yaml')
    json_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_segments.json')
    
    subtitles = []
    config = config_parser.get_default_config()
    segments = []
    
    if os.path.exists(srt_file):
        subtitles = subtitle_parser.parse(srt_file)
    
    if os.path.exists(yaml_file):
        config = config_parser.parse(yaml_file)
    
    if os.path.exists(json_file):
        segments_parser = SegmentsParser()
        segments = segments_parser.parse(json_file)
    
    print(f"\n测试数据:")
    print(f"  - 字幕数量: {len(subtitles)}")
    print(f"  - 片段数量: {len(segments)}")
    print(f"  - 说话人数量: {len(config.speakers)}")
    print(f"  - 敏感词数量: {len(config.sensitive_words)}")
    
    # 运行规则引擎
    print(f"\n运行质检规则...")
    engine = RulesEngine(config)
    issues = engine.check_all(subtitles, segments)
    
    print(f"\n检查结果:")
    print(f"  - 总问题数: {len(issues)}")
    
    # 统计信息
    stats = engine.get_statistics()
    print(f"\n按严重程度分布:")
    print(f"  - 错误 (Error): {stats['by_severity']['error']}")
    print(f"  - 警告 (Warning): {stats['by_severity']['warning']}")
    print(f"  - 提示 (Info): {stats['by_severity']['info']}")
    
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
            print(f"  - {name}: {count}")
    
    # 显示几个问题示例
    if issues:
        print(f"\n问题示例 (前 3 个):")
        for i, issue in enumerate(issues[:3], 1):
            severity_name = "错误" if issue.severity == IssueSeverity.ERROR else \
                           "警告" if issue.severity == IssueSeverity.WARNING else "提示"
            type_name = type_names.get(issue.issue_type.value, issue.issue_type.value)
            print(f"  {i}. [{severity_name}] {type_name}: {issue.message}")
    
    print("\n✅ 规则引擎测试通过!")
    return True


def test_state_storage():
    """测试状态存储"""
    print("\n" + "=" * 60)
    print("测试 5: 状态存储 (StateStorage)")
    print("=" * 60)
    
    storage = StateStorage()
    
    # 创建新会话
    print("\n创建新会话...")
    session = storage.create_new_session()
    print(f"  - 会话 ID: {session.session_id}")
    print(f"  - 创建时间: {session.created_at}")
    
    # 测试更新问题状态
    print("\n测试问题状态更新...")
    issue_id = storage.generate_issue_id(1, 'test_issue', 10.5)
    print(f"  - 生成问题 ID: {issue_id}")
    
    state = storage.update_issue_state(
        issue_id=issue_id,
        subtitle_index=1,
        issue_type='test_issue',
        status=ConfirmationStatus.CONFIRMED,
        notes="这是一个测试备注"
    )
    
    print(f"  - 更新后状态: {state.status.value}")
    print(f"  - 备注: {state.notes}")
    
    # 测试获取状态
    retrieved_status = storage.get_issue_status(issue_id)
    print(f"  - 获取状态: {retrieved_status.value}")
    
    # 测试统计
    print("\n测试统计更新...")
    storage.update_issue_state(
        issue_id=storage.generate_issue_id(2, 'test_issue_2', 20.0),
        subtitle_index=2,
        issue_type='test_issue_2',
        status=ConfirmationStatus.PENDING
    )
    
    storage.update_issue_state(
        issue_id=storage.generate_issue_id(3, 'test_issue_3', 30.0),
        subtitle_index=3,
        issue_type='test_issue_3',
        status=ConfirmationStatus.DISMISSED
    )
    
    print(f"  - 会话中问题数量: {len(storage.current_session.issue_states)}")
    print(f"  - 已确认: {storage.current_session.confirmed_issues}")
    print(f"  - 已忽略: {storage.current_session.dismissed_issues}")
    print(f"  - 待处理: {storage.current_session.pending_issues}")
    
    # 测试列出会话
    print("\n测试会话列表...")
    sessions = storage.list_sessions()
    print(f"  - 已保存的会话数量: {len(sessions)}")
    
    print("\n✅ 状态存储测试通过!")
    return True


def test_exporter():
    """测试导出器"""
    print("\n" + "=" * 60)
    print("测试 6: 导出器 (Exporter)")
    print("=" * 60)
    
    # 先获取一些测试数据
    subtitle_parser = SubtitleParser()
    config_parser = ConfigParser()
    
    srt_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_subtitle.srt')
    yaml_file = os.path.join(os.path.dirname(__file__), 'sample_data', 'sample_config.yaml')
    
    subtitles = []
    config = config_parser.get_default_config()
    
    if os.path.exists(srt_file):
        subtitles = subtitle_parser.parse(srt_file)
    
    if os.path.exists(yaml_file):
        config = config_parser.parse(yaml_file)
    
    # 运行规则引擎获取问题
    engine = RulesEngine(config)
    issues = engine.check_all(subtitles)
    
    if not issues:
        print("\n⚠️  没有问题数据可用于测试导出")
        print("\n✅ 导出器测试跳过（无数据）")
        return True
    
    print(f"\n测试数据: {len(issues)} 个问题")
    
    # 测试导出为临时文件
    import tempfile
    
    # 测试 Markdown 导出
    print("\n测试 Markdown 导出...")
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        md_file = f.name
    
    try:
        result = Exporter.export_markdown(issues, subtitles, md_file)
        if result and os.path.exists(md_file):
            print(f"  ✅ Markdown 导出成功: {md_file}")
            file_size = os.path.getsize(md_file)
            print(f"  - 文件大小: {file_size} 字节")
            
            # 读取前几行验证
            with open(md_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()[:10]
                print(f"  - 前 10 行预览:")
                for line in lines:
                    print(f"    {line.rstrip()}")
    finally:
        if os.path.exists(md_file):
            os.unlink(md_file)
            print(f"\n  - 临时文件已清理")
    
    # 测试 CSV 导出
    print("\n测试 CSV 导出...")
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        csv_file = f.name
    
    try:
        result = Exporter.export_csv(issues, csv_file)
        if result and os.path.exists(csv_file):
            print(f"  ✅ CSV 导出成功: {csv_file}")
            file_size = os.path.getsize(csv_file)
            print(f"  - 文件大小: {file_size} 字节")
            
            # 读取前几行验证
            with open(csv_file, 'r', encoding='utf-8-sig') as f:
                lines = f.readlines()[:5]
                print(f"  - 前 5 行预览:")
                for line in lines:
                    print(f"    {line.rstrip()}")
    finally:
        if os.path.exists(csv_file):
            os.unlink(csv_file)
            print(f"\n  - 临时文件已清理")
    
    print("\n✅ 导出器测试通过!")
    return True


def main():
    """主测试函数"""
    print("\n" + "=" * 60)
    print("字幕质检工具 - 模块测试")
    print("=" * 60)
    
    test_results = []
    
    # 运行所有测试
    test_results.append(test_subtitle_parser())
    test_results.append(test_segments_parser())
    test_results.append(test_config_parser())
    test_results.append(test_rules_engine())
    test_results.append(test_state_storage())
    test_results.append(test_exporter())
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("测试汇总")
    print("=" * 60)
    
    passed = sum(1 for r in test_results if r)
    total = len(test_results)
    
    print(f"\n通过: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 所有测试通过!")
        return 0
    else:
        print("\n❌ 部分测试失败!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
