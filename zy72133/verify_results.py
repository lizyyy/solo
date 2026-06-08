#!/usr/bin/env python3
import yaml
from src.audit_log import AuditLog
from src.track_importer import TrackImporter
from src.audio_scanner import AudioScanner
from src.matcher import TrackMatcher

config = yaml.safe_load(open('config.yaml'))
audit_log = AuditLog('verify_audit.json')

importer = TrackImporter(config, audit_log)
tracks = importer.import_excel('sample_data/track_list.xlsx')

scanner = AudioScanner(config, audit_log)
audio_files = scanner.scan_directory('sample_data/audio')

matcher = TrackMatcher(config, audit_log)
results = matcher.match_tracks(tracks, audio_files, operator="验证")

print(f"{'ID':<8} {'曲名':<24} {'状态':<8} {'异常列表'}")
print("-" * 80)
for r in sorted(results, key=lambda x: x.track.track_id):
    exc_names = ", ".join(e.value for e in r.exceptions) if r.exceptions else "—"
    print(f"{r.track.track_id:<8} {r.track.title:<24} {r.status.value:<8} {exc_names}")

print()
print("=" * 80)
print("预期 vs 实际核对:")
print("-" * 80)
expected = {
    "TRK001": "已匹配",
    "TRK002": "已匹配",
    "TRK003": "旧版母带",
    "TRK004": "重复曲目",
    "TRK005": "缺授权",
    "TRK006": "重复曲目",
    "TRK007": "重复曲目",
    "TRK008": "缺授权",
    "TRK009": "人工改名",
    "TRK010": "未匹配",
}
all_ok = True
for r in sorted(results, key=lambda x: x.track.track_id):
    tid = r.track.track_id
    if tid.startswith("unknown_"):
        continue
    exp = expected.get(tid, "???")
    actual = r.status.value
    mark = "✓" if exp == actual else "✗"
    if exp != actual:
        all_ok = False
    print(f"  {tid}: 预期={exp}, 实际={actual} {mark}")

print()
if all_ok:
    print("✅ 全部曲目分类正确！")
else:
    print("❌ 存在分类错误，需进一步修复")
