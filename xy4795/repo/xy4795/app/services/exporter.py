from app.services.metrics_calculator import (
    get_overall_metrics, get_metrics_by_module, get_metrics_by_owner
)
from app.services.quarantine_service import get_quarantine_list, get_quarantine_stats
from app.models import TestReport, CoverageReport, FlakyRun
from datetime import datetime


def export_markdown_report(target_coverage=80.0, flaky_threshold=30.0, days=None, 
                            include_modules=True, include_owners=True, 
                            include_quarantine=True):
    overall = get_overall_metrics(target_coverage, flaky_threshold, days)
    modules = get_metrics_by_module(target_coverage, flaky_threshold, days) if include_modules else {}
    owners = get_metrics_by_owner(target_coverage, flaky_threshold, days) if include_owners else {}
    quarantine_list = get_quarantine_list() if include_quarantine else []
    quarantine_stats = get_quarantine_stats() if include_quarantine else {}
    
    lines = []
    
    lines.append('# 测试健康门禁报告')
    lines.append('')
    lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    lines.append('')
    
    health_emoji = _get_health_emoji(overall['health_status'])
    lines.append('## 整体健康状态')
    lines.append('')
    lines.append(f'| 健康分数 | 状态 |')
    lines.append(f'|----------|------|')
    lines.append(f'| **{overall["health_score"]}** | {health_emoji} {overall["health_status"].upper()} |')
    lines.append('')
    
    lines.append('## 关键指标摘要')
    lines.append('')
    lines.append('### 测试通过率')
    lines.append('')
    fr = overall['failure_rate']
    lines.append(f'- 总测试数: {fr["total_tests"]}')
    lines.append(f'- 通过: {fr["passed"]}')
    lines.append(f'- 失败: {fr["failed"]}')
    lines.append(f'- 跳过: {fr["skipped"]}')
    lines.append(f'- **失败率**: {fr["failure_rate"]}%')
    lines.append(f'- **通过率**: {fr["pass_rate"]}%')
    lines.append('')
    
    lines.append('### 代码覆盖率')
    lines.append('')
    cg = overall['coverage_gap']
    lines.append(f'- 目标覆盖率: {cg["target_coverage"]}%')
    lines.append(f'- 当前覆盖率: {cg["current_coverage"]}%')
    lines.append(f'- **覆盖率缺口**: {cg["coverage_gap"]}%')
    lines.append(f'- 总行数: {cg["total_lines"]}')
    lines.append(f'- 已覆盖: {cg["covered_lines"]}')
    lines.append(f'- 未覆盖: {cg["missed_lines"]}')
    if cg['lines_needed'] > 0:
        lines.append(f'- 需要覆盖行数: {cg["lines_needed"]}')
    if cg['files_below_target']:
        lines.append(f'- 文件低于目标: {len(cg["files_below_target"])} 个')
    lines.append('')
    
    lines.append('### Flaky 测试风险')
    lines.append('')
    fl = overall['flaky_risk']
    lines.append(f'- Flaky 阈值: {fl["flaky_threshold"]}%')
    lines.append(f'- 总 Flaky 测试数: {fl["total_flaky_tests"]}')
    lines.append(f'- 总尝试次数: {fl["total_attempts"]}')
    lines.append(f'- 总失败次数: {fl["total_failures"]}')
    lines.append(f'- **整体 Flaky 率**: {fl["overall_flaky_rate"]}%')
    lines.append(f'- 最高 Flaky 率: {fl["max_flaky_rate"]}%')
    lines.append(f'- **风险分数**: {fl["risk_score"]}')
    lines.append(f'- **风险等级**: {_get_risk_emoji(fl["risk_level"])} {fl["risk_level"].upper()}')
    lines.append('')
    if fl['high_risk_tests']:
        lines.append(f'#### 高风险测试 ({len(fl["high_risk_tests"])} 个)')
        lines.append('')
        for test in fl['high_risk_tests'][:10]:
            lines.append(f'- **{test["test_name"]}** (Flaky 率: {test["flaky_rate"]}%)')
            if test['error_messages']:
                lines.append(f'  - 错误: {test["error_messages"][0][:100]}...' if len(test["error_messages"][0]) > 100 else f'  - 错误: {test["error_messages"][0]}')
        lines.append('')
    if fl['medium_risk_tests']:
        lines.append(f'#### 中风险测试 ({len(fl["medium_risk_tests"])} 个)')
        lines.append('')
        for test in fl['medium_risk_tests'][:5]:
            lines.append(f'- **{test["test_name"]}** (Flaky 率: {test["flaky_rate"]}%)')
        lines.append('')
    
    if include_quarantine:
        lines.append('## 隔离名单')
        lines.append('')
        lines.append(f'- 活动隔离数: {quarantine_stats.get("total_active", 0)}')
        lines.append(f'- 历史隔离数: {quarantine_stats.get("total_inactive", 0)}')
        lines.append('')
        
        if quarantine_stats.get('by_category'):
            lines.append('### 按原因分类')
            lines.append('')
            for cat, count in quarantine_stats['by_category'].items():
                lines.append(f'- {cat}: {count}')
            lines.append('')
        
        if quarantine_list:
            lines.append('### 当前隔离列表')
            lines.append('')
            for q in quarantine_list[:15]:
                lines.append(f'- **{q["test_name"]}**')
                lines.append(f'  - 模块: {q["module"] or "N/A"}')
                lines.append(f'  - 负责人: {q["owner"] or "N/A"}')
                lines.append(f'  - 原因: {q["reason"]}')
                if q['reason_category']:
                    lines.append(f'  - 类别: {q["reason_category"]}')
                lines.append(f'  - 添加时间: {q["added_at"]}')
                lines.append('')
    
    if include_modules and modules:
        lines.append('## 按模块分析')
        lines.append('')
        for module, metrics in sorted(modules.items()):
            module_health = _calculate_module_health(metrics)
            lines.append(f'### {module}')
            lines.append('')
            lines.append(f'- 健康状态: {_get_health_emoji(module_health)} {module_health.upper()}')
            lines.append(f'- 失败率: {metrics["failure_rate"]["failure_rate"]}%')
            lines.append(f'- 覆盖率: {metrics["coverage_gap"]["current_coverage"]}% (缺口: {metrics["coverage_gap"]["coverage_gap"]}%)')
            lines.append(f'- Flaky 测试: {metrics["flaky_risk"]["total_flaky_tests"]} 个')
            lines.append('')
    
    if include_owners and owners:
        lines.append('## 按负责人分析')
        lines.append('')
        for owner, metrics in sorted(owners.items()):
            owner_health = _calculate_module_health(metrics)
            lines.append(f'### {owner}')
            lines.append('')
            lines.append(f'- 健康状态: {_get_health_emoji(owner_health)} {owner_health.upper()}')
            lines.append(f'- 失败率: {metrics["failure_rate"]["failure_rate"]}%')
            lines.append(f'- 覆盖率: {metrics["coverage_gap"]["current_coverage"]}% (缺口: {metrics["coverage_gap"]["coverage_gap"]}%)')
            lines.append(f'- Flaky 测试: {metrics["flaky_risk"]["total_flaky_tests"]} 个')
            lines.append('')
    
    lines.append('---')
    lines.append('')
    lines.append('*报告由测试健康门禁系统自动生成*')
    
    return '\n'.join(lines)


def export_json_details(target_coverage=80.0, flaky_threshold=30.0, days=None,
                        include_test_cases=False, include_coverage_files=False,
                        include_flaky_details=False, include_quarantine=True):
    result = {
        'generated_at': datetime.now().isoformat(),
        'target_coverage': target_coverage,
        'flaky_threshold': flaky_threshold,
        'overall': get_overall_metrics(target_coverage, flaky_threshold, days),
        'by_module': get_metrics_by_module(target_coverage, flaky_threshold, days),
        'by_owner': get_metrics_by_owner(target_coverage, flaky_threshold, days)
    }
    
    if include_quarantine:
        result['quarantine'] = {
            'list': get_quarantine_list(),
            'stats': get_quarantine_stats()
        }
    
    if include_test_cases:
        from app.models import TestCase
        test_cases = TestCase.query.all()
        result['test_cases'] = [tc.to_dict() for tc in test_cases]
    
    if include_coverage_files:
        from app.models import CoverageFile
        coverage_files = CoverageFile.query.all()
        result['coverage_files'] = [cf.to_dict() for cf in coverage_files]
    
    if include_flaky_details:
        from app.models import FlakyRun
        flaky_runs = FlakyRun.query.all()
        result['flaky_runs'] = [fr.to_dict() for fr in flaky_runs]
    
    return result


def _get_health_emoji(status):
    emoji_map = {
        'healthy': '✅',
        'warning': '⚠️',
        'degraded': '🔶',
        'critical': '🔴'
    }
    return emoji_map.get(status, '⚪')


def _get_risk_emoji(level):
    emoji_map = {
        'low': '🟢',
        'medium': '🟡',
        'high': '🟠',
        'critical': '🔴'
    }
    return emoji_map.get(level, '⚪')


def _calculate_module_health(metrics):
    score = 100.0
    
    fr = metrics['failure_rate']
    if fr['total_tests'] > 0:
        score -= fr['failure_rate'] * 0.5
    
    cg = metrics['coverage_gap']
    score -= cg['coverage_gap'] * 0.8
    
    fl = metrics['flaky_risk']
    if fl['risk_score'] > 0:
        score -= fl['risk_score'] * 0.3
    
    score = max(0, score)
    
    if score >= 80:
        return 'healthy'
    elif score >= 60:
        return 'warning'
    elif score >= 40:
        return 'degraded'
    else:
        return 'critical'
