#!/usr/bin/env python3
import sys
import os
from pathlib import Path

src_path = Path(__file__).parent / 'src'
sys.path.insert(0, str(src_path))

def main():
    print("=" * 70)
    print("🎬 纪录片字幕质检工具 - 演示")
    print("=" * 70)
    print()
    
    from subtitle_checker.config import ConfigManager
    from subtitle_checker.models import Speaker, Term, ForbiddenWord
    from subtitle_checker.parser import parse_file
    from subtitle_checker.rules import RuleEngine
    from subtitle_checker.reporter import Reporter, create_check_result
    from subtitle_checker.fixer import FixerManager, generate_fixed_filename
    
    project_dir = Path(__file__).parent
    examples_dir = project_dir / 'examples'
    config_path = project_dir / '.subtitle-checker.json'
    reports_dir = project_dir / 'demo-reports'
    output_dir = project_dir / 'demo-output'
    
    print("📍 项目目录:", project_dir)
    print("📍 示例文件目录:", examples_dir)
    print()
    
    print("📋 步骤 1: 初始化项目配置")
    print("-" * 50)
    
    try:
        if config_path.exists():
            print("   配置文件已存在，删除后重新初始化...")
            config_path.unlink()
        
        cm = ConfigManager(config_path=config_path)
        config = cm.init_project("纪录片项目 - 演示")
        print(f"✅ 项目 '{config.name}' 初始化成功!")
        print(f"   配置文件: {config_path}")
    except Exception as e:
        print(f"❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print()
    print("📋 步骤 2: 添加测试配置")
    print("-" * 50)
    
    try:
        cm.add_speaker("张教授", aliases=["张老师", "张先生"])
        print("✅ 添加说话人: 张教授 (别名: 张老师, 张先生)")
        
        cm.add_speaker("李博士", aliases=["李医生"])
        print("✅ 添加说话人: 李博士 (别名: 李医生)")
        
        cm.add_speaker("王总")
        print("✅ 添加说话人: 王总")
        
        cm.add_term("人工智能", alternatives=["AI", "机器智能"], category="技术")
        print("✅ 添加术语: 人工智能 (替代: AI, 机器智能)")
        
        cm.add_term("访谈", alternatives=["采访"], category="内容")
        print("✅ 添加术语: 访谈 (替代: 采访)")
        
        cm.add_forbidden_word("敏感内容", category="内容", suggestion="请替换为中性表述")
        print("✅ 添加禁用词: 敏感内容")
        
        print()
        print("当前配置:")
        config = cm.load()
        print(f"   说话人数量: {len(config.speakers)}")
        for s in config.speakers:
            print(f"      - {s.name} (别名: {', '.join(s.aliases) if s.aliases else '无'})")
        
        print(f"   术语数量: {len(config.terms)}")
        for t in config.terms:
            print(f"      - {t.correct} (替代: {', '.join(t.alternatives) if t.alternatives else '无'})")
        
        print(f"   禁用词数量: {len(config.forbidden_words)}")
        for fw in config.forbidden_words:
            print(f"      - {fw.word}")
            
    except Exception as e:
        print(f"❌ 添加配置失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print()
    print("📋 步骤 3: 检查示例字幕文件")
    print("-" * 50)
    
    try:
        srt_file = examples_dir / 'interview_ep01.srt'
        vtt_file = examples_dir / 'interview_ep02.vtt'
        
        print(f"🔍 解析 SRT 文件: {srt_file.name}")
        srt_subtitle = parse_file(srt_file)
        print(f"   发现 {len(srt_subtitle.items)} 条字幕")
        
        print(f"🔍 解析 VTT 文件: {vtt_file.name}")
        vtt_subtitle = parse_file(vtt_file)
        print(f"   发现 {len(vtt_subtitle.items)} 条字幕")
        
        print()
        print("🔍 运行规则引擎检查...")
        rule_engine = RuleEngine()
        config = cm.load()
        
        srt_issues = rule_engine.check_file(srt_subtitle, config)
        srt_subtitle.issues = srt_issues
        print(f"   SRT 文件发现 {len(srt_issues)} 个问题")
        
        vtt_issues = rule_engine.check_file(vtt_subtitle, config)
        vtt_subtitle.issues = vtt_issues
        print(f"   VTT 文件发现 {len(vtt_issues)} 个问题")
        
        total_issues = len(srt_issues) + len(vtt_issues)
        print()
        print(f"📊 总计发现 {total_issues} 个问题")
        
    except Exception as e:
        print(f"❌ 检查字幕失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print()
    print("📋 步骤 4: 生成质检报告")
    print("-" * 50)
    
    try:
        reports_dir.mkdir(exist_ok=True)
        
        all_files = [srt_subtitle, vtt_subtitle]
        check_result = create_check_result(all_files, cm.config_hash)
        
        reporter = Reporter()
        
        json_path = reports_dir / 'subtitle_report.json'
        reporter.save_report(check_result, json_path, 'json')
        print(f"✅ JSON 报告已生成: {json_path}")
        
        md_path = reports_dir / 'subtitle_report.md'
        reporter.save_report(check_result, md_path, 'md')
        print(f"✅ Markdown 报告已生成: {md_path}")
        
        print()
        print("报告摘要:")
        print(f"   - 检查文件数: {check_result.total_files}")
        print(f"   - 发现问题数: {check_result.total_issues}")
        print()
        print("按严重程度统计:")
        for severity, count in check_result.issues_by_severity.items():
            print(f"   - {severity.name}: {count}")
        
        print()
        print("按问题类型统计:")
        for issue_type, count in check_result.issues_by_type.items():
            print(f"   - {issue_type.name}: {count}")
            
    except Exception as e:
        print(f"❌ 生成报告失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print()
    print("📋 步骤 5: 应用安全修复")
    print("-" * 50)
    
    try:
        output_dir.mkdir(exist_ok=True)
        fixer_manager = FixerManager()
        config = cm.load()
        
        print("🔧 修复 SRT 文件...")
        fixed_srt, srt_fixes = fixer_manager.fix_file(srt_subtitle, config)
        print(f"   应用了 {len(srt_fixes)} 个修复")
        
        if len(srt_fixes) > 0:
            output_srt = output_dir / (srt_file.stem + '_fixed' + srt_file.suffix)
            from subtitle_checker.parser import generate_file
            generate_file(fixed_srt, output_srt)
            print(f"   保存到: {output_srt}")
        
        print("🔧 修复 VTT 文件...")
        fixed_vtt, vtt_fixes = fixer_manager.fix_file(vtt_subtitle, config)
        print(f"   应用了 {len(vtt_fixes)} 个修复")
        
        if len(vtt_fixes) > 0:
            output_vtt = output_dir / (vtt_file.stem + '_fixed' + vtt_file.suffix)
            generate_file(fixed_vtt, output_vtt)
            print(f"   保存到: {output_vtt}")
        
        total_fixes = len(srt_fixes) + len(vtt_fixes)
        print()
        print(f"📊 总计应用 {total_fixes} 个修复")
        
    except Exception as e:
        print(f"❌ 应用修复失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print()
    print("=" * 70)
    print("🎉 演示完成!")
    print("=" * 70)
    print()
    print("📁 生成的文件:")
    print(f"   配置文件: {config_path}")
    print(f"   JSON 报告: {reports_dir / 'subtitle_report.json'}")
    print(f"   Markdown 报告: {reports_dir / 'subtitle_report.md'}")
    print(f"   输出目录: {output_dir}")
    print()
    print("📋 下一步:")
    print("   1. 查看生成的 Markdown 报告了解详细问题")
    print("   2. 检查修复后的字幕文件")
    print("   3. 根据报告中的建议手动修正时间轴问题")
    print()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
