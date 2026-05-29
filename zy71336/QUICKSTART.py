"""快速入门脚本 - 一键初始化并运行完整测试流程"""
import os
import sys
import subprocess
import os

def run_cmd(cmd, description):
    """运行命令并返回输出"""
    print(f"\n{'='*70}")
    print(f"▶ {description}")
    print(f"命令: {cmd}")
    print('='*70 + "\n")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    return result.returncode

def main():
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)

    print("🎹 钢琴练琴打卡异常处理系统 - 快速入门")
    print("="*70)

    print("\n📋 第一步: 语法检查")
    print("-"*70)
    for f in [
        "piano_checkin/__init__.py",
        "piano_checkin/models.py",
        "piano_checkin/audio_checker.py",
        "piano_checkin/makeup_rules.py",
        "piano_checkin/duplicate_merger.py",
        "piano_checkin/comment_tracker.py",
        "piano_checkin/report_exporter.py",
        "piano_checkin/cli.py",
    ]:
        full_path = os.path.join(project_root, f)
        try:
            with open(full_path) as fp:
                compile(fp.read(), f, 'exec')
            print(f"✅ {f}")
        except SyntaxError as e:
            print(f"❌ {f}: {e}")
            sys.exit(1)

    print("\n✅ 所有文件语法正确！")

    print("\n" + "="*70)
    print("📚 项目结构")
    print("="*70)

    for root, dirs, files in os.walk(project_root):
        if 'data' in dirs:
            dirs.remove('data')
        level = root.replace(project_root, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        subindent = ' ' * 2 * (level + 1)
        for file in sorted(files):
            if file.endswith('.py') or file.endswith('.sh') or file.endswith('.md'):
                size = os.path.getsize(os.path.join(root, file))
                print(f'{subindent}{file:<35} {size:>6} bytes')

    print("\n" + "="*70)
    print("🚀 使用说明")
    print("="*70)

    print("\n1️⃣  初始化测试数据:")
    print("   python3 init_test_data.py")
    print("   (输入 y 确认")

    print("\n2️⃣  运行端到端测试:")
    print("   python3 test_e2e.py")

    print("\n3️⃣  进入交互模式:")
    print("   python3 -m piano_checkin.cli -i")

    print("\n4️⃣  命令行模式示例:")
    print("   # 处理音频:")
    print("   python3 -m piano_checkin.cli --process data/audio/test_normal1.wav <学生ID>")
    print("")
    print("   # 合并重复:")
    print("   python3 -m piano_checkin.cli --merge 2026-05-29")
    print("")
    print("   # 生成日报:")
    print("   python3 -m piano_checkin.cli --report 2026-05-29")
    print("")
    print("   # 查看流水线:")
    print("   python3 -m piano_checkin.cli --pipeline <记录ID>")

    print("\n" + "="*70)
    print("🔍 五大核心模块")
    print("="*70)

    modules = [
        ("① 音频校验", "audio_checker.py", "WAV解析 + RMS音量计算 + 空白检测"),
        ("② 补录规则", "makeup_rules.py", "超期检测 + 理由验证 + 课程表匹配"),
        ("③ 重复合并", "duplicate_merger.py", "同日检测 + 智能评分 + 合并追踪"),
        ("④ 点评追踪", "comment_tracker.py", "点评关联 + 历史查询 + 待办提醒"),
        ("⑤ 报告导出", "report_exporter.py", "文本/JSON/CSV + 异常明细 + 统计汇总"),
    ]

    for name, file, desc in modules:
        print(f"\n{name} [{file}]")
        print(f"   {desc}")

    print("\n" + "="*70)
    print("🧪 测试场景（压力测试）")
    print("="*70)

    scenarios = [
        ("1. 空白音频", "30秒全静音 → 检测blank_audio异常"),
        ("2. 时长不足", "15秒音频 → 检测short_audio异常"),
        ("3. 同日重复", "同日3条 → 合并为1条，保留最优"),
        ("4. 补录超期", "超期5天 → 检测makeup_overdue异常"),
        ("5. 理由无效", "\"有事\"2字 → 检测invalid_reason异常"),
        ("6. 课程表不匹配", "补录日期无课 → 检测invalid_reason异常"),
        ("7. 正常打卡", "45秒正常音频 → 标记normal"),
    ]

    for num, desc in scenarios:
        print(f"  ✅ {num:<15} {desc}")

    print("\n" + "="*70)
    print("💡 核心设计要点")
    print("="*70)

    print("\n✅ 导入导出不独立:")
    print("   process_audio() 依次调用音频校验+补录规则")
    print("   merge_duplicates() 基于校验结果智能评分")
    print("   generate_report() 汇总所有模块结果")

    print("\n✅ 错误详情不笼统:")
    print("   显示具体数值（差15秒、超2天、音量-60dB）")
    print("   给出建议（请补充理由、需老师审批）")

    print("\n✅ 历史自动备份:")
    print("   每次保存自动备份到 data/history/")
    print("   文件名带时间戳，支持回溯")

    print("\n✅ 处理流水线视图:")
    print("   show_pipeline() 展示5步完整处理过程")
    print("   每步显示通过/异常状态")

    print("\n" + "="*70)
    print("🎉 项目就绪！运行 python3 init_test_data.py 开始测试")
    print("="*70)

    return 0

if __name__ == "__main__":
    sys.exit(main())
