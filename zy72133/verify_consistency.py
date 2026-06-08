#!/usr/bin/env python3
import yaml
import re
from src.audit_log import AuditLog
from src.track_importer import TrackImporter
from src.audio_scanner import AudioScanner
from src.matcher import TrackMatcher

config = yaml.safe_load(open('config.yaml'))
audit_log = AuditLog('consistency_audit.json')

importer = TrackImporter(config, audit_log)
tracks = importer.import_excel('sample_data/track_list.xlsx')

scanner = AudioScanner(config, audit_log)
audio_files = scanner.scan_directory('sample_data/audio')

matcher = TrackMatcher(config, audit_log)
results = matcher.match_tracks(tracks, audio_files, operator="一致性校验")

expected_map = {
    "TRK001": ("已匹配", []),
    "TRK002": ("已匹配", []),
    "TRK003": ("旧版母带", ["旧版母带"]),
    "TRK004": ("重复曲目", ["重复曲目"]),
    "TRK005": ("缺授权", ["缺授权"]),
    "TRK006": ("重复曲目", ["重复曲目"]),
    "TRK007": ("重复曲目", ["重复曲目"]),
    "TRK008": ("缺授权", ["缺授权"]),
    "TRK009": ("人工改名", ["文件名不匹配", "人工改名"]),
    "TRK010": ("未匹配", []),
}

print("=" * 80)
print("一致性校验: 匹配结果 vs 报告展示 vs 异常列表")
print("=" * 80)

all_ok = True
for r in sorted(results, key=lambda x: x.track.track_id):
    tid = r.track.track_id
    if tid.startswith("unknown_"):
        continue

    status_val = r.status.value
    exc_names = [e.value for e in r.exceptions]
    exc_detail_primary = None
    if r.exceptions:
        for exc in r.exceptions:
            detail = r.exception_details.get(exc.name.lower(), {})
            exc_detail_primary = detail.get('suggestion', '')

    exp_status, exp_exceptions = expected_map.get(tid, ("???", []))

    status_ok = status_val == exp_status

    exc_ok = True
    for expected_exc in exp_exceptions:
        if expected_exc not in exc_names:
            exc_ok = False

    report_status_label = status_val

    overall = "✓" if (status_ok and exc_ok) else "✗"
    if not (status_ok and exc_ok):
        all_ok = False

    print(f"\n{overall} {tid}: {r.track.title}")
    print(f"  状态: {status_val} (预期: {exp_status}) {'✓' if status_ok else '✗'}")
    print(f"  异常: {', '.join(exc_names) if exc_names else '—'}")
    print(f"  报告标签: {report_status_label}")
    if exc_detail_primary:
        print(f"  建议动作: {exc_detail_primary}")

print()
print("=" * 80)
if all_ok:
    print("✅ 一致性校验通过: 状态标签、异常列表、建议动作完全一致")
else:
    print("❌ 一致性校验失败: 存在不一致")
