#!/usr/bin/env python3
"""
生成示例文件的脚本
用于创建测试用的音频、图片等文件
"""

import os
import struct
import io
from PIL import Image


def create_dummy_mp3(file_path, duration_seconds=60):
    """
    创建一个简单的MP3占位文件
    注意：这不是真正的音频文件，只是一个有效的MP3文件头
    """
    # MP3文件头 - 简单的同步字和帧头
    # 这只是一个占位文件，不是真正的音频
    mp3_header = struct.pack('>I', 0xFFE00000)  # 简化的MP3帧同步字
    
    with open(file_path, 'wb') as f:
        # 写入多个空帧来达到一定的文件大小
        for _ in range(duration_seconds * 10):  # 简单的计算
            f.write(mp3_header)
            f.write(b'\x00' * 100)  # 填充数据
    
    print(f"已创建MP3文件: {file_path}")


def create_test_image(file_path, width=1400, height=1400, color=(100, 150, 200)):
    """
    创建一个测试用的图片文件
    """
    try:
        # 创建一个纯色图片
        img = Image.new('RGB', (width, height), color)
        
        # 添加一些简单的图案
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        
        # 画一些圆形
        for i in range(5):
            x1 = 100 + i * 50
            y1 = 100 + i * 50
            x2 = width - 100 - i * 50
            y2 = height - 100 - i * 50
            draw.ellipse([x1, y1, x2, y2], outline=(255, 255, 255), width=3)
        
        # 添加文字
        try:
            from PIL import ImageFont
            # 使用默认字体
            font = ImageFont.load_default()
            text = f"Test Image {width}x{height}"
            text_bbox = draw.textbbox((0, 0), text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = (width - text_width) // 2
            text_y = (height - text_height) // 2
            draw.text((text_x, text_y), text, fill=(255, 255, 255), font=font)
        except Exception as e:
            print(f"添加文字失败: {e}")
        
        # 保存图片
        img.save(file_path)
        print(f"已创建图片: {file_path} ({width}x{height})")
        return True
    except Exception as e:
        print(f"创建图片失败: {e}")
        # 创建一个简单的占位文件
        with open(file_path, 'w') as f:
            f.write(f"Placeholder image file - {width}x{height}")
        print(f"已创建占位图片文件: {file_path}")
        return False


def create_dummy_wav(file_path, duration_seconds=10):
    """
    创建一个简单的WAV音频文件
    """
    # WAV文件格式参数
    sample_rate = 44100
    bits_per_sample = 16
    channels = 1  # 单声道
    
    # 计算数据大小
    num_samples = sample_rate * duration_seconds
    data_size = num_samples * channels * (bits_per_sample // 8)
    
    # 构建WAV文件头
    riff_header = b'RIFF'
    riff_size = 36 + data_size  # 36是固定的头大小
    wave_header = b'WAVE'
    fmt_header = b'fmt '
    fmt_size = 16  # PCM格式的fmt块大小
    audio_format = 1  # PCM
    num_channels = channels
    byte_rate = sample_rate * channels * (bits_per_sample // 8)
    block_align = channels * (bits_per_sample // 8)
    bits_per_sample_field = bits_per_sample
    data_header = b'data'
    data_size_field = data_size
    
    # 打包头信息
    header = struct.pack('<4sI4s4sIHHIIHH4sI',
                        riff_header, riff_size, wave_header,
                        fmt_header, fmt_size, audio_format,
                        num_channels, sample_rate, byte_rate,
                        block_align, bits_per_sample_field,
                        data_header, data_size_field)
    
    # 生成简单的音频数据（静音）
    audio_data = b'\x00' * data_size
    
    # 写入文件
    with open(file_path, 'wb') as f:
        f.write(header)
        f.write(audio_data)
    
    print(f"已创建WAV文件: {file_path} (时长: {duration_seconds}秒)")


def main():
    """主函数"""
    # 获取项目根目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(script_dir, 'sample_projects')
    
    # 确保示例目录存在
    if not os.path.exists(sample_dir):
        print(f"示例目录不存在: {sample_dir}")
        return
    
    print("开始生成示例文件...\n")
    
    # 1. tech_talk_2024_05_01 - 创建正确尺寸的封面和音频
    tech_dir = os.path.join(sample_dir, 'tech_talk_2024_05_01')
    if os.path.exists(tech_dir):
        # 创建封面（正确尺寸：1400x1400）
        cover_path = os.path.join(tech_dir, 'cover.jpg')
        create_test_image(cover_path, 1400, 1400, (70, 130, 180))
        
        # 创建音频文件（使用WAV格式，确保mutagen可以解析）
        audio_path = os.path.join(tech_dir, 'episode.wav')
        create_dummy_wav(audio_path, 300)  # 5分钟
    
    # 2. daily_news_2024_05_01 - 创建错误尺寸的封面，缺少音频
    daily_dir = os.path.join(sample_dir, 'daily_news_2024_05_01')
    if os.path.exists(daily_dir):
        # 创建封面（错误尺寸：800x600）
        cover_path = os.path.join(daily_dir, 'cover.png')
        create_test_image(cover_path, 800, 600, (180, 100, 70))
        
        # 创建字幕文件
        subtitle_path = os.path.join(daily_dir, 'subtitles.srt')
        with open(subtitle_path, 'w', encoding='utf-8') as f:
            f.write("""1
00:00:01,000 --> 00:00:05,000
欢迎收听每日新闻

2
00:00:05,000 --> 00:00:10,000
今天是2024年5月1日

3
00:00:10,000 --> 00:00:15,000
首先为您播报科技新闻
""")
        print(f"已创建字幕文件: {subtitle_path}")
        
        # 注意：不创建音频文件，用于测试"缺少音频"的检查
    
    # 3. music_hour_2024_05_01 - 创建混合情况
    music_dir = os.path.join(sample_dir, 'music_hour_2024_05_01')
    if os.path.exists(music_dir):
        # 创建封面（正确尺寸：1600x1600）
        cover_path = os.path.join(music_dir, 'cover.jpg')
        create_test_image(cover_path, 1600, 1600, (100, 180, 100))
        
        # 创建音频文件（使用WAV格式）
        audio_path = os.path.join(music_dir, 'music_hour.wav')
        create_dummy_wav(audio_path, 3600)  # 60分钟
        
        # 创建备注文件（无确认关键词）
        notes_path = os.path.join(music_dir, 'notes.md')
        with open(notes_path, 'w', encoding='utf-8') as f:
            f.write("""# 音乐时刻 2024年5月1日

## 节目内容
- 经典老歌回顾
- 新歌推荐
- 听众点歌环节

## 播放列表
1. 歌曲A - 歌手A
2. 歌曲B - 歌手B
3. 歌曲C - 歌手C

## 注意事项
- 音量调整
- 转场效果
""")
        print(f"已创建备注文件: {notes_path}")
        
        # 创建剪辑单
        edit_path = os.path.join(music_dir, '剪辑单.txt')
        with open(edit_path, 'w', encoding='utf-8') as f:
            f.write("""音乐时刻 2024年5月1日 剪辑单

歌曲顺序：
1. 开场音乐（0:00 - 0:30）
2. 主持人介绍（0:30 - 1:00）
3. 歌曲A（1:00 - 5:00）
4. 歌曲B（5:00 - 9:00）
5. 广告（9:00 - 9:30）
6. 歌曲C（9:30 - 13:30）
7. 结尾（13:30 - 14:00）
""")
        print(f"已创建剪辑单: {edit_path}")
    
    print("\n示例文件生成完成！")
    print("\n节目结构说明：")
    print("1. tech_talk_2024_05_01: 配置正确，应该通过检查")
    print("2. daily_news_2024_05_01: 缺少音频，封面尺寸错误，用于测试失败检查")
    print("3. music_hour_2024_05_01: 备注无确认关键词，用于测试警告检查")


if __name__ == '__main__':
    main()
