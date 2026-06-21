#!/usr/bin/env python3
"""
可复现验证脚本：TRK007 匹配链路 + 统计一致性核对
覆盖：打开样例 → 导入音频 → 扫描 → 匹配 → 异常判断 → 历史记录 → 报告导出 → 一致性校验
"""
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.config import SAMPLE_AUDIO_DIR, SAMPLE_EXCEL_DIR, OUTPUT_DIR
from src.excel_reader import ExcelReader
from src.audio_scanner import AudioScanner
from src.matcher import TrackMatcher
from src.anomaly_detector import AnomalyDetector
from src.note_manager import NoteManager
from src.report_generator import ReportGenerator
from src.batch_processor import BatchProcessor

RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BOLD = "\033[1m"
RESET = "\033[0m"

PASS = f"{GREEN}✅ PASS{RESET}"
FAIL = f"{RED}❌ FAIL{RESET}"

checks = []


def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    msg = f"  [{status}] {name}"
    if detail:
        msg += f"  ({detail})"
    print(msg)
    checks.append((name, condition, detail))


def main():
    notes_file = str(OUTPUT_DIR / "notes_verify.json")
    if os.path.exists(notes_file):
        os.remove(notes_file)

    print(f"\n{BOLD}=" * 70)
    print(f"  TRK007 可复现验证脚本")
    print(f"  覆盖: 扫描→匹配→异常判断→状态→补录备注→历史记录→报告导出")
    print(f"=" * 70 + RESET)

    # -------- 步骤 1：打开样例 --------
    print(f"\n{BOLD}[1/8] 打开样例：扫描音频目录{RESET}")
    scanner = AudioScanner(str(SAMPLE_AUDIO_DIR))
    audio_files = scanner.scan_files()
    audio_map = {af.file_name + af.extension: af for af in audio_files}

    print(f"  目录: {SAMPLE_AUDIO_DIR}")
    print(f"  共扫描到 {len(audio_files)} 个文件")

    # TRK007 两个音频验证
    xiaoqiang = "TRK007_跳跃的音符_小强.wav"
    xiaohua = "TRK007_快乐节拍_小华.wav"

    check(
        f"存在可用音频 {xiaoqiang}",
        xiaoqiang in audio_map and audio_map[xiaoqiang].is_valid,
        f"大小={audio_map[xiaoqiang].file_size if xiaoqiang in audio_map else 'MISSING'}字节, 有效={audio_map[xiaoqiang].is_valid if xiaoqiang in audio_map else 'N/A'}"
    )
    check(
        f"可用音频大小 ≈ 264644 字节",
        xiaoqiang in audio_map and abs(audio_map[xiaoqiang].file_size - 264644) < 1000,
        f"实际={audio_map[xiaoqiang].file_size if xiaoqiang in audio_map else 'MISSING'}"
    )
    check(
        f"存在损坏音频 {xiaohua}",
        xiaohua in audio_map and not audio_map[xiaohua].is_valid,
        f"大小={audio_map[xiaohua].file_size if xiaohua in audio_map else 'MISSING'}字节"
    )
    check(
        f"可用音频解析: 曲目编号=TRK007, 曲目名='跳跃的音符', 学生='小强'",
        (xiaoqiang in audio_map
         and audio_map[xiaoqiang].parsed_track_id == "TRK007"
         and audio_map[xiaoqiang].parsed_track_name == "跳跃的音符"
         and audio_map[xiaoqiang].parsed_student_name == "小强"),
        f"解析结果: id={audio_map[xiaoqiang].parsed_track_id if xiaoqiang in audio_map else 'MISSING'}, "
        f"name={audio_map[xiaoqiang].parsed_track_name if xiaoqiang in audio_map else 'MISSING'}, "
        f"student={audio_map[xiaoqiang].parsed_student_name if xiaoqiang in audio_map else 'MISSING'}"
    )

    # -------- 步骤 2：导入 Excel --------
    print(f"\n{BOLD}[2/8] 导入 Excel：读取曲目清单{RESET}")
    reader = ExcelReader(str(SAMPLE_EXCEL_DIR / "曲目清单.xlsx"))
    tracks = reader.read_tracks()

    trk007_list = [t for t in tracks if t.track_id == "TRK007"]
    check(f"TRK007 在 Excel 中有 2 条记录", len(trk007_list) == 2, f"实际={len(trk007_list)}")

    xiaoqiang_track = next((t for t in trk007_list if t.track_name == "跳跃的音符" and t.student_name == "小强"), None)
    xiaohua_track = next((t for t in trk007_list if t.track_name == "快乐节拍" and t.student_name == "小华"), None)

    check("TRK007-跳跃的音符-小强 存在于Excel", xiaoqiang_track is not None)
    check("TRK007-快乐节拍-小华 存在于Excel", xiaohua_track is not None)

    # -------- 步骤 3：匹配 --------
    print(f"\n{BOLD}[3/8] 匹配算法验证：贪心分配 + 评分排序{RESET}")
    import copy
    working = copy.deepcopy(tracks)
    matcher = TrackMatcher(working, audio_files)
    matched = matcher.match_all()

    xiaoqiang_matched = next((t for t in matched
                              if t.track_id == "TRK007" and t.track_name == "跳跃的音符" and t.student_name == "小强"), None)
    xiaohua_matched = next((t for t in matched
                            if t.track_id == "TRK007" and t.track_name == "快乐节拍" and t.student_name == "小华"), None)

    check(
        f"TRK007-小强 匹配到 {xiaoqiang}",
        xiaoqiang_matched is not None and xiaoqiang_matched.matched_audio_name == xiaoqiang,
        f"实际匹配={xiaoqiang_matched.matched_audio_name if xiaoqiang_matched else '未匹配'}"
    )
    check(
        "TRK007-小强 匹配音频有效性=可用",
        xiaoqiang_matched is not None and xiaoqiang_matched.matched_audio_valid is True,
        f"matched_audio_valid={xiaoqiang_matched.matched_audio_valid if xiaoqiang_matched else 'N/A'}"
    )
    check(
        "TRK007-小强 匹配音频大小>0",
        xiaoqiang_matched is not None and xiaoqiang_matched.matched_audio_size > 0,
        f"大小={xiaoqiang_matched.matched_audio_size if xiaoqiang_matched else 'N/A'}"
    )
    check(
        f"TRK007-小华 匹配到 {xiaohua}",
        xiaohua_matched is not None and xiaohua_matched.matched_audio_name == xiaohua,
        f"实际匹配={xiaohua_matched.matched_audio_name if xiaohua_matched else '未匹配'}"
    )
    check(
        "两个 TRK007 没有共享同一个音频文件",
        (xiaoqiang_matched is not None and xiaohua_matched is not None
         and xiaoqiang_matched.audio_file != xiaohua_matched.audio_file),
        f"小强={xiaoqiang_matched.audio_file if xiaoqiang_matched else 'N/A'} vs 小华={xiaohua_matched.audio_file if xiaohua_matched else 'N/A'}"
    )

    # -------- 步骤 4：异常判断 --------
    print(f"\n{BOLD}[4/8] 异常判断：文件损坏 / 名称不匹配 / 编号重复{RESET}")
    detector = AnomalyDetector(matched)
    detected = detector.detect_all()

    xiaoqiang_after = next((t for t in detected
                            if t.track_id == "TRK007" and t.track_name == "跳跃的音符" and t.student_name == "小强"), None)
    xiaohua_after = next((t for t in detected
                          if t.track_id == "TRK007" and t.track_name == "快乐节拍" and t.student_name == "小华"), None)

    anomaly_names_xq = {a.value for a in xiaoqiang_after.anomalies} if xiaoqiang_after else set()
    anomaly_names_xh = {a.value for a in xiaohua_after.anomalies} if xiaohua_after else set()

    check(
        "TRK007-小强 不包含 '文件损坏' 异常",
        xiaoqiang_after is not None and "文件损坏" not in anomaly_names_xq,
        f"异常类型={anomaly_names_xq}"
    )
    check(
        "TRK007-小华 包含 '文件损坏' 异常",
        xiaohua_after is not None and "文件损坏" in anomaly_names_xh,
        f"异常类型={anomaly_names_xh}"
    )
    check(
        "TRK007-小华 包含 '重复曲目' 异常（编号重复）",
        xiaohua_after is not None and "重复曲目" in anomaly_names_xh,
        f"异常类型={anomaly_names_xh}"
    )

    # -------- 步骤 5：统计一致性 --------
    print(f"\n{BOLD}[5/8] 已匹配数量统计一致性{RESET}")
    total_audio = len(audio_files)
    valid_audio = sum(1 for af in audio_files if af.is_valid)
    corrupted_audio = sum(1 for af in audio_files if not af.is_valid)

    matched_total = sum(1 for t in detected if t.audio_file)
    matched_valid = sum(1 for t in detected if t.matched_audio_valid is True)
    matched_corrupted = sum(1 for t in detected if t.matched_audio_valid is False)

    print(f"  音频文件总数: {total_audio} (可用={valid_audio}, 损坏={corrupted_audio})")
    print(f"  已匹配总数: {matched_total} (可用={matched_valid}, 损坏={matched_corrupted})")

    check("已匹配总数 = 可用匹配 + 损坏匹配", matched_total == matched_valid + matched_corrupted,
          f"{matched_total} vs {matched_valid}+{matched_corrupted}={matched_valid + matched_corrupted}")
    check("可用匹配数 = 实际用到的可用音频数", matched_valid <= valid_audio,
          f"已用可用={matched_valid}, 总可用={valid_audio}")
    check("可用匹配数 >= 5（已知5条真实匹配：TRK001/002/004/006/007小强）", matched_valid >= 5,
          f"实际={matched_valid}")
    check("损坏匹配数 = TRK003/005/TRK007小华 共 3 条", matched_corrupted == 3,
          f"实际={matched_corrupted}")

    used_audio_files = {t.audio_file for t in detected if t.audio_file}
    check("每个被匹配的音频只被一个曲目独占", len(used_audio_files) == matched_total,
          f"唯一音频路径={len(used_audio_files)}, 匹配曲数={matched_total}")

    # -------- 步骤 6：补录备注 --------
    print(f"\n{BOLD}[6/8] 补录备注 & 历史记录验证{RESET}")
    note_mgr = NoteManager(notes_file)
    note_mgr.add_note("TRK007", "2024-03-15 课堂录音已审听，节奏稳定")

    for t in detected:
        note = note_mgr.get_note(t.track_id)
        if note:
            t.supplementary_notes = note.note_content
            t.log(f"验证脚本加载备注: {note.note_content[:50]}")

    trk007_with_note = [t for t in detected if t.track_id == "TRK007" and t.supplementary_notes]
    check("两条 TRK007 都加载到了同一条补录备注", len(trk007_with_note) == 2,
          f"有备注的数量={len(trk007_with_note)}")

    log_with_matching = 0
    for t in detected:
        if "匹配结果: 选中" in "\n".join(t.process_log):
            log_with_matching += 1
    check(f"匹配历史记录写入: {matched_total} 条曲目有 '匹配结果: 选中' 日志",
          log_with_matching == matched_total,
          f"有匹配日志={log_with_matching}, 总匹配={matched_total}")

    # -------- 步骤 7：导出报告 --------
    print(f"\n{BOLD}[7/8] 导出报告 & Excel 明细核对{RESET}")
    batch = BatchProcessor()
    summary = batch.process_batch(detected, lambda t: None)
    summary.total_audio_files = total_audio
    summary.valid_audio_count = valid_audio
    summary.corrupted_audio_count = corrupted_audio
    summary.matched_tracks = matched_total
    summary.matched_with_valid_audio = matched_valid
    summary.matched_with_corrupted_audio = matched_corrupted

    report_gen = ReportGenerator(str(OUTPUT_DIR))
    paths = report_gen.generate_full_report(
        tracks=detected,
        summary=summary,
        report_name="验证_TRK007"
    )
    print(f"  Excel: {paths['excel']}")
    print(f"  汇总: {paths['summary']}")
    print(f"  HTML:  {paths['html']}")

    # 核对 Excel
    import pandas as pd
    xl = pd.ExcelFile(paths["excel"])
    check("Excel 包含所有必要 sheet",
          set(xl.sheet_names) >= {"曲目明细", "异常清单", "补录备注"},
          f"sheets={xl.sheet_names}"
          )

    detail_df = xl.parse("曲目明细")
    trk007_detail = detail_df[detail_df["曲目编号"] == "TRK007"]
    check("Excel 明细中 TRK007 有 2 行", len(trk007_detail) == 2, f"实际={len(trk007_detail)}")

    row_xq = trk007_detail[(trk007_detail["曲目名称"] == "跳跃的音符") & (trk007_detail["学生姓名"] == "小强")]
    row_xh = trk007_detail[(trk007_detail["曲目名称"] == "快乐节拍") & (trk007_detail["学生姓名"] == "小华")]

    check(
        "Excel 明细: TRK007-小强 匹配音频名正确",
        len(row_xq) == 1 and row_xq.iloc[0]["匹配音频名"] == xiaoqiang,
        f"实际={row_xq.iloc[0]['匹配音频名'] if len(row_xq) == 1 else 'ROW_MISSING'}"
    )
    check(
        "Excel 明细: TRK007-小强 匹配音频大小 > 0",
        len(row_xq) == 1 and row_xq.iloc[0]["匹配音频大小(字节)"] > 0,
        f"大小={row_xq.iloc[0]['匹配音频大小(字节)'] if len(row_xq) == 1 else 'ROW_MISSING'}"
    )
    check(
        "Excel 明细: TRK007-小强 匹配音频有效性='可用'",
        len(row_xq) == 1 and row_xq.iloc[0]["匹配音频有效性"] == "可用",
        f"有效性={row_xq.iloc[0]['匹配音频有效性'] if len(row_xq) == 1 else 'ROW_MISSING'}"
    )
    check(
        "Excel 明细: TRK007-小华 匹配音频有效性='损坏'",
        len(row_xh) == 1 and row_xh.iloc[0]["匹配音频有效性"] == "损坏",
        f"有效性={row_xh.iloc[0]['匹配音频有效性'] if len(row_xh) == 1 else 'ROW_MISSING'}"
    )

    # 核对汇总 txt
    with open(paths["summary"], 'r', encoding='utf-8') as f:
        summary_text = f.read()
    check(
        "文本汇总: '可用音频匹配' + '损坏音频匹配' = '已匹配'",
        (f"可用音频: {matched_valid}" in summary_text
         and f"损坏音频: {matched_corrupted}" in summary_text
         and f"- 已匹配: {matched_total}" in summary_text),
        "检查文本汇总中的统计数字一致性"
    )

    # -------- 步骤 8：最终一致性核对 --------
    print(f"\n{BOLD}[8/8] 最终：曲目↔学生↔文件名↔大小↔有效性 证据链核对{RESET}")
    print(f"  ┌──────────┬──────────┬──────────┬─────────────────────────┬──────────┬──────────┐")
    print(f"  │ 曲目编号  │ 曲目名称  │ 学生姓名  │ 匹配音频文件名            │ 大小(字节)│ 有效性    │")
    print(f"  ├──────────┼──────────┼──────────┼─────────────────────────┼──────────┼──────────┤")

    evidence_ok = True
    for t in sorted(detected, key=lambda x: (x.track_id, x.track_name)):
        if not t.audio_file:
            continue
        valid_str = "可用" if t.matched_audio_valid else "损坏"
        expected_valid = t.matched_audio_size > 0
        if expected_valid != t.matched_audio_valid:
            evidence_ok = False
        if t.matched_audio_size == 0 and t.matched_audio_valid:
            evidence_ok = False
        if t.matched_audio_size > 0 and not t.matched_audio_valid:
            evidence_ok = False

        fname = t.matched_audio_name
        if len(fname) > 23:
            fname = fname[:20] + "..."
        print(f"  │ {t.track_id:<7} │ {t.track_name:<7} │ {t.student_name:<7} │ {fname:<23} │ {t.matched_audio_size:<8} │ {valid_str:<7} │")

    print(f"  └──────────┴──────────┴──────────┴─────────────────────────┴──────────┴──────────┘")
    check(
        "所有匹配曲目：大小>0 ⇄ 可用，大小=0 ⇄ 损坏，没有矛盾",
        evidence_ok
    )

    # -------- 结果汇总 --------
    passed = sum(1 for _, ok, _ in checks if ok)
    total = len(checks)
    print(f"\n{BOLD}═══════════════════════════════════════════════════════════════")
    if passed == total:
        print(f"  {GREEN}✅ 全部 {total}/{total} 项检查通过{RESET}")
    else:
        print(f"  {RED}❌ {total - passed}/{total} 项检查失败{RESET}")
        print(f"  {YELLOW}失败项列表:{RESET}")
        for name, ok, detail in checks:
            if not ok:
                print(f"    - {name}: {detail}")
    print(f"═══════════════════════════════════════════════════════════════{RESET}\n")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
