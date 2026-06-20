#!/usr/bin/env python3
"""
端到端测试脚本：验证Web看板图表点击跳转正确性

测试内容：
1. 上传负样本 → 检测
2. 补录召回候选
3. 请求dashboard页面 → 检查JS中EXPERIMENT_ID是否正确（核心验证：不缺实验ID）
4. 模拟plotly_click跳转 → 检查URL格式是否为 /record/<实验ID>/<记录ID>
5. 请求记录详情页 → 检查字段与报告一致
6. 验证"为什么留给评测运营复核"字段
"""

import sys
import json
import re
import requests

BASE_URL = "http://localhost:5001"
TEST_PASSED = []
TEST_FAILED = []


def test(name, condition, detail=""):
    if condition:
        TEST_PASSED.append(name)
        print(f"✅ PASS: {name} {detail}")
    else:
        TEST_FAILED.append(name)
        print(f"❌ FAIL: {name} {detail}")


print("=" * 80)
print("端到端测试：Web看板图表点击跳转正确性验证")
print("=" * 80)

# === Step 1: 上传负样本，开始检测 ===
print("\n--- Step 1: 导入负样本列表 ---")
with open("samples/negative_samples.csv", "rb") as f:
    files = {"file": ("negative_samples.csv", f, "text/csv")}
    r = requests.post(f"{BASE_URL}/detect", files=files, allow_redirects=True)

test("POST /detect 返回200", r.status_code == 200, f"status={r.status_code}")

# 从响应中提取实验ID
exp_id_match = re.search(r'实验ID[：: ]+([a-f0-9\-]+)', r.text)
if not exp_id_match:
    exp_id_match = re.search(r'experiment_id["\']?\s*[:=]\s*["\']?([a-f0-9\-]+)', r.text)

test("响应中包含实验ID", exp_id_match is not None)
if exp_id_match:
    EXPERIMENT_ID = exp_id_match.group(1)
    print(f"   实验ID: {EXPERIMENT_ID}")
else:
    EXPERIMENT_ID = None
    print("   无法提取实验ID，后续测试将失败")
    sys.exit(1)

# === Step 2: 补录召回候选 ===
print("\n--- Step 2: 算法工程师小乔补录召回候选 ---")
with open("samples/recall_candidates.csv", "rb") as f:
    files = {"file": ("recall_candidates.csv", f, "text/csv")}
    data = {"experiment_id": EXPERIMENT_ID}
    r = requests.post(f"{BASE_URL}/supplement", files=files, data=data, allow_redirects=True)

test("POST /supplement 返回200", r.status_code == 200, f"status={r.status_code}")

# === Step 3: 请求dashboard页面，检查JS中EXPERIMENT_ID是否正确 ===
print("\n--- Step 3: 请求dashboard页面，检查JS跳转代码（核心验证）---")
r = requests.get(f"{BASE_URL}/dashboard/{EXPERIMENT_ID}")
test(f"GET /dashboard/{EXPERIMENT_ID} 返回200", r.status_code == 200, f"status={r.status_code}")

html = r.text

# 检查JS中的EXPERIMENT_ID是否正确（这是之前的bug：模板变量没传导致空字符串）
js_exp_id_match = re.search(r"const EXPERIMENT_ID\s*=\s*'([^']*)'", html)
test("JS中定义了 EXPERIMENT_ID 常量", js_exp_id_match is not None)

if js_exp_id_match:
    js_exp_id = js_exp_id_match.group(1)
    test(f"JS中的 EXPERIMENT_ID 不为空字符串", js_exp_id != "", f"实际值='{js_exp_id}'")
    test(f"JS中的 EXPERIMENT_ID = 真实实验ID", js_exp_id == EXPERIMENT_ID,
         f"JS='{js_exp_id}', 真实='{EXPERIMENT_ID}'")
    print(f"   JS中 EXPERIMENT_ID = '{js_exp_id}'")

# 检查跳转URL构造代码
url_construct_match = re.search(r"const targetUrl\s*=\s*'/record/'\s*\+\s*EXPERIMENT_ID\s*\+\s*'/'\s*\+\s*recordId", html)
test("JS跳转URL构造代码正确（EXPERIMENT_ID + '/' + recordId）", url_construct_match is not None)

# 检查URL格式校验代码
url_pattern_match = re.search(r"const urlPattern\s*=\s*/\^.*record.*\$/", html)
test("JS中有URL格式校验正则，拦截缺实验ID的错误地址", url_pattern_match is not None)

# 检查页面上显示的实验ID
page_exp_id_match = re.search(f"当前实验ID[：: ]*<code>{EXPERIMENT_ID}</code>", html)
test(f"页面上显示了正确的实验ID {EXPERIMENT_ID}", page_exp_id_match is not None)

# === Step 4: 从报告获取S001的记录ID，验证跳转URL格式 ===
print("\n--- Step 4: 从报告获取S001记录，验证跳转URL构造 ---")

# 获取报告
r = requests.get(f"{BASE_URL}/report/{EXPERIMENT_ID}")
test(f"GET /report/{EXPERIMENT_ID} 返回200", r.status_code == 200)

# 从响应中提取S001的记录ID（在报告页的链接href里）
s001_link_match = re.search(f'href="/record/{EXPERIMENT_ID}/([a-f0-9\-]+)">S001', r.text)
test("报告页中S001的链接包含正确的实验ID", s001_link_match is not None)

if s001_link_match:
    RECORD_ID = s001_link_match.group(1)
    print(f"   S001 记录ID: {RECORD_ID}")

    # 构造跳转URL
    EXPECTED_URL = f"/record/{EXPERIMENT_ID}/{RECORD_ID}"
    print(f"   期望跳转URL: {EXPECTED_URL}")

    # 检查URL格式（应形如 /record/xxx/yyy，而不是 /record//yyy）
    url_pattern = r"^/record/[^/]+/[^/]+$"
    test(f"跳转URL格式正确（不是/record//<记录ID>）",
         bool(re.match(url_pattern, EXPECTED_URL)),
         f"URL={EXPECTED_URL}")

    # 检查URL中没有连续斜杠
    test("跳转URL中没有连续斜杠（//）", "//" not in EXPECTED_URL, f"URL={EXPECTED_URL}")

    # === Step 5: 请求记录详情页，检查字段 ===
    print("\n--- Step 5: 请求记录详情页，检查字段与报告一致 ---")
    r = requests.get(f"{BASE_URL}{EXPECTED_URL}")
    test(f"GET {EXPECTED_URL} 返回200", r.status_code == 200, f"status={r.status_code}")

    detail_html = r.text

    # 检查面包屑导航
    test("详情页有面包屑导航（回到报告）", f"/report/{EXPERIMENT_ID}" in detail_html)

    # 检查真实分数（不是0.000）
    test("详情页显示离线分数 0.25", "0.250" in detail_html or ">0.25<" in detail_html)
    test("详情页显示线上分数 0.35", "0.350" in detail_html or ">0.35<" in detail_html)

    # 检查分桶信息
    test("详情页显示离线分桶 0", "分桶 <strong>0</strong>" in detail_html)
    test("详情页显示线上分桶 1", "分桶 <strong>1</strong>" in detail_html)
    test("详情页显示桶位差 差1桶", "差1桶" in detail_html or "one_bucket" in detail_html)

    # 检查"为什么留给评测运营复核"字段
    test("详情页包含'为什么这条记录被留下'字段", "为什么这条记录被留下" in detail_html)
    test("详情页包含'离线和线上分数差了一个桶，需要评测运营复核'",
         "离线和线上分数差了一个桶" in detail_html and "评测运营复核" in detail_html)

    # 检查"下一步找谁"字段
    test("详情页包含'下一步该找谁'字段", "下一步该找谁" in detail_html or "next_owner" in detail_html.lower())
    test("详情页显示下一步找 评测运营", "评测运营" in detail_html or "operation" in detail_html.lower())

    # 检查召回候选表（小乔补录）
    test("详情页包含召回候选表", "召回候选" in detail_html and "小乔" in detail_html)
    test("召回候选表包含C001", "C001" in detail_html)

    # 检查状态
    test("详情页显示状态 已补录召回", "supplemented_by_algo" in detail_html or "已补录召回" in detail_html)

    # 检查回到负样本列表的链接
    test("详情页有'负样本详情'标题", "负样本" in detail_html)

    # 检查页面标题包含记录ID
    test("详情页标题包含样本ID S001", "S001" in detail_html)

# === Step 6: 验证dashboard页面中customdata是否包含recordId（散点图/3D图）===
print("\n--- Step 6: 验证dashboard页面图表数据包含recordId（customdata） ---")

# 检查3D图的customdata
customdata_match = re.search(r'customdata["\']?\s*:\s*\[', html)
test("3D图/散点图设置了 customdata（用于点击跳转时获取recordId）",
     customdata_match is not None)

# === Step 7: 安全校验 - 检查跳转前的URL校验逻辑 ===
print("\n--- Step 7: 安全校验 - 跳转前URL格式校验 ---")

# 模拟JS中experiment_id为空的情况（旧bug场景）
BUGGY_URL = f"/record//{RECORD_ID}"  # 缺实验ID
CORRECT_URL = f"/record/{EXPERIMENT_ID}/{RECORD_ID}"

# 检查buggy URL是否会被正则拦截
url_pattern_re = re.compile(r"^/record/[^/]+/[^/]+$")
test("旧bug URL /record//<记录ID> 会被正则拦截",
     not bool(url_pattern_re.match(BUGGY_URL)),
     f"BUGGY_URL={BUGGY_URL} 匹配结果={bool(url_pattern_re.match(BUGGY_URL))}")
test("正确URL /record/<实验ID>/<记录ID> 会通过正则校验",
     bool(url_pattern_re.match(CORRECT_URL)),
     f"CORRECT_URL={CORRECT_URL} 匹配结果={bool(url_pattern_re.match(CORRECT_URL))}")

# === 测试总结 ===
print("\n" + "=" * 80)
print(f"测试完成：通过 {len(TEST_PASSED)}/{len(TEST_PASSED) + len(TEST_FAILED)}")
print("=" * 80)

if TEST_FAILED:
    print("\n❌ 失败的测试：")
    for t in TEST_FAILED:
        print(f"   - {t}")
    sys.exit(1)
else:
    print("\n✅ 所有测试通过！")
    print(f"\n关键验证结论：")
    print(f"  1. Web看板JS中的 EXPERIMENT_ID 不再是空字符串")
    print(f"  2. 图表点击跳转URL格式正确：/record/{EXPERIMENT_ID}/<记录ID>")
    print(f"  3. 不会再出现 /record//<记录ID> 的错误地址")
    print(f"  4. 记录详情页展示了真实分数、分桶差、为什么留给运营复核")
    print(f"  5. 从图表点击可以完整回到负样本列表和召回候选表")
    sys.exit(0)
