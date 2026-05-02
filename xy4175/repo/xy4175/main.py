"""
轴承振动早筛员 - 主入口程序
轨道交通轴承振动异常检测工具
"""

import os
import sys
import argparse
from typing import Optional, Dict, List
from datetime import datetime

import pandas as pd

from bearing_vibration_detector import (
    DataParser,
    FeatureEngineer,
    AnomalyDetector,
    RuleFusion,
    ReviewStorage,
    Exporter
)
from bearing_vibration_detector.review_storage import ReviewStatus, ReviewConclusion


def print_banner():
    """打印程序横幅"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║           轴承振动早筛员 - 轨道交通轴承振动异常检测工具        ║
║                    Bearing Vibration Detector                  ║
╚══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def process_single_trip(data_dir: str,
                        trip_id: Optional[str] = None,
                        sampling_rate: float = 25600.0,
                        export_reports: bool = True) -> Dict:
    """
    处理单趟数据
    
    参数:
        data_dir: 数据目录
        trip_id: 趟次ID
        sampling_rate: 采样率
        export_reports: 是否导出报告
        
    返回:
        处理结果字典
    """
    print(f"\n{'='*60}")
    print(f"开始处理数据目录: {data_dir}")
    print(f"{'='*60}\n")
    
    print("[步骤 1/6] 解析数据...")
    parser = DataParser(
        expected_sampling_rate=sampling_rate,
        min_sampling_rate=1000.0,
        max_missing_ratio=0.05
    )
    
    trips = parser.parse_directory(data_dir)
    
    if not trips:
        print("错误: 未找到任何有效数据")
        return {"success": False, "message": "未找到有效数据"}
    
    print(f"  找到 {len(trips)} 趟数据")
    
    summary = parser.get_trip_summary()
    print("\n数据摘要:")
    print(summary.to_string(index=False))
    
    valid_trips = parser.get_valid_trips()
    print(f"\n有效趟次: {len(valid_trips)}")
    
    results = {}
    
    for current_trip_id, trip_data in valid_trips.items():
        if trip_id and current_trip_id != trip_id:
            continue
        
        actual_trip_id = current_trip_id
        
        print(f"\n{'='*60}")
        print(f"处理趟次: {actual_trip_id}")
        print(f"{'='*60}\n")
        
        validation_status = trip_data.validation_status
        
        if validation_status.get("errors"):
            print(f"数据校验错误: {validation_status['errors']}")
        
        if validation_status.get("warnings"):
            print(f"数据校验警告: {validation_status['warnings']}")
        
        print("\n[步骤 2/6] 特征工程...")
        engineer = FeatureEngineer(
            frame_size=int(sampling_rate),
            frame_overlap=0.5,
            sampling_rate=sampling_rate
        )
        
        features = engineer.extract_features(
            trip_data.vibration_data,
            trip_data.speed_profile
        )
        
        print(f"  提取帧数: {len(features.frame_features)}")
        print(f"  峰值帧数: {len(features.peak_frames)}")
        print(f"  可疑帧数: {len(features.suspicious_frames)}")
        
        features_df = engineer.features_to_dataframe(features)
        global_features_df = engineer.get_global_features_dataframe(features)
        
        print("\n[步骤 3/6] 异常检测...")
        detector = AnomalyDetector(
            use_ensemble=False,
            anomaly_threshold=0.7
        )
        
        anomaly_result = detector.detect(features_df, features.global_features)
        
        print(f"  是否检测到异常: {'是' if anomaly_result.has_anomaly else '否'}")
        print(f"  异常帧数: {len(anomaly_result.anomaly_frames)}")
        print(f"  主要异常类型: {anomaly_result.primary_anomaly_type.value}")
        print(f"  检测置信度: {anomaly_result.confidence:.1%}")
        
        anomaly_summary = detector.get_anomaly_summary(anomaly_result)
        print(f"\n异常检测摘要:")
        for key, value in anomaly_summary.items():
            print(f"  {key}: {value}")
        
        print("\n[步骤 4/6] 规则融合...")
        rule_fusion = RuleFusion()
        
        validation_warnings = validation_status.get("warnings", [])
        
        risk_result = rule_fusion.fuse(
            anomaly_result,
            features_df,
            validation_warnings
        )
        
        print(f"  整体风险等级: {risk_result.overall_risk.value}")
        print(f"  整体风险评分: {risk_result.overall_score:.2f}")
        print(f"  主要问题: {risk_result.primary_concern}")
        print(f"  评估置信度: {risk_result.confidence:.1%}")
        
        risk_summary = rule_fusion.get_risk_summary(risk_result)
        print(f"\n风险评估摘要:")
        for key, value in risk_summary.items():
            print(f"  {key}: {value}")
        
        print("\n[步骤 5/6] 复核存储...")
        storage = ReviewStorage()
        
        review = storage.create_review_from_risk(risk_result, actual_trip_id)
        
        print(f"  复核记录已创建，状态: {review.review_status}")
        
        stats = storage.get_statistics()
        print(f"\n存储统计:")
        print(f"  总记录数: {stats['total_reviews']}")
        print(f"  待复核: {stats['pending_count']}")
        print(f"  已确认: {stats['confirmed_count']}")
        
        print("\n[步骤 6/6] 导出报告...")
        exporter = Exporter()
        
        export_files = {}
        
        if export_reports:
            md_path = exporter.export_markdown_report(
                risk_result,
                anomaly_result,
                features,
                validation_warnings,
                actual_trip_id
            )
            export_files["markdown"] = md_path
            
            evidence_files = exporter.export_evidence_package(
                risk_result,
                anomaly_result,
                features,
                features_df,
                actual_trip_id,
                output_format="both"
            )
            export_files.update(evidence_files)
        
        export_summary = exporter.get_export_summary()
        print(f"\n导出摘要:")
        print(f"  输出目录: {export_summary['output_directory']}")
        print(f"  Markdown报告: {export_summary['markdown_reports']} 个")
        print(f"  CSV文件: {export_summary['csv_files']} 个")
        print(f"  JSON文件: {export_summary['json_files']} 个")
        
        results[actual_trip_id] = {
            "trip_id": actual_trip_id,
            "validation_status": validation_status,
            "features": {
                "frame_count": len(features.frame_features),
                "peak_frames": len(features.peak_frames),
                "suspicious_frames": len(features.suspicious_frames)
            },
            "anomaly_detection": {
                "has_anomaly": anomaly_result.has_anomaly,
                "primary_type": anomaly_result.primary_anomaly_type.value,
                "confidence": anomaly_result.confidence
            },
            "risk_assessment": {
                "overall_risk": risk_result.overall_risk.value,
                "overall_score": risk_result.overall_score,
                "primary_concern": risk_result.primary_concern
            },
            "export_files": export_files
        }
        
        print(f"\n{'='*60}")
        print(f"趟次 {actual_trip_id} 处理完成!")
        print(f"{'='*60}")
    
    return {
        "success": True,
        "trip_count": len(results),
        "results": results
    }


def interactive_mode():
    """交互模式"""
    print("\n进入交互模式...")
    print("\n可用命令:")
    print("  1. 处理数据目录 (process)")
    print("  2. 查看复核记录 (review)")
    print("  3. 提交复核反馈 (submit)")
    print("  4. 查看统计信息 (stats)")
    print("  5. 退出 (quit/exit)")
    
    storage = ReviewStorage()
    
    while True:
        print("\n" + "-"*40)
        command = input("请输入命令 (输入 help 查看帮助): ").strip().lower()
        
        if command in ["quit", "exit", "q"]:
            print("退出程序...")
            break
        
        elif command in ["help", "h", "?"]:
            print("\n命令说明:")
            print("  process, p  - 处理数据目录")
            print("  review,  r  - 查看复核记录列表")
            print("  submit,  s  - 提交复核反馈")
            print("  stats,   st - 查看统计信息")
            print("  quit,    q  - 退出程序")
        
        elif command in ["process", "p"]:
            data_dir = input("\n请输入数据目录路径: ").strip()
            
            if not os.path.isdir(data_dir):
                print(f"错误: 目录不存在 - {data_dir}")
                continue
            
            sampling_rate_input = input("采样率 (默认 25600 Hz): ").strip()
            sampling_rate = float(sampling_rate_input) if sampling_rate_input else 25600.0
            
            export_input = input("是否导出报告? (Y/n): ").strip().lower()
            export_reports = export_input != "n"
            
            process_single_trip(
                data_dir=data_dir,
                sampling_rate=sampling_rate,
                export_reports=export_reports
            )
        
        elif command in ["review", "r"]:
            pending = storage.get_pending_reviews()
            
            if not pending:
                print("\n没有待复核的记录")
                continue
            
            print(f"\n待复核记录 ({len(pending)} 条):")
            for i, review in enumerate(pending, 1):
                print(f"\n  {i}. 趟次ID: {review.trip_id}")
                print(f"     原始风险: {review.original_overall_risk}")
                print(f"     原始评分: {review.original_overall_score:.2f}")
                print(f"     分析时间: {review.analysis_time}")
        
        elif command in ["submit", "s"]:
            trip_id = input("\n请输入趟次ID: ").strip()
            
            review = storage.get_review(trip_id)
            if not review:
                print(f"错误: 未找到趟次记录 - {trip_id}")
                continue
            
            print(f"\n当前记录状态: {review.review_status}")
            print(f"原始风险: {review.original_overall_risk}")
            print(f"原始评分: {review.original_overall_score:.2f}")
            
            print("\n请选择复核状态:")
            print("  1. 已确认 (Confirmed)")
            print("  2. 已驳回 (Rejected)")
            print("  3. 已修改 (Modified)")
            
            status_choice = input("请选择 (1-3): ").strip()
            
            status_map = {
                "1": ReviewStatus.CONFIRMED,
                "2": ReviewStatus.REJECTED,
                "3": ReviewStatus.MODIFIED
            }
            
            if status_choice not in status_map:
                print("无效选择")
                continue
            
            review_status = status_map[status_choice]
            
            print("\n请选择复核结论:")
            print("  1. 真阳性 (确认为异常)")
            print("  2. 假阳性 (误报)")
            print("  3. 真阴性 (确认为正常)")
            print("  4. 假阴性 (漏报)")
            print("  5. 需更多数据确认")
            
            conclusion_choice = input("请选择 (1-5): ").strip()
            
            conclusion_map = {
                "1": ReviewConclusion.TRUE_POSITIVE,
                "2": ReviewConclusion.FALSE_POSITIVE,
                "3": ReviewConclusion.TRUE_NEGATIVE,
                "4": ReviewConclusion.FALSE_NEGATIVE,
                "5": ReviewConclusion.NEED_MORE_DATA
            }
            
            if conclusion_choice not in conclusion_map:
                print("无效选择")
                continue
            
            review_conclusion = conclusion_map[conclusion_choice]
            
            reviewer = input("\n复核人姓名 (可选): ").strip()
            comments = input("备注 (可选): ").strip()
            
            success = storage.submit_review(
                trip_id=trip_id,
                review_status=review_status,
                review_conclusion=review_conclusion,
                reviewer=reviewer,
                comments=comments
            )
            
            if success:
                print("\n复核反馈已提交!")
            else:
                print("\n提交失败!")
        
        elif command in ["stats", "st"]:
            stats = storage.get_statistics()
            
            print("\n" + "="*40)
            print("复核统计信息")
            print("="*40)
            print(f"\n总记录数: {stats['total_reviews']}")
            print(f"待复核: {stats['pending_count']}")
            print(f"已确认: {stats['confirmed_count']}")
            print(f"\n状态分布:")
            for status, count in stats['status_distribution'].items():
                print(f"  {status}: {count}")
            print(f"\n结论分布:")
            for conclusion, count in stats['conclusion_distribution'].items():
                print(f"  {conclusion}: {count}")
            print(f"\n风险分布:")
            for risk, count in stats['risk_distribution'].items():
                print(f"  {risk}: {count}")
            print(f"\n模型精度估计: {stats['model_precision_estimate']:.1%}")
            print(f"可用于训练的记录: {stats['usable_for_training']}")
        
        else:
            print(f"未知命令: {command}，输入 help 查看帮助")


def main():
    """主函数"""
    print_banner()
    
    parser = argparse.ArgumentParser(
        description="轴承振动早筛员 - 轨道交通轴承振动异常检测工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 处理数据目录
  python main.py --data-dir ./sample_data
  
  # 指定采样率
  python main.py --data-dir ./data --sampling-rate 51200
  
  # 进入交互模式
  python main.py --interactive
  
  # 仅处理不导出报告
  python main.py --data-dir ./data --no-export
        """
    )
    
    parser.add_argument(
        "--data-dir", "-d",
        type=str,
        help="数据目录路径，包含振动CSV、转速表和检修结论"
    )
    
    parser.add_argument(
        "--trip-id", "-t",
        type=str,
        default=None,
        help="指定趟次ID（可选）"
    )
    
    parser.add_argument(
        "--sampling-rate", "-sr",
        type=float,
        default=25600.0,
        help="采样率（Hz），默认 25600"
    )
    
    parser.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="进入交互模式"
    )
    
    parser.add_argument(
        "--no-export",
        action="store_true",
        help="不导出报告"
    )
    
    parser.add_argument(
        "--version", "-v",
        action="version",
        version="轴承振动早筛员 v1.0.0"
    )
    
    args = parser.parse_args()
    
    if args.interactive:
        interactive_mode()
    elif args.data_dir:
        if not os.path.isdir(args.data_dir):
            print(f"错误: 数据目录不存在 - {args.data_dir}")
            sys.exit(1)
        
        result = process_single_trip(
            data_dir=args.data_dir,
            trip_id=args.trip_id,
            sampling_rate=args.sampling_rate,
            export_reports=not args.no_export
        )
        
        if result["success"]:
            print(f"\n处理完成! 共处理 {result['trip_count']} 趟数据")
            sys.exit(0)
        else:
            print(f"\n处理失败: {result.get('message', '未知错误')}")
            sys.exit(1)
    else:
        parser.print_help()
        print("\n提示: 使用 --interactive 进入交互模式，或使用 --data-dir 指定数据目录")


if __name__ == "__main__":
    main()
