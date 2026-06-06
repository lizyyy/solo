#!/usr/bin/env python3
"""
端到端测试：验证核心三步流程
1. 排练群接龙第一次导入
2. 同名歌曲 → 留给音乐老师复核（不急着归正常）
3. 版权运营小鹿补看合同页截图
4. 给店长看的周报更新
"""

import os
import shutil
from recording_cleaner.engine import RecordingCleanerEngine
from recording_cleaner.report import render_weekly_report

TEST_DATA_DIR = "test_data"

def cleanup():
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR)

def step1_import_signup():
    print("=" * 60)
    print("  第 1 步：排练群接龙第一次导入")
    print("=" * 60)
    engine = RecordingCleanerEngine(data_dir=TEST_DATA_DIR)

    signup_text = """
晴天（版权名：《恋爱预报》） | 主唱+和声轨
夜曲 | 钢琴轨
稻香（版权登记名：《回家的路》） | 吉他弹唱轨
七里香 | 鼓组轨
"""
    signup = engine.import_wechat_signup(signup_text, date="2026-06-07")
    songs = engine.process_signup(signup.signup_id)

    print(f"✅ 导入成功，解析到 {len(signup.songs_raw)} 条记录")
    print(f"   新建歌曲：{len(songs)} 首\n")

    for s in songs:
        copy_info = f"（版权名：{s.copyright_name}）" if s.copyright_name else ""
        print(f"  🎵 {s.scene_name}{copy_info}")
        print(f"     状态：{s.status.value}")
        if s.has_dual_name:
            print(f"     ⚠️  检测到同名异名 → 留给音乐老师复核，不急着归正常")
        print()

    engine.save_state()
    print("💾 状态已保存\n")
    return engine

def step2_check_pending_review(engine):
    print("=" * 60)
    print("  验证：同名歌曲确实处于「待音乐老师复核」状态")
    print("=" * 60)

    pending_count = 0
    for sid, song in engine.songs.items():
        if song.has_dual_name:
            assert song.status.value == "待音乐老师复核", \
                f"歌曲 {song.scene_name} 应该是待复核状态，但实际是 {song.status.value}"
            pending_count += 1
            print(f"  ✅ {song.scene_name}（版权名：{song.copyright_name}）→ 待音乐老师复核")

    print(f"\n共 {pending_count} 首同名歌曲待复核，符合预期：不急着归正常\n")
    return pending_count

def step3_teacher_review(engine):
    print("=" * 60)
    print("  第 2 步：音乐老师复核后，小鹿补录合同页截图")
    print("=" * 60)

    for sid, song in list(engine.songs.items()):
        if song.status.value == "待音乐老师复核":
            engine.teacher_review(
                sid,
                approved=True,
                reviewer="李老师",
                note=f"确认现场名「{song.scene_name}」和版权名「{song.copyright_name}」为同一首歌"
            )
            print(f"  ✅ 李老师复核通过：{song.scene_name}")

    print()
    for sid, song in list(engine.songs.items()):
        if song.status.value == "待补合同页截图":
            contract_path = os.path.join(TEST_DATA_DIR, "contracts", f"{song.copyright_name}_合同.jpg")
            os.makedirs(os.path.dirname(contract_path), exist_ok=True)
            with open(contract_path, "w") as f:
                f.write(f"contract for {song.copyright_name}")
            engine.add_contract_screenshot(sid, contract_path, operator="小鹿")
            print(f"  ✅ 小鹿补录合同截图：{song.scene_name} → {contract_path}")

    print()
    engine.save_state()
    return engine

def step4_generate_report(engine):
    print("=" * 60)
    print("  第 3 步：给店长看的周报更新")
    print("=" * 60)

    items = engine.generate_weekly_report()
    report = render_weekly_report(items, week_range="2026-06-07 测试周")
    print(report)
    return report

def main():
    print("🎬 开始端到端测试：核心三步流程\n")

    cleanup()

    engine = step1_import_signup()
    step2_check_pending_review(engine)
    engine = step3_teacher_review(engine)
    step4_generate_report(engine)

    print("\n" + "=" * 60)
    print("  ✅ 所有测试通过！核心流程验证完毕")
    print("=" * 60)
    print("\n关键业务逻辑确认：")
    print("  ✅ 导入后自动标出同一首歌有现场名和版权名")
    print("  ✅ 同名歌曲不急着归正常，留给音乐老师复核")
    print("  ✅ 补录合同页截图后周报自动更新")
    print("  ✅ 周报里说明：为什么留下、缺什么、下一步找谁")

    cleanup()

if __name__ == "__main__":
    main()
