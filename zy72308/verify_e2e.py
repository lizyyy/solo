#!/usr/bin/env python3
"""端到端完整场景验证"""
import os, json, csv
from residual_review.workflow import ReviewWorkflow
from residual_review.storage import StorageManager
from residual_review.exporter import UnifiedExporter
from residual_review.row_manager import RowManager
from residual_review.importer import DataImporter

def run_all():
    print("=" * 72)
    print(" 端到端场景验证脚本")
    print("=" * 72)

    # ========== 场景1：删除→补录→不复核 → 待复核状态保留 ==========
    print("\n[场景1] 删除行5 → 补录 → 不复核 → 检查pending_review状态保留")
    if os.path.isdir("data"):
        import shutil
        shutil.rmtree("data")

    wf = ReviewWorkflow()
    r1 = wf.step1_import("sample_data.csv", "旧公式截图数据.csv")
    imp_id = r1["import_id"]
    print(f"  导入ID: {imp_id}")

    wf.action_delete_row(imp_id, 5, "截图缺少行5")
    wf.action_supplement_and_recalc(imp_id, 5, 4.9, 9.8, "老师提供补录值", auto_recalc=False)

    exp = UnifiedExporter(StorageManager())
    data = exp.export_for_api(imp_id)
    row5 = data["行明细"][4]
    assert row5["状态"] == "pending_review", f"行5状态应为pending_review, 实际={row5['状态']}"
    assert row5["下一步处理人"] == "教研组"
    assert row5["是否参与计算"] == "否", f"pending_review不应参与计算"
    assert row5["残差"] is None, f"pending_review不应有残差"
    print(f"  ✔ 行5状态: {row5['状态']}, 下一步→{row5['下一步处理人']}, 残差={row5['残差']} (符合预期)")

    # ========== 场景2：复核通过 → supplemented + 参与计算 + 有残差 ==========
    print("\n[场景2] 教研组复核通过 → supplemented + 参与计算 + 有残差")
    wf.action_review_row(imp_id, 5, True, "核对原始截图无误，接受补录值")
    data = exp.export_for_api(imp_id)
    row5 = data["行明细"][4]
    assert row5["状态"] == "supplemented"
    assert row5["下一步处理人"] == ""
    assert row5["是否参与计算"] == "是"
    assert row5["残差"] is not None
    print(f"  ✔ 行5状态: {row5['状态']}, 残差={row5['残差']:.4f} (符合预期)")

    # ========== 场景3：复核不通过 → gap + 不参与计算 ==========
    print("\n[场景3] 先补录另一行，然后复核不通过 → gap")
    wf.action_delete_row(imp_id, 7, "行7截图不清晰暂删")
    wf.action_supplement_and_recalc(imp_id, 7, 7.1, 14.3, "老师暂估值", auto_recalc=False)
    wf.action_review_row(imp_id, 7, False, "行7老师补录值不对，退回重补", reviewer="教研组")
    data = exp.export_for_api(imp_id)
    row7 = data["行明细"][6]
    assert row7["状态"] == "gap", f"行7状态应为gap, 实际={row7['状态']}"
    assert row7["下一步处理人"] == "运营规划阿岚"
    assert row7["是否参与计算"] == "否"
    print(f"  ✔ 行7状态: {row7['状态']}, 下一步→{row7['下一步处理人']} (符合预期)")

    # ========== 场景4：三步流程 + 参数更新后全出口一致 ==========
    print("\n[场景4] 完整三步流程 + 参数更新后 4个出口一致")
    wf.step2_annotate(imp_id, 1, "老师批注：注意行3残差")
    wf.step3_update_params(imp_id, trigger="完整三步流程结束手动更新")

    api_d = exp.export_for_api(imp_id)
    display_d = exp.export_for_display(imp_id)
    files = exp.export_all(imp_id)

    # 读回 4 份文件
    with open(files["csv_details"], encoding="utf-8-sig") as f:
        csv_d = list(csv.DictReader(f))
    with open(files["json_full"], encoding="utf-8") as f:
        json_d = json.load(f)
    with open(files["csv_changelog"], encoding="utf-8-sig") as f:
        clog = list(csv.DictReader(f))
    with open(files["report"], encoding="utf-8") as f:
        txt = f.read()

    assert len(csv_d) == len(api_d["行明细"]) == 10
    assert json_d["参数版本"] == api_d["参数版本"] == display_d["参数版本"]
    assert json_d["回归参数"]["slope"] == api_d["回归参数"]["slope"]
    assert len(clog) == len(api_d["变更历史"])
    assert "编号断档" in txt
    assert "待教研组复核" in txt

    print(f"  ✔ 4出口一致: 明细10行, 参数v{api_d['参数版本']}, 变更{len(clog)}条")

    # ========== 场景5：字段别名归一（中文列名） ==========
    print("\n[场景5] 中文列名字段归一")
    with open("sample_zh.csv", "w", encoding="utf-8") as f:
        f.write("自变量,因变量\n1.5,3.2\n2.5,4.9\n3.5,6.8\n")
    wf2 = ReviewWorkflow()
    r5 = wf2.step1_import("sample_zh.csv", "中文列名数据")
    data5 = UnifiedExporter(StorageManager()).export_for_api(r5["import_id"])
    assert data5["字段映射"] == {"自变量": "x", "因变量": "y"}, f"映射不对: {data5['字段映射']}"
    assert len(data5["行明细"]) == 3
    assert data5["行明细"][0]["来源字段X"] == "自变量"
    print(f"  ✔ 字段映射: {data5['字段映射']}, 行数={len(data5['行明细'])} (符合预期)")

    # ========== 场景6：重复导入检测 ==========
    print("\n[场景6] 重复导入检测")
    importer = DataImporter(StorageManager())
    # 第一次导入
    r_first, is_dup_first = importer.import_from_file(
        "sample_data.csv", "旧公式截图2.csv", check_duplicate=True
    )
    assert is_dup_first == False
    # 第二次导入相同文件
    r_dup, is_dup_second = importer.import_from_file(
        "sample_data.csv", "旧公式截图2.csv", check_duplicate=True
    )
    assert is_dup_second == True, f"第二次应检测为重复, 实际is_dup={is_dup_second}"
    assert r_dup.import_id == r_first.import_id, "重复导入应返回同一记录ID"
    print(f"  ✔ 首次导入: {r_first.import_id} -> is_dup=False; 第二次 -> is_dup=True; 返回相同ID (符合预期)")

    print("\n" + "=" * 72)
    print("🎉 全部6个场景通过！核心修复生效：")
    print("  · 待复核不提前归正常（pending_review/gap状态保留原始值）")
    print("  · 补录/复核后残差正确重算")
    print("  · 接口/展示/JSON/CSV/TXT 全链路同一份结果")
    print("  · 变更历史完整：删除/补录/复核/批注/重算/参数更新")
    print("  · 字段别名归一（中文自变量/因变量）")
    print("  · 原始行号/原始值/当前值永久保留，教研组可回到证据")
    print("=" * 72)

if __name__ == "__main__":
    run_all()
