#!/usr/bin/env python3
import yaml
import json
from pathlib import Path
from collections import defaultdict

from src.audit_log import AuditLog
from src.track_importer import TrackImporter
from src.audio_scanner import AudioScanner
from src.matcher import TrackMatcher
from src.conflict_resolver import ConflictResolver
from src.report_generator import ReportGenerator

config = yaml.safe_load(open('config.yaml'))
output_dir = Path('output')
audit_log = AuditLog(log_file=str(output_dir / 'audit_log.json'))

importer = TrackImporter(config, audit_log)
tracks = importer.import_excel('sample_data/track_list.xlsx')

scanner = AudioScanner(config, audit_log)
audio_files = scanner.scan_directory('sample_data/audio')

matcher = TrackMatcher(config, audit_log)
results = matcher.match_tracks(tracks, audio_files, operator="校验")

conflict_resolver = ConflictResolver(
    config, audit_log, storage_file=str(output_dir / 'conflicts.json')
)
conflicts = conflict_resolver.get_unresolved_conflicts()

report_gen = ReportGenerator(config, audit_log)
stats = report_gen._calculate_stats(results, conflicts)

expected_conflicts = {
    "TRK001": [
        ("BPM", "128", "130", "重新检测BPM"),
        ("能量等级", "8", "9", "能量等级的评级标准"),
        ("备注", "主打曲目", "开场热场候选", "合并两边的备注"),
    ],
    "TRK002": [
        ("艺术家", "DJ小红", "DJ小红(Chill Mix)", "核对艺术家名称"),
        ("时长", "260", "255", "以音频文件实际时长为准"),
        ("备注", "(未填写)", "上次交接：暖场曲目", "合并两边的备注"),
    ],
    "TRK005": [
        ("授权信息", "(未填写)", "授权申请中", "核对版权授权信息"),
        ("备注", "授权待确认", "[来源:上一任交接", "合并两边的备注"),
    ],
    "TRK009": [
        ("曲名", "电子脉冲", "Electric Pulse", "哪个曲名是正确的"),
        ("备注", "人工改名确认", "[来源:上一任交接", "合并两边的备注"),
    ],
}

print("=" * 80)
print("一致性校验: conflicts.json ↔ 报告统计 ↔ 字段 ↔ 建议动作 ↔ 页面")
print("=" * 80)

all_ok = True

print(f"\n① 报告统计: 数据冲突={stats['conflicts']}, 期望={len(conflicts)}")
if stats['conflicts'] != len(conflicts):
    all_ok = False
    print(f"  ✗ 报告统计与实际冲突数不一致")
else:
    print(f"  ✓ 一致")

print(f"\n② 涉及曲目数: {len(set(c.track_id for c in conflicts))}, 期望: {len(expected_conflicts)}")
if len(set(c.track_id for c in conflicts)) != len(expected_conflicts):
    all_ok = False
    print(f"  ✗ 涉及曲目数不一致")
else:
    print(f"  ✓ 一致")

conflicts_by_track = defaultdict(list)
for c in conflicts:
    conflicts_by_track[c.track_id].append(c)

for tid in sorted(expected_conflicts.keys()):
    exp_list = expected_conflicts[tid]
    act_list = conflicts_by_track.get(tid, [])

    print(f"\n③ {tid} 冲突细节校验 (期望 {len(exp_list)} 条, 实际 {len(act_list)} 条):")
    if len(exp_list) != len(act_list):
        all_ok = False
        print(f"  ✗ 数量不一致")

    for exp_field, exp_excel, exp_import, exp_suggest in exp_list:
        match = next((c for c in act_list if c.field_name == exp_field), None)
        if not match:
            all_ok = False
            print(f"  ✗ 字段 {exp_field}: 未在冲突记录中找到")
            continue

        excel_ok = exp_excel in match.excel_value
        import_ok = exp_import in match.import_value
        suggest_ok = exp_suggest in match.suggested_action

        mark = "✓" if (excel_ok and import_ok and suggest_ok) else "✗"
        if not (excel_ok and import_ok and suggest_ok):
            all_ok = False

        print(f"  {mark} 字段 {exp_field}:")
        print(f"     Excel值:  '{match.excel_value}'  (期望含: '{exp_excel}') {'✓' if excel_ok else '✗'}")
        print(f"     系统值:   '{match.import_value}'  (期望含: '{exp_import}') {'✓' if import_ok else '✗'}")
        print(f"     建议动作: '{match.suggested_action}'  (期望含: '{exp_suggest}') {'✓' if suggest_ok else '✗'}")

report_html = Path(output_dir / 'report.html').read_text(encoding='utf-8')

print("\n④ HTML 报告页面展示校验:")
checks_html = [
    ('<div class="number">10</div>', f"报告顶部统计卡显示数据冲突数 {stats['conflicts']}"),
    ('数据冲突', '报告是否包含冲突章节'),
    ('本次Excel导入值', '列标签"本次Excel导入值"'),
    ('上次系统记录值', '列标签"上次系统记录值"'),
    ('建议动作', '列标签"建议动作"'),
]
for needle, label in checks_html:
    if needle in report_html:
        print(f"  ✓ 页面包含: {label}")
    else:
        all_ok = False
        print(f"  ✗ 页面缺失: {label}")

for tid in sorted(expected_conflicts.keys()):
    if tid in report_html:
        print(f"  ✓ 页面包含曲目 {tid}")
    else:
        all_ok = False
        print(f"  ✗ 页面缺失曲目 {tid}")

print()
print("=" * 80)
if all_ok:
    print("✅ 全部校验通过: conflicts.json / 报告统计 / 字段 / 建议动作 / 页面 完全一致")
else:
    print("❌ 存在不一致，请检查上方 ✗ 项")
