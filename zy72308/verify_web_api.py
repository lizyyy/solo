"""Web + HTTP API 端到端验证脚本
使用真实 HTTP 请求（不是内部方法）验证：
- Flask 服务器启动
- CSV / Excel 上传导入
- 列表页 / 详情页 / 参数页 返回 HTTP 200
- 补录 → 复核 → 重算 → 导出 JSON/CSV/TXT 全链路与 API 同源
- 参数版本页点击更新后版本号 +1
"""
import os
import io
import sys
import time
import json
import subprocess
import tempfile
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
BASE_URL = "http://127.0.0.1:5051"
DATA_DIR = ROOT / "data_web_test"


def clean():
    import shutil
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def start_server():
    env = os.environ.copy()
    env["RESIDUAL_DATA_DIR"] = str(DATA_DIR)
    proc = subprocess.Popen(
        [sys.executable, "-c", (
            "import os; from app import create_app; "
            "a = create_app(os.environ.get('RESIDUAL_DATA_DIR')); "
            "a.run(host='127.0.0.1', port=5051, debug=False, use_reloader=False)"
        )],
        cwd=str(ROOT), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    for _ in range(60):
        try:
            r = requests.get(f"{BASE_URL}/api/health", timeout=0.5)
            if r.status_code == 200 and r.json().get("status") == "ok":
                return proc
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError("Flask server failed to start in 30s")


def make_sample_csv(path: Path):
    path.write_text(
        "x,y\n1.0,2.1\n2.0,4.2\n3.0,5.9\n4.0,8.3\n5.0,10.3\n"
        "6.0,12.0\n7.0,14.2\n8.0,15.9\n9.0,18.1\n10.0,20.2\n",
        encoding="utf-8",
    )


def make_sample_xlsx(path: Path):
    import pandas as pd
    df = pd.DataFrame({"自变量": [1.0, 2.0, 3.0], "因变量": [2.2, 4.1, 5.8]})
    df.to_excel(path, index=False)


def wait_ok(url, timeout=8):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            r = requests.get(url, timeout=1)
            if r.status_code == 200:
                return r
        except Exception:
            pass
        time.sleep(0.3)
    raise RuntimeError(f"GET {url} timeout")


def check(cond, msg):
    if not cond:
        print(f"  ✘ {msg}")
        raise AssertionError(msg)
    print(f"  ✔ {msg}")


def main():
    print("=" * 70)
    print(" Web + HTTP API 端到端验证")
    print("=" * 70)

    clean()
    print("\n[启动] Flask 服务器 ...")
    proc = start_server()
    print("  ✔ 服务器启动成功, 健康检查 /api/health OK")

    try:
        # ===== 1. 页面可进入 =====
        print("\n[页面] 验证三个页面入口 HTTP 200")
        r_list = wait_ok(f"{BASE_URL}/")
        check(r_list.status_code == 200 and "复盘记录列表" in r_list.text,
              "列表页 / 可进入，标题正确")

        # ===== 2. 导入 CSV =====
        print("\n[导入] 上传 CSV 文件 → /api/import")
        csv_path = DATA_DIR / "sample.csv"
        make_sample_csv(csv_path)
        with open(csv_path, "rb") as f:
            files = {"file": ("sample_data.csv", f, "text/csv")}
            data = {"author": "阿岚", "source_name": "旧公式截图.csv"}
            r = requests.post(f"{BASE_URL}/api/import", files=files, data=data)
        check(r.status_code == 200, "CSV 导入返回 200")
        j = r.json()
        import_id = j["import_id"]
        dup = j["duplicate"]
        check(import_id.startswith("IMP") and not dup,
              f"CSV 导入成功, import_id={import_id}, duplicate=False")
        display_url = j["display_url"]
        params_url = j["params_url"]
        check(display_url and params_url,
              f"返回页面链接 display_url={display_url}, params_url={params_url}")

        # ===== 3. 列表 API 与列表页同源 =====
        print("\n[一致性] 列表页 / 与 /api/records 同源")
        r_api = requests.get(f"{BASE_URL}/api/records")
        recs_api = r_api.json()["records"]
        r_page = requests.get(f"{BASE_URL}/")
        check(r_api.status_code == 200 and any(x["导入ID"] == import_id for x in recs_api),
              "/api/records 包含刚导入的记录")
        check(import_id in r_page.text, "列表页 HTML 包含相同 import_id")

        # ===== 4. 详情页与 /api/records/<id> 同源 =====
        print(f"\n[一致性] 详情页 /record/{import_id} 与 /api/records/{import_id} 同源")
        r_api_d = requests.get(f"{BASE_URL}/api/records/{import_id}")
        api_d = r_api_d.json()
        r_page_d = requests.get(f"{BASE_URL}/record/{import_id}")
        check(r_api_d.status_code == 200 and r_page_d.status_code == 200,
              "API / 详情页均返回 200")
        check(f"v{api_d['参数版本']}" in r_page_d.text,
              f"详情页 HTML 显示相同参数版本 v{api_d['参数版本']}")
        check(str(api_d["总行数"]) in r_page_d.text,
              f"详情页显示相同总行数 {api_d['总行数']}")

        # ===== 5. 删除行5 → 产生断档 =====
        print("\n[动作] 删除行5 → 产生断档")
        r = requests.post(
            f"{BASE_URL}/api/records/{import_id}/delete_row",
            json={"line_no": 5, "reason": "老师批注截图缺行", "author": "阿岚"},
        )
        after_del = r.json()
        row5 = next(row for row in after_del["行明细"] if row["原始行号"] == 5)
        check(row5["状态标签"] == "断档（缺失）" and row5["是否参与计算"] == "否",
              f"删除后行5状态标签='{row5['状态标签']}', 参与计算='{row5['是否参与计算']}'")

        # ===== 6. 补录行5 (4.9, 9.8) → pending_review，不参与计算 =====
        print("\n[动作] 补录行5 x=4.9 y=9.8 → pending_review")
        r = requests.post(
            f"{BASE_URL}/api/records/{import_id}/supplement",
            json={"line_no": 5, "x_value": 4.9, "y_value": 9.8,
                  "reason": "老师批注补回", "author": "阿岚"},
        )
        after_supp = r.json()
        row5 = next(row for row in after_supp["行明细"] if row["原始行号"] == 5)
        check(row5["状态标签"] == "待复核" and row5["是否参与计算"] == "否",
              f"补录后行5状态标签='{row5['状态标签']}', 参与计算='{row5['是否参与计算']}'（不提前归正常）")
        check(row5["原始X值"] == 5.0 and row5["原始Y值"] == 10.3,
              f"原始值保留: X={row5['原始X值']}, Y={row5['原始Y值']}")
        check(row5["当前X值"] == 4.9 and row5["当前Y值"] == 9.8,
              f"改后值同步: X={row5['当前X值']}, Y={row5['当前Y值']}")
        check(row5["下一步处理人"] == "教研组",
              f"下一步找人正确: {row5['下一步处理人']}")
        check(not row5.get("残差") or row5["残差"] is None,
              "待复核状态残差=None（不参与计算假象）")

        # ===== 7. 详情页刷新：原始值/改后值/处理原因/历史记录同步 =====
        print("\n[刷新] 刷新详情页 → 展示补录结果")
        page_after_supp = requests.get(f"{BASE_URL}/record/{import_id}").text
        for needle in ["待复核", "教研组", "老师批注补回", "4.9", "9.8", "原始X", "当前X", "预测值", "残差"]:
            check(needle in page_after_supp,
                  f"详情页 HTML 包含关键字段『{needle}』")

        # ===== 8. 导出 JSON / CSV / TXT / changelog CSV 同源 =====
        print("\n[导出] 导出 JSON/CSV/TXT/changelog → 与 API 同源")
        j_api = requests.get(f"{BASE_URL}/api/records/{import_id}").json()

        j_exp = requests.get(f"{BASE_URL}/api/records/{import_id}/export/json").json()
        check(j_exp["导入ID"] == import_id and j_exp["参数版本"] == j_api["参数版本"],
              "JSON 导出与 API 参数版本一致")
        check(len(j_exp["行明细"]) == len(j_api["行明细"]),
              f"JSON 导出行数={len(j_exp['行明细'])} 与 API={len(j_api['行明细'])} 一致")

        csv_text = requests.get(f"{BASE_URL}/api/records/{import_id}/export/csv").text
        check("原始行号" in csv_text and "当前X值" in csv_text and "当前Y值" in csv_text,
              "CSV 明细含原始行号/当前X/Y")
        check("4.9" in csv_text and "9.8" in csv_text, "CSV 明细含改后值 4.9 / 9.8")

        txt = requests.get(f"{BASE_URL}/api/records/{import_id}/export/report").text
        check(import_id in txt and "线性回归残差复盘" in txt,
              "TXT 报告含正确导入ID与标题")

        chg = requests.get(f"{BASE_URL}/api/records/{import_id}/export/changelog_csv").text
        for tag in ["补录", "删除", "导入"]:
            check(tag in chg, f"变更历史 CSV 包含事件 {tag}")

        # ===== 9. 教研组复核通过 → supplemented 参与计算 =====
        print("\n[动作] 教研组复核通过行5")
        r = requests.post(
            f"{BASE_URL}/api/records/{import_id}/review",
            json={"line_no": 5, "approve": True,
                  "comment": "核对老师批注与原始截图一致", "reviewer": "教研组-A"},
        )
        after_rv = r.json()
        row5 = next(row for row in after_rv["行明细"] if row["原始行号"] == 5)
        check(row5["状态标签"] in ("补录", "已复核", "补录并复核") or "补录" in row5["状态标签"] or row5["状态标签"] in ("已修正",),
              f"复核后状态标签='{row5['状态标签']}'")
        check(row5["是否参与计算"] == "是", "复核通过后参与计算='是'")
        check(row5["残差"] is not None and abs(float(row5["残差"])) < 0.5,
              f"复核后残差={row5['残差']}（已参与重算）")
        check(row5["复核人"] == "教研组-A" and "原始截图" in (row5["复核意见"] or ""),
              f"复核追踪保留：复核人={row5['复核人']}, 意见='{row5['复核意见']}'")

        # ===== 10. 参数版本页触发更新 → 版本号 +1 =====
        print("\n[参数版本] 打开参数页 → 更新参数版本 → 版本号 +1")
        pv_before = after_rv["参数版本"]
        rp_before = requests.get(f"{BASE_URL}/record/{import_id}/params").text
        check(f"v{pv_before}" in rp_before and "参数历史快照" in rp_before,
              f"参数版本页打开成功, 显示 v{pv_before}")
        r = requests.post(
            f"{BASE_URL}/api/records/{import_id}/recalc",
            json={"trigger": "参数版本页更新", "author": "参数页-教研组"},
        )
        after_recalc = r.json()
        pv_after = after_recalc["参数版本"]
        check(pv_after == pv_before + 1,
              f"参数版本号递增: v{pv_before} → v{pv_after}")
        check(any(p["版本"] == pv_after for p in after_recalc["参数历史快照"]),
              f"参数历史快照包含新版本 v{pv_after}")

        # ===== 11. 刷新详情页，展示最新 =====
        print("\n[刷新] 刷新详情页 / API / 导出 → 全部显示新版本号")
        page_new = requests.get(f"{BASE_URL}/record/{import_id}").text
        api_new = requests.get(f"{BASE_URL}/api/records/{import_id}").json()
        csv_new = requests.get(f"{BASE_URL}/api/records/{import_id}/export/csv").text
        check(f"v{pv_after}" in page_new,
              f"页面 HTML 显示最新版本号 v{pv_after}")
        check(api_new["参数版本"] == pv_after,
              f"JSON API 参数版本 = v{pv_after}")
        check(len(api_new["参数历史快照"]) >= 2 and any(p["版本"] == pv_after for p in api_new["参数历史快照"]),
              f"API 参数历史快照包含 v{pv_after}")
        check(any(r["原始行号"] == 5 and r["状态标签"] == "补录" for r in api_new["行明细"]),
              "API 行明细中行5仍为 补录 状态")

        # ===== 12. Excel 中文列名导入 =====
        print("\n[多源] 上传 Excel .xlsx（列名『自变量』『因变量』）")
        xlsx_path = DATA_DIR / "zh.xlsx"
        make_sample_xlsx(xlsx_path)
        with open(xlsx_path, "rb") as f:
            files = {"file": ("中文.xlsx", f)}
            rx = requests.post(f"{BASE_URL}/api/import", files=files,
                               data={"source_name": "中文列名Excel"})
        check(rx.status_code == 200, "Excel 上传返回 200")
        xj = rx.json()
        check(not xj["duplicate"] and xj["record"]["字段映射"] == {"自变量": "x", "因变量": "y"},
              f"中文字段归一: {xj['record']['字段映射']}")
        check(xj["record"]["总行数"] == 3, f"Excel 总行数={xj['record']['总行数']}")

        print("\n" + "=" * 70)
        print(" 🎉 Web+HTTP API 端到端验证全部通过")
        print(" 验证点：")
        print("   · 服务器启动 /api/health")
        print("   · 列表页 / 、详情页 /record/<id> 、参数页 /record/<id>/params 可进入")
        print("   · 列表页与 /api/records、详情页与 /api/records/<id> 同源")
        print("   · CSV 上传导入、Excel 中文列名归一")
        print("   · 删除→补录→待复核→复核通过→参与重算，状态/原始值/改后值/原因/下一步完整")
        print("   · 参数版本页点击更新后版本号 +1，历史快照留存")
        print("   · 页面刷新后 HTML 展示、API JSON、CSV明细、变更CSV、TXT报告全同源")
        print("=" * 70)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    main()
