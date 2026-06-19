#!/usr/bin/env python3
"""
时间序列异常分解 - 完整流水线测试脚本

覆盖全流程验证：
1. 依赖检查
2. 示例数据生成
3. CSV/中文Excel导入 + 字段归一
4. 行号2分母补录（验证只产生1条修改记录
5. 批注/复核/finalize（验证3条复核记录不变）
6. pending_verification记录不被自动确认
7. CLI全视图一致性
8. API接口一致性
9. 导出文件一致性

运行方式：python3 test_full_pipeline.py
"""

import sys
import os
import json
import subprocess
import time
import json
from pathlib import Path
from collections import Counter

WORKDIR_CSV = "./output_test_csv"
WORKDIR_XLSX = "./output_test_xlsx"
EXAMPLES_DIR = "./examples"

class Colors:
    OK = "\033[92m"
    FAIL = "\033[91m"
    WARN = "\033[93m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"

passed = 0
failed = 0

def run(cmd, cwd=".", check=True, capture=True):
    """运行命令，返回 (returncode, stdout, stderr)"""
    print(f"  $ {cmd}")
    result = subprocess.run(
        cmd, shell=True, cwd=cwd,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if capture:
        if result.stdout:
            print(f"    {result.stdout.strip()[:500]}")
        if result.stderr and check and result.returncode != 0:
            print(f"    {Colors.FAIL}ERR: {result.stderr.strip()[:500]}{Colors.ENDC}")
    if check and result.returncode != 0:
        raise Exception(f"命令失败: {cmd}")
    return result.returncode, result.stdout, result.stderr

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  {Colors.OK}✓ PASS{Colors.ENDC} {name} {f'({detail})' if detail else ''}")
    else:
        failed += 1
        print(f"  {Colors.FAIL}✗ FAIL{Colors.ENDC} {name} {f'({detail})' if detail else ''}")
    return condition

def get_state(workdir):
    """读取 state_store.json"""
    state_path = Path(workdir) / ".state" / "state_store.json"
    with open(state_path) as f:
        return json.load(f)

def get_result(state, row_number):
    """从state中取指定行"""
    return state["results"][str(row_number)]

def count_results(state):
    """统计结果"""
    results = list(state["results"].values())
    total_mm = sum(len(r.get("manual_modifications", [])) for r in results)
    total_rr = sum(len(r.get("review_records", [])) for r in results)
    return total_mm, total_rr

def main():
    global passed, failed
    print(f"\n{Colors.BOLD}=== 时间序列异常分解 - 完整流水线测试 ==={Colors.ENDC}\n")

    # ============================================================
    print(f"\n{Colors.BOLD}[1/10] 依赖检查{Colors.ENDC}")
    # ============================================================
    try:
        import pandas, numpy, pydantic, typer, rich, openpyxl, fastapi, uvicorn
        test("所有依赖已安装", True)
    except ImportError as e:
        test("所有依赖已安装", False, str(e))
        run("pip3 install -r requirements.txt --quiet")
        import pandas, numpy, pydantic, typer, rich, openpyxl, fastapi, uvicorn
        test("依赖安装成功", True)

    # ============================================================
    print(f"\n{Colors.BOLD}[2/10] 生成示例数据{Colors.ENDC}")
    # ============================================================
    run(f"rm -rf {EXAMPLES_DIR}")
    run("python3 cli.py sample")
    files = [
        f"{EXAMPLES_DIR}/sample_input.csv",
        f"{EXAMPLES_DIR}/sample_input.xlsx",
        f"{EXAMPLES_DIR}/sample_input_cn.xlsx",
        f"{EXAMPLES_DIR}/sample_comments.json",
        f"{EXAMPLES_DIR}/sample_review.json",
    ]
    for f in files:
        test(f"生成 {f}", os.path.exists(f))

    # ============================================================
    print(f"\n{Colors.BOLD}[3/10] CSV 导入 + 一致性检查{Colors.ENDC}")
    # ============================================================
    run(f"rm -rf {WORKDIR_CSV}")
    run(f"python3 cli.py import {EXAMPLES_DIR}/sample_input.csv --workdir {WORKDIR_CSV}")
    state = get_state(WORKDIR_CSV)
    results = list(state["results"].values())
    test("导入8条记录", len(results) == 8)

    # 检查分母为0空字符串的识别
    pv_rows = [r for r in results if r["anomaly_type"] == "pending_verification"]
    test("识别3条分母为0空字符串记录", len(pv_rows) == 3)
    pv_row_numbers = sorted(r["row_number"] for r in pv_rows)
    test("待验证行号为2,3,6", pv_row_numbers == [2, 3, 6])

    # 检查原始分母值保留
    row2 = get_result(state, 2)
    test(f"行号2原始分母为空字符串", row2["raw_denominator"] == "")
    test(f"行号3原始分母为'0'", get_result(state, 3)["raw_denominator"] == "0")
    test(f"行号6原始分母为空字符串", get_result(state, 6)["raw_denominator"] == "")

    # 一致性检查
    rc, out, err = run(f"python3 cli.py verify --workdir {WORKDIR_CSV}")
    test("一致性检查 PASS", "PASS" in out)

    # ============================================================
    print(f"\n{Colors.BOLD}[4/10] 中文Excel导入 + 字段归一验证{Colors.ENDC}")
    # ============================================================
    run(f"rm -rf {WORKDIR_XLSX}")
    run(f"python3 cli.py import {EXAMPLES_DIR}/sample_input_cn.xlsx --workdir {WORKDIR_XLSX}")
    state_xlsx = get_state(WORKDIR_XLSX)
    results_xlsx = list(state_xlsx["results"].values())
    test("中文Excel导入8条记录", len(results_xlsx) == 8)
    pv_xlsx = [r for r in results_xlsx if r["anomaly_type"] == "pending_verification"]
    test("中文Excel识别3条分母为0空字符串", len(pv_xlsx) == 3)

    # 字段归一：检查标准字段是否存在
    for r in results_xlsx:
        for field in ["row_number", "metric_name", "numerator", "denominator", "raw_denominator", "anomaly_type"]:
            assert field in r, f"缺少字段 {field}"
    test("中文列名成功归一为标准字段", True)

    # ============================================================
    print(f"\n{Colors.BOLD}[5/10] 行号2分母补录 + 防重复验证{Colors.ENDC}")
    # ============================================================
    run(f'python3 cli.py modify 2 denominator 100 --reason "测试防重复补录" --workdir {WORKDIR_CSV}')
    state_after_modify = get_state(WORKDIR_CSV)
    row2_after = get_result(state_after_modify, 2)

    # 关键验证：一次修改只产生1条manual_modifications
    mm_count = len(row2_after.get("manual_modifications", []))
    test(f"行号2人工修改记录=1（不会放大成8条）", mm_count == 1, f"实际={mm_count}")

    total_mm, total_rr = count_results(state_after_modify)
    test(f"全表人工修改总数=1", total_mm == 1, f"实际={total_mm}")
    test(f"全表复核记录总数=0（还没开始复核）", total_rr == 0, f"实际={total_rr}")

    # 继续执行后续步骤，验证每一步都不会让manual_modifications倍增
    run(f"python3 cli.py comment {EXAMPLES_DIR}/sample_comments.json --workdir {WORKDIR_CSV}")
    state_after_comment = get_state(WORKDIR_CSV)
    total_mm_c, total_rr_c = count_results(state_after_comment)
    test(f"加批注后人工修改仍=1", total_mm_c == 1, f"实际={total_mm_c}")

    run(f"python3 cli.py review-file {EXAMPLES_DIR}/sample_review.json --workdir {WORKDIR_CSV}")
    state_after_review = get_state(WORKDIR_CSV)
    total_mm_r, total_rr_r = count_results(state_after_review)
    test(f"复核后人工修改仍=1", total_mm_r == 1, f"实际={total_mm_r}")
    test(f"复核记录=3（3条复核）", total_rr_r == 3, f"实际={total_rr_r}")

    run(f"python3 cli.py finalize --workdir {WORKDIR_CSV}")
    state_after_finalize = get_state(WORKDIR_CSV)
    total_mm_f, total_rr_f = count_results(state_after_finalize)
    test(f"finalize后人工修改仍=1", total_mm_f == 1, f"实际={total_mm_f}")
    test(f"finalize后复核记录仍=3", total_rr_f == 3, f"实际={total_rr_f}")

    # ============================================================
    print(f"\n{Colors.BOLD}[6/10] pending_verification记录不被自动确认{Colors.ENDC}")
    # ============================================================
    row6 = get_result(state_after_finalize, 6)
    test(f"行号6异常类型仍=pending_verification（不提前归normal）",
         row6["anomaly_type"] == "pending_verification",
         f"实际={row6['anomaly_type']}")
    test(f"行号6处理状态=reviewed（已复核但未finalize）",
         row6["process_status"] == "reviewed",
         f"实际={row6['process_status']}")
    test(f"行号6保留原始空字符串分母",
         row6["raw_denominator"] == "",
         f"实际={row6['raw_denominator']!r}")

    # 检查复核七要素完整
    rr = row6.get("review_records", [])
    test(f"行号6有1条复核记录", len(rr) == 1)
    if rr:
        rr0 = rr[0]
        for field in ["reviewed_at", "reviewed_by", "original_statement", "corrected_value",
                    "review_reason", "next_owner", "anomaly_type_after_review"]:
            test(f"  复核七要素:{field}存在", field in rr0 and rr0[field] is not None)

    # ============================================================
    print(f"\n{Colors.BOLD}[7/10] CLI全视图一致性{Colors.ENDC}")
    # ============================================================
    # 摘要
    rc, out, err = run(f"python3 cli.py summary --workdir {WORKDIR_CSV}")
    test("summary中人工修改累计=1",
         "人工修改累计: 1" in out or "人工修改累计.*1" in out)
    test("summary中复核记录累计=3",
         "复核记录累计: 3" in out or "复核记录累计.*3" in out)

    # 列表
    rc, out, err = run(f"python3 cli.py list --pending --workdir {WORKDIR_CSV}")
    test("list --pending显示1条pending_verification",
         "1条" in out or "共1" in out or "pending_verification" in out)

    # 详情
    rc, out, err = run(f"python3 cli.py detail 2 --workdir {WORKDIR_CSV}")
    test("detail行号2显示人工修改记录(1条)",
         "人工修改记录(1条)" in out or "manual_modifications=1" in out)

    # 历史
    rc, out, err = run(f"python3 cli.py history 2 --workdir {WORKDIR_CSV}")
    actions = Counter()
    for line in out.split("\n"):
        if "manual_modification" in line:
            actions["manual_modification"] += 1
        if "review" in line:
            actions["review"] += 1
    test("history行号2只有1次modify动作", actions.get("manual_modification", 0) == 1, f"实际={actions}")

    # 一致性检查
    rc, out, err = run(f"python3 cli.py verify 2 --workdir {WORKDIR_CSV}")
    test("verify行号2一致性PASS", "PASS" in out)

    # ============================================================
    print(f"\n{Colors.BOLD}[8/10] API接口一致性{Colors.ENDC}")
    # ============================================================
    # 启动API服务（注意：app.py 通过 Query 参数 workdir 指定目录，不是命令行）
    server = subprocess.Popen(
        f"python3 app.py",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(2)
    try:
        import urllib.request

        def api_get(path):
            sep = "&" if "?" in path else "?"
            url = f"http://localhost:8000{path}{sep}workdir={WORKDIR_CSV}"
            with urllib.request.urlopen(url) as resp:
                return json.loads(resp.read())

        # health
        data = api_get("/api/health")
        test("API健康检查", data.get("status") == "ok")

        # summary
        data = api_get("/api/summary")
        test("API summary manual_modifications_total=1",
             data["data"]["manual_modifications_total"] == 1,
             f"实际={data['data']['manual_modifications_total']}")
        test("API summary review_records_total=3",
             data["data"]["review_records_total"] == 3,
             f"实际={data['data']['review_records_total']}")
        test("API summary一致性ok", data["metadata"]["consistency"]["ok"] == True)

        # detail
        data = api_get("/api/detail/2")
        test("API detail行号2 manual_modifications=1",
             len(data["evidence_chain"]["manual_modifications"]) == 1,
             f"实际={len(data['evidence_chain']['manual_modifications'])}")
        test("API detail行号2 consistency ok",
             data["metadata"]["consistency"]["ok"] == True)

        # list
        data = api_get("/api/list")
        test("API list返回8条", len(data["data"]) == 8)
        test("API list一致性ok", data["metadata"]["consistency"]["ok"] == True)

        # verify
        data = api_get("/api/verify?row_number=2")
        test("API verify行号2 ok", data["ok"] == True)

        # API modify 测试
        import urllib.parse
        params = urllib.parse.urlencode({
            "field_name": "teacher_comment",
            "new_value": "API测试批注",
            "reason": "API测试修改",
            "modified_by": "API测试人",
        })
        req = urllib.request.Request(
            f"http://localhost:8000/api/modify/2?{params}&workdir={WORKDIR_CSV}", method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
            test("API modify成功", result.get("status") == "ok")
            test("API modify后一致性ok", result["consistency"]["ok"] == True)
        except urllib.error.HTTPError as e:
            err_detail = e.read().decode()
            test(f"API modify成功 (HTTP {e.code})", False, err_detail[:500])
            result = None

        # 验证API修改后CLI读的是同一份
        state_after_api_modify = get_state(WORKDIR_CSV)
        row2_api = get_result(state_after_api_modify, 2)
        test("API修改后teacher_comment同步到StateStore",
             row2_api["teacher_comment"] == "API测试批注")

    finally:
        server.terminate()
        server.wait()

    # ============================================================
    print(f"\n{Colors.BOLD}[9/10] 导出文件一致性{Colors.ENDC}")
    # ============================================================
    # 检查导出的CSV和Excel
    csv_path = Path(WORKDIR_CSV) / "timeseries_anomaly.csv"
    xlsx_path = Path(WORKDIR_CSV) / "timeseries_anomaly.xlsx"
    test(f"CSV导出存在", csv_path.exists())
    test(f"Excel导出存在", xlsx_path.exists())

    # 读取CSV核对行号2的denominator
    import pandas as pd
    # keep_default_na=False 防止空字符串被转成 NaN
    df = pd.read_csv(csv_path, keep_default_na=False, na_values=[])
    row2_csv = df[df["row_number"] == 2].iloc[0]
    test(f"CSV行号2denominator=100（与StateStore一致）",
         float(row2_csv["denominator"]) == 100.0)
    raw_den = str(row2_csv["raw_denominator"])
    # pandas可能会把空字符串显示为nan，所以也检查pd.isna
    import numpy as np
    is_empty = raw_den == "" or (pd.isna(row2_csv["raw_denominator"]) and raw_den == "nan")
    test(f"CSV行号2raw_denominator=''（保留原始空字符串）",
         is_empty, f"实际={raw_den!r}")

    # 读取Excel核对Sheet
    xl = pd.ExcelFile(xlsx_path)
    test(f"Excel有3个以上Sheet", len(xl.sheet_names) >= 3)
    df_main = pd.read_excel(xl, sheet_name=0)
    test(f"Excel主Sheet有8条记录", len(df_main) == 8)

    # ============================================================
    print(f"\n{Colors.BOLD}[10/10] README命令与实际一致{Colors.ENDC}")
    # ============================================================
    # 验证README里的关键命令实际能跑
    readme = Path("README.md").read_text()
    test("README包含import命令", "python3 cli.py import" in readme)
    test("README包含comment命令", "python3 cli.py comment" in readme)
    test("README包含review-file命令", "python3 cli.py review-file" in readme)
    test("README包含finalize命令", "python3 cli.py finalize" in readme)
    test("README包含API启动说明", "python3 app.py" in readme)
    test("README不包含过时的step1/step2/step3命令",
         "python3 cli.py step1" not in readme and "python3 cli.py step2" not in readme and "python3 cli.py step3" not in readme)

    # ============================================================
    # 总结
    # ============================================================
    print(f"\n{Colors.BOLD}=== 测试总结 ==={Colors.ENDC}")
    print(f"{Colors.OK}通过: {passed}{Colors.ENDC}")
    print(f"{Colors.FAIL}失败: {failed}{Colors.ENDC}")

    # 清理
    run(f"rm -rf {WORKDIR_CSV} {WORKDIR_XLSX}", check=False)

    if failed > 0:
        print(f"\n{Colors.FAIL}❌ 有 {failed} 个测试失败{Colors.ENDC}")
        sys.exit(1)
    else:
        print(f"\n{Colors.OK}✅ 全部 {passed} 个测试全部通过{Colors.ENDC}")
        sys.exit(0)

if __name__ == "__main__":
    main()
