"""
配电柜温升异常归因 · 主流程入口
流程：
  1. 标准化两批维修照片（字段名不一致合并）
  2. 去重导入到 output/normalized_photos.csv
  3. 运行温升异常归因（含采样断档标记、晚到备件影响）
  4. 去重导入归因结果（幂等）
  5. 合并人工备注（不覆盖已有备注）
  6. 偏差追溯：定位拖偏结论的照片行号
  7. 生成HTML分析报告
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.normalizer import load_csv, normalize_photos, write_csv, STANDARD_FIELDS
from src.attribution import run_attribution
from src.dedup_import import (
    dedup_import_normalized_photos,
    merge_manual_notes,
    dedup_import_attribution
)
from src.skew_trace import run_trace
from src.report_gen import generate_report
from src.attribution import analyze_late_parts, detect_gaps_and_anomalies

STEP = 0
def step(msg):
    global STEP
    STEP += 1
    print(f"\n{'='*60}")
    print(f"[{STEP}] {msg}")
    print('='*60)

def pipeline():
    os.makedirs("output", exist_ok=True)
    
    step("标准化维修照片（处理字段名不一致，保留source和process_status")
    b1 = load_csv("data/repair_photos_batch1.csv")
    b2 = load_csv("data/repair_photos_batch2.csv")
    n1 = normalize_photos(b1, source_tag_hint="班组巡检App-v1")
    n2 = normalize_photos(b2, source_tag_hint="算法巡检系统-v2")
    
    tmp_n = "output/_tmp_normalized.csv"
    write_csv(tmp_n, n1 + n2, STANDARD_FIELDS)
    print(f"  批次1={len(n1)} 批次2={len(n2)}")
    
    target_photos = "output/normalized_photos.csv"
    added, skipped = dedup_import_normalized_photos(tmp_n, target_photos)
    print(f"  去重导入 → 新增={added} 跳过重复={skipped}")
    
    step("运行温升异常归因（采样断档→标为异常处理，晚到备件→写入late_part_impact）")
    attrs, late_parts, analyzed = run_attribution(
        "data/temperature_sampling.csv",
        target_photos,
        "data/spare_parts.csv",
        "output/attribution_result.csv"
    )
    print(f"  归因条目: {len(attrs)}")
    print(f"  晚到备件: {len(late_parts)}")
    for lp in late_parts:
        print(f"    · {lp['part_code']} {lp['part_name']} → {lp['cabinet_id']} 晚到{lp['late_hours']}h")
    
    step("归因结果去重导入（幂等） + 合并人工备注（不覆盖）")
    target_attr = "output/attribution_with_notes.csv"
    a, u, p = dedup_import_attribution("output/attribution_result.csv", target_attr)
    print(f"  归因→目标文件：新增={a} 更新={u} 保留保护字段={p}")
    
    mn, pn = merge_manual_notes("data/manual_notes.csv", target_attr, target_attr)
    print(f"  人工备注合并：新合并={mn} 已存在被保护={pn}")
    
    step("偏差追溯：定位拖偏结论的照片行号")
    tr = run_trace(target_attr, target_photos, "output/skew_trace.csv")
    print(f"  追溯条目: {len(tr)}")
    for t in tr[:5]:
        print(f"    {t['attribution_id']} → 照片{t['skew_photo_id']} @ normalized_photos.csv:{t['skew_photo_row_in_csv']} 权重={t['impact_weight']}")
    
    step("生成HTML分析报告")
    html = generate_report(
        target_attr,
        "output/skew_trace.csv",
        target_photos,
        late_parts,
        analyzed,
        "output/report.html"
    )
    print(f"  报告已生成: {html}")
    
    print("\n" + "="*60)
    print("✅  主流程完成")
    print("="*60)
    return attrs, late_parts, tr

if __name__ == "__main__":
    pipeline()
