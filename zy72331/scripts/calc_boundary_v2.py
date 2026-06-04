"""精确计算边界值参数 - 先算CI下限，再设阈值"""

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


def find_exact_boundary(target_precision=1e-12, max_n=500):
    """
    寻找精确的边界值组合：
    策略：先找 n 和 k 算出 ci_lower，然后把阈值设为这个精确值
    返回多个候选组合
    """
    candidates = []

    for n in range(30, max_n + 1):
        for k in range(1, n):
            ci_lower, ci_upper, p_hat = wilson_ci(n, k)
            # 保留足够多的小数位
            ci_lower_str = f"{ci_lower:.12f}"
            candidates.append({
                'n': n,
                'k': k,
                'p_hat': p_hat,
                'ci_lower': ci_lower,
                'ci_lower_str': ci_lower_str,
                'ci_upper': ci_upper,
                'score_range': get_score_range(p_hat * 100),
            })

    # 按置信区间下限分组，找适合做阈值的
    return candidates


def get_score_range(score):
    """根据分数确定区间"""
    if score >= 90:
        return "90-100"
    elif score >= 80:
        return "80-89"
    elif score >= 70:
        return "70-79"
    elif score >= 60:
        return "60-69"
    else:
        return "0-59"


if __name__ == "__main__":
    print("=== 精确边界值参数搜索 ===")

    candidates = find_exact_boundary(max_n=200)

    # 挑选几个典型的、不同分数区间的组合
    print("\n=== 推荐边界值组合（阈值=CI下限）===")

    selected = []
    score_ranges_covered = set()

    for c in candidates:
        sr = c['score_range']
        if sr not in score_ranges_covered and sr != "0-59":
            selected.append(c)
            score_ranges_covered.add(sr)
            if len(score_ranges_covered) >= 4:
                break

    # 再额外挑选一些整数值的
    for c in candidates:
        if c['n'] in [100, 150, 200] and c['k'] % 5 == 0:
            if c not in selected:
                selected.append(c)

    for i, c in enumerate(selected[:8]):
        print(f"\n【边界组合 {i+1}】")
        print(f"  样本量 n = {c['n']}")
        print(f"  通过数 k = {c['k']}")
        print(f"  通过率 p = {c['p_hat']:.6f}")
        print(f"  分数: {c['p_hat']*100:.2f} (区间: {c['score_range']})")
        print(f"  CI下限 = {c['ci_lower_str']}")
        print(f"  CI上限 = {c['ci_upper']:.6f}")
        print(f"  → 权重表阈值应设为: {c['ci_lower_str']}")
        print(f"  判定: NEED_REVIEW (边界值刚好等于阈值)")

    # 验证：选一个作为演示的边界案例
    print("\n=== 验证边界标记逻辑 ===")
    test_c = selected[1]
    threshold = test_c['ci_lower']
    ci_lower = test_c['ci_lower']

    print(f"\n测试案例: n={test_c['n']}, k={test_c['k']}")
    print(f"CI下限: {ci_lower:.12f}")
    print(f"阈值:    {threshold:.12f}")
    print(f"差值:    {abs(ci_lower - threshold):.20f}")
    print(f"是否小于1e-9: {abs(ci_lower - threshold) < 1e-9}")

    # 现在设计完整的评分权重表
    print("\n=== 完整演示数据设计 ===")

    # 案例1: 顺利记录 (normal)
    n1, k1 = 100, 95
    ci_l1, ci_u1, p1 = wilson_ci(n1, k1)
    threshold1 = 0.85  # 90-100分区间
    print(f"\n【案例1: 顺利记录】")
    print(f"  课程: 高等数学, 老师: 张教授")
    print(f"  分数区间: 90-100 (得分: {p1*100:.1f})")
    print(f"  样本量: {n1}, 通过: {k1}, 通过率: {p1:.4f}")
    print(f"  置信区间: [{ci_l1:.6f}, {ci_u1:.6f}]")
    print(f"  阈值: {threshold1}")
    print(f"  CI下限 - 阈值 = {ci_l1 - threshold1:.6f} (>0 → NORMAL ✓)")

    # 案例2: 边界值记录 (need_review)
    boundary_c = selected[2]  # 选80-89区间的
    n2, k2 = boundary_c['n'], boundary_c['k']
    ci_l2, ci_u2, p2 = wilson_ci(n2, k2)
    threshold2 = boundary_c['ci_lower']  # 精确等于CI下限
    print(f"\n【案例2: 边界值记录 ⚠️】")
    print(f"  课程: 线性代数, 老师: 李老师")
    print(f"  分数区间: {boundary_c['score_range']} (得分: {p2*100:.1f})")
    print(f"  样本量: {n2}, 通过: {k2}, 通过率: {p2:.4f}")
    print(f"  置信区间: [{ci_l2:.10f}, {ci_u2:.6f}]")
    print(f"  阈值: {threshold2:.10f}")
    print(f"  CI下限 - 阈值 = {ci_l2 - threshold2:.15f} (==0 → NEED_REVIEW ⚠️)")
    print(f"  待任课老师复核，不自动归为正常")

    # 案例3: 旧口径补录 (normal → 旧公式补录后生成反例)
    n3, k3 = 100, 82
    ci_l3, ci_u3, p3 = wilson_ci(n3, k3)
    threshold3 = 0.72  # 70-79区间
    print(f"\n【案例3: 旧口径补录】")
    print(f"  课程: 概率论与数理统计, 老师: 王老师")
    print(f"  分数区间: 70-79 (得分: {p3*100:.1f})")
    print(f"  新口径 - 样本量: {n3}, 通过: {k3}, 通过率: {p3:.4f}")
    print(f"  新口径 - 置信区间: [{ci_l3:.6f}, {ci_u3:.6f}]")
    print(f"  新口径 - 阈值: {threshold3}")
    print(f"  新口径判定: {'NORMAL ✓' if ci_l3 >= threshold3 else 'ABNORMAL'}")

    # 旧公式下的计算（不同统计口径，k值不同）
    old_k3 = 76  # 旧公式统计口径差异
    old_ci_l3, old_ci_u3, old_p3 = wilson_ci(n3, old_k3)
    old_threshold3 = 0.75  # 旧阈值
    print(f"\n  【补录旧公式截图后】")
    print(f"  旧公式: 通过率 = (通过人数 - 缺考人数) / 应考人数")
    print(f"  旧口径 - 通过: {old_k3}, 通过率: {old_p3:.4f}")
    print(f"  旧口径 - 置信区间: [{old_ci_l3:.6f}, {old_ci_u3:.6f}]")
    print(f"  旧口径 - 阈值: {old_threshold3}")
    is_old_abnormal = old_ci_l3 < old_threshold3
    print(f"  旧口径判定: {'ABNORMAL ⚠️' if is_old_abnormal else 'NORMAL'}")
    if is_old_abnormal:
        print(f"  → 生成反例记录，反例列表自动更新")
        print(f"  → 创建旧口径来源的样本记录")

    # 输出可直接使用的精确阈值
    print("\n=== 评分权重表设计（含精确边界阈值）===")
    print("""
    [
        {"score_range": "90-100", "weight": 1.2, "threshold": 0.85, "description": "优秀"},
        {"score_range": "80-89", "weight": 1.0, "threshold": """ + f"{threshold2:.12f}" + """, "description": "良好（边界值精确匹配）"},
        {"score_range": "70-79", "weight": 0.9, "threshold": 0.72, "description": "中等"},
        {"score_range": "60-69", "weight": 0.8, "threshold": 0.58, "description": "及格"},
    ]
    """)

    print(f"\n边界案例精确参数: n={n2}, k={k2}, threshold={threshold2:.12f}")
