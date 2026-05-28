#!/usr/bin/env python3
"""快速入门脚本
展示如何使用Python API进行音频片段谱聚类
"""

import os
import sys

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from audio_spectrum_cluster import (
    AudioClusteringController,
    OperationType
)


def main():
    print("🎵 音乐音频片段谱聚类 - 快速入门")
    print("=" * 60)

    # 初始化控制器
    controller = AudioClusteringController(
        data_dir="./data",
        output_dir="./output"
    )

    # 1. 检查当前状态
    print("\n📊 当前状态:")
    summary = controller.get_summary()
    print(f"   已有片段: {summary['total_segments']} 个")
    print(f"   聚类数量: {summary['n_clusters']} 个")

    # 2. 如果有音频文件目录，处理它们
    demo_dir = "./demo_audio"
    if os.path.isdir(demo_dir):
        audio_files = [
            f for f in os.listdir(demo_dir)
            if f.lower().endswith(('.wav', '.mp3', '.flac', '.ogg'))
        ]

        if audio_files:
            print(f"\n📁 发现 {len(audio_files)} 个音频文件在 {demo_dir}")
            print("   开始处理...")

            result = controller.process_directory(
                directory=demo_dir,
                operation_type=OperationType.NORMAL,
                operator="quick_start",
                description="快速入门测试"
            )

            print(f"✅ 处理完成!")
            print(f"   新增: {result.get('n_new_segments', 0)} 个片段")
            print(f"   总共: {result.get('total_segments', 0)} 个片段")
            print(f"   聚类: {result.get('n_clusters', 0)} 个")

            if result.get('anomalies'):
                print(f"⚠️  异常: {len(result['anomalies'])} 个")
                for a in result['anomalies'][:3]:
                    print(f"   - [{a.severity}] {a.description}")

    # 3. 列出所有片段
    print("\n📋 片段列表:")
    segments = controller.list_segments()
    for seg in segments[:10]:
        cluster = seg.get('cluster_name', '未聚类')
        print(f"   {seg['segment_id']} | {seg['file_name']} | {seg['duration']:.2f}s | {cluster}")

    if len(segments) > 10:
        print(f"   ... 还有 {len(segments) - 10} 个片段")

    # 4. 如果有聚类结果，展示详情
    if segments and controller.report:
        print("\n🎯 聚类结果摘要:")
        for cluster in controller.report.clusters_summary:
            print(f"   {cluster['cluster_name']}: {cluster['size']} 个片段, "
                  f"平均节拍 {cluster['avg_tempo']:.1f} BPM, "
                  f"乐器: {', '.join(cluster['instrument_tags']) or '无'}")

        # 5. 导出数据
        print("\n📥 导出数据...")
        files = controller.export_data()
        for name, path in files.items():
            print(f"   {name}: {path}")

        print("\n🎉 完成! 查看 output 目录获取图表和报告。")
        print("   运行 `python cli.py web` 启动Web界面查看更多详情。")

    else:
        print("\n⚠️  还没有足够的音频片段进行聚类。")
        print("   请将音频文件放入 ./demo_audio 目录后重新运行。")
        print("   或使用命令: python cli.py process <目录路径>")


if __name__ == '__main__':
    main()
