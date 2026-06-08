#!/usr/bin/env python3
"""一致性验证脚本"""
import json, csv, sys
from residual_review.storage import StorageManager
from residual_review.exporter import UnifiedExporter

IMP = sys.argv[1] if len(sys.argv) > 1 else 'IMP20260609010958'
exp = UnifiedExporter(StorageManager())
api = exp.export_for_api(IMP)
display = exp.export_for_display(IMP)

ok = []

def check(name, cond, detail=""):
    ok.append((name, bool(cond), detail))
    print(f"  {'✔' if cond else '✘'} {name} {detail}")

print(f"\n=== 全链路一致性验证 (导入ID: {IMP}) ===\n")

print("[1] 接口 vs 页面展示同源:")
check("行明细条数一致", len(display["行明细"]) == len(api["行明细"]), f"{len(display['行明细'])} vs {len(api['行明细'])}")
check("参数版本一致", display["参数版本"] == api["参数版本"], f"v{display['参数版本']}")
check("回归参数slope一致", display["回归参数"]["slope"] == api["回归参数"]["slope"])
check("待处理摘要gap条数一致", len(display["待处理摘要"]["gap"]) == len(api["待处理摘要"]["gap"]))

print("\n[2] 行5证据链（原始值/当前值/状态）:")
row5_api = api["行明细"][4]
check("行5原始X=5.0", row5_api["原始X值"] == 5.0)
check("行5原始Y=10.3", row5_api["原始Y值"] == 10.3)
check("行5当前X=4.9", row5_api["当前X值"] == 4.9)
check("行5当前Y=9.8", row5_api["当前Y值"] == 9.8)
check("行5状态supplemented", row5_api["状态"] == "supplemented")
check("行5残差非空", row5_api["残差"] is not None, f"={row5_api['残差']:.4f}")
check("行5参与计算", row5_api["是否参与计算"] == "是")

print("\n[3] 导出4份文件 vs 接口数据:")

with open(f'data/exports/{IMP}_明细.csv', encoding='utf-8-sig') as f:
    rows_csv = list(csv.DictReader(f))
check("CSV明细 行数一致", len(rows_csv) == len(api["行明细"]))
check("CSV明细 行5状态", rows_csv[4]["状态"] == "supplemented")
check("CSV明细 行5原始X", rows_csv[4]["原始X值"] == "5.0")
check("CSV明细 行5当前X", rows_csv[4]["当前X值"] == "4.9")

with open(f'data/exports/{IMP}_复盘记录.json', encoding='utf-8') as f:
    d_json = json.load(f)
check("JSON 参数版本", d_json["参数版本"] == api["参数版本"])
check("JSON 变更历史条数", len(d_json["变更历史"]) == len(api["变更历史"]), f"{len(d_json['变更历史'])}条")
check("JSON 行5状态", d_json["行明细"][4]["状态"] == "supplemented")
check("JSON 行5残差", d_json["行明细"][4]["残差"] == row5_api["残差"])

with open(f'data/exports/{IMP}_变更历史.csv', encoding='utf-8-sig') as f:
    rows_cl = list(csv.DictReader(f))
check("变更历史CSV条数", len(rows_cl) == len(api["变更历史"]))
types = set(r["change_type"] for r in rows_cl)
check("变更历史含delete/supplement/review/recalc", {"delete","supplement","review","recalc"} <= types)

with open(f'data/exports/{IMP}_复盘摘要.txt', encoding='utf-8') as f:
    txt = f.read()
check("TXT含编号断档痕迹", "编号断档" in txt)
check("TXT含待教研组复核痕迹", "待教研组复核" in txt)
check("TXT含参数历史快照", "参数历史快照" in txt)
check("TXT含一致性校验通过", "总行数校验: 通过" in txt)

print("\n[4] 变更历史关键事件:")
events = [c["change_type"] for c in api["变更历史"]]
check("含import", "import" in events)
check("含delete", "delete" in events)
check("含supplement", "supplement" in events)
check("含recalc", "recalc" in events)
check("含review", "review" in events)
check("含annotate", "annotate" in events)
check("含param_update", "param_update" in events)

passed = sum(1 for _, o, _ in ok if o)
total = len(ok)
print(f"\n=== 验证结果: {passed}/{total} 通过 ===")
if passed < total:
    print("失败项:")
    for name, o, d in ok:
        if not o:
            print(f"  ✘ {name} {d}")
    sys.exit(1)
print("🎉 所有出口（接口/页面/JSON/CSV明细/CSV历史/TXT报告）完全一致！\n")
