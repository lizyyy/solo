#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
import random
from datetime import datetime, timedelta


def generate_sample_excel(output_path: str):
    data = [
        {
            "曲目ID": "TRK001",
            "曲名": "午夜节拍",
            "艺术家": "DJ小明",
            "专辑": "电音派对 Vol.1",
            "时长": "3:45",
            "BPM": 128,
            "能量等级": 8,
            "授权": "已授权 - 商用许可",
            "备注": "主打曲目"
        },
        {
            "曲目ID": "TRK002",
            "曲名": "星空漫步",
            "艺术家": "DJ小红",
            "专辑": "Chill Vibes",
            "时长": "4:20",
            "BPM": 100,
            "能量等级": 4,
            "授权": "已授权",
            "备注": ""
        },
        {
            "曲目ID": "TRK003",
            "曲名": "暴风来袭 (Old Version)",
            "艺术家": "DJ小刚",
            "专辑": "风暴系列",
            "时长": "5:10",
            "BPM": 140,
            "能量等级": 9,
            "授权": "已授权",
            "备注": "旧版母带"
        },
        {
            "曲目ID": "TRK004",
            "曲名": "暴风来袭 (Final Master)",
            "艺术家": "DJ小刚",
            "专辑": "风暴系列",
            "时长": "5:12",
            "BPM": 140,
            "能量等级": 9,
            "授权": "已授权",
            "备注": "新版母带，替换旧版"
        },
        {
            "曲目ID": "TRK005",
            "曲名": "深海回响",
            "艺术家": "未知艺术家",
            "专辑": "",
            "时长": "3:58",
            "BPM": 120,
            "能量等级": 6,
            "授权": "",
            "备注": "授权待确认"
        },
        {
            "曲目ID": "TRK006",
            "曲名": "霓虹之夜",
            "艺术家": "DJ小美",
            "专辑": "城市节拍",
            "时长": "4:05",
            "BPM": 130,
            "能量等级": 7,
            "授权": "已授权",
            "备注": ""
        },
        {
            "曲目ID": "TRK007",
            "曲名": "霓虹之夜_Remix",
            "艺术家": "DJ小美",
            "专辑": "城市节拍",
            "时长": "4:15",
            "BPM": 132,
            "能量等级": 8,
            "授权": "已授权",
            "备注": "Remix版本"
        },
        {
            "曲目ID": "TRK008",
            "曲名": "晨曦微光",
            "艺术家": "DJ阿杰",
            "专辑": "晨光系列",
            "时长": "3:30",
            "BPM": 95,
            "能量等级": 3,
            "授权": "待申请",
            "备注": ""
        },
        {
            "曲目ID": "TRK009",
            "曲名": "电子脉冲",
            "艺术家": "DJ小飞",
            "专辑": "Future Bass",
            "时长": "3:55",
            "BPM": 110,
            "能量等级": 7,
            "授权": "已授权",
            "备注": "人工改名确认"
        },
        {
            "曲目ID": "TRK010",
            "曲名": "迷失幻境",
            "艺术家": "DJ小林",
            "专辑": "迷幻电音",
            "时长": "4:30",
            "BPM": 118,
            "能量等级": 6,
            "授权": "已授权",
            "备注": ""
        }
    ]
    
    df = pd.DataFrame(data)
    
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(output_path, index=False, sheet_name="曲目列表")
    
    print(f"✅ 样例曲目表已生成: {output_path}")
    print(f"   包含 {len(data)} 条曲目记录")
    print()
    print("   📋 曲目构成:")
    print("   - TRK001-002: 正常曲目")
    print("   - TRK003-004: 新旧版本对比")
    print("   - TRK005, TRK008: 缺授权")
    print("   - TRK006-007: 重复/Remix")
    print("   - TRK009: 人工改名")
    print("   - TRK010: 无对应音频文件")


def generate_sample_audio(audio_dir: str):
    Path(audio_dir).mkdir(parents=True, exist_ok=True)
    
    audio_files = [
        ("DJ小明 - 午夜节拍.mp3", 8000000, 5),
        ("DJ小红 - 星空漫步.wav", 40000000, 3),
        ("DJ小刚 - 暴风来袭_OldVersion.mp3", 10000000, 10),
        ("DJ小刚 - 暴风来袭_FinalMaster.mp3", 10500000, 2),
        ("深海回响_无授权.mp3", 7500000, 7),
        ("DJ小美 - 霓虹之夜.mp3", 8200000, 4),
        ("DJ小美 - 霓虹之夜_Remix.mp3", 8500000, 4),
        ("DJ阿杰 - 晨曦微光.mp3", 7000000, 6),
        ("Electric_Pulse_人工修改.mp3", 7800000, 1),
    ]
    
    now = datetime.now()
    
    for filename, size, days_ago in audio_files:
        file_path = Path(audio_dir) / filename
        
        content = f"Sample audio file: {filename}\n" + "X" * (size // 1000)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
            
        mtime = (now - timedelta(days=days_ago)).timestamp()
        import os
        os.utime(file_path, (mtime, mtime))
    
    print(f"✅ 样例音频文件已生成: {audio_dir}")
    print(f"   生成 {len(audio_files)} 个模拟音频文件")
    print()
    print("   📁 文件构成:")
    print("   - 大部分文件名与曲目表匹配")
    print("   - Electric_Pulse_人工修改.mp3: 人工改名案例")
    print("   - 深海回响_无授权.mp3: 缺授权案例")
    print("   - 注意: TRK010 迷失幻境 无对应音频文件")


def main():
    print("=" * 50)
    print("DJ曲库能量排序 - 样例数据生成")
    print("=" * 50)
    print()
    
    base_dir = Path("sample_data")
    base_dir.mkdir(exist_ok=True)
    
    generate_sample_excel("sample_data/track_list.xlsx")
    print()
    generate_sample_audio("sample_data/audio")
    print()
    print("=" * 50)
    print("样例数据生成完成!")
    print()
    print("💡 运行命令: python main.py")
    print("=" * 50)


if __name__ == "__main__":
    main()
