#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
示例素材生成器
用于创建测试用的播客音频素材
"""

import os
import sys
import shutil
from pathlib import Path
from datetime import datetime

try:
    from pydub import AudioSegment
    from pydub.generators import Sine
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False


def create_silent_audio(duration_ms: int, sample_rate: int = 44100, channels: int = 2) -> AudioSegment:
    return AudioSegment.silent(duration=duration_ms, frame_rate=sample_rate)


def create_test_tone(duration_ms: int, frequency: float = 440.0, 
                      sample_rate: int = 44100, volume: float = -20.0) -> AudioSegment:
    sine = Sine(frequency, sample_rate=sample_rate)
    audio = sine.to_audio_segment(duration=duration_ms)
    return audio + volume


def create_sample_audio(output_path: str, duration_seconds: float = 5.0,
                         sample_rate: int = 44100, channels: int = 2,
                         format: str = "wav"):
    if not PYDUB_AVAILABLE:
        raise RuntimeError("pydub 未安装，无法生成音频文件")
    
    duration_ms = int(duration_seconds * 1000)
    
    audio = create_test_tone(duration_ms, sample_rate=sample_rate)
    
    if channels == 1:
        audio = audio.set_channels(1)
    
    audio = audio.set_frame_rate(sample_rate)
    
    audio.export(output_path, format=format)
    print(f"  已生成: {output_path} ({sample_rate} Hz, {channels}ch)")


def create_sample_project(project_path: str, generate_audio: bool = True):
    project_path = Path(project_path).resolve()
    
    print(f"创建示例项目: {project_path}")
    print("=" * 50)
    
    if project_path.exists():
        print(f"警告: 项目文件夹已存在，将覆盖内容")
        shutil.rmtree(project_path)
    
    project_path.mkdir(parents=True, exist_ok=True)
    
    (project_path / "主持人").mkdir()
    (project_path / "嘉宾").mkdir()
    (project_path / "片头片尾").mkdir()
    (project_path / "广告").mkdir()
    (project_path / "远程录音").mkdir()
    (project_path / "output").mkdir()
    
    print("\n创建素材文件...")
    
    if generate_audio and PYDUB_AVAILABLE:
        create_sample_audio(
            str(project_path / "主持人" / "第001期_主持人_张三.wav"),
            duration_seconds=10.0,
            sample_rate=48000,
            channels=2,
            format="wav"
        )
        
        create_sample_audio(
            str(project_path / "嘉宾" / "第001期_嘉宾_李四.wav"),
            duration_seconds=8.0,
            sample_rate=48000,
            channels=2,
            format="wav"
        )
        
        create_sample_audio(
            str(project_path / "嘉宾" / "第001期_嘉宾_王五.mp3"),
            duration_seconds=6.0,
            sample_rate=44100,
            channels=2,
            format="mp3"
        )
        
        create_sample_audio(
            str(project_path / "片头片尾" / "第001期_片头.wav"),
            duration_seconds=3.0,
            sample_rate=48000,
            channels=2,
            format="wav"
        )
        
        create_sample_audio(
            str(project_path / "片头片尾" / "第001期_片尾.wav"),
            duration_seconds=2.0,
            sample_rate=48000,
            channels=2,
            format="wav"
        )
        
        create_sample_audio(
            str(project_path / "广告" / "第001期_广告_品牌A.wav"),
            duration_seconds=4.0,
            sample_rate=48000,
            channels=2,
            format="wav"
        )
        
        create_sample_audio(
            str(project_path / "远程录音" / "第001期_远程_赵六.wav"),
            duration_seconds=5.0,
            sample_rate=44100,
            channels=1,
            format="wav"
        )
        
        create_sample_audio(
            str(project_path / "远程录音" / "第001期_远程_钱七.m4a"),
            duration_seconds=7.0,
            sample_rate=44100,
            channels=1,
            format="mp4"
        )
        
        create_sample_audio(
            str(project_path / "第001期_未知角色.wav"),
            duration_seconds=3.0,
            sample_rate=48000,
            channels=2,
            format="wav"
        )
        
    else:
        print("\n警告: pydub 未安装，无法生成实际音频文件")
        print("将创建占位文本文件，您可以用真实音频文件替换它们")
        print("")
        
        placeholder_files = [
            "主持人/第001期_主持人_张三.wav",
            "嘉宾/第001期_嘉宾_李四.wav",
            "嘉宾/第001期_嘉宾_王五.mp3",
            "片头片尾/第001期_片头.wav",
            "片头片尾/第001期_片尾.wav",
            "广告/第001期_广告_品牌A.wav",
            "远程录音/第001期_远程_赵六.wav",
            "远程录音/第001期_远程_钱七.m4a",
            "第001期_未知角色.wav",
        ]
        
        for rel_path in placeholder_files:
            full_path = project_path / rel_path
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(f"这是一个音频文件占位符\n")
                f.write(f"文件名: {Path(rel_path).name}\n")
                f.write(f"创建时间: {datetime.now()}\n")
                f.write(f"\n请用真实音频文件替换此文件。\n")
            print(f"  已创建占位符: {rel_path}")
    
    print("\n" + "=" * 50)
    print("示例项目创建完成!")
    print(f"项目路径: {project_path}")
    print("\n素材说明:")
    print("  - 主持人: 48000 Hz, 立体声")
    print("  - 嘉宾李四: 48000 Hz, 立体声")
    print("  - 嘉宾王五: 44100 Hz, 立体声 (采样率不一致)")
    print("  - 片头片尾: 48000 Hz, 立体声")
    print("  - 广告: 48000 Hz, 立体声")
    print("  - 远程录音赵六: 44100 Hz, 单声道 (采样率和声道都不一致)")
    print("  - 远程录音钱七: 44100 Hz, 单声道 (m4a格式)")
    print("  - 未知角色: 未指定角色的素材")
    print("\n预期检测到的问题:")
    print("  1. 采样率不一致 (44100 vs 48000)")
    print("  2. 声道数不一致 (单声道 vs 立体声)")
    print("  3. 未知角色的素材")
    print("")
    return project_path


def print_usage():
    print("用法:")
    print("  python create_sample_project.py <项目路径>")
    print("")
    print("示例:")
    print("  python create_sample_project.py ~/Desktop/播客第001期")
    print("")
    print("说明:")
    print("  此脚本会创建一个包含多种测试场景的示例播客项目")
    print("  包括不同采样率、声道数、角色的音频文件")
    print("")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_usage()
        
        default_path = Path.home() / "Desktop" / "示例播客项目_第001期"
        response = input(f"\n是否使用默认路径创建示例项目? ({default_path}) [Y/n]: ")
        
        if response.lower() in ["", "y", "yes"]:
            create_sample_project(str(default_path))
        else:
            sys.exit(0)
    else:
        project_path = sys.argv[1]
        create_sample_project(project_path)
