"""辅助脚本：计算边界值刚好等于阈值时需要的样本参数"""

import math


def wilson_ci(n, k, confidence=0.95):
    """计算 Wilson 置信区间"""
    z_scores = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
    z = z_scores.get(confidence, 1.96)

    p_hat = k / n
    denominator = 1 + z ** 2 / n
    center = (p_hat + z ** 2 / (2 * n)) / denominator
    margin = z * math.sqrt((p_hat * (1 - p_hat) + z ** 2 / (4 * n)) / n) / denominator

    return center - margin, center + margin, p_hat


def find_boundary_params(target_threshold, sample_size):
    """
    寻找刚好让置信区间下限等于阈值的 k（通过人数）
    二分查找
    """
    low = 0
    high = sample_size
    best_k = None
    best_diff = float('inf')

    for k in range(low, high + 1):
        ci_lower, _, _ = wilson_ci(sample_size, k)
        diff = abs(ci_lower - target_threshold)
        if diff < best_diff:
            best_diff = diff
            best_k = k

    ci_lower, ci_upper, p_hat = wilson_ci(sample_size, best_k)
    return best_k, ci_lower, ci_upper, p_hat, best_diff


if __name__ == "__main__":
    print("=== 置信区间边界值参数计算 ===")

    # 评分权重表
    print("\n评分权重规则示例:")
    rules = [
        {"score_range": "90-100", "weight": 1.2, "threshold": 0.85},
        {"score_range": "80-89", "weight": 1.0, "threshold": 0.80},
        {"score_range": "70-79", "weight": 0.9, "threshold": 0.75},
        {"score_range": "60-69", "weight": 0.8, "threshold": 0.60},
    ]
    for r in rules:
        print(f"  {r['score_range']}分: 权重={r['weight']}, 阈值={r['threshold']}")

    # 计算各阈值下的边界值参数
    print("\n=== 边界值参数计算结果 ===")
    sample_size = 100

    for rule in rules:
        threshold = rule["threshold"]
        k, ci_lower, ci_upper, p_hat, diff = find_boundary_params(threshold, sample_size)
        print(f"\n阈值 {threshold}, 样本量 {sample_size}:")
        print(f"  通过人数 k = {k}")
        print(f"  通过率 p = {p_hat:.4f}")
        print(f"  置信区间: [{ci_lower:.6f}, {ci_upper:.6f}]")
        print(f"  与阈值差: {diff:.10f}")
        if diff < 1e-9:
            print(f"  ✓ 边界值刚好等于阈值！")

    # 预计算演示数据
    print("\n=== 演示数据预计算 ===")

    # 案例1: 顺利记录 - 置信区间下限 > 阈值
    print("\n【案例1: 顺利记录】")
    n1, k1 = 100, 92
    ci_l1, ci_u1, p1 = wilson_ci(n1, k1)
    threshold1 = 0.85
    print(f"  课程: 高等数学, 老师: 张老师")
    print(f"  样本量: {n1}, 通过: {k1}, 通过率: {p1:.4f}")
    print(f"  置信区间: [{ci_l1:.6f}, {ci_u1:.6f}]")
    print(f"  阈值: {threshold1}")
    print(f"  判定: {'NORMAL ✓' if ci_l1 > threshold1 else '其他'}")

    # 案例2: 边界值记录 - 置信区间下限 == 阈值
    print("\n【案例2: 边界值记录（重点）】")
    n2, k2 = 100, 87
    ci_l2, ci_u2, p2 = wilson_ci(n2, k2)
    threshold2 = 0.80
    print(f"  课程: 线性代数, 老师: 李老师")
    print(f"  样本量: {n2}, 通过: {k2}, 通过率: {p2:.4f}")
    print(f"  置信区间: [{ci_l2:.6f}, {ci_u2:.6f}]")
    print(f"  阈值: {threshold2}")
    print(f"  差值: {abs(ci_l2 - threshold2):.10f}")
    if abs(ci_l2 - threshold2) < 1e-9:
        print(f"  判定: NEED_REVIEW ⚠️ （边界值等于阈值，待任课老师复核）")
    else:
        print(f"  判定: 需要调整参数")

    # 再找一个更精确的
    print("\n  寻找更精确的边界值参数...")
    for n_test in [50, 80, 100, 120, 150, 200]:
        k, ci_l, _, p, diff = find_boundary_params(0.80, n_test)
        if diff < 1e-9:
            print(f"  ✓ n={n_test}, k={k}, p={p:.4f}, ci_lower={ci_l:.6f}, diff={diff:.10f}")

    # 案例3: 旧口径记录（先按新口径正常，补录旧公式后发现异常）
    print("\n【案例3: 旧口径补录】")
    n3, k3 = 100, 78
    ci_l3, ci_u3, p3 = wilson_ci(n3, k3)
    threshold3 = 0.75
    print(f"  课程: 概率论, 老师: 王老师")
    print(f"  新口径 - 样本量: {n3}, 通过: {k3}, 通过率: {p3:.4f}")
    print(f"  新口径 - 置信区间: [{ci_l3:.6f}, {ci_u3:.6f}]")
    print(f"  新口径 - 阈值: {threshold3}")
    print(f"  新口径判定: {'NORMAL' if ci_l3 >= threshold3 else 'ABNORMAL'}")

    # 旧公式下的计算
    print(f"\n  旧公式补录:")
    old_k3 = 73  # 旧公式统计口径不同
    old_ci_l3, old_ci_u3, old_p3 = wilson_ci(n3, old_k3)
    old_threshold3 = 0.78  # 旧阈值
    print(f"  旧口径 - 样本量: {n3}, 通过: {old_k3}, 通过率: {old_p3:.4f}")
    print(f"  旧口径 - 置信区间: [{old_ci_l3:.6f}, {old_ci_u3:.6f}]")
    print(f"  旧口径 - 阈值: {old_threshold3}")
    print(f"  旧口径判定: {'NORMAL' if old_ci_l3 >= old_threshold3 else 'ABNORMAL ⚠️ （生成反例）'}")
