from typing import Dict, List, Tuple


def validate_gamma(pass_rate: float, threshold: float = 90.0) -> Tuple[bool, str]:
    passed = pass_rate >= threshold
    status = "PASS" if passed else "FAIL"
    message = f"Gamma通过率: {pass_rate:.2f}% (阈值: {threshold:.2f}%)"
    return passed, message


def validate_structure_dose(name: str, stats: Dict, thresholds: Dict) -> Tuple[bool, str]:
    if name not in thresholds:
        return True, f"{name}: 无阈值配置"
    thresh = thresholds[name]
    messages = []
    all_passed = True
    if 'max_dose' in thresh:
        limit = thresh['max_dose']
        actual = stats['max_dose']
        passed = actual <= limit
        all_passed = all_passed and passed
        msg = f"最大剂量 {actual:.2f} {'≤' if passed else '>'} {limit:.2f}"
        messages.append(msg)
    if 'mean_dose' in thresh:
        limit = thresh['mean_dose']
        actual = stats['mean_dose']
        passed = actual <= limit
        all_passed = all_passed and passed
        msg = f"平均剂量 {actual:.2f} {'≤' if passed else '>'} {limit:.2f}"
        messages.append(msg)
    status = "PASS" if all_passed else "FAIL"
    return all_passed, f"{name} [{status}]: {'; '.join(messages)}"


def validate_all(gamma_pass_rate: float, structure_stats: Dict, thresholds: Dict) -> Dict:
    results = {}
    gamma_passed, gamma_msg = validate_gamma(gamma_pass_rate, thresholds.get('gamma_pass_rate', 90.0))
    results['gamma'] = {'passed': gamma_passed, 'message': gamma_msg}
    results['structures'] = {}
    for name, stats in structure_stats.items():
        if stats is None:
            results['structures'][name] = {'passed': True, 'message': f"{name}: 轮廓数据为空"}
        else:
            passed, msg = validate_structure_dose(name, stats, thresholds)
            results['structures'][name] = {'passed': passed, 'message': msg}
    overall_passed = gamma_passed and all([r['passed'] for r in results['structures'].values()])
    results['overall'] = {'passed': overall_passed}
    return results
