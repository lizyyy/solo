#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
采访素材脱敏剪辑台
==================
一个给纪录片剪辑助理用的本地桌面小工具

功能：
- 导入 SRT 字幕、说话人名单、敏感词表、片段备注
- 按规则和说话人权限自动标记风险
- 支持逐条复核、合并相邻风险片段
- 生成可回退的脱敏版本
- 导出新版 SRT、剪辑决策清单 CSV 和 Markdown 报告

作者：自动生成
版本：1.0.0
"""

import sys
import os
from pathlib import Path

# 检查 Python 版本
if sys.version_info < (3, 7):
    print("错误：需要 Python 3.7 或更高版本")
    sys.exit(1)

# 将当前目录添加到模块搜索路径
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))


def check_dependencies():
    """检查依赖"""
    # tkinter 是标准库，在大多数系统上都已安装
    # 但在某些 Linux 发行版可能需要单独安装 python3-tk
    try:
        import tkinter
        return True
    except ImportError:
        print("错误：tkinter 模块未安装")
        print("请安装：")
        print("  - Ubuntu/Debian: sudo apt-get install python3-tk")
        print("  - Fedora/RHEL: sudo dnf install python3-tkinter")
        print("  - macOS: brew install python-tk")
        return False


def print_intro():
    """打印介绍信息"""
    intro = """
╔═══════════════════════════════════════════════════════════════╗
║                    采访素材脱敏剪辑台 v1.0                      ║
╠═══════════════════════════════════════════════════════════════╣
║  功能：                                                         ║
║  ✓ 导入 SRT 字幕、说话人名单、敏感词表                         ║
║  ✓ 自动检测敏感词、未授权姓名、身份证号、手机号、邮箱等        ║
║  ✓ 按说话人权限分级标记风险                                     ║
║  ✓ 逐条复核风险标记（批准/驳回/自定义替换）                    ║
║  ✓ 合并相邻风险片段                                             ║
║  ✓ 版本历史和回退功能                                           ║
║  ✓ 导出脱敏 SRT、决策清单 CSV、审核报告 Markdown              ║
╚═══════════════════════════════════════════════════════════════╝
"""
    print(intro)


def run_gui():
    """启动 GUI 界面"""
    try:
        from modules.gui import GUI
        print("启动图形界面...")
        print("提示：如果界面未显示，请检查是否有窗口被最小化")
        GUI.run()
    except Exception as e:
        print(f"启动 GUI 失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    return True


def run_cli_demo():
    """运行命令行演示（展示核心功能）"""
    print("\n" + "="*60)
    print("命令行演示模式")
    print("="*60)
    
    try:
        # 导入核心模块
        from modules.parser import Parser
        from modules.rules import RuleEngine
        from modules.import_export import ImportExport
        
        # 检查示例数据目录
        sample_dir = current_dir / "sample_data"
        if not sample_dir.exists():
            print(f"\n警告：示例数据目录不存在: {sample_dir}")
            print("请确保 sample_data 目录与 main.py 在同一目录下")
            return False
        
        print(f"\n示例数据目录: {sample_dir}")
        
        # 1. 解析示例数据
        print("\n" + "-"*60)
        print("步骤1: 解析示例数据")
        print("-"*60)
        
        # 解析 SRT
        srt_file = sample_dir / "sample.srt"
        print(f"  解析 SRT: {srt_file}")
        subtitles = Parser.parse_srt(str(srt_file))
        print(f"  ✓ 成功解析 {len(subtitles)} 条字幕")
        
        # 解析说话人名单
        speakers_file = sample_dir / "speakers.csv"
        print(f"  解析说话人名单: {speakers_file}")
        speakers = Parser.parse_speakers(str(speakers_file))
        print(f"  ✓ 成功解析 {len(speakers)} 位说话人")
        for s in speakers:
            print(f"    - {s.name}: {s.permission.value}")
        
        # 解析敏感词表
        words_file = sample_dir / "sensitive_words.csv"
        print(f"  解析敏感词表: {words_file}")
        sensitive_words = Parser.parse_sensitive_words(str(words_file))
        print(f"  ✓ 成功解析 {len(sensitive_words)} 个敏感词规则")
        
        # 2. 执行风险分析
        print("\n" + "-"*60)
        print("步骤2: 执行风险分析")
        print("-"*60)
        
        engine = RuleEngine(sensitive_words, speakers)
        markers, fragments = engine.analyze(subtitles)
        
        print(f"  ✓ 检测到 {len(markers)} 个风险标记")
        print(f"  ✓ 生成 {len(fragments)} 个风险片段")
        
        # 统计
        stats = engine.get_statistics(markers)
        print(f"\n  风险统计:")
        for level, count in stats['by_level'].items():
            print(f"    - {level}: {count}")
        
        # 显示前5个风险标记
        print(f"\n  前5个风险标记:")
        for i, marker in enumerate(markers[:5], 1):
            subtitle_map = {s.id: s for s in subtitles}
            subtitle = subtitle_map.get(marker.subtitle_id)
            time_str = ""
            if subtitle:
                time_str = ImportExport.format_time(subtitle.start_time)
            
            print(f"    {i}. [{time_str}] {marker.risk_text!r}")
            print(f"       类型: {marker.risk_type.value}, 等级: {marker.risk_level.value}")
            print(f"       建议替换: {marker.suggested_replacement!r}")
        
        # 3. 模拟复核
        print("\n" + "-"*60)
        print("步骤3: 模拟复核操作")
        print("-"*60)
        
        from modules.rules import RiskReviewer
        
        # 批准第一个标记
        if markers:
            print(f"  批准第一个标记: {markers[0].risk_text!r}")
            RiskReviewer.approve(markers[0], "演示用户", "自动批准演示")
            print(f"  ✓ 状态已更新为: {markers[0].review_status.value}")
        
        # 自定义替换第二个标记
        if len(markers) >= 2:
            print(f"\n  自定义替换第二个标记: {markers[1].risk_text!r}")
            RiskReviewer.modify(markers[1], "[已处理]", "演示用户", "使用自定义替换")
            print(f"  ✓ 状态已更新为: {markers[1].review_status.value}")
            print(f"  ✓ 自定义替换: {markers[1].custom_replacement!r}")
        
        # 驳回第三个标记
        if len(markers) >= 3:
            print(f"\n  驳回第三个标记: {markers[2].risk_text!r}")
            RiskReviewer.reject(markers[2], "演示用户", "上下文安全，不是风险")
            print(f"  ✓ 状态已更新为: {markers[2].review_status.value}")
        
        # 4. 演示导出
        print("\n" + "-"*60)
        print("步骤4: 演示导出功能")
        print("-"*60)
        
        # 创建导出目录
        export_dir = current_dir / "demo_output"
        export_dir.mkdir(exist_ok=True)
        
        # 创建一个简单的项目状态用于导出演示
        from modules.models import ProjectState
        from datetime import datetime
        
        demo_state = ProjectState(
            project_name="演示项目",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            subtitles=subtitles,
            speakers=speakers,
            sensitive_words=sensitive_words,
            notes=[],
            risk_markers=markers,
            risk_fragments=fragments,
            redactions=[],
            version_history=[],
            active_version=0
        )
        
        print(f"  导出目录: {export_dir}")
        
        # 导出脱敏 SRT
        srt_output = export_dir / "demo_redacted.srt"
        print(f"  导出脱敏 SRT: {srt_output.name}")
        ImportExport.srt_exporter.export_redacted(
            subtitles, markers, str(srt_output)
        )
        print(f"  ✓ SRT 导出完成")
        
        # 导出决策清单
        csv_output = export_dir / "demo_decisions.csv"
        print(f"  导出决策清单: {csv_output.name}")
        ImportExport.csv_exporter.export_decision_list(
            markers, subtitles, str(csv_output), include_all=True
        )
        print(f"  ✓ CSV 导出完成")
        
        # 导出 Markdown 报告
        report_output = export_dir / "demo_report.md"
        print(f"  导出审核报告: {report_output.name}")
        ImportExport.markdown_exporter.export_report(
            demo_state, str(report_output)
        )
        print(f"  ✓ Markdown 报告导出完成")
        
        print("\n" + "="*60)
        print("演示完成！")
        print("="*60)
        print(f"\n导出的文件位于: {export_dir}")
        print("\n要使用完整的图形界面功能，请直接运行 main.py（不带 --demo 参数）")
        
        return True
        
    except Exception as e:
        print(f"\n演示过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False


def show_help():
    """显示帮助信息"""
    help_text = """
采访素材脱敏剪辑台 - 使用说明

用法:
    python main.py              启动图形界面（默认）
    python main.py --demo       运行命令行演示
    python main.py --help       显示此帮助信息

功能特点:
    1. 数据导入
       - 支持导入 SRT 字幕文件
       - 支持导入 CSV 格式的说话人名单、敏感词表、片段备注
    
    2. 风险检测
       - 敏感词匹配（支持字面和正则表达式）
       - 未授权说话人姓名检测
       - 个人信息检测（身份证号、手机号、邮箱、地址等）
    
    3. 风险复核
       - 逐条审核风险标记
       - 支持三种决策：批准、驳回、自定义替换
       - 可合并相邻风险片段
    
    4. 版本管理
       - 自动保存版本历史
       - 支持回退到历史版本
    
    5. 数据导出
       - 脱敏后的 SRT 字幕
       - 剪辑决策清单 CSV
       - 完整的审核报告 Markdown

示例数据:
    sample_data/ 目录包含示例数据，可以用来测试功能：
    - sample.srt: 示例字幕文件
    - speakers.csv: 说话人名单（包含权限设置）
    - sensitive_words.csv: 敏感词规则
    - notes.csv: 片段备注

CSV 文件格式:
    说话人名单 CSV:
        name,permission,alias,notes,authorized_phrases
        张教授,PARTIAL_AUTHORIZATION,"张三,张老师",备注,"人工智能,机器学习"
    
    敏感词表 CSV:
        word,level,category,replacement,notes,is_pattern
        敏感词,HIGH,SENSITIVE_WORD,[已脱敏],备注,false
    
    权限类型:
        FULL_AUTHORIZATION: 完全授权
        PARTIAL_AUTHORIZATION: 部分授权
        NO_AUTHORIZATION: 未授权
    
    风险等级:
        CRITICAL: 严重
        HIGH: 高
        MEDIUM: 中
        LOW: 低

快捷键:
    Ctrl+N: 新建项目
    Ctrl+O: 打开项目
    Ctrl+S: 保存项目
    F5: 重新分析
"""
    print(help_text)


def main():
    """主函数"""
    # 打印介绍
    print_intro()
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    # 解析命令行参数
    args = sys.argv[1:]
    
    if '--help' in args or '-h' in args:
        show_help()
        sys.exit(0)
    
    if '--demo' in args:
        # 运行命令行演示
        success = run_cli_demo()
        sys.exit(0 if success else 1)
    
    # 默认启动 GUI
    print("启动图形界面...")
    print("提示：")
    print("  1. 使用 \"文件\" 菜单创建或打开项目")
    print("  2. 导入 SRT 字幕、说话人名单、敏感词表")
    print("  3. 点击 \"分析\" 按钮检测风险")
    print("  4. 在右侧面板进行复核操作")
    print("  5. 完成后导出脱敏结果")
    print()
    
    success = run_gui()
    if not success:
        print("\n尝试使用 --demo 参数运行命令行演示")
        sys.exit(1)


if __name__ == "__main__":
    main()
