#!/usr/bin/env python3
"""
Resume Matcher Bias Review Tool
本地 Python 简历岗位匹配偏差复核工具

功能：
- 读取岗位要求 YAML、脱敏简历 JSONL、模型打分 CSV 和面试结果 CSV
- 归一化技能别名
- 轻量文本匹配/规则解释复核推荐排序
- 输出 mismatch_cases.csv、bias_review.md 和 HTML 概览

重点处理：
1. 候选人技能写法不同（技能别名）
2. 年限刚好卡边界
3. 模型高分但面试淘汰
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

from resume_matcher.data_loader.loaders import (
    load_all_data,
    ModelScoreLoader,
    InterviewResultLoader
)
from resume_matcher.matcher.bias_reviewer import BiasReviewer
from resume_matcher.reporter.generators import generate_all_reports


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='简历岗位匹配偏差复核工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  # 使用默认 sample 数据
  python main.py --sample

  # 使用自定义数据
  python main.py \\
    --job requirements/job.yaml \\
    --resumes data/resumes.jsonl \\
    --model-scores data/model_scores.csv \\
    --interview-results data/interview_results.csv \\
    --output output/

  # 使用短参数
  python main.py -j job.yaml -r resumes.jsonl -m scores.csv -i results.csv -o out/
        '''
    )

    parser.add_argument(
        '--sample', '-s',
        action='store_true',
        help='使用 sample 数据运行演示'
    )

    parser.add_argument(
        '--job', '-j',
        type=str,
        help='岗位要求 YAML 文件路径'
    )

    parser.add_argument(
        '--resumes', '-r',
        type=str,
        help='脱敏简历 JSONL 文件路径'
    )

    parser.add_argument(
        '--model-scores', '-m',
        type=str,
        help='模型打分 CSV 文件路径'
    )

    parser.add_argument(
        '--interview-results', '-i',
        type=str,
        help='面试结果 CSV 文件路径'
    )

    parser.add_argument(
        '--output', '-o',
        type=str,
        default='./output',
        help='输出目录路径 (默认: ./output)'
    )

    parser.add_argument(
        '--base-name', '-n',
        type=str,
        default='review',
        help='输出文件名前缀 (默认: review)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='显示详细输出'
    )

    return parser.parse_args()


def get_sample_paths() -> dict:
    """Get sample data file paths"""
    sample_dir = Path(__file__).parent / 'samples'
    return {
        'job': str(sample_dir / 'job_requirement.yaml'),
        'resumes': str(sample_dir / 'resumes.jsonl'),
        'model_scores': str(sample_dir / 'model_scores.csv'),
        'interview_results': str(sample_dir / 'interview_results.csv')
    }


def validate_paths(
    job_path: str,
    resumes_path: str,
    model_scores_path: str,
    interview_results_path: str
) -> bool:
    """Validate that all input files exist"""
    paths = [
        ('岗位要求 YAML', job_path),
        ('脱敏简历 JSONL', resumes_path),
        ('模型打分 CSV', model_scores_path),
        ('面试结果 CSV', interview_results_path)
    ]

    all_valid = True
    for name, path in paths:
        if not Path(path).exists():
            print(f"错误: {name}文件不存在: {path}", file=sys.stderr)
            all_valid = False

    return all_valid


def run_review(
    job_path: str,
    resumes_path: str,
    model_scores_path: str,
    interview_results_path: str,
    output_dir: str,
    base_name: str = 'review',
    verbose: bool = False
) -> dict:
    """
    Run the complete bias review process.

    Returns:
        Dictionary with paths to generated reports
    """
    if verbose:
        print("=" * 60)
        print("简历岗位匹配偏差复核工具")
        print("=" * 60)
        print()

    if verbose:
        print("[1/5] 加载数据文件...")
        print(f"  - 岗位要求: {job_path}")
        print(f"  - 简历数据: {resumes_path}")
        print(f"  - 模型打分: {model_scores_path}")
        print(f"  - 面试结果: {interview_results_path}")

    job, resumes, model_scores, interview_results = load_all_data(
        job_path,
        resumes_path,
        model_scores_path,
        interview_results_path
    )

    if verbose:
        print(f"    ✓ 加载完成: {len(resumes)} 份简历, {len(model_scores)} 个模型分数, {len(interview_results)} 个面试结果")
        print()

    if verbose:
        print(f"[2/5] 初始化复核器...")
        print(f"  - 岗位: {job.job_title} ({job.job_id})")
        print(f"  - 要求技能: {', '.join(job.required_skills)}")
        if job.experience_min:
            print(f"  - 经验要求: {job.experience_min}-{job.experience_max or '不限'} 年")
        print()

    reviewer = BiasReviewer(job)

    if verbose:
        print("[3/5] 复核候选人...")

    for i, resume in enumerate(resumes, 1):
        model_score = ModelScoreLoader.get_score_by_candidate_job(
            model_scores, resume.candidate_id, job.job_id
        )
        interview_result = InterviewResultLoader.get_result_by_candidate_job(
            interview_results, resume.candidate_id, job.job_id
        )

        if verbose:
            status = []
            if model_score:
                status.append(f"分数={model_score.model_score:.2f}")
            if interview_result:
                status.append(f"面试={interview_result.final_outcome}")
            status_str = f" ({', '.join(status)})" if status else ""
            print(f"  [{i}/{len(resumes)}] 候选人 {resume.candidate_id}{status_str}")

        reviewer.review_candidate(resume, model_score, interview_result)

    if verbose:
        stats = reviewer.get_summary_statistics()
        print(f"    ✓ 复核完成: {stats['total_mismatches']} 个不匹配案例")
        print()

    if verbose:
        print("[4/5] 生成报告...")

    reports = generate_all_reports(reviewer, output_dir, base_name)

    if verbose:
        print(f"    ✓ CSV报告: {reports['csv']}")
        print(f"    ✓ Markdown报告: {reports['markdown']}")
        print(f"    ✓ HTML概览: {reports['html']}")
        print()

    if verbose:
        print("=" * 60)
        print("复核完成!")
        print("=" * 60)
        print()
        stats = reviewer.get_summary_statistics()
        print(f"统计概览:")
        print(f"  - 总候选人数: {stats['total_candidates']}")
        print(f"  - 发现不匹配数: {stats['total_mismatches']}")
        print(f"  - 存在问题的候选人: {stats['candidates_with_mismatches']}")
        print()
        print(f"生成的文件:")
        for report_type, path in reports.items():
            print(f"  - {report_type}: {path}")
        print()
        print(f"提示: 可以直接打开 HTML 概览查看交互式报告:")
        print(f"  {reports['html']}")

    return reports


def main():
    """Main entry point"""
    args = parse_args()

    if args.sample:
        sample_paths = get_sample_paths()
        job_path = sample_paths['job']
        resumes_path = sample_paths['resumes']
        model_scores_path = sample_paths['model_scores']
        interview_results_path = sample_paths['interview_results']
        verbose = True
    else:
        if not all([args.job, args.resumes, args.model_scores, args.interview_results]):
            print("错误: 必须提供所有输入文件路径，或使用 --sample 参数运行演示", file=sys.stderr)
            print()
            print("使用方法:")
            print("  python main.py --sample              # 使用 sample 数据演示")
            print("  python main.py -j job.yaml -r resumes.jsonl -m scores.csv -i results.csv")
            sys.exit(1)

        job_path = args.job
        resumes_path = args.resumes
        model_scores_path = args.model_scores
        interview_results_path = args.interview_results
        verbose = args.verbose

    if not validate_paths(job_path, resumes_path, model_scores_path, interview_results_path):
        sys.exit(1)

    try:
        run_review(
            job_path=job_path,
            resumes_path=resumes_path,
            model_scores_path=model_scores_path,
            interview_results_path=interview_results_path,
            output_dir=args.output,
            base_name=args.base_name,
            verbose=verbose
        )
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
