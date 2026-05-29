import os
import csv
from typing import List, Dict, Tuple, Any
from collections import defaultdict

from ..core.models import (
    NormalizedBill,
    BudgetLine,
    AnomalyRecord,
    AnomalyType,
)
from ..core.config import Config
from ..utils.currency import convert_currency, normalize_currency_code
from ..utils.security import get_masked_logger, mask_sensitive_data, MaskingContext


def load_budget_file(
    filepath: str,
    config: Config,
) -> List[BudgetLine]:
    logger = get_masked_logger(config, "budget")
    logger.info(f"Loading budget file: {filepath}")

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Budget file not found: {filepath}")

    budgets: List[BudgetLine] = []
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    try:
        if ext == ".csv":
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    budget = _parse_budget_row(row, config)
                    if budget:
                        budgets.append(budget)
        elif ext in [".xlsx", ".xls"]:
            import pandas as pd
            df = pd.read_excel(filepath)
            for _, row in df.iterrows():
                row_dict = row.to_dict()
                budget = _parse_budget_row(row_dict, config)
                if budget:
                    budgets.append(budget)
        elif ext in [".yaml", ".yml"]:
            import yaml
            with open(filepath, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                if isinstance(data, list):
                    for item in data:
                        budget = _parse_budget_row(item, config)
                        if budget:
                            budgets.append(budget)
                elif isinstance(data, dict) and "budgets" in data:
                    for item in data["budgets"]:
                        budget = _parse_budget_row(item, config)
                        if budget:
                            budgets.append(budget)
    except Exception as e:
        logger.error(f"Failed to load budget file: {e}")
        raise

    logger.info(f"Loaded {len(budgets)} budget lines")
    return budgets


def _parse_budget_row(row: Dict[str, Any], config: Config) -> BudgetLine:
    project = (
        str(row.get("project", row.get("项目", row.get("Project", "")))).strip()
    )
    if not project:
        return None

    budget_amount = row.get(
        "monthly_budget",
        row.get("预算", row.get("budget", row.get("amount", row.get("金额", 0)))),
    )
    try:
        monthly_budget = float(budget_amount) if budget_amount is not None else 0.0
    except (ValueError, TypeError):
        monthly_budget = 0.0

    currency = str(row.get(
        "currency",
        row.get("币种", row.get("Currency", config.target_currency)),
    )).strip()
    currency = normalize_currency_code(currency) or config.target_currency

    try:
        if currency != config.target_currency:
            monthly_budget, _ = convert_currency(
                monthly_budget, currency, config.target_currency, config
            )
            currency = config.target_currency
    except ValueError:
        pass

    service = str(row.get(
        "service",
        row.get("服务", row.get("Service", "")),
    )).strip() or None

    team = str(row.get(
        "team",
        row.get("团队", row.get("Team", "")),
    )).strip() or None

    return BudgetLine(
        project=project,
        monthly_budget=monthly_budget,
        currency=currency,
        service=service,
        team=team,
    )


def compare_budgets(
    bills: List[NormalizedBill],
    budgets: List[BudgetLine],
    config: Config,
) -> Tuple[Dict[str, Dict[str, Any]], List[AnomalyRecord]]:
    logger = get_masked_logger(config, "budget")
    logger.info(f"Comparing {len(bills)} bills against {len(budgets)} budgets")

    project_costs: Dict[str, float] = defaultdict(float)
    project_service_costs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    project_team_costs: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    for bill in bills:
        project = bill.project or "unknown_project"
        service = bill.service or "unknown_service"
        team = bill.team or "unknown_team"
        cost = bill.normalized_cost

        project_costs[project] += cost
        project_service_costs[project][service] += cost
        project_team_costs[project][team] += cost

    budget_comparison: Dict[str, Dict[str, Any]] = {}
    anomalies: List[AnomalyRecord] = []

    for budget in budgets:
        project = budget.project
        actual_cost = project_costs.get(project, 0.0)
        budget_amount = budget.monthly_budget

        if budget_amount > 0:
            usage_percent = (actual_cost / budget_amount) * 100
        else:
            usage_percent = 0.0 if actual_cost == 0 else 100.0

        comparison = {
            "project": project,
            "budget": budget_amount,
            "actual": actual_cost,
            "difference": actual_cost - budget_amount,
            "usage_percent": usage_percent,
            "currency": config.target_currency,
            "service_breakdown": dict(project_service_costs.get(project, {})),
            "team_breakdown": dict(project_team_costs.get(project, {})),
            "status": "normal",
        }

        if usage_percent >= 100:
            comparison["status"] = "exceeded"
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.BUDGET_EXCEEDED,
                severity="high",
                message=(
                    f"Budget exceeded for project '{project}': "
                    f"actual {actual_cost:.2f} {config.target_currency} > "
                    f"budget {budget_amount:.2f} {config.target_currency} "
                    f"({usage_percent:.1f}%)"
                ),
                project=project,
                current_cost=actual_cost,
                threshold=budget_amount,
                change_percent=usage_percent,
                raw_data={
                    "budget": budget_amount,
                    "usage_percent": usage_percent,
                    "team": budget.team,
                    "service": budget.service,
                },
            ))
        elif usage_percent >= config.budget_warning_percent:
            comparison["status"] = "warning"
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.BUDGET_EXCEEDED,
                severity="medium",
                message=(
                    f"Budget warning for project '{project}': "
                    f"usage at {usage_percent:.1f}% "
                    f"({actual_cost:.2f} / {budget_amount:.2f} {config.target_currency})"
                ),
                project=project,
                current_cost=actual_cost,
                threshold=budget_amount,
                change_percent=usage_percent,
                raw_data={
                    "budget": budget_amount,
                    "usage_percent": usage_percent,
                    "warning_threshold": config.budget_warning_percent,
                },
            ))

        budget_comparison[project] = comparison

    unknown_projects = set(project_costs.keys()) - set(b.project for b in budgets)
    for project in unknown_projects:
        if project == "unknown_project":
            continue
        actual_cost = project_costs[project]
        budget_comparison[project] = {
            "project": project,
            "budget": 0.0,
            "actual": actual_cost,
            "difference": actual_cost,
            "usage_percent": 100.0 if actual_cost > 0 else 0.0,
            "currency": config.target_currency,
            "service_breakdown": dict(project_service_costs.get(project, {})),
            "team_breakdown": dict(project_team_costs.get(project, {})),
            "status": "no_budget",
        }

    logger.info(
        f"Budget comparison complete: {len(budget_comparison)} projects, "
        f"{len([a for a in anomalies if a.severity == 'high'])} exceeded, "
        f"{len([a for a in anomalies if a.severity == 'medium'])} warnings"
    )

    return budget_comparison, anomalies
