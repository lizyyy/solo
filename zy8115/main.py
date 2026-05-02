#!/usr/bin/env python3
"""
舞台灯光时间线复核工具
用于舞台监督在彩排前复核灯光时间线。

功能：
- 加载灯光CUE (CSV)
- 加载曲目时间轴 (JSON)
- 加载设备通道配置 (YAML)
- 自动检测风险（通道重叠、时间过早、缺失标记等）
- 风险确认和持久化
- 导出Markdown和CSV报告
"""

import sys
import argparse
from pathlib import Path

# 添加当前目录到Python路径
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))


def run_gui():
    """运行图形界面"""
    from gui_app import main
    main()


def run_cli(args):
    """运行命令行模式"""
    from parsers import ProjectLoader
    from risk_detector import run_risk_detection
    from utils import ReportExporter, ProjectPersistence
    
    # 加载项目
    if args.directory:
        print(f"从目录加载项目: {args.directory}")
        project = ProjectLoader.from_directory(args.directory, args.project_name or "CLI项目")
    else:
        print("加载项目文件...")
        project = ProjectLoader.load(
            project_name=args.project_name or "CLI项目",
            cues_file=args.cues_file,
            timeline_file=args.timeline_file,
            channels_file=args.channels_file
        )
    
    if not project.lighting_cues:
        print("错误: 没有加载到灯光CUE数据")
        sys.exit(1)
    
    print(f"\n成功加载: {len(project.lighting_cues)} 个CUE, {len(project.track_markers)} 个曲目, {len(project.device_channels)} 个通道")
    
    # 运行风险检测
    print("\n运行风险检测...")
    risks = run_risk_detection(project)
    print(f"检测到 {len(risks)} 个风险")
    
    # 按级别统计
    from models import RiskLevel
    critical = len([r for r in risks if r.level == RiskLevel.CRITICAL])
    high = len([r for r in risks if r.level == RiskLevel.HIGH])
    medium = len([r for r in risks if r.level == RiskLevel.MEDIUM])
    low = len([r for r in risks if r.level == RiskLevel.LOW])
    
    print(f"\n风险级别分布:")
    print(f"  严重: {critical}")
    print(f"  高: {high}")
    print(f"  中: {medium}")
    print(f"  低: {low}")
    
    # 显示风险详情
    if args.verbose and risks:
        print("\n=== 风险详情 ===")
        for risk in sorted(risks, key=lambda x: (
            0 if x.level == RiskLevel.CRITICAL else
            1 if x.level == RiskLevel.HIGH else
            2 if x.level == RiskLevel.MEDIUM else 3,
            x.time_reference or 0
        )):
            print(f"\n[{risk.level.value}] {risk.title}")
            print(f"  类型: {risk.risk_type.value}")
            if risk.time_reference is not None:
                print(f"  参考时间: {risk.time_reference:.2f}s")
            print(f"  描述: {risk.description[:100]}..." if len(risk.description) > 100 else f"  描述: {risk.description}")
    
    # 保存项目
    if args.save:
        save_path = args.save
        if ProjectPersistence.save_project(project, save_path):
            print(f"\n项目已保存到: {save_path}")
    
    # 导出报告
    if args.export_md:
        md_path = args.export_md
        if ReportExporter.export_markdown(project, md_path):
            print(f"Markdown报告已导出到: {md_path}")
    
    if args.export_csv:
        csv_path = args.export_csv
        if ReportExporter.export_csv(project, csv_path):
            print(f"CSV报告已导出到: {csv_path}")
    
    if args.export_cues:
        cues_path = args.export_cues
        if ReportExporter.export_cue_list_csv(project, cues_path):
            print(f"CUE列表已导出到: {cues_path}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="舞台灯光时间线复核工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行图形界面
  python main.py
  
  # 命令行模式 - 从目录加载
  python main.py --directory ./examples --export-md report.md --export-csv report.csv
  
  # 命令行模式 - 指定各个文件
  python main.py --cues-file cues.csv --timeline-file timeline.json --channels-file channels.yaml --save project.json
        """
    )
    
    # 运行模式
    parser.add_argument('--gui', action='store_true', help='运行图形界面（默认）')
    parser.add_argument('--cli', action='store_true', help='运行命令行模式')
    
    # 项目加载选项
    parser.add_argument('-d', '--directory', type=str, help='从目录自动加载项目文件')
    parser.add_argument('--cues-file', type=str, help='灯光CUE CSV文件路径')
    parser.add_argument('--timeline-file', type=str, help='曲目时间轴JSON文件路径')
    parser.add_argument('--channels-file', type=str, help='设备通道YAML文件路径')
    parser.add_argument('--project-name', type=str, help='项目名称')
    
    # 输出选项
    parser.add_argument('--save', type=str, help='保存项目到JSON文件')
    parser.add_argument('--export-md', type=str, help='导出Markdown报告')
    parser.add_argument('--export-csv', type=str, help='导出CSV风险报告')
    parser.add_argument('--export-cues', type=str, help='导出CUE列表CSV')
    
    # 其他选项
    parser.add_argument('-v', '--verbose', action='store_true', help='显示详细信息')
    
    args = parser.parse_args()
    
    # 判断运行模式
    if args.cli or args.directory or args.cues_file or args.timeline_file or args.channels_file:
        # 命令行模式
        run_cli(args)
    else:
        # 默认运行图形界面
        run_gui()


if __name__ == "__main__":
    main()