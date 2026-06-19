#!/usr/bin/env python3
"""
最终验证脚本：同一条业务样例贯穿整条链路
复现场景：网格员巡查表第一次导入 → 坡道补录（评分无变化→ESCALATED）
        → API读取验证不断裂 → 导入书记已审阅施工告示（切到社区书记协调）
        → 再读API → 文本报告（含处理历史/证据#/材料对账）
        → HTML报告（含已提供材料/证据#/处理历史）→ 字段全核对
"""
import subprocess, sys, os, json, re

def run(cmd):
    print(f"\n{'═'*70}")
    print(f"$ {' '.join(cmd)}")
    print(f"{'═'*70}")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stdout: print(r.stdout)
    if r.stderr: print("STDERR:", r.stderr[:500], file=sys.stderr)
    return r

def ASSERT(cond, msg):
    if not cond:
        print(f"\n❌ 断言失败：{msg}")
        sys.exit(1)
    print(f"✅ {msg}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '.')

# 清理
for d in ['data', 'output']:
    os.makedirs(d, exist_ok=True)
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))

print("\n" + "#"*70)
print("【最终验证】同一条样例：导入巡查表→补录坡道→导入告示→报告全字段核对")
print("#"*70)

# ============ 阶段1：CLI 创建 + 导入巡查表 ============
print("\n--- 阶段1：CLI 创建案件 + 导入巡查表 ---")
r = run(['python3','cli.py','create','最终贯通样例'])
ASSERT(r.returncode == 0, "CLI 创建案件成功")
case_id = re.search(r'案件ID[:：]\s*(\S+)', r.stdout).group(1)
print(f"案件ID = {case_id}")

r = run(['python3','cli.py','import-inspection', case_id, '--json', 'samples/inspection.json'])
ASSERT(r.returncode == 0, "CLI 导入巡查表成功")

fp = os.path.join('data', f'case_{case_id}.json')
with open(fp, encoding='utf-8') as f:
    d = json.load(f)
ramp_id = d['ramps'][0]['id']
print(f"ramp_id = {ramp_id}")

# 阶段1断言：初次巡查建档历史、责任人网格员
ASSERT(len(d['ramps'][0].get('status_history', [])) >= 1,
       "坡道有处理历史记录")
first_hist = d['ramps'][0]['status_history'][0]
ASSERT(first_hist['action'] == "初次巡查建档", f"第1步历史是初次巡查建档（实际：{first_hist.get('action')}）")
ASSERT(first_hist['responsible_role'] == "网格员", f"初始责任人是网格员（实际：{first_hist.get('responsible_role')}）")
ASSERT(d['suggestions'][0]['responsible_role'] == "网格员",
       f"初始建议责任人是网格员（实际：{d['suggestions'][0].get('responsible_role')}）")
print(f"\n   初始责任人：{d['suggestions'][0]['responsible_role']}")
print(f"   初始还缺：{d['suggestions'][0]['missing_materials']}")
print(f"   初始已提供：{d['suggestions'][0].get('provided_materials', [])}")

# ============ 阶段2：CLI 坡道补录（评分无变化→ESCALATED） ============
print("\n--- 阶段2：CLI 坡道补录（关键词：已拍3张照片、约25辆）---")
note = "社区书记周姐复核：已拍3张照片，约25辆单车，仍堵入口，暂无可设停放区"
r = run(['python3','cli.py','supplement-ramp', case_id, ramp_id, '--note', note])
ASSERT(r.returncode == 0, "CLI 坡道补录成功")
ASSERT("评分无变化" in r.stdout and "转交通协管" in r.stdout,
       "评分无变化 → 自动转交通协管")

with open(fp, encoding='utf-8') as f:
    d1 = json.load(f)

# 阶段2断言
ASSERT(d1['ramps'][0]['review_status'] == "转交通协管",
       f"坡道复核状态=转交通协管（实际：{d1['ramps'][0].get('review_status')}）")
ASSERT(d1['suggestions'][0]['responsible_role'] == "交通协管",
       f"补录后责任人=交通协管（实际：{d1['suggestions'][0].get('responsible_role')}）")
ASSERT("交通协管现场勘查记录" in d1['suggestions'][0]['missing_materials'],
       "缺交通协管现场勘查记录")
# 关键词消缺
provided = d1['suggestions'][0].get('provided_materials', [])
ASSERT("坡道现场照片" in provided, f"补录关键词「已拍」→ 坡道现场照片已提供（实际：{provided}）")
ASSERT("共享单车实际停放数量统计" in provided, f"补录关键词「约25辆」→ 停放数量统计已提供")
# 历史记录
hist = d1['ramps'][0].get('status_history', [])
ASSERT(len(hist) >= 2, f"历史记录至少2条（实际{len(hist)}）")
ASSERT(hist[1]['action'] == "坡道补录", f"第2步是坡道补录（实际：{hist[1].get('action')}）")
ASSERT(hist[1]['responsible_role'] == "交通协管",
       f"补录后责任人转交通协管（实际：{hist[1].get('responsible_role')}）")
ASSERT(hist[1]['score_changed'] is False,
       "补录后评分无变化标记正确")

# ============ 阶段3：API 读取含坡道案件 ============
print("\n--- 阶段3：API _load_case 读取（之前 NameError 的点）---")
from api import _load_case, _save_case
try:
    case = _load_case(case_id)
    ASSERT(True, "API _load_case 读取不断裂")
    ASSERT(len(case.ramps) == 1, f"API读到坡道数=1（实际{len(case.ramps)}）")
    ASSERT(len(case.suggestions) == 1, f"API读到建议数=1（实际{len(case.suggestions)}）")
    ASSERT(case.ramps[0].review_status.value == "转交通协管",
           f"API 坡道状态=转交通协管（实际：{case.ramps[0].review_status.value}）")
    provided_api = getattr(case.suggestions[0], 'provided_materials', [])
    ASSERT("坡道现场照片" in provided_api, "API 侧 provided_materials 正确读取")
    hist_api = getattr(case.ramps[0], 'status_history', [])
    ASSERT(len(hist_api) >= 2, "API 侧 status_history 正确读取")
except Exception as e:
    ASSERT(False, f"API _load_case 断裂：{type(e).__name__}: {e}")

# ============ 阶段4：CLI 导入书记已审阅施工告示 → 责任人应切社区书记 ============
print("\n--- 阶段4：CLI 导入书记已审阅施工告示（责任人应切社区书记）---")
r = run(['python3','cli.py','import-notice', case_id, '--json', 'samples/notice.json', '--reviewed'])
ASSERT(r.returncode == 0, "CLI 导入施工告示成功")

with open(fp, encoding='utf-8') as f:
    d2 = json.load(f)

# 关键断言：施工告示 + 书记审阅 → ESCALATED 坡道从交通协管切到社区书记协调
ASSERT(d2['suggestions'][0]['responsible_role'] == "社区书记周姐",
       f"导入书记审阅告示后责任人=社区书记周姐（实际：{d2['suggestions'][0].get('responsible_role')}）")
# 还缺应变成施工相关的材料（清理计划/临时停放/协调记录等）
missing = d2['suggestions'][0]['missing_materials']
ASSERT("施工结束后的清理计划" in missing,
       f"导入告示后还缺含施工清理计划（实际：{missing}）")
ASSERT("临时停放点设置方案" in missing,
       f"导入告示后还缺含临时停放方案（实际：{missing}）")
ASSERT("交通协管现场勘查记录" not in missing,
       "切到社区书记后，不再缺交通协管勘查记录")
# 已提供应包含施工告示的材料
provided_after = d2['suggestions'][0].get('provided_materials', [])
ASSERT("现场说法记录" in provided_after,
       f"已提供含现场说法记录（实际：{provided_after}）")
ASSERT("社区书记审阅签字" in provided_after,
       "已提供含社区书记审阅签字")
ASSERT("施工告示原件" in provided_after,
       "已提供含施工告示原件")
# 历史记录应有第3条：导入施工告示
hist_after = d2['ramps'][0].get('status_history', [])
ASSERT(len(hist_after) >= 3, f"历史记录至少3条（实际{len(hist_after)}）")
ASSERT(hist_after[2]['action'] == "导入施工告示",
       f"第3步是导入施工告示（实际：{hist_after[2].get('action')}）")
ASSERT(hist_after[2]['reviewed_by_secretary'] is True,
       "标记书记已审阅")
ASSERT(hist_after[2]['responsible_role'] == "社区书记周姐",
       f"责任人转社区书记周姐（实际：{hist_after[2].get('responsible_role')}）")

# ============ 阶段5：API 再次读取重载 ============
print("\n--- 阶段5：API 再次读取重载（含新字段/历史）---")
try:
    case2 = _load_case(case_id)
    ASSERT(True, "API 重载不断裂")
    ASSERT(case2.suggestions[0].responsible_role.value == "社区书记周姐",
           f"API 重载责任人=社区书记周姐（实际：{case2.suggestions[0].responsible_role.value}）")
    provided2 = getattr(case2.suggestions[0], 'provided_materials', [])
    ASSERT("现场说法记录" in provided2, "API 重载 provided_materials 含现场说法")
    trace2 = getattr(case2.suggestions[0], 'evidence_trace', [])
    ASSERT(len(trace2) >= 3, f"API 重载 evidence_trace 至少3条（实际{len(trace2)}）")
    hist2 = getattr(case2.ramps[0], 'status_history', [])
    ASSERT(len(hist2) >= 3, "API 重载 status_history 至少3条")
except Exception as e:
    ASSERT(False, f"API 重载断裂：{type(e).__name__}: {e}")

# ============ 阶段6：生成文本报告（含处理历史 + 材料对账 + 证据#追溯） ============
print("\n--- 阶段6：CLI report 文本报告（全字段核对）---")
r = run(['python3','cli.py','report', case_id])
ASSERT(r.returncode == 0, "CLI report 成功")
report_text = r.stdout
# 文本报告关键内容
ASSERT("🕓 处理历史" in report_text or "处理历史" in report_text,
       "文本报告含处理历史")
ASSERT("初次巡查建档" in report_text, "历史显示第1步：初次巡查建档")
ASSERT("坡道补录" in report_text, "历史显示第2步：坡道补录")
ASSERT("导入施工告示" in report_text, "历史显示第3步：导入施工告示")
ASSERT("责任人→网格员" in report_text, "历史含责任人从网格员开始")
ASSERT("责任人→交通协管" in report_text, "历史含责任人转交通协管")
ASSERT("责任人→社区书记周姐" in report_text, "历史含责任人转社区书记")
ASSERT("✅ 已提供" in report_text, "文本报告含已提供材料")
ASSERT("❌ 还缺" in report_text, "文本报告含还缺材料")
ASSERT("证据#" in report_text, "文本报告含证据#追溯编号")
ASSERT("先服务复核" in report_text, "文本报告含先服务复核提示")

# ============ 阶段7：生成 HTML 报告 ============
print("\n--- 阶段7：CLI report --format html（核对已提供/证据#/历史）---")
html_path = os.path.join('output', f'final_report_{case_id}.html')
r = run(['python3','cli.py','report', case_id, '--format', 'html', '--output', html_path])
ASSERT(r.returncode == 0, "CLI report HTML 成功")
ASSERT(os.path.exists(html_path), f"HTML 文件已生成：{html_path}")
with open(html_path, encoding='utf-8') as f:
    html = f.read()
# HTML 关键字段
ASSERT("已提供" in html, "HTML 报告含已提供材料")
ASSERT("还缺" in html, "HTML 报告含还缺材料")
ASSERT("证据#" in html, "HTML 报告含证据#编号")
ASSERT("处理历史" in html, "HTML 报告含处理历史")
ASSERT("初次巡查建档" in html, "HTML 历史第1步：初次巡查建档")
ASSERT("坡道补录" in html, "HTML 历史第2步：坡道补录")
ASSERT("导入施工告示" in html, "HTML 历史第3步：导入施工告示")
ASSERT("先服务复核" in html, "HTML 含先服务复核")
ASSERT("临时停放点设置方案" in html, "HTML 还缺材料里有临时停放方案")

# ============ 阶段8：API 侧 save → load 验证持久化完整 ============
print("\n--- 阶段8：API _save_case → _load_case 往返验证 ---")
try:
    case2.ramps[0].provided_materials.append("测试往返标记")
    _save_case(case2)
    case3 = _load_case(case_id)
    ASSERT("测试往返标记" in case3.ramps[0].provided_materials,
           "API 读写往返 provided_materials 正确")
    ASSERT(len(getattr(case3.ramps[0], 'status_history', [])) >= 3,
           "API 读写往返 status_history 正确")
    ASSERT(getattr(case3.suggestions[0], 'evidence_trace', []),
           "API 读写往返 evidence_trace 正确")
except Exception as e:
    ASSERT(False, f"API 往返断裂：{type(e).__name__}: {e}")

# ============ 总结 ============
print("\n" + "="*70)
print("🎉 最终验证：所有核对点通过")
print("="*70)
checks = [
    "CLI 创建 + 导入巡查表（历史记录 + 初始责任人）",
    "CLI 坡道补录（评分无变化→ESCALATED + 关键词消缺）",
    "API 读取含坡道案件（不断裂 + 新字段全读取）",
    "CLI 导入书记审阅施工告示 → 责任人切社区书记周姐 + 还缺材料切换为施工相关",
    "API 重载（责任人 + provided_materials + evidence_trace + status_history）",
    "CLI report 文本报告：处理历史3步 + 材料对账 + 证据#追溯 + 先服务复核",
    "CLI report HTML：已提供/还缺/证据#/处理历史/先服务复核/临时停放方案",
    "API save→load 往返：新字段完整不丢失",
]
for i, c in enumerate(checks, 1):
    print(f"  {i}. ☑️  {c}")

print(f"\n📁 案件文件：{fp}")
print(f"📄 文本报告：python3 cli.py report {case_id}")
print(f"📄 HTML报告：{html_path}（可用浏览器直接打开）")
print(f"\n🚀 新人快速上手：rm -rf data output && python3 demo.py")
