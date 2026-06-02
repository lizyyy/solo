#!/usr/bin/env python3
import argparse
import pandas as pd
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fraud_replay import ReplayPipeline


def main():
    parser = argparse.ArgumentParser(
        description="信贷欺诈样本回放工具 - 让小乔同学的工作更轻松~",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 快速开始（使用示例数据）
  python cli.py --demo
  
  # 使用自己的数据
  python cli.py --model-output model_output.csv 
  
  # 完整模式（带复核和反馈）
  python cli.py --model-output model_output.csv --review manual_review.csv --feedback online_feedback.csv
  
  # 对比两次运行
  python cli.py --model-output new_data.csv --compare previous_data.csv
  
  # 指定输出目录和阈值
  python cli.py --model-output data.csv --output ./results --threshold 0.6
        """
    )
    
    parser.add_argument("--model-output", "-m", help="模型输出日志文件路径")
    parser.add_argument("--review", "-r", help="人工复核数据文件路径")
    parser.add_argument("--feedback", "-f", help="线上反馈数据文件路径")
    parser.add_argument("--compare", "-c", help="前次运行数据文件，用于对比")
    parser.add_argument("--output", "-o", default="./output", help="输出目录，默认 ./output")
    parser.add_argument("--threshold", "-t", type=float, default=0.5, help="欺诈判定阈值，默认 0.5")
    parser.add_argument("--demo", action="store_true", help="使用示例数据快速演示")
    
    args = parser.parse_args()
    
    if args.demo:
        run_demo(args.output, args.threshold)
        return
    
    if not args.model_output:
        parser.print_help()
        return
    
    run_pipeline(
        model_output_path=args.model_output,
        review_path=args.review,
        feedback_path=args.feedback,
        compare_path=args.compare,
        output_dir=args.output,
        threshold=args.threshold
    )


def run_demo(output_dir: str, threshold: float):
    print("\n" + "="*60)
    print("🎬 信贷欺诈样本回放 - 演示模式")
    print("="*60)
    
    from sample_data.generate_samples import generate_sample_data
    
    print("\n📊 正在生成示例数据...")
    sample_df = generate_sample_data("./sample_data")
    
    pipeline = ReplayPipeline()
    pipeline.config.fraud_threshold = threshold
    
    pipeline.run(
        df=sample_df,
        output_dir=output_dir,
        run_name="demo_run"
    )
    
    print("\n" + "="*60)
    print("🎉 演示完成！")
    print(f"📂 查看输出目录: {output_dir}")
    print("="*60 + "\n")


def run_pipeline(model_output_path: str, review_path: str = None, 
                 feedback_path: str = None, compare_path: str = None,
                 output_dir: str = "./output", threshold: float = 0.5):
    
    pipeline = ReplayPipeline()
    pipeline.config.fraud_threshold = threshold
    
    if compare_path and os.path.exists(compare_path):
        compare_df = pd.read_csv(compare_path)
        pipeline.set_previous_run(compare_df)
    
    pipeline.run(
        model_output_path=model_output_path,
        review_data_path=review_path,
        feedback_data_path=feedback_path,
        output_dir=output_dir
    )


if __name__ == "__main__":
    main()
