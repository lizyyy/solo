#!/usr/bin/env python3
"""
风险预算拉格朗日工具 - CLI接口

用法示例:
  # 基本用法
  python -m risk_budget_lagrange.cli --cov "0.04,0.01;0.01,0.03" --budget "0.5,0.5"
  
  # 带边界约束
  python -m risk_budget_lagrange.cli --cov "0.04,0.01;0.01,0.03" --budget "0.7,0.3" \
    --lb "0,0" --ub "0.6,1" --names "股票,债券" -v 2
  
  # 从文件输入
  python -m risk_budget_lagrange.cli --cov-file cov.csv --budget-file budget.csv
  
  # 导出结果
  python -m risk_budget_lagrange.cli --cov "0.04,0.01;0.01,0.03" --budget "0.5,0.5" \
    --json-out result.json --csv-out result.csv
"""

import argparse
import sys
import numpy as np
from typing import List, Optional

from .core import RiskBudgetOptimizer
from .formatting import ResultFormatter


def parse_matrix(s: str) -> np.ndarray:
    """
    解析矩阵字符串，格式: "a,b;c,d"
    """
    try:
        rows = s.strip().split(";")
        matrix = []
        for row in rows:
            row = row.strip()
            if row:
                vals = [float(x.strip()) for x in row.split(",")]
                matrix.append(vals)
        return np.array(matrix)
    except Exception as e:
        raise argparse.ArgumentTypeError(f"矩阵格式错误: {e}. 正确格式: 'a,b;c,d'")


def parse_vector(s: str) -> np.ndarray:
    """
    解析向量字符串，格式: "a,b,c"
    """
    try:
        vals = [float(x.strip()) for x in s.strip().split(",")]
        return np.array(vals)
    except Exception as e:
        raise argparse.ArgumentTypeError(f"向量格式错误: {e}. 正确格式: 'a,b,c'")


def parse_names(s: str) -> List[str]:
    """
    解析资产名称字符串
    """
    return [x.strip() for x in s.strip().split(",")]


def read_matrix_from_file(file_path: str) -> np.ndarray:
    """
    从CSV文件读取矩阵
    """
    try:
        return np.loadtxt(file_path, delimiter=",")
    except Exception as e:
        print(f"读取文件错误 {file_path}: {e}", file=sys.stderr)
        sys.exit(1)


def read_vector_from_file(file_path: str) -> np.ndarray:
    """
    从CSV文件读取向量
    """
    try:
        data = np.loadtxt(file_path, delimiter=",")
        return data.flatten()
    except Exception as e:
        print(f"读取文件错误 {file_path}: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="风险预算拉格朗日优化工具 - 透明展示优化过程和边界约束解释",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
公式说明:
  组合波动率: σ_p = sqrt(w' Σ w)
  边际风险贡献: MRC_i = (Σ w)_i / σ_p
  总风险贡献: TRC_i = w_i * MRC_i
  风险预算约束: TRC_i = b_i * σ_p
  
拉格朗日函数:
  L = 0.5 * w' Σ w - λ(Σ w_i - 1) - Σ μ_i (w_i - ub_i) - Σ ν_i (lb_i - w_i)
        """,
    )

    input_group = parser.add_argument_group("输入参数")
    input_group.add_argument(
        "--cov",
        type=parse_matrix,
        help="协方差矩阵，格式: 'a,b;c,d'",
    )
    input_group.add_argument(
        "--cov-file",
        type=str,
        help="协方差矩阵CSV文件路径",
    )
    input_group.add_argument(
        "--budget",
        type=parse_vector,
        help="风险预算向量，格式: 'a,b,c'，和为1",
    )
    input_group.add_argument(
        "--budget-file",
        type=str,
        help="风险预算CSV文件路径",
    )
    input_group.add_argument(
        "--lb",
        type=parse_vector,
        help="权重下界，格式: 'a,b,c'，默认为0",
    )
    input_group.add_argument(
        "--ub",
        type=parse_vector,
        help="权重上界，格式: 'a,b,c'，默认为1",
    )
    input_group.add_argument(
        "--names",
        type=parse_names,
        help="资产名称，格式: '股票,债券,商品'",
    )
    input_group.add_argument(
        "--init",
        type=parse_vector,
        help="初始权重猜测，格式: 'a,b,c'",
    )

    config_group = parser.add_argument_group("配置参数")
    config_group.add_argument(
        "--tol",
        type=float,
        default=1e-8,
        help="优化容差，默认1e-8",
    )
    config_group.add_argument(
        "--max-iter",
        type=int,
        default=10000,
        help="最大迭代次数，默认10000",
    )

    output_group = parser.add_argument_group("输出选项")
    output_group.add_argument(
        "-v", "--verbose",
        type=int,
        default=1,
        choices=[0, 1, 2, 3],
        help="输出详细程度: 0=极简, 1=标准, 2=详细, 3=完整中间过程",
    )
    output_group.add_argument(
        "--json-out",
        type=str,
        help="导出JSON结果到指定文件",
    )
    output_group.add_argument(
        "--csv-out",
        type=str,
        help="导出CSV结果到指定文件",
    )
    output_group.add_argument(
        "--no-print",
        action="store_true",
        help="不打印结果到控制台",
    )

    args = parser.parse_args()

    if args.cov is None and args.cov_file is None:
        print("错误: 必须提供 --cov 或 --cov-file", file=sys.stderr)
        sys.exit(1)

    if args.budget is None and args.budget_file is None:
        print("错误: 必须提供 --budget 或 --budget-file", file=sys.stderr)
        sys.exit(1)

    cov = args.cov if args.cov is not None else read_matrix_from_file(args.cov_file)
    budget = args.budget if args.budget is not None else read_vector_from_file(args.budget_file)

    if cov.shape[0] != cov.shape[1]:
        print(f"错误: 协方差矩阵必须是方阵，当前形状: {cov.shape}", file=sys.stderr)
        sys.exit(1)

    if cov.shape[0] != len(budget):
        print(
            f"错误: 协方差矩阵维度({cov.shape[0]})与风险预算长度({len(budget)})不匹配",
            file=sys.stderr,
        )
        sys.exit(1)

    n = cov.shape[0]

    if args.lb is not None and len(args.lb) != n:
        print(
            f"错误: 下界长度({len(args.lb)})与资产数({n})不匹配",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.ub is not None and len(args.ub) != n:
        print(
            f"错误: 上界长度({len(args.ub)})与资产数({n})不匹配",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.names is not None and len(args.names) != n:
        print(
            f"错误: 资产名称数量({len(args.names)})与资产数({n})不匹配",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.init is not None and len(args.init) != n:
        print(
            f"错误: 初始权重长度({len(args.init)})与资产数({n})不匹配",
            file=sys.stderr,
        )
        sys.exit(1)

    print("📥 输入参数汇总:")
    print(f"  资产数量: {n}")
    print(f"  协方差矩阵:\n{cov}")
    print(f"  风险预算: {budget}")
    if args.names:
        print(f"  资产名称: {args.names}")
    if args.lb is not None:
        print(f"  权重下界: {args.lb}")
    if args.ub is not None:
        print(f"  权重上界: {args.ub}")
    print()

    optimizer = RiskBudgetOptimizer(
        asset_names=args.names,
        tolerance=args.tol,
        max_iterations=args.max_iter,
    )

    print("⚙️  开始优化...\n")

    result = optimizer.optimize(
        cov=cov,
        risk_budget=budget,
        lower_bounds=args.lb,
        upper_bounds=args.ub,
        initial_weights=args.init,
    )

    if not args.no_print:
        ResultFormatter.print_summary(result, verbose=args.verbose)

    if args.json_out:
        ResultFormatter.to_json(result, args.json_out)
        print(f"\n💾 JSON结果已保存到: {args.json_out}")

    if args.csv_out:
        ResultFormatter.to_csv(result, args.csv_out)
        print(f"💾 CSV结果已保存到: {args.csv_out}")

    return 0 if result.success else 1


if __name__ == "__main__":
    sys.exit(main())
