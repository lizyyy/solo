"""
示例数据模块
用于生成测试和演示用的节目单、模拟音频元数据等
"""

import os
import csv
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from audio_metadata import AudioMetadata, AudioFormat
from rules_engine import QualityIssue, IssueType, IssueSeverity


def generate_sample_schedule(output_path: str = None) -> str:
    """
    生成示例节目单 CSV
    
    Args:
        output_path: 输出文件路径，如果为 None 则返回 CSV 内容
        
    Returns:
        文件路径或 CSV 内容
    """
    # 表头
    headers = ["编号", "标题", "开始时间", "预计时长(秒)", "音频文件", "类型", "口播备注"]
    
    # 数据行（包含各种测试场景）
    rows = [
        # 片头 - 正常
        ["J001", "早间开播片头", "08:00:00", "15", "morning_intro.mp3", "jingle", "音量调大一点"],
        
        # 新闻节目 - 音频可能时长不符
        ["P001", "校园新闻早播报", "08:00:15", "300", "news_20260503.mp3", "program", "注意口播衔接"],
        
        # 天气预报 - 正常
        ["P002", "今日天气", "08:05:15", "60", "weather_report.mp3", "program", ""],
        
        # 广告1 - 可能重复播出
        ["A001", "食堂优惠广告", "08:06:15", "30", "cafeteria_ad.mp3", "ad", "音量适中"],
        
        # 音乐节目 - 音频格式可能有问题
        ["P003", "音乐下午茶", "08:06:45", "600", "music_show.mp3", "program", "注意峰值控制"],
        
        # 广告2 - 与广告1重复检测
        ["A002", "食堂优惠广告", "08:16:45", "30", "cafeteria_ad.mp3", "ad", "同一广告短时间重复"],
        
        # 社团活动宣传 - 缺少音频文件
        ["P004", "社团招新宣传", "08:17:15", "45", "club_recruitment.mp3", "program", "这个文件可能缺失"],
        
        # 演讲比赛 - 时间线冲突（与上一个重叠）
        ["P005", "演讲比赛实况", "08:17:30", "180", "speech_contest.mp3", "program", "时间可能冲突"],
        
        # 片尾
        ["J002", "上午时段结束片花", "08:20:30", "10", "segment_ending.mp3", "jingle", ""],
    ]
    
    if output_path:
        # 确保目录存在
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)
        
        return output_path
    else:
        # 构建 CSV 字符串
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        return output.getvalue()


def generate_mock_audio_metadata() -> Dict[str, AudioMetadata]:
    """
    生成模拟的音频元数据（用于测试和演示）
    
    Returns:
        音频文件名 -> AudioMetadata 的字典
    """
    metadata_dict = {}
    
    # morning_intro.mp3 - 正常
    m1 = AudioMetadata(
        file_path="/mock/audio/morning_intro.mp3",
        file_name="morning_intro.mp3",
        format=AudioFormat.MP3,
        duration_seconds=15.2,
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=192000,
        peak_dbfs=-2.3,
        rms_dbfs=-18.5,
        leading_silence_duration=0.1,
        trailing_silence_duration=0.2,
        parse_success=True
    )
    metadata_dict["morning_intro.mp3"] = m1
    
    # news_20260503.mp3 - 时长过长
    m2 = AudioMetadata(
        file_path="/mock/audio/news_20260503.mp3",
        file_name="news_20260503.mp3",
        format=AudioFormat.MP3,
        duration_seconds=310.5,  # 预计 300 秒，实际 310.5 秒
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=192000,
        peak_dbfs=-3.1,
        rms_dbfs=-16.8,
        leading_silence_duration=0.05,
        trailing_silence_duration=0.1,
        parse_success=True
    )
    metadata_dict["news_20260503.mp3"] = m2
    
    # weather_report.mp3 - 正常
    m3 = AudioMetadata(
        file_path="/mock/audio/weather_report.mp3",
        file_name="weather_report.mp3",
        format=AudioFormat.MP3,
        duration_seconds=58.3,
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=128000,
        peak_dbfs=-4.2,
        rms_dbfs=-20.1,
        leading_silence_duration=0.2,
        trailing_silence_duration=0.3,
        parse_success=True
    )
    metadata_dict["weather_report.mp3"] = m3
    
    # cafeteria_ad.mp3 - 峰值过高 + 片头静音过长
    m4 = AudioMetadata(
        file_path="/mock/audio/cafeteria_ad.mp3",
        file_name="cafeteria_ad.mp3",
        format=AudioFormat.MP3,
        duration_seconds=29.8,
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=256000,
        peak_dbfs=-0.3,  # 接近 0dBFS，有削波风险
        rms_dbfs=-12.5,
        leading_silence_duration=2.5,  # 片头静音过长
        trailing_silence_duration=0.5,
        parse_success=True
    )
    metadata_dict["cafeteria_ad.mp3"] = m4
    
    # music_show.mp3 - 采样率不对 + 单声道 + 音量过低
    m5 = AudioMetadata(
        file_path="/mock/audio/music_show.mp3",
        file_name="music_show.mp3",
        format=AudioFormat.MP3,
        duration_seconds=595.0,
        sample_rate=22050,  # 采样率不对（应该是 44100）
        channels=1,  # 单声道
        bit_depth=16,
        bitrate=64000,
        peak_dbfs=-8.5,
        rms_dbfs=-28.0,  # 音量过低
        leading_silence_duration=0.3,
        trailing_silence_duration=10.0,  # 片尾静音过长
        parse_success=True
    )
    metadata_dict["music_show.mp3"] = m5
    
    # speech_contest.mp3 - 格式问题（OGG）
    m6 = AudioMetadata(
        file_path="/mock/audio/speech_contest.mp3",
        file_name="speech_contest.ogg",  # 实际是 OGG 格式
        format=AudioFormat.OGG,
        duration_seconds=178.5,
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=160000,
        peak_dbfs=-5.0,
        rms_dbfs=-19.0,
        leading_silence_duration=0.5,
        trailing_silence_duration=0.8,
        parse_success=True
    )
    metadata_dict["speech_contest.ogg"] = m6
    
    # segment_ending.mp3 - 正常
    m7 = AudioMetadata(
        file_path="/mock/audio/segment_ending.mp3",
        file_name="segment_ending.mp3",
        format=AudioFormat.MP3,
        duration_seconds=9.8,
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=192000,
        peak_dbfs=-3.5,
        rms_dbfs=-17.2,
        leading_silence_duration=0.1,
        trailing_silence_duration=0.1,
        parse_success=True
    )
    metadata_dict["segment_ending.mp3"] = m7
    
    # extra_file.mp3 - 未被节目单引用的文件
    m8 = AudioMetadata(
        file_path="/mock/audio/extra_file.mp3",
        file_name="extra_file.mp3",
        format=AudioFormat.MP3,
        duration_seconds=45.0,
        sample_rate=44100,
        channels=2,
        bit_depth=16,
        bitrate=192000,
        peak_dbfs=-4.0,
        rms_dbfs=-18.0,
        leading_silence_duration=0.2,
        trailing_silence_duration=0.2,
        parse_success=True
    )
    metadata_dict["extra_file.mp3"] = m8
    
    return metadata_dict


def generate_mock_quality_issues() -> List[QualityIssue]:
    """
    生成模拟的质检问题列表（用于演示）
    
    Returns:
        QualityIssue 列表
    """
    issues = []
    
    # 1. 缺少音频文件（严重）
    i1 = QualityIssue(
        issue_type=IssueType.MISSING_AUDIO,
        severity=IssueSeverity.CRITICAL,
        item_id="P004",
        audio_file="club_recruitment.mp3",
        title="社团招新宣传",
        message="节目单中引用的音频文件 'club_recruitment.mp3' 不存在于素材目录中",
        expected_value="文件存在",
        actual_value="文件缺失"
    )
    issues.append(i1)
    
    # 2. 时间线重叠（严重）
    i2 = QualityIssue(
        issue_type=IssueType.TIMELINE_OVERLAP,
        severity=IssueSeverity.CRITICAL,
        item_id="P004 & P005",
        title="时间重叠: 社团招新宣传 / 演讲比赛实况",
        message="条目 'P004(社团招新宣传)' 结束于 08:18:00，与条目 'P005(演讲比赛实况)' 开始于 08:17:30 重叠 30.0 秒",
        expected_value="无时间重叠",
        actual_value="重叠 30.0 秒"
    )
    issues.append(i2)
    
    # 3. 峰值过高（严重）
    i3 = QualityIssue(
        issue_type=IssueType.PEAK_TOO_HIGH,
        severity=IssueSeverity.CRITICAL,
        item_id="A001",
        audio_file="cafeteria_ad.mp3",
        title="食堂优惠广告",
        message="音量峰值达到 -0.30 dBFS，接近削波阈值！",
        expected_value="< 0.0 dBFS",
        actual_value="-0.30 dBFS"
    )
    issues.append(i3)
    
    # 4. 时长过长（警告）
    i4 = QualityIssue(
        issue_type=IssueType.DURATION_TOO_LONG,
        severity=IssueSeverity.WARNING,
        item_id="P001",
        audio_file="news_20260503.mp3",
        title="校园新闻早播报",
        message="实际时长 05:10.500 比节目单预计的 05:00 长 10.50 秒",
        expected_value="05:00",
        actual_value="05:10.500"
    )
    issues.append(i4)
    
    # 5. 片头静音过长（警告）
    i5 = QualityIssue(
        issue_type=IssueType.LEADING_SILENCE_TOO_LONG,
        severity=IssueSeverity.WARNING,
        item_id="A001",
        audio_file="cafeteria_ad.mp3",
        title="食堂优惠广告",
        message="片头静音时长 2.50 秒，超过建议的 1.0 秒",
        expected_value="<= 1.0 秒",
        actual_value="2.50 秒"
    )
    issues.append(i5)
    
    # 6. 片尾静音过长（警告）
    i6 = QualityIssue(
        issue_type=IssueType.TRAILING_SILENCE_TOO_LONG,
        severity=IssueSeverity.WARNING,
        item_id="P003",
        audio_file="music_show.mp3",
        title="音乐下午茶",
        message="片尾静音时长 10.00 秒，超过建议的 1.0 秒",
        expected_value="<= 1.0 秒",
        actual_value="10.00 秒"
    )
    issues.append(i6)
    
    # 7. 采样率不符（警告）
    i7 = QualityIssue(
        issue_type=IssueType.SAMPLE_RATE_MISMATCH,
        severity=IssueSeverity.WARNING,
        item_id="P003",
        audio_file="music_show.mp3",
        title="音乐下午茶",
        message="采样率 22050 Hz 与要求的 44100 Hz 不符",
        expected_value="44100 Hz",
        actual_value="22050 Hz"
    )
    issues.append(i7)
    
    # 8. 声道数不符（警告）
    i8 = QualityIssue(
        issue_type=IssueType.CHANNELS_MISMATCH,
        severity=IssueSeverity.WARNING,
        item_id="P003",
        audio_file="music_show.mp3",
        title="音乐下午茶",
        message="声道数为 单声道，要求为 立体声",
        expected_value="立体声",
        actual_value="单声道"
    )
    issues.append(i8)
    
    # 9. 广告重复播出（警告）
    i9 = QualityIssue(
        issue_type=IssueType.AD_DUPLICATE_IN_TIMELINE,
        severity=IssueSeverity.WARNING,
        item_id="A001 & A002",
        audio_file="cafeteria_ad.mp3",
        title="广告重复: 食堂优惠广告",
        message="广告 'cafeteria_ad.mp3' 在 08:06:15 和 08:16:45 重复播出，间隔仅 10.3 分钟（建议间隔 >= 30.0 分钟）",
        expected_value=">= 30.0 分钟间隔",
        actual_value="10.3 分钟间隔"
    )
    issues.append(i9)
    
    # 10. 音量过低（信息）
    i10 = QualityIssue(
        issue_type=IssueType.PEAK_TOO_LOW,
        severity=IssueSeverity.INFO,
        item_id="P003",
        audio_file="music_show.mp3",
        title="音乐下午茶",
        message="平均音量 -28.00 dBFS 偏低，建议提升音量",
        expected_value=">= -24.0 dBFS",
        actual_value="-28.00 dBFS"
    )
    issues.append(i10)
    
    # 11. 未使用的音频文件（信息）
    i11 = QualityIssue(
        issue_type=IssueType.UNUSED_AUDIO,
        severity=IssueSeverity.INFO,
        audio_file="extra_file.mp3",
        title="未使用的素材",
        message="音频文件 'extra_file.mp3' 存在但未被节目单引用",
        expected_value="被节目单引用",
        actual_value="未引用"
    )
    issues.append(i11)
    
    return issues


def create_demo_project(output_directory: str) -> Dict[str, str]:
    """
    创建一个完整的演示项目
    
    Args:
        output_directory: 输出目录
        
    Returns:
        创建的文件路径字典
    """
    os.makedirs(output_directory, exist_ok=True)
    
    files = {}
    
    # 1. 生成节目单 CSV
    schedule_path = os.path.join(output_directory, "program_schedule.csv")
    files["schedule"] = generate_sample_schedule(schedule_path)
    
    # 2. 创建音频子目录
    audio_dir = os.path.join(output_directory, "audio")
    os.makedirs(audio_dir, exist_ok=True)
    
    # 3. 生成说明文件（因为没有真实音频文件）
    readme_path = os.path.join(audio_dir, "README.txt")
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write("音频素材目录\n")
        f.write("=" * 50 + "\n\n")
        f.write("此目录用于存放音频素材文件。\n")
        f.write("当前为演示模式，使用模拟数据。\n\n")
        f.write("预期的音频文件列表：\n")
        f.write("- morning_intro.mp3 (片头)\n")
        f.write("- news_20260503.mp3 (新闻节目)\n")
        f.write("- weather_report.mp3 (天气预报)\n")
        f.write("- cafeteria_ad.mp3 (广告)\n")
        f.write("- music_show.mp3 (音乐节目)\n")
        f.write("- speech_contest.mp3 (演讲比赛)\n")
        f.write("- segment_ending.mp3 (片尾)\n")
        f.write("- extra_file.mp3 (未使用的文件)\n")
    
    files["audio_readme"] = readme_path
    
    # 4. 生成演示状态文件
    demo_state = {
        "session_id": "demo_session",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "project_name": "演示项目 - 早间节目排播",
        "schedule_csv_path": schedule_path,
        "audio_directory": audio_dir,
        "issue_resolutions": [],
        "custom_config": {},
        "session_notes": "这是一个演示项目，用于展示播前音频质检台的功能。",
        "check_history": []
    }
    
    state_path = os.path.join(output_directory, "demo_state.json")
    with open(state_path, 'w', encoding='utf-8') as f:
        json.dump(demo_state, f, ensure_ascii=False, indent=2)
    
    files["demo_state"] = state_path
    
    return files


# 测试数据生成
if __name__ == "__main__":
    import json
    
    print("=" * 50)
    print("示例数据生成器")
    print("=" * 50)
    
    # 生成节目单
    print("\n1. 示例节目单 CSV:")
    csv_content = generate_sample_schedule()
    print(csv_content)
    
    # 生成模拟元数据
    print("\n2. 模拟音频元数据:")
    metadata = generate_mock_audio_metadata()
    for filename, meta in metadata.items():
        print(f"  - {filename}: {meta.duration_formatted}, {meta.format_str}, {meta.sample_rate}Hz")
        print(f"    峰值: {meta.peak_dbfs:.1f} dBFS, 片头静音: {meta.leading_silence_duration:.1f}s")
    
    # 生成模拟问题
    print("\n3. 模拟质检问题:")
    issues = generate_mock_quality_issues()
    for idx, issue in enumerate(issues, 1):
        print(f"  {idx}. [{issue.severity_display}] {issue.issue_type_display}: {issue.title}")
        print(f"     {issue.message}")
    
    print("\n" + "=" * 50)
    print("示例数据生成完成")
    print("=" * 50)
