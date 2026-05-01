#!/usr/bin/env python3
"""
示例素材生成脚本

用于生成模拟的 SD 卡目录结构，包含视频、音频、代理和边车文件。
这些文件不是真正的媒体文件，而是文本文件，用于测试 media-guardian 工具。

用法:
    python scripts/generate_sample_data.py --output ./sample_data --num-cards 3 --num-clips 5
"""

import argparse
import json
import random
import sys
from datetime import datetime
from pathlib import Path


def generate_sample_data(
    output_dir: Path,
    num_cards: int = 2,
    num_clips: int = 5,
    verbose: bool = False,
) -> list[Path]:
    """
    生成示例素材目录

    Args:
        output_dir: 输出根目录
        num_cards: 模拟的存储卡数量
        num_clips: 每张卡的片段数量
        verbose: 是否输出详细信息

    Returns:
        生成的存储卡目录路径列表
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cameras = ["A", "B", "C"]
    card_types = ["SD", "CFast", "XQD", "CFexpress"]
    card_directories: list[Path] = []

    if verbose:
        print(f"生成示例素材到: {output_dir}")
        print(f"存储卡数量: {num_cards}")
        print(f"每卡片段: {num_clips}")
        print()

    for card_idx in range(num_cards):
        camera = cameras[card_idx % len(cameras)]
        card_type = card_types[card_idx % len(card_types)]
        card_name = f"{camera}_{card_type}_{card_idx + 1:03d}"
        card_dir = output_dir / card_name
        card_directories.append(card_dir)

        dcim_dir = card_dir / "DCIM" / f"100CANON"
        audio_dir = card_dir / "AUDIO"
        private_dir = card_dir / "PRIVATE" / "M4ROOT" / "CLIP"
        subclips_dir = card_dir / "SUBCLIPS"

        dcim_dir.mkdir(parents=True, exist_ok=True)
        audio_dir.mkdir(parents=True, exist_ok=True)
        private_dir.mkdir(parents=True, exist_ok=True)
        subclips_dir.mkdir(parents=True, exist_ok=True)

        shoot_date = datetime(2024, 5, 15 + card_idx)
        shoot_date_str = shoot_date.strftime("%Y%m%d")
        shoot_date_iso = shoot_date.strftime("%Y-%m-%d")

        if verbose:
            print(f"  创建卡: {card_name}")
            print(f"    机位: {camera}")
            print(f"    拍摄日期: {shoot_date_iso}")

        for clip_idx in range(num_clips):
            clip_num = clip_idx + 1
            duration = random.randint(30, 300)
            frame_rate = random.choice([23.98, 24.0, 25.0, 29.97, 30.0, 50.0, 60.0])
            start_hour = random.randint(8, 18)
            start_min = random.randint(0, 59)
            start_sec = random.randint(0, 59)
            start_frame = random.randint(0, int(frame_rate) - 1)

            timecode = f"{start_hour:02d}:{start_min:02d}:{start_sec:02d}:{start_frame:02d}"

            video_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.MP4"
            video_path = dcim_dir / video_name

            video_metadata = {
                "type": "video",
                "name": video_name,
                "duration_seconds": duration,
                "frame_rate": frame_rate,
                "start_timecode": timecode,
                "shoot_date": shoot_date_iso,
                "camera": camera,
                "card_id": card_name,
                "resolution": random.choice(["1920x1080", "3840x2160", "4096x2160"]),
                "codec": random.choice(["H.264", "H.265", "ProRes 422 HQ", "ProRes 4444"]),
                "bit_rate": random.randint(50, 500) * 1000000,
                "_fake": True,
            }

            video_content = json.dumps(video_metadata, indent=2, ensure_ascii=False)
            video_path.write_text(video_content, encoding="utf-8")

            proxy_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}_proxy.mp4"
            proxy_path = dcim_dir / proxy_name
            proxy_metadata = {
                "type": "proxy",
                "name": proxy_name,
                "source": video_name,
                "resolution": "1920x1080",
                "codec": "H.264",
                "_fake": True,
            }
            proxy_path.write_text(json.dumps(proxy_metadata, indent=2), encoding="utf-8")

            audio_name = f"A{camera}{clip_num:04d}.WAV"
            audio_path = audio_dir / audio_name
            audio_metadata = {
                "type": "audio",
                "name": audio_name,
                "duration_seconds": duration,
                "sample_rate": random.choice([44100, 48000, 96000]),
                "channels": random.choice([1, 2, 8]),
                "bit_depth": random.choice([16, 24]),
                "camera": camera,
                "_fake": True,
            }
            audio_path.write_text(json.dumps(audio_metadata, indent=2), encoding="utf-8")

            if clip_idx % 2 == 0:
                srt_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.srt"
                srt_path = dcim_dir / srt_name

                num_subs = random.randint(2, 10)
                srt_lines = []
                for sub_idx in range(num_subs):
                    sub_start_sec = sub_idx * (duration // num_subs)
                    sub_end_sec = (sub_idx + 1) * (duration // num_subs)

                    start_str = f"00:{sub_start_sec // 60:02d}:{sub_start_sec % 60:02d},000"
                    end_str = f"00:{sub_end_sec // 60:02d}:{sub_end_sec % 60:02d},000"

                    srt_lines.extend([
                        f"{sub_idx + 1}",
                        f"{start_str} --> {end_str}",
                        f"示例字幕第 {sub_idx + 1} 行",
                        "",
                    ])

                srt_content = "\n".join(srt_lines)
                srt_path.write_text(srt_content, encoding="utf-8")

            if clip_idx % 3 == 0:
                json_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.json"
                json_path = dcim_dir / json_name

                sidecar_data = {
                    "clip_name": video_name,
                    "duration": duration,
                    "camera": camera,
                    "shoot_date": shoot_date_iso,
                    "timecode": timecode,
                    "lens": random.choice([
                        "Canon EF 24-70mm f/2.8L II",
                        "Canon EF 70-200mm f/2.8L IS III",
                        "Sony FE 16-35mm f/2.8 GM",
                        "Sony FE 24-70mm f/2.8 GM II",
                    ]),
                    "iso": random.choice([100, 200, 400, 800, 1600, 3200]),
                    "aperture": random.choice(["f/2.8", "f/4", "f/5.6", "f/8"]),
                    "shutter_speed": f"1/{random.choice([48, 50, 60, 100, 120, 200])}",
                    "white_balance": random.choice([3200, 4300, 5500, 5600, 6500]),
                    "gps": {
                        "latitude": round(random.uniform(30.0, 45.0), 6),
                        "longitude": round(random.uniform(110.0, 125.0), 6),
                    } if random.random() > 0.5 else None,
                    "_fake": True,
                }

                json_path.write_text(json.dumps(sidecar_data, indent=2, ensure_ascii=False), encoding="utf-8")

            if clip_idx % 4 == 0:
                csv_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.csv"
                csv_path = dcim_dir / csv_name

                csv_lines = [
                    "timecode,level_left,level_right,peak_left,peak_right",
                ]
                for t in range(0, min(duration, 10)):
                    csv_lines.append(
                        f"{t:02d}:00:00,{random.randint(-40, -12)},{random.randint(-40, -12)},{random.randint(-20, 0)},{random.randint(-20, 0)}"
                    )

                csv_path.write_text("\n".join(csv_lines), encoding="utf-8")

        readme_path = card_dir / "README.txt"
        readme_content = f"""模拟存储卡目录
================

卡号: {card_name}
机位: {camera}
拍摄日期: {shoot_date_iso}

目录结构:
- DCIM/100CANON/ - 视频和照片文件
- AUDIO/ - 音频文件
- PRIVATE/M4ROOT/CLIP/ - 摄像机私有数据
- SUBCLIPS/ - 代理/低码率文件

注意: 这些都是模拟的文本文件，不是真正的媒体文件。
      用于测试 media-guardian 工具。

生成时间: {datetime.now().isoformat()}
"""
        readme_path.write_text(readme_content, encoding="utf-8")

    if verbose:
        print()
        print(f"完成！生成了 {num_cards} 张卡，共 {num_cards * num_clips} 个片段。")
        print(f"输出目录: {output_dir}")
        print()
        print("使用示例:")
        print(f"  media-guardian scan {output_dir}/* -o manifest.json")
        print(f"  media-guardian plan manifest.json ./archive")
        print(f"  media-guardian copy manifest.json")

    return card_directories


def main():
    parser = argparse.ArgumentParser(
        description="生成示例素材目录（用于测试 media-guardian）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python scripts/generate_sample_data.py -o ./sample_data
  python scripts/generate_sample_data.py -o ./sample_data --num-cards 3 --num-clips 10
        """,
    )

    parser.add_argument(
        "--output", "-o",
        type=Path,
        required=True,
        help="输出根目录路径",
    )
    parser.add_argument(
        "--num-cards", "-c",
        type=int,
        default=2,
        help="模拟的存储卡数量 (默认: 2)",
    )
    parser.add_argument(
        "--num-clips", "-k",
        type=int,
        default=5,
        help="每张卡的片段数量 (默认: 5)",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="安静模式，减少输出",
    )

    args = parser.parse_args()

    try:
        generate_sample_data(
            output_dir=args.output,
            num_cards=args.num_cards,
            num_clips=args.num_clips,
            verbose=not args.quiet,
        )
        return 0
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
