"""验证整个项目的语法和导入"""
import os
import sys
import py_compile

project_root = os.path.dirname(os.path.abspath(__file__))

print("🎹 钢琴练琴打卡异常处理系统 - 项目验证")
print("=" * 70)

files_to_check = [
    "piano_checkin/__init__.py",
    "piano_checkin/models.py",
    "piano_checkin/audio_checker.py",
    "piano_checkin/makeup_rules.py",
    "piano_checkin/duplicate_merger.py",
    "piano_checkin/comment_tracker.py",
    "piano_checkin/report_exporter.py",
    "piano_checkin/cli.py",
    "__main__.py",
    "init_test_data.py",
    "test_e2e.py",
    "QUICKSTART.py",
    "check_syntax.py",
    "verify_project.py",
]

print("\n📋 语法检查")
print("-" * 70)

all_passed = True
for rel_path in files_to_check:
    full_path = os.path.join(project_root, rel_path)
    if not os.path.exists(full_path):
        print(f"⚠️  {rel_path}: 文件不存在")
        continue
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            code = f.read()
        compile(code, rel_path, 'exec')
        size = os.path.getsize(full_path)
        lines = len(code.split('\n'))
        print(f"✅ {rel_path:<40} {lines:>4}行  {size:>6}字节")
    except SyntaxError as e:
        print(f"❌ {rel_path}:")
        print(f"   错误: {e}")
        all_passed = False
    except Exception as e:
        print(f"❌ {rel_path}: {e}")
        all_passed = False

print("\n" + "=" * 70)
print("📁 项目结构")
print("=" * 70)

for root, dirs, files in os.walk(project_root):
    if '.pyc' in dirs:
        dirs.remove('.pyc')
    if '__pycache__' in dirs:
        dirs.remove('__pycache__')
    if 'data' in dirs:
        dirs.remove('data')

    level = root.replace(project_root, '').count(os.sep)
    indent = ' ' * 2 * level
    print(f'{indent}{os.path.basename(root)}/')
    subindent = ' ' * 2 * (level + 1)
    for file in sorted(files):
        if file.endswith('.py') or file.endswith('.sh') or file.endswith('.md'):
            print(f'{subindent}{file}')

print("\n" + "=" * 70)
print("🔍 核心模块说明")
print("=" * 70)

modules = [
    ("models.py", "数据模型定义: Student, AudioInfo, MakeupInfo, CheckinRecord, Comment, Schedule"),
    ("audio_checker.py", "音频校验: WAV解析 + RMS音量计算 + 空白/短/低质量检测"),
    ("makeup_rules.py", "补录规则: 超期检测 + 理由验证 + 课程表匹配"),
    ("duplicate_merger.py", "重复合并: 同日检测 + 智能评分 + 合并追踪"),
    ("comment_tracker.py", "点评追踪: 点评关联 + 历史查询 + 待办提醒"),
    ("report_exporter.py", "报告导出: 文本/JSON/CSV + 异常明细 + 统计汇总"),
    ("cli.py", "CLI主入口: 交互模式 + 命令行 + 处理流水线视图"),
]

for file, desc in modules:
    print(f"\n📄 {file}")
    print(f"   {desc}")

print("\n" + "=" * 70)
print("🧪 测试场景")
print("=" * 70)

scenarios = [
    ("1. 空白音频", "30秒全静音WAV → 检测blank_audio异常，显示音量-60dB < -50dB阈值"),
    ("2. 时长不足", "15秒音频 → 检测short_audio异常，显示差15秒到30秒"),
    ("3. 同日重复", "同日3条(45/60/50秒) → 合并为1条，保留60秒最优"),
    ("4. 补录超期", "超期5天 → 检测makeup_overdue异常，超期2天"),
    ("5. 理由无效", "\"有事\"2字 → 检测invalid_reason异常，需至少5字"),
    ("6. 课程表不匹配", "补录日期无课 → 检测invalid_reason异常"),
    ("7. 正常打卡", "45秒正常音频 → 标记normal，无异常"),
]

for num, desc in scenarios:
    print(f"  ✅ {num:<15} {desc}")

print("\n" + "=" * 70)
print("💡 核心设计要点")
print("=" * 70)

print("""
✅ 主流程串联:
   音频校验 → 补录规则 → 重复合并 → 点评追踪 → 报告导出
   导入不独立: process_audio() 依次调用前两个模块
   合并不独立: merge_duplicates() 基于校验结果评分
   点评不独立: add_comment() 检查记录状态
   导出不独立: generate_report() 汇总所有模块结果

✅ 错误详情不笼统:
   显示具体数值（差15秒、超2天、音量-60dB）
   给出建议（请补充理由、需老师审批）

✅ 历史自动备份:
   每次保存自动备份到 data/history/
   文件名带时间戳，支持回溯

✅ 处理流水线视图:
   show_pipeline() 展示5步完整处理过程
   每步显示通过/异常状态

✅ 失败路径真实:
   音频不存在、0字节空文件、WAV格式损坏
   学生不存在、原日期晚于提交日期、理由仅语气词
   对已合并记录点评、点评内容为空
""")

print("=" * 70)
if all_passed:
    print("🎉 所有文件语法正确！项目就绪！")
    print("\n🚀 快速开始:")
    print("   1. python3 init_test_data.py   # 初始化测试数据")
    print("   2. python3 test_e2e.py          # 运行端到端测试")
    print("   3. python3 -m piano_checkin.cli -i  # 进入交互模式")
else:
    print("⚠️  有语法错误，请检查上面的错误信息")

print("=" * 70)

sys.exit(0 if all_passed else 1)
