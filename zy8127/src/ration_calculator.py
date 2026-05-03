import pandas as pd
import yaml
from datetime import datetime, date
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
import copy


@dataclass
class NutritionCalculation:
    total_dry_matter_kg: float
    crude_protein_dm_percent: float
    net_energy_mcal_kg_dm: float
    calcium_dm_percent: float
    phosphorus_dm_percent: float
    ca_p_ratio: float
    feed_breakdown: List[Dict] = field(default_factory=list)


@dataclass
class InventoryConsumption:
    feed_id: str
    feed_name: str
    daily_consumption_kg: float
    current_inventory_kg: float
    days_remaining: float
    projected_shortfall_kg: float
    shortfall_date: Optional[date] = None


@dataclass
class Issue:
    issue_type: str
    severity: str
    group_id: Optional[str]
    feed_id: Optional[str]
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


def load_feed_inventory(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    df['expiry_date'] = pd.to_datetime(df['expiry_date']).dt.date
    return df


def load_lab_results(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    df['test_date'] = pd.to_datetime(df['test_date']).dt.date
    return df


def load_herd_groups(file_path: str) -> pd.DataFrame:
    return pd.read_csv(file_path)


def load_ration_plan(file_path: str) -> Dict:
    with open(file_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def get_lab_values(lab_df: pd.DataFrame, feed_id: str) -> Tuple[Optional[float], Optional[float], Optional[float], Optional[float], Optional[float]]:
    if lab_df.empty or 'feed_id' not in lab_df.columns:
        return None, None, None, None, None
    
    row = lab_df[lab_df['feed_id'] == feed_id]
    if len(row) == 0:
        return None, None, None, None, None
    latest_row = row.iloc[-1]
    return (
        latest_row.get('dry_matter_actual'),
        latest_row.get('crude_protein_percent'),
        latest_row.get('net_energy_mcal_kg'),
        latest_row.get('calcium_percent'),
        latest_row.get('phosphorus_percent')
    )


def get_inventory_dm(inventory_df: pd.DataFrame, feed_id: str) -> Optional[float]:
    row = inventory_df[inventory_df['feed_id'] == feed_id]
    if len(row) == 0:
        return None
    return row.iloc[0].get('dry_matter_percent')


def calculate_group_nutrition(
    group_ration: Dict,
    inventory_df: pd.DataFrame,
    lab_df: pd.DataFrame
) -> Tuple[NutritionCalculation, List[Issue]]:
    issues = []
    feed_breakdown = []
    
    total_dry_matter = 0.0
    cp_grams = 0.0
    ne_mcal = 0.0
    ca_grams = 0.0
    p_grams = 0.0
    
    for feed in group_ration.get('feeds', []):
        feed_id = feed['feed_id']
        as_fed_kg = feed['as_fed_kg']
        
        dm_actual, cp_pct, ne_mcal_kg, ca_pct, p_pct = get_lab_values(lab_df, feed_id)
        
        inv_row = inventory_df[inventory_df['feed_id'] == feed_id]
        inv_dm = get_inventory_dm(inventory_df, feed_id) if len(inv_row) > 0 else None
        feed_name = inv_row.iloc[0]['feed_name'] if len(inv_row) > 0 else feed_id
        
        if dm_actual is None or pd.isna(dm_actual):
            if inv_dm is not None and not pd.isna(inv_dm):
                dm_actual = inv_dm
                issues.append(Issue(
                    issue_type='missing_lab_data',
                    severity='warning',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 缺少实际干物质检测值，使用库存标称值 {inv_dm}%",
                    details={'feed_id': feed_id, 'feed_name': feed_name, 'used_value': inv_dm, 'source': 'inventory'}
                ))
            else:
                issues.append(Issue(
                    issue_type='missing_lab_data',
                    severity='error',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 缺少干物质数据，无法计算",
                    details={'feed_id': feed_id, 'feed_name': feed_name, 'missing_field': 'dry_matter'}
                ))
                continue
        else:
            if cp_pct is None or pd.isna(cp_pct):
                issues.append(Issue(
                    issue_type='missing_lab_data',
                    severity='warning',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 缺少粗蛋白检测值",
                    details={'feed_id': feed_id, 'feed_name': feed_name, 'missing_field': 'crude_protein'}
                ))
            if ne_mcal_kg is None or pd.isna(ne_mcal_kg):
                issues.append(Issue(
                    issue_type='missing_lab_data',
                    severity='warning',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 缺少净能量检测值",
                    details={'feed_id': feed_id, 'feed_name': feed_name, 'missing_field': 'net_energy'}
                ))
            if ca_pct is None or pd.isna(ca_pct):
                issues.append(Issue(
                    issue_type='missing_lab_data',
                    severity='warning',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 缺少钙检测值",
                    details={'feed_id': feed_id, 'feed_name': feed_name, 'missing_field': 'calcium'}
                ))
            if p_pct is None or pd.isna(p_pct):
                issues.append(Issue(
                    issue_type='missing_lab_data',
                    severity='warning',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 缺少磷检测值",
                    details={'feed_id': feed_id, 'feed_name': feed_name, 'missing_field': 'phosphorus'}
                ))
        
        dry_matter_kg = as_fed_kg * (dm_actual / 100.0)
        total_dry_matter += dry_matter_kg
        
        if cp_pct is not None and not pd.isna(cp_pct):
            cp_grams += dry_matter_kg * 1000 * (cp_pct / 100.0)
        
        if ne_mcal_kg is not None and not pd.isna(ne_mcal_kg):
            ne_mcal += dry_matter_kg * ne_mcal_kg
        
        if ca_pct is not None and not pd.isna(ca_pct):
            ca_grams += dry_matter_kg * 1000 * (ca_pct / 100.0)
        
        if p_pct is not None and not pd.isna(p_pct):
            p_grams += dry_matter_kg * 1000 * (p_pct / 100.0)
        
        feed_breakdown.append({
            'feed_id': feed_id,
            'feed_name': feed_name,
            'as_fed_kg': as_fed_kg,
            'dm_percent': dm_actual,
            'dry_matter_kg': dry_matter_kg
        })
    
    cp_dm_pct = (cp_grams / (total_dry_matter * 1000) * 100) if total_dry_matter > 0 else 0.0
    ne_per_kg_dm = (ne_mcal / total_dry_matter) if total_dry_matter > 0 else 0.0
    ca_dm_pct = (ca_grams / (total_dry_matter * 1000) * 100) if total_dry_matter > 0 else 0.0
    p_dm_pct = (p_grams / (total_dry_matter * 1000) * 100) if total_dry_matter > 0 else 0.0
    ca_p_ratio = ca_dm_pct / p_dm_pct if p_dm_pct > 0 else 0.0
    
    return NutritionCalculation(
        total_dry_matter_kg=total_dry_matter,
        crude_protein_dm_percent=cp_dm_pct,
        net_energy_mcal_kg_dm=ne_per_kg_dm,
        calcium_dm_percent=ca_dm_pct,
        phosphorus_dm_percent=p_dm_pct,
        ca_p_ratio=ca_p_ratio,
        feed_breakdown=feed_breakdown
    ), issues


def calculate_inventory_consumption(
    ration_plan: Dict,
    inventory_df: pd.DataFrame,
    herd_df: pd.DataFrame,
    projection_days: int = 30
) -> Tuple[List[InventoryConsumption], List[Issue]]:
    issues = []
    consumption_map: Dict[str, float] = {}
    
    for group_id, group_ration in ration_plan.get('herd_rations', {}).items():
        herd_row = herd_df[herd_df['group_id'] == group_id]
        cow_count = int(herd_row.iloc[0]['cow_count']) if len(herd_row) > 0 else 0
        
        for feed in group_ration.get('feeds', []):
            feed_id = feed['feed_id']
            as_fed_kg = feed['as_fed_kg']
            daily_total = as_fed_kg * cow_count
            
            if feed_id in consumption_map:
                consumption_map[feed_id] += daily_total
            else:
                consumption_map[feed_id] = daily_total
    
    inventory_list = []
    today = date.today()
    
    for _, row in inventory_df.iterrows():
        feed_id = row['feed_id']
        feed_name = row['feed_name']
        current_inv = float(row['quantity_kg'])
        expiry_date = row['expiry_date']
        
        daily_consump = consumption_map.get(feed_id, 0.0)
        
        if daily_consump <= 0:
            days_remaining = float('inf')
            shortfall_kg = 0.0
            shortfall_date = None
        else:
            days_remaining = current_inv / daily_consump
            projected_usage = daily_consump * projection_days
            shortfall_kg = max(0.0, projected_usage - current_inv)
            
            if days_remaining <= projection_days:
                shortfall_days = int(days_remaining)
                from datetime import timedelta
                shortfall_date = today + timedelta(days=shortfall_days)
                
                issues.append(Issue(
                    issue_type='inventory_shortfall',
                    severity='error' if shortfall_kg > 0 else 'warning',
                    group_id=None,
                    feed_id=feed_id,
                    message=f"饲料 {feed_name}({feed_id}) 库存不足，预计 {int(days_remaining)} 天后耗尽",
                    details={
                        'feed_id': feed_id,
                        'feed_name': feed_name,
                        'current_inventory': current_inv,
                        'daily_consumption': daily_consump,
                        'days_remaining': days_remaining,
                        'shortfall_kg': shortfall_kg,
                        'projection_days': projection_days
                    }
                ))
            else:
                shortfall_date = None
        
        if expiry_date < today:
            issues.append(Issue(
                issue_type='expired_batch',
                severity='error',
                group_id=None,
                feed_id=feed_id,
                message=f"饲料 {feed_name}({feed_id}) 批次已过期，过期日期: {expiry_date}",
                details={
                    'feed_id': feed_id,
                    'feed_name': feed_name,
                    'expiry_date': expiry_date,
                    'days_overdue': (today - expiry_date).days
                }
            ))
        elif (expiry_date - today).days <= 14:
            issues.append(Issue(
                issue_type='expiring_soon',
                severity='warning',
                group_id=None,
                feed_id=feed_id,
                message=f"饲料 {feed_name}({feed_id}) 即将过期，剩余 {(expiry_date - today).days} 天",
                details={
                    'feed_id': feed_id,
                    'feed_name': feed_name,
                    'expiry_date': expiry_date,
                    'days_remaining': (expiry_date - today).days
                }
            ))
        
        inventory_list.append(InventoryConsumption(
            feed_id=feed_id,
            feed_name=feed_name,
            daily_consumption_kg=daily_consump,
            current_inventory_kg=current_inv,
            days_remaining=days_remaining,
            projected_shortfall_kg=shortfall_kg,
            shortfall_date=shortfall_date
        ))
    
    return inventory_list, issues


def calculate_actual_cost(
    group_ration: Dict,
    inventory_df: pd.DataFrame
) -> float:
    total_cost = 0.0
    
    for feed in group_ration.get('feeds', []):
        feed_id = feed['feed_id']
        as_fed_kg = feed['as_fed_kg']
        
        inv_row = inventory_df[inventory_df['feed_id'] == feed_id]
        if len(inv_row) > 0:
            unit_cost = float(inv_row.iloc[0]['unit_cost_cny_kg'])
            total_cost += as_fed_kg * unit_cost
    
    return total_cost


def check_nutrient_deviations(
    calculation: NutritionCalculation,
    group_ration: Dict,
    tolerance_pct: float = 5.0
) -> List[Issue]:
    issues = []
    group_name = group_ration.get('group_name', '未知群体')
    group_id = None
    
    targets = {
        'dry_matter': group_ration.get('target_dry_matter_kg'),
        'crude_protein': group_ration.get('target_crude_protein_percent'),
        'net_energy': group_ration.get('target_net_energy_mcal_kg'),
        'calcium': group_ration.get('target_calcium_percent'),
        'phosphorus': group_ration.get('target_phosphorus_percent'),
    }
    
    actuals = {
        'dry_matter': calculation.total_dry_matter_kg,
        'crude_protein': calculation.crude_protein_dm_percent,
        'net_energy': calculation.net_energy_mcal_kg_dm,
        'calcium': calculation.calcium_dm_percent,
        'phosphorus': calculation.phosphorus_dm_percent,
    }
    
    nutrient_names = {
        'dry_matter': '干物质采食量',
        'crude_protein': '粗蛋白(DM基础)',
        'net_energy': '泌乳净能',
        'calcium': '钙(DM基础)',
        'phosphorus': '磷(DM基础)',
    }
    
    units = {
        'dry_matter': 'kg/头/天',
        'crude_protein': '%',
        'net_energy': 'Mcal/kg DM',
        'calcium': '%',
        'phosphorus': '%',
    }
    
    for nutrient, target in targets.items():
        if target is None:
            continue
        
        actual = actuals[nutrient]
        if actual == 0 and nutrient != 'dry_matter':
            continue
        
        deviation_pct = ((actual - target) / target) * 100
        
        if abs(deviation_pct) > tolerance_pct:
            severity = 'error' if abs(deviation_pct) > 10 else 'warning'
            issues.append(Issue(
                issue_type='nutrient_deviation',
                severity=severity,
                group_id=group_id,
                feed_id=None,
                message=f"{group_name} {nutrient_names[nutrient]} 偏差 {deviation_pct:+.1f}%：目标 {target}{units[nutrient]}，实际 {actual:.2f}{units[nutrient]}",
                details={
                    'nutrient': nutrient,
                    'target': target,
                    'actual': actual,
                    'deviation_pct': deviation_pct,
                    'tolerance_pct': tolerance_pct
                }
            ))
    
    ca_p_ratio = calculation.ca_p_ratio
    if ca_p_ratio > 0:
        target_ca_p_min = 1.5
        target_ca_p_max = 2.5
        
        if ca_p_ratio < target_ca_p_min or ca_p_ratio > target_ca_p_max:
            severity = 'error' if (ca_p_ratio < 1.2 or ca_p_ratio > 3.0) else 'warning'
            issues.append(Issue(
                issue_type='ca_p_ratio_deviation',
                severity=severity,
                group_id=group_id,
                feed_id=None,
                message=f"{group_name} 钙磷比例异常: {ca_p_ratio:.2f}:1 (建议范围 1.5-2.5:1)",
                details={
                    'actual_ratio': ca_p_ratio,
                    'target_min': target_ca_p_min,
                    'target_max': target_ca_p_max
                }
            ))
    
    return issues


def check_budget_deviation(
    actual_cost: float,
    group_ration: Dict,
    group_name: str
) -> List[Issue]:
    issues = []
    budget = group_ration.get('budget_cny_per_head_daily')
    
    if budget is None:
        return issues
    
    deviation_pct = ((actual_cost - budget) / budget) * 100
    
    if deviation_pct > 5:
        severity = 'error' if deviation_pct > 10 else 'warning'
        issues.append(Issue(
            issue_type='budget_exceeded',
            severity=severity,
            group_id=None,
            feed_id=None,
            message=f"{group_name} 日粮成本超预算 {deviation_pct:+.1f}%：预算 ¥{budget:.2f}/头/天，实际 ¥{actual_cost:.2f}/头/天",
            details={
                'budget': budget,
                'actual': actual_cost,
                'deviation_pct': deviation_pct
            }
        ))
    elif deviation_pct < -10:
        issues.append(Issue(
            issue_type='budget_underutilized',
            severity='info',
            group_id=None,
            feed_id=None,
            message=f"{group_name} 日粮成本低于预算 {abs(deviation_pct):.1f}%",
            details={
                'budget': budget,
                'actual': actual_cost,
                'deviation_pct': deviation_pct
            }
        ))
    
    return issues


def process_all_groups(
    ration_plan: Dict,
    inventory_df: pd.DataFrame,
    lab_df: pd.DataFrame,
    herd_df: pd.DataFrame,
    projection_days: int = 30,
    tolerance_pct: float = 5.0
) -> Tuple[Dict[str, Dict], List[Issue], List[InventoryConsumption]]:
    all_issues = []
    group_results = {}
    seen_feed_issues = set()
    
    inventory_consumptions, inv_issues = calculate_inventory_consumption(
        ration_plan, inventory_df, herd_df, projection_days
    )
    all_issues.extend(inv_issues)
    
    for issue in inv_issues:
        if issue.feed_id:
            seen_feed_issues.add((issue.feed_id, issue.issue_type))
    
    for group_id, group_ration in ration_plan.get('herd_rations', {}).items():
        nutrition_calc, lab_issues = calculate_group_nutrition(group_ration, inventory_df, lab_df)
        
        for issue in lab_issues:
            key = (issue.feed_id, issue.issue_type) if issue.feed_id else None
            if key and key not in seen_feed_issues:
                seen_feed_issues.add(key)
                all_issues.append(issue)
        
        nutrient_issues = check_nutrient_deviations(nutrition_calc, group_ration, tolerance_pct)
        all_issues.extend(nutrient_issues)
        
        actual_cost = calculate_actual_cost(group_ration, inventory_df)
        group_name = group_ration.get('group_name', group_id)
        budget_issues = check_budget_deviation(actual_cost, group_ration, group_name)
        all_issues.extend(budget_issues)
        
        herd_row = herd_df[herd_df['group_id'] == group_id]
        cow_count = int(herd_row.iloc[0]['cow_count']) if len(herd_row) > 0 else 0
        
        group_results[group_id] = {
            'group_id': group_id,
            'group_name': group_name,
            'cow_count': cow_count,
            'targets': {
                'dry_matter_kg': group_ration.get('target_dry_matter_kg'),
                'crude_protein_percent': group_ration.get('target_crude_protein_percent'),
                'net_energy_mcal_kg': group_ration.get('target_net_energy_mcal_kg'),
                'calcium_percent': group_ration.get('target_calcium_percent'),
                'phosphorus_percent': group_ration.get('target_phosphorus_percent'),
                'budget_cny': group_ration.get('budget_cny_per_head_daily')
            },
            'actual': {
                'dry_matter_kg': nutrition_calc.total_dry_matter_kg,
                'crude_protein_percent': nutrition_calc.crude_protein_dm_percent,
                'net_energy_mcal_kg': nutrition_calc.net_energy_mcal_kg_dm,
                'calcium_percent': nutrition_calc.calcium_dm_percent,
                'phosphorus_percent': nutrition_calc.phosphorus_dm_percent,
                'ca_p_ratio': nutrition_calc.ca_p_ratio,
                'cost_cny': actual_cost
            },
            'feeds': nutrition_calc.feed_breakdown,
            'raw_feeds': group_ration.get('feeds', [])
        }
    
    return group_results, all_issues, inventory_consumptions


def generate_markdown_report(
    group_results: Dict,
    inventory_consumptions: List[InventoryConsumption],
    issues: List[Issue],
    metadata: Dict
) -> str:
    from datetime import datetime
    
    report = []
    report.append(f"# 奶牛日粮配方偏差复核报告")
    report.append("")
    report.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"**配方版本**: {metadata.get('version', 'N/A')}")
    report.append(f"**配方日期**: {metadata.get('date', 'N/A')}")
    report.append(f"**营养师**: {metadata.get('created_by', 'N/A')}")
    report.append("")
    
    issue_count = {'error': 0, 'warning': 0, 'info': 0}
    for issue in issues:
        if issue.severity in issue_count:
            issue_count[issue.severity] += 1
    
    report.append("## 📊 概览")
    report.append(f"")
    report.append(f"- **牛群数量**: {len(group_results)}")
    report.append(f"- **饲料种类**: {len(inventory_consumptions)}")
    report.append(f"- **问题统计**: 🔴 错误 {issue_count['error']} | 🟡 警告 {issue_count['warning']} | ℹ️ 提示 {issue_count['info']}")
    report.append("")
    
    report.append("## 🐄 牛群营养情况")
    report.append("")
    
    for group_id, result in group_results.items():
        report.append(f"### {result['group_name']} ({group_id})")
        report.append("")
        report.append(f"- **牛头数**: {result['cow_count']} 头")
        report.append("")
        report.append("| 指标 | 目标值 | 实际值 | 偏差 |")
        report.append("|------|--------|--------|------|")
        
        targets = result['targets']
        actuals = result['actual']
        
        metrics = [
            ('干物质采食量', 'dry_matter_kg', 'kg/头/天'),
            ('粗蛋白(DM)', 'crude_protein_percent', '%'),
            ('泌乳净能', 'net_energy_mcal_kg', 'Mcal/kg DM'),
            ('钙(DM)', 'calcium_percent', '%'),
            ('磷(DM)', 'phosphorus_percent', '%'),
            ('钙磷比', 'ca_p_ratio', ':1'),
            ('日粮成本', 'cost_cny', '元/头/天'),
        ]
        
        for name, key, unit in metrics:
            target = targets.get(key) if key in targets else None
            actual = actuals.get(key, 0)
            
            if key == 'ca_p_ratio':
                target_str = "1.5-2.5"
            elif key == 'cost_cny':
                target = targets.get('budget_cny')
                target_str = f"{target:.2f}" if target else "N/A"
            else:
                target_str = f"{target:.2f}" if target else "N/A"
            
            if target and key not in ['ca_p_ratio', 'cost_cny']:
                deviation = ((actual - target) / target * 100) if target > 0 else 0
                deviation_str = f"{deviation:+.1f}%"
            elif key == 'cost_cny' and target:
                deviation = ((actual - target) / target * 100) if target > 0 else 0
                deviation_str = f"{deviation:+.1f}%"
            else:
                deviation_str = "-"
            
            report.append(f"| {name} | {target_str} {unit} | {actual:.2f} {unit} | {deviation_str} |")
        
        report.append("")
        report.append("**饲料配方:**")
        report.append("")
        report.append("| 饲料 | 饲喂量(kg) | 干物质(%) | DM摄入量(kg) |")
        report.append("|------|-----------|-----------|-------------|")
        for feed in result['feeds']:
            report.append(f"| {feed['feed_name']} | {feed['as_fed_kg']:.1f} | {feed['dm_percent']:.1f} | {feed['dry_matter_kg']:.2f} |")
        report.append("")
    
    report.append("## 📦 库存消耗分析")
    report.append("")
    report.append("| 饲料 | 当前库存(kg) | 日消耗量(kg) | 可用天数 | 30天预测缺口(kg) |")
    report.append("|------|-------------|-------------|---------|-----------------|")
    
    for inv in inventory_consumptions:
        days_str = "∞" if inv.days_remaining == float('inf') else f"{int(inv.days_remaining)}天"
        report.append(f"| {inv.feed_name} | {inv.current_inventory_kg:,.0f} | {inv.daily_consumption_kg:,.1f} | {days_str} | {inv.projected_shortfall_kg:,.1f} |")
    
    report.append("")
    
    if issues:
        report.append("## ⚠️ 问题明细")
        report.append("")
        
        for severity in ['error', 'warning', 'info']:
            severity_issues = [i for i in issues if i.severity == severity]
            if severity_issues:
                icon = '🔴' if severity == 'error' else ('🟡' if severity == 'warning' else 'ℹ️')
                label = '错误' if severity == 'error' else ('警告' if severity == 'warning' else '提示')
                report.append(f"### {icon} {label} ({len(severity_issues)}项)")
                report.append("")
                for issue in severity_issues:
                    report.append(f"- **{issue.issue_type}**: {issue.message}")
                report.append("")
    
    report.append("---")
    report.append("*此报告由日粮配方偏差复核系统自动生成*")
    
    return "\n".join(report)


def issues_to_dataframe(issues: List[Issue]) -> pd.DataFrame:
    rows = []
    for issue in issues:
        rows.append({
            'issue_type': issue.issue_type,
            'severity': issue.severity,
            'group_id': issue.group_id or '',
            'feed_id': issue.feed_id or '',
            'message': issue.message,
            'details': str(issue.details)
        })
    return pd.DataFrame(rows)
