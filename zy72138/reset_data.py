import csv
import os

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")

check_rows = [
    ["批次号","检查日期","检查人","通道编号","曲目名称","文件名","文件时长","时码入点","时码出点","版本标记","批注","导入来源","人工改名标记"],
    ["BATCH-001","2026-06-02","张工","CH-001","Intro 开场序曲","intro_opening_v2.wav","00:01:30","00:00:00","00:01:30","2025_master","音量正常","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-002","霓虹深处","neon_deep_v3.wav","00:03:45","00:01:30","00:05:15","2025_master","相位已校准","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-002","霓虹深处","neon_deep_v2.wav","00:03:45","00:01:35","00:05:20","2024_master","旧版母带标记","手工导入",""],
    ["BATCH-001","2026-06-02","张工","CH-003","城市回响","echo_city_v1.wav","00:03:45","00:05:15","00:09:00","2024_master","旧版母带","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-004","霓虹深处","neon_deep_v2.wav","00:03:45","00:09:00","00:12:45","2024_master","重复曲目","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-005","空城旧梦","empty_city_dream.wav","00:03:45","00:12:45","00:16:30","2025_master","电平偏低","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-006","边界线","boundary_line_rename.wav","00:02:30","00:16:30","00:19:00","2025_master","人工改名","手工导入","是"],
    ["BATCH-001","2026-06-02","张工","CH-007","未知曲目","unknown_track.wav","00:03:15","00:19:00","00:22:15","2025_master","曲目名称为空","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-008","风起时","wind_rises.wav","00:03:15","00:22:15","00:25:30","2025_master","正常","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-009","潮声","tide_sound_v1.wav","00:03:45","00:25:30","00:29:15","2024_master","旧版母带","音频库",""],
    ["BATCH-001","2026-06-02","张工","CH-010","夜航","night_flight.wav","00:03:45","00:29:15","00:33:00","2025_master","缺授权标记","音频库",""],
]

with open(os.path.join(DATA, "ear_return_channel_check.csv"), "w", encoding="utf-8-sig", newline="") as f:
    csv.writer(f).writerows(check_rows)
print(f"ear_return_channel_check.csv: {len(check_rows)} 行 (含表头)")

stage_header = ["通道编号","曲目名称","文件路径","母带版本","艺人","时码入点","时码出点","舞台区域","合同编号","合同备注","负责人","登记日期"]
stage_rows_text = """CH-001|Intro 开场序曲|audio/intro_opening_v2.wav|2025_master|林夜|00:00:00|00:01:30|主舞台|CT-2025-001|授权期限:2025-01-01 至 2026-12-31; 厂牌:银河音效|小孟|2026-06-01
CH-002|霓虹深处|audio/neon_deep_v3.wav|2025_master|林夜|00:01:30|00:05:15|主舞台|CT-2025-002|授权期限:2025-01-01 至 2026-12-31; 厂牌:银河音效|小孟|2026-06-01
CH-003|城市回响|audio/echo_city_v1.wav|2024_master|陆燃|00:05:15|00:09:00|主舞台|CT-2025-003|授权期限:2025-03-15 至 2026-03-14; 厂牌:城市节拍|小孟|2026-06-01
CH-004|霓虹深处|audio/neon_deep_v2.wav|2024_master|林夜|00:09:00|00:12:45|主舞台|CT-2025-004|授权期限:2025-01-01 至 2026-12-31; 厂牌:银河音效|小孟|2026-06-01
CH-005|空城旧梦|audio/empty_city_dream.wav|2025_master|方拾|00:12:45|00:16:30|主舞台|CT-2025-005|授权期限:2025-02-01 至 2026-01-31; 厂牌:旧城音乐|小孟|2026-06-01
CH-006|边界线|audio/boundary_line.wav|2025_master|周隐|00:16:30|00:19:00|主舞台|CT-2025-006|授权期限:2025-04-01 至 2026-03-31; 厂牌:暗流唱片|小孟|2026-06-01
CH-007|未知曲目|audio/unknown_track.wav|2025_master|未知|00:19:00|00:22:15|主舞台|||小孟|2026-06-01
CH-008|风起时|audio/wind_rises.wav|2025_master|林风|00:22:15|00:25:30|主舞台|CT-2025-008|授权期限:2025-05-01 至 2026-04-30; 厂牌:清风音乐|小王|2026-06-01
CH-009|潮声|audio/tide_sound_v1.wav|2024_master|海浪|00:25:30|00:29:15|主舞台|CT-2025-009|授权期限:2024-12-01 至 2025-11-30; 厂牌:潮汐音乐|小王|2026-06-01
CH-010|夜航|audio/night_flight.wav|2025_master|夜空|00:29:15|00:33:00|主舞台|CT-2025-010|授权期限:2025-06-01 至 2025-12-31; 厂牌:夜空音乐|小王|2026-06-01
CH-011|星海沉眠|audio/starsea_sleep.wav|2025_master|星海|00:33:00|00:36:30|主舞台|CT-2025-011|授权期限:2025-07-01 至 2026-06-30; 厂牌:星空音乐|小王|2026-06-01
CH-012|雾中列车|audio/fog_train.wav|2025_master|远方|00:36:30|00:40:00|主舞台|CT-2025-012|授权期限:2024-01-01 至 2024-12-31; 厂牌:旅途音乐|小王|2026-06-01"""
stage_rows = [stage_header]
for line in stage_rows_text.strip().split("\n"):
    stage_rows.append(line.split("|"))

with open(os.path.join(DATA, "stage_channel_table.csv"), "w", encoding="utf-8-sig", newline="") as f:
    csv.writer(f).writerows(stage_rows)
print(f"stage_channel_table.csv: {len(stage_rows)} 行 (含表头)")

for fn in [".check_state.json", "supplements.json", "column_mapping.json"]:
    p = os.path.join(DATA, fn)
    if os.path.exists(p):
        os.remove(p)
        print(f"已删除: {fn}")
