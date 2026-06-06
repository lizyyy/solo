#!/usr/bin/env python3
import argparse
import os
import sys

from recording_cleaner.engine import RecordingCleanerEngine
from recording_cleaner.report import render_weekly_report, render_review_log
from recording_cleaner.demo_data import (
    DEMO_WECHAT_SIGNUP_1,
    DEMO_WECHAT_SIGNUP_2,
    DEMO_CONTRACT_FILES,
    DEMO_TEACHER_REVIEW_NOTES,
    DEMO_MANUAL_FIX
)


def cmd_import(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    if args.state:
        engine.load_state(args.state)

    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            raw_text = f.read()
    else:
        raw_text = sys.stdin.read()

    signup = engine.import_wechat_signup(raw_text, date=args.date)
    songs = engine.process_signup(signup.signup_id)

    print(f"✅ 已导入排练群接龙，日期：{signup.date}")
    print(f"   解析到 {len(signup.songs_raw)} 条原始记录")
    print(f"   新建歌曲：{len(songs)} 首")
    for s in songs:
        flag = "⚠️ 同名待复核" if s.has_dual_name else "✅ 正常"
        copy_info = f"（版权名：{s.copyright_name}）" if s.copyright_name else ""
        print(f"     - {s.scene_name}{copy_info} [{flag}]")

    engine.save_state(args.state)
    print(f"\n💾 状态已保存，可继续后续操作")


def cmd_list(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)

    print(f"📋 当前歌曲列表（共 {len(engine.songs)} 首）\n")
    for sid, song in engine.songs.items():
        dual = " 🔴同名" if song.has_dual_name else ""
        contract = " 📄有合同" if song.contract_screenshot else " ❌无合同"
        copy_info = f"（版权：{song.copyright_name}）" if song.copyright_name else ""
        print(f"  [{sid}] {song.scene_name}{copy_info}")
        print(f"       状态：{song.status.value}{dual}{contract}")
        print(f"       音轨数：{len(song.tracks)}")
        if song.reviewer:
            print(f"       复核人：{song.reviewer}")
        print()


def cmd_review(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)

    song = engine.songs.get(args.song_id)
    if not song:
        print(f"❌ 找不到歌曲 ID：{args.song_id}")
        sys.exit(1)

    engine.teacher_review(
        song_id=args.song_id,
        approved=not args.reject,
        reviewer=args.reviewer,
        note=args.note or ""
    )

    action = "通过" if not args.reject else "驳回"
    print(f"✅ 音乐老师{action}复核：{song.scene_name}")
    print(f"   复核人：{args.reviewer}")
    if args.note:
        print(f"   意见：{args.note}")

    engine.save_state(args.state)


def cmd_contract(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)

    song = engine.songs.get(args.song_id)
    if not song:
        print(f"❌ 找不到歌曲 ID：{args.song_id}")
        sys.exit(1)

    engine.add_contract_screenshot(
        song_id=args.song_id,
        screenshot_path=args.path,
        operator=args.operator
    )

    print(f"✅ 已补录合同页截图：{song.scene_name}")
    print(f"   截图路径：{args.path}")
    print(f"   操作人：{args.operator}")

    engine.save_state(args.state)


def cmd_fix(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)

    song = engine.songs.get(args.song_id)
    if not song:
        print(f"❌ 找不到歌曲 ID：{args.song_id}")
        sys.exit(1)

    engine.manual_fix_song_name(
        song_id=args.song_id,
        scene_name=args.scene,
        copyright_name=args.copyright,
        operator=args.operator
    )

    print(f"✅ 已人工修正歌名：{song.scene_name}")
    if args.scene:
        print(f"   现场名 → {args.scene}")
    if args.copyright:
        print(f"   版权名 → {args.copyright}")

    engine.save_state(args.state)


def cmd_rerun(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)
    engine.rerun_processing()
    print(f"✅ 已重新跑完全量识别逻辑")
    engine.save_state(args.state)


def cmd_report(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)
    items = engine.generate_weekly_report()
    report = render_weekly_report(items, week_range=args.week)
    print(report)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n💾 周报已保存到：{args.output}")


def cmd_logs(args):
    engine = RecordingCleanerEngine(data_dir=args.data_dir)
    engine.load_state(args.state)
    print(render_review_log(engine.review_logs))


def cmd_demo(args):
    print("🎬 运行演示场景...\n")
    engine = RecordingCleanerEngine(data_dir=args.data_dir)

    print("=" * 60)
    print("  第 1 步：导入第一次排练群接龙")
    print("=" * 60)
    signup1 = engine.import_wechat_signup(DEMO_WECHAT_SIGNUP_1, date="2026-06-01")
    songs1 = engine.process_signup(signup1.signup_id)
    print(f"✅ 导入完成，新建 {len(songs1)} 首歌曲")
    for s in songs1:
        flag = "⚠️ 同名待复核" if s.has_dual_name else "✅ 正常"
        print(f"   - {s.scene_name} [{flag}]")
    print()

    print("=" * 60)
    print("  第 2 步：导入第二次排练群接龙（会关联已有歌曲）")
    print("=" * 60)
    signup2 = engine.import_wechat_signup(DEMO_WECHAT_SIGNUP_2, date="2026-06-03")
    songs2 = engine.process_signup(signup2.signup_id)
    print(f"✅ 导入完成，新建 {len(songs2)} 首歌曲")
    for s in songs2:
        flag = "⚠️ 同名待复核" if s.has_dual_name else "✅ 正常"
        print(f"   - {s.scene_name} [{flag}]")
    print()

    print("=" * 60)
    print("  第 3 步：音乐老师复核同名歌曲")
    print("=" * 60)
    for sid, song in list(engine.songs.items()):
        if song.status.value == "待音乐老师复核":
            note = DEMO_TEACHER_REVIEW_NOTES.get(song.scene_name, "确认同一首歌")
            engine.teacher_review(sid, approved=True, reviewer="张老师", note=note)
            print(f"✅ 张老师复核通过：{song.scene_name}")
            print(f"   意见：{note}")
    print()

    print("=" * 60)
    print("  第 4 步：版权运营小鹿补录合同页截图")
    print("=" * 60)
    for sid, song in list(engine.songs.items()):
        if song.status.value == "待补合同页截图":
            contract_path = DEMO_CONTRACT_FILES.get(song.copyright_name, f"data/contracts/{song.copyright_name}.jpg")
            os.makedirs(os.path.dirname(contract_path), exist_ok=True)
            with open(contract_path, "w") as f:
                f.write(f"contract: {song.copyright_name}")
            engine.add_contract_screenshot(sid, contract_path, operator="小鹿")
            print(f"✅ 小鹿补录合同：{song.scene_name} → {contract_path}")
    print()

    print("=" * 60)
    print("  第 5 步：人工修正歌名（演示一次人工修正）")
    print("=" * 60)
    for sid, song in list(engine.songs.items()):
        if song.scene_name == DEMO_MANUAL_FIX["song_scene"]:
            engine.manual_fix_song_name(
                sid,
                copyright_name=DEMO_MANUAL_FIX["new_copyright"],
                operator="小鹿"
            )
            print(f"✅ 小鹿人工修正：{song.scene_name} 版权名统一为「{DEMO_MANUAL_FIX['new_copyright']}」")
    print()

    print("=" * 60)
    print("  第 6 步：重跑识别（确保修正后状态正确）")
    print("=" * 60)
    engine.rerun_processing()
    print(f"✅ 重跑完成\n")

    print("=" * 60)
    print("  第 7 步：生成给店长的周报")
    print("=" * 60)
    items = engine.generate_weekly_report()
    report = render_weekly_report(items, week_range="2026-06-01 ~ 2026-06-06 演示周")
    print(report)
    print()

    engine.save_state()
    print(f"💾 演示数据已保存到 {args.data_dir}/state.json")
    print(f"   后续可运行：python cli.py report 查看周报")
    print(f"   或运行：python cli.py logs 查看复盘记录")


def main():
    parser = argparse.ArgumentParser(description="录音工程轨道备注清洗")
    parser.add_argument("--data-dir", default="data", help="数据目录")
    parser.add_argument("--state", default=None, help="状态文件路径")

    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import = subparsers.add_parser("import", help="导入排练群接龙")
    p_import.add_argument("--file", help="接龙文本文件")
    p_import.add_argument("--date", help="接龙日期 YYYY-MM-DD")
    p_import.set_defaults(func=cmd_import)

    p_list = subparsers.add_parser("list", help="列出所有歌曲")
    p_list.set_defaults(func=cmd_list)

    p_review = subparsers.add_parser("review", help="音乐老师复核")
    p_review.add_argument("song_id", help="歌曲ID")
    p_review.add_argument("--reviewer", required=True, help="复核人姓名")
    p_review.add_argument("--note", help="复核意见")
    p_review.add_argument("--reject", action="store_true", help="驳回（默认通过）")
    p_review.set_defaults(func=cmd_review)

    p_contract = subparsers.add_parser("contract", help="补录合同页截图")
    p_contract.add_argument("song_id", help="歌曲ID")
    p_contract.add_argument("path", help="截图文件路径")
    p_contract.add_argument("--operator", default="小鹿", help="操作人")
    p_contract.set_defaults(func=cmd_contract)

    p_fix = subparsers.add_parser("fix", help="人工修正歌名")
    p_fix.add_argument("song_id", help="歌曲ID")
    p_fix.add_argument("--scene", help="新现场名")
    p_fix.add_argument("--copyright", help="新版权名")
    p_fix.add_argument("--operator", default="小鹿", help="操作人")
    p_fix.set_defaults(func=cmd_fix)

    p_rerun = subparsers.add_parser("rerun", help="重新跑完全量识别")
    p_rerun.set_defaults(func=cmd_rerun)

    p_report = subparsers.add_parser("report", help="生成店长周报")
    p_report.add_argument("--week", help="周度范围描述")
    p_report.add_argument("--output", help="输出文件路径")
    p_report.set_defaults(func=cmd_report)

    p_logs = subparsers.add_parser("logs", help="查看操作复盘记录")
    p_logs.set_defaults(func=cmd_logs)

    p_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    p_demo.set_defaults(func=cmd_demo)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
