#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建测试数据 - 覆盖各种边界情况
"""

import os
import time
from pathlib import Path


TEST_ROOT = "test_data"


def create_normal_case():
    """正常情况：所有文件齐全，无重复剪辑点"""
    case_dir = Path(TEST_ROOT) / "01_正常完整材料"
    case_dir.mkdir(parents=True, exist_ok=True)

    (case_dir / "录音文件.mp3").write_bytes(b"fake audio data for test")

    (case_dir / "字幕草稿.txt").write_text(
        """00:00:00 大家好，欢迎收听本期播客
00:00:15 今天我们来聊聊人工智能的发展
00:00:30 首先介绍一下今天的嘉宾
00:01:00 第一个话题：AI 在日常生活中的应用
00:02:00 第二个话题：AI 的未来发展趋势
00:03:00 感谢收听，下期再见
""",
        encoding="utf-8",
    )

    (case_dir / "剪辑点清单.txt").write_text(
        """开场,00:00:00,00:00:15
嘉宾介绍,00:00:30,00:01:00
话题1,00:01:00,00:02:00
话题2,00:02:00,00:03:00
结尾,00:03:00,00:03:30
""",
        encoding="utf-8",
    )

    (case_dir / "嘉宾名单.txt").write_text(
        """张三 - AI 研究员
李四 - 产品经理
王五 - 主持人
""",
        encoding="utf-8",
    )
    print(f"✓ 创建正常案例: {case_dir}")


def create_missing_guest_case():
    """缺嘉宾名单"""
    case_dir = Path(TEST_ROOT) / "02_缺嘉宾名单"
    case_dir.mkdir(parents=True, exist_ok=True)

    (case_dir / "录音文件.wav").write_bytes(b"fake wav data")

    (case_dir / "字幕草稿.txt").write_text(
        """00:00:00 欢迎收听
00:00:10 今天的话题很有趣
00:00:20 我们邀请了几位嘉宾
""",
        encoding="utf-8",
    )

    (case_dir / "剪辑点清单.txt").write_text(
        """开场,00:00:00,00:00:10
主话题,00:00:10,00:00:20
""",
        encoding="utf-8",
    )
    print(f"✓ 创建缺嘉宾名单案例: {case_dir}")


def create_duplicate_clips_case():
    """有重复剪辑点"""
    case_dir = Path(TEST_ROOT) / "03_重复剪辑点"
    case_dir.mkdir(parents=True, exist_ok=True)

    (case_dir / "recording.m4a").write_bytes(b"fake m4a data")

    (case_dir / "字幕草稿.txt").write_text(
        """00:00:00 开场
00:00:30 话题A
00:01:00 话题A
00:01:30 话题B
""",
        encoding="utf-8",
    )

    (case_dir / "剪辑点.txt").write_text(
        """开场,00:00:00,00:00:30
话题A,00:00:30,00:01:00
话题A,00:01:00,00:01:30
话题B,00:01:30,00:02:00
话题B,00:02:00,00:02:30
结尾,00:02:30,00:03:00
""",
        encoding="utf-8",
    )

    (case_dir / "嘉宾.txt").write_text(
        """嘉宾A
嘉宾B
""",
        encoding="utf-8",
    )
    print(f"✓ 创建重复剪辑点案例: {case_dir}")


def create_missing_recording_case():
    """缺录音文件（阻塞）"""
    case_dir = Path(TEST_ROOT) / "04_缺录音文件_阻塞"
    case_dir.mkdir(parents=True, exist_ok=True)

    (case_dir / "字幕草稿.txt").write_text(
        """00:00:00 test
00:00:10 test2
""",
        encoding="utf-8",
    )

    (case_dir / "剪辑点.txt").write_text(
        """part1,00:00:00,00:00:10
""",
        encoding="utf-8",
    )

    (case_dir / "嘉宾名单.txt").write_text("嘉宾1\n", encoding="utf-8")
    print(f"✓ 创建缺录音文件案例: {case_dir}")


def create_multiple_missing_case():
    """同时缺多个文件"""
    case_dir = Path(TEST_ROOT) / "05_同时缺多个文件"
    case_dir.mkdir(parents=True, exist_ok=True)

    (case_dir / "字幕草稿.txt").write_text(
        """00:00:00 只有字幕
""",
        encoding="utf-8",
    )
    print(f"✓ 创建多文件缺失案例: {case_dir}")


def create_modified_subtitle_case():
    """先处理一次，然后修改字幕草稿（测试变更检测）"""
    case_dir = Path(TEST_ROOT) / "06_字幕草稿被修改"
    case_dir.mkdir(parents=True, exist_ok=True)

    (case_dir / "录音文件.mp3").write_bytes(b"audio data")

    (case_dir / "字幕草稿.txt").write_text(
        """00:00:00 初始版本
00:00:10 内容A
""",
        encoding="utf-8",
    )

    (case_dir / "剪辑点清单.txt").write_text(
        """p1,00:00:00,00:00:10
""",
        encoding="utf-8",
    )

    (case_dir / "嘉宾名单.txt").write_text("嘉宾X\n", encoding="utf-8")
    print(f"✓ 创建字幕修改测试案例: {case_dir}")
    return case_dir


def modify_subtitle_later(case_dir):
    """模拟修改字幕草稿"""
    time.sleep(1.1)
    subtitle_file = case_dir / "字幕草稿.txt"
    subtitle_file.write_text(
        """00:00:00 初始版本
00:00:10 内容A - 已修改
00:00:20 新增内容
""",
        encoding="utf-8",
    )
    print(f"  → 已修改字幕文件: {subtitle_file}")


def main():
    if Path(TEST_ROOT).exists():
        import shutil
        shutil.rmtree(TEST_ROOT)
        print(f"已清理旧测试目录: {TEST_ROOT}")

    create_normal_case()
    create_missing_guest_case()
    create_duplicate_clips_case()
    create_missing_recording_case()
    create_multiple_missing_case()
    case_dir = create_modified_subtitle_case()

    print(f"\n测试数据创建完成，目录: {os.path.abspath(TEST_ROOT)}")
    print("\n可用的测试案例:")
    for d in sorted(Path(TEST_ROOT).iterdir()):
        if d.is_dir():
            print(f"  - {d.name}")

    return case_dir


if __name__ == "__main__":
    main()
