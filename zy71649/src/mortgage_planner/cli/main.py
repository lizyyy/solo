"""房贷提前还款规划 CLI - 主入口"""

import os
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Optional, List, Dict, Any
from io import StringIO

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.columns import Columns
from rich.syntax import Syntax
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import box
from rich.text import Text

from ..models.base import ConflictResolution
from ..models.loan import LoanContract
from ..models.repayment import RepaymentRecord
from ..models.budget import Budget
from ..models.penalty import PenaltyRule
from ..models.goal import ClientGoal, PrepayStrategy, Priority
from ..storage.store import DataStore, RecordStatus
from ..importer.importer import DataImporter
from ..importer.base import ImportAction
from ..engine.calculator import get_repayment_summary
from ..simulation.scenario import (
    generate_default_scenarios,
    compare_scenarios,
    create_scenario,
    Scenario,
)
from ..report.generator import ReportGenerator, ReportFormat
from ..report.interpreter import ResultInterpreter, ExplanationLevel
from ..exceptions.handler import ExceptionHandler
from ..exceptions.base import ErrorCategory

console = Console()
D = Decimal


def _get_store(data_dir: str = "data") -> DataStore:
    """获取数据存储实例"""
    return DataStore(data_dir=data_dir)


def _print_error_summary(exception_handler: ExceptionHandler, title: str = "异常信息"):
    """打印错误摘要"""
    if not exception_handler.has_errors:
        return

    table = Table(title=title, box=box.ROUNDED, show_lines=True)
    table.add_column("类别", style="cyan", no_wrap=True)
    table.add_column("严重程度", style="magenta", no_wrap=True)
    table.add_column("字段", style="yellow")
    table.add_column("错误信息", style="red")
    table.add_column("建议", style="green")

    category_labels = {
        ErrorCategory.DATA_ERROR: "📊 数据问题",
        ErrorCategory.RULE_ERROR: "⚙️ 规则问题",
        ErrorCategory.MATERIAL_ERROR: "📋 材料缺失",
        ErrorCategory.SYSTEM_ERROR: "🔧 系统问题",
    }

    severity_styles = {
        "info": "blue",
        "warning": "yellow",
        "error": "red",
        "critical": "bold red",
    }

    for err in exception_handler.errors:
        category_label = category_labels.get(err.category, err.category.value)
        severity_style = severity_styles.get(err.severity.value, "white")
        severity_text = Text(err.severity.value, style=severity_style)

        field = err.context.field if err.context else "-"
        suggestions = "; ".join(err.context.suggestions) if err.context and err.context.suggestions else "-"

        table.add_row(
            category_label,
            severity_text,
            field,
            err.message,
            suggestions,
        )

    console.print(table)


def _format_amount(amount: Optional[Decimal]) -> str:
    """格式化金额"""
    if amount is None:
        return "-"
    if abs(amount) >= D("10000"):
        return f"{float(amount / D('10000')):.2f}万"
    return f"{float(amount):,.2f}"


@click.group(help="🏠 房贷提前还款规划工具 - 帮您做出最优还款决策")
@click.option("--data-dir", default="data", help="数据存储目录", show_default=True)
@click.pass_context
def cli(ctx: click.Context, data_dir: str):
    """房贷提前还款规划 CLI 主入口"""
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    ctx.obj["store"] = _get_store(data_dir)


# ─── 初始化命令 ────────────────────────────────────────────────────────────
@cli.command("init", help="初始化工作目录并创建样例数据")
@click.option("--force", is_flag=True, help="强制覆盖现有数据")
@click.option("--with-examples", is_flag=True, default=True, help="生成样例数据", show_default=True)
@click.pass_context
def init_cmd(ctx: click.Context, force: bool, with_examples: bool):
    """初始化工作目录"""
    data_dir = ctx.obj["data_dir"]
    store = ctx.obj["store"]

    if Path(data_dir).exists() and any(Path(data_dir).iterdir()) and not force:
        console.print(f"[yellow]⚠️  数据目录 '{data_dir}' 已存在且不为空[/yellow]")
        console.print("   使用 --force 强制覆盖，或手动清理目录后重试")
        return

    Path(data_dir).mkdir(parents=True, exist_ok=True)

    stats = store.get_stats()
    existing_data = any(s["total"] > 0 for s in stats.values())

    if existing_data and not force:
        console.print(f"[yellow]⚠️  数据目录已有数据[/yellow]")
        console.print("   使用 --force 强制覆盖")
        return

    if with_examples:
        console.print("[green]📦 正在创建样例数据...[/green]")
        _create_example_data(store)

    console.print(Panel.fit(
        f"[green]✓[/green] 工作目录初始化完成\n"
        f"[cyan]📁 数据目录:[/cyan] {data_dir}\n"
        f"[cyan]📝 下一步:[/cyan] 查看样例数据: mortgage list\n"
        f"[cyan]🚀 快速开始:[/cyan] mortgage simulate --contract-no LOAN001",
        title="初始化成功",
        border_style="green",
    ))


def _create_example_data(store: DataStore):
    """创建样例数据"""
    loan = LoanContract(
        contract_no="LOAN001",
        customer_name="张三",
        customer_id="CUST001",
        loan_amount=D("1000000"),
        loan_term_months=360,
        annual_interest_rate=D("0.042"),
        repayment_method="equal_principal_interest",
        start_date=date(2022, 1, 1),
        first_payment_date=date(2022, 2, 1),
        maturity_date=date(2052, 1, 1),
        lpr_based=True,
        lpr_adjustment_period_months=12,
        current_lpr_rate=D("0.0345"),
        lpr_margin=D("0.0075"),
        loan_purpose="首套住房贷款",
        property_address="北京市朝阳区建国路88号",
        bank_name="中国工商银行",
        account_no="6222021234567890123",
        notes="2022年购房贷款，享受首套利率优惠",
    )
    store.save(loan, conflict_resolution=ConflictResolution.UPDATE, operator="system")

    current_date = date(2022, 2, 1)
    remaining_principal = D("1000000")
    monthly_rate = D("0.042") / D("12")
    monthly_payment = D("4890.17")

    for period_no in range(1, 37):
        interest = ROUND(remaining_principal * monthly_rate)
        principal = ROUND(monthly_payment - interest)
        remaining_principal = ROUND(remaining_principal - principal)

        record = RepaymentRecord(
            contract_no="LOAN001",
            repayment_date=current_date,
            period_no=period_no,
            total_amount=monthly_payment,
            principal_amount=principal,
            interest_amount=interest,
            penalty_amount=D("0"),
            overdue_amount=D("0"),
            remaining_principal=remaining_principal,
            status="normal",
            is_prepayment=False,
            payment_method="自动扣款",
            transaction_no=f"TXN{period_no:06d}",
            bank_remark="正常还款",
        )
        store.save(record, conflict_resolution=ConflictResolution.UPDATE, operator="system")
        current_date = _add_months(current_date, 1)

    budget = Budget(
        customer_id="CUST001",
        budget_month=date(2025, 1, 1),
        monthly_household_income=D("35000"),
        monthly_household_expense=D("15000"),
        monthly_mortgage_payment=D("4890.17"),
        monthly_surplus=D("15109.83"),
        total_assets=D("2500000"),
        total_liabilities=D("950000"),
        emergency_fund=D("100000"),
        available_cash=D("300000"),
        risk_tolerance="medium",
        future_income_change="stable",
        major_expense_plan="预计2026年子女教育支出增加",
        notes="家庭财务状况良好，有一定积蓄",
    )
    store.save(budget, conflict_resolution=ConflictResolution.UPDATE, operator="system")

    penalty_rule = PenaltyRule(
        contract_no="LOAN001",
        rule_name="提前还款违约金规则",
        rule_effective_date=date(2022, 1, 1),
        penalty_type="interest_months",
        penalty_value=D("3"),
        min_months_to_prepay=12,
        min_prepay_amount=D("10000"),
        max_prepay_times_per_year=3,
        prepay_date_restriction="还款日前后3天",
        special_conditions="还款满3年后免违约金",
        source_document="贷款合同第15条",
        notes="3年期内提前还款收3个月利息作为违约金",
    )
    store.save(penalty_rule, conflict_resolution=ConflictResolution.UPDATE, operator="system")

    goal = ClientGoal(
        customer_id="CUST001",
        prepay_amount=D("200000"),
        prepay_strategy="shorten_term",
        priority="interest_saving",
        maximum_monthly_payment=D("8000"),
        minimum_monthly_surplus=D("10000"),
        expected_interest_saving=D("100000"),
        risk_preference="conservative",
        other_requirements="希望尽量减少总利息支出",
        notes="客户有一笔年终奖可用于提前还款",
    )
    store.save(goal, conflict_resolution=ConflictResolution.UPDATE, operator="system")


def _add_months(d: date, months: int) -> date:
    """月份加法"""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and not year % 100 == 0 or year % 400 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def ROUND(x):
    return D(x).quantize(D("0.01"), rounding="ROUND_HALF_UP")


# ─── 导入命令 ──────────────────────────────────────────────────────────────
@cli.command("import", help="导入数据文件（支持JSON/YAML/CSV/Excel）")
@click.argument("filename", type=click.Path(exists=True, dir_okay=False))
@click.option("--type", "data_type", required=True,
              type=click.Choice(["loan", "repayment", "budget", "penalty", "goal"]),
              help="数据类型")
@click.option("--conflict", "conflict_resolution", default="ask",
              type=click.Choice(["skip", "update", "ask", "error"]),
              help="重复数据处理策略", show_default=True)
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def import_cmd(ctx: click.Context, filename: str, data_type: str, conflict_resolution: str, operator: str):
    """导入数据"""
    store = ctx.obj["store"]
    importer = DataImporter(store)

    conflict_enum = ConflictResolution(conflict_resolution)

    console.print(f"[cyan]📥 正在导入:[/cyan] {filename}")
    console.print(f"[cyan]📋 数据类型:[/cyan] {data_type}")
    console.print(f"[cyan]⚙️  冲突策略:[/cyan] {conflict_resolution}")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("处理中...", total=None)
        result = importer.import_data(filename, data_type, conflict_enum, operator)

    action_icons = {
        ImportAction.INSERTED: "✅",
        ImportAction.UPDATED: "🔄",
        ImportAction.SKIPPED: "⏭️",
        ImportAction.CONFLICTED: "⚠️",
        ImportAction.FAILED: "❌",
    }

    table = Table(title="导入结果", box=box.ROUNDED, show_lines=True)
    table.add_column("状态", no_wrap=True)
    table.add_column("记录", style="cyan")
    table.add_column("说明", style="yellow")

    for action, record, error in result.records:
        icon = action_icons.get(action, "❓")
        action_label = action.value
        record_info = "-"
        note = "-"

        if record:
            if hasattr(record, "contract_no"):
                record_info = record.contract_no
            elif hasattr(record, "customer_id"):
                record_info = record.customer_id

        if error:
            note = str(error)

        table.add_row(f"{icon} {action_label}", record_info, note)

    console.print(table)

    summary = result.get_summary()
    total = sum(summary.values())
    summary_text = " | ".join([f"{k}: {v}" for k, v in summary.items()])
    console.print(f"\n[cyan]📊 总计:[/cyan] {total} 条记录 | {summary_text}")

    if result.has_conflicts and conflict_resolution == "ask":
        console.print(f"\n[yellow]⚠️  发现 {result.conflicts} 条冲突记录[/yellow]")
        console.print("   使用 'mortgage resolve' 解决冲突")

    if result.has_failures:
        console.print(f"\n[red]❌ 有 {result.failed} 条记录导入失败[/red]")
        console.print("   请检查数据格式后重试")


# ─── 列表命令 ──────────────────────────────────────────────────────────────
@cli.command("list", help="列出已导入的数据")
@click.option("--type", "data_type", default=None,
              type=click.Choice(["loan", "repayment", "budget", "penalty", "goal", "all"]),
              help="数据类型，默认显示全部")
@click.option("--show-archived", is_flag=True, help="显示已归档数据")
@click.pass_context
def list_cmd(ctx: click.Context, data_type: Optional[str], show_archived: bool):
    """列出数据"""
    store = ctx.obj["store"]

    type_map = {
        "loan": ("贷款合同", LoanContract, _format_loan_row),
        "repayment": ("还款流水", RepaymentRecord, _format_repayment_row),
        "budget": ("收入预算", Budget, _format_budget_row),
        "penalty": ("违约金规则", PenaltyRule, _format_penalty_row),
        "goal": ("客户目标", ClientGoal, _format_goal_row),
    }

    types_to_show = [(k, v) for k, v in type_map.items()] if data_type in [None, "all"] else [(data_type, type_map[data_type])]

    for type_key, (title, model_class, formatter) in types_to_show:
        records = store.list(model_class, include_archived=show_archived)

        if not records:
            continue

        table = Table(title=f"📋 {title} ({len(records)}条)", box=box.ROUNDED, show_lines=True)
        for col in formatter()[0]:
            table.add_column(col, style=formatter()[1].get(col, "white"))

        for record in records:
            _, _, row_data = formatter(record)
            table.add_row(*row_data)

        console.print(table)

    stats = store.get_stats()
    pending = store.get_pending_confirmations()
    conflicts = store.get_conflicts()

    status_grid = Table.grid(padding=(0, 4))
    status_grid.add_column(style="cyan")
    status_grid.add_column()
    status_grid.add_row("📊 数据统计:", " | ".join([f"{k}: {v['active']}" for k, v in stats.items()]))
    status_grid.add_row("⏳ 待确认:", f"{len(pending)} 条" if pending else "无")
    status_grid.add_row("⚠️  冲突:", f"{len(conflicts)} 条" if conflicts else "无")

    console.print(Panel(status_grid, title="系统状态", border_style="cyan"))


def _format_loan_row(loan: Optional[LoanContract] = None):
    columns = ["合同号", "客户", "贷款金额", "年利率", "期限", "已还期数", "确认状态"]
    styles = {"合同号": "yellow", "客户": "cyan"}
    if loan is None:
        return columns, styles, []
    return columns, styles, [
        loan.contract_no,
        loan.customer_name,
        _format_amount(loan.loan_amount),
        f"{float(loan.annual_interest_rate * 100):.2f}%",
        f"{loan.loan_term_months}个月",
        f"{len(loan.change_history) if hasattr(loan, 'change_history') else 0}",
        "✅ 已确认" if (hasattr(loan, 'is_confirmed') and loan.is_confirmed) else "⏳ 待确认",
    ]


def _format_repayment_row(record: Optional[RepaymentRecord] = None):
    columns = ["期数", "日期", "总金额", "本金", "利息", "剩余本金", "状态"]
    styles = {"期数": "yellow", "日期": "cyan"}
    if record is None:
        return columns, styles, []
    return columns, styles, [
        str(record.period_no),
        record.repayment_date.isoformat(),
        _format_amount(record.total_amount),
        _format_amount(record.principal_amount),
        _format_amount(record.interest_amount),
        _format_amount(record.remaining_principal),
        record.status.value,
    ]


def _format_budget_row(budget: Optional[Budget] = None):
    columns = ["客户ID", "月份", "月收入", "月支出", "月供", "月结余", "可用现金"]
    styles = {"客户ID": "yellow", "月份": "cyan"}
    if budget is None:
        return columns, styles, []
    return columns, styles, [
        budget.customer_id,
        budget.budget_month.isoformat(),
        _format_amount(budget.monthly_household_income),
        _format_amount(budget.monthly_household_expense),
        _format_amount(budget.monthly_mortgage_payment),
        _format_amount(budget.monthly_surplus),
        _format_amount(budget.available_cash or D("0")),
    ]


def _format_penalty_row(rule: Optional[PenaltyRule] = None):
    columns = ["合同号", "规则名称", "类型", "值", "最低还款月数", "最低还款额"]
    styles = {"合同号": "yellow", "规则名称": "cyan"}
    if rule is None:
        return columns, styles, []
    return columns, styles, [
        rule.contract_no,
        rule.rule_name,
        rule.penalty_type.value,
        str(rule.penalty_value),
        str(rule.min_months_to_prepay),
        _format_amount(rule.min_prepay_amount),
    ]


def _format_goal_row(goal: Optional[ClientGoal] = None):
    columns = ["客户ID", "目标金额", "策略", "优先级", "最大月供", "期望节省利息"]
    styles = {"客户ID": "yellow", "目标金额": "cyan"}
    if goal is None:
        return columns, styles, []
    return columns, styles, [
        goal.customer_id,
        _format_amount(goal.prepay_amount or D("0")),
        goal.prepay_strategy.value,
        goal.priority.value,
        _format_amount(goal.maximum_monthly_payment or D("0")),
        _format_amount(goal.expected_interest_saving or D("0")),
    ]


# ─── 确认命令 ──────────────────────────────────────────────────────────────
@cli.command("confirm", help="确认数据记录")
@click.option("--type", "data_type", required=True,
              type=click.Choice(["loan", "repayment", "budget", "penalty", "goal"]),
              help="数据类型")
@click.option("--id", "record_id", required=True, help="记录ID")
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def confirm_cmd(ctx: click.Context, data_type: str, record_id: str, operator: str):
    """确认数据"""
    store = ctx.obj["store"]

    type_map = {
        "loan": LoanContract,
        "repayment": RepaymentRecord,
        "budget": Budget,
        "penalty": PenaltyRule,
        "goal": ClientGoal,
    }

    model_class = type_map[data_type]
    success = store.confirm(model_class, record_id, operator)

    if success:
        console.print(f"[green]✓ 记录 {record_id} 已由 {operator} 确认[/green]")
    else:
        console.print(f"[red]✗ 确认失败：记录不存在或不支持确认操作[/red]")


@cli.command("confirm-all", help="批量确认所有待确认数据")
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def confirm_all_cmd(ctx: click.Context, operator: str):
    """批量确认所有待确认数据"""
    store = ctx.obj["store"]
    pending = store.get_pending_confirmations()

    if not pending:
        console.print("[green]✓ 没有待确认的数据[/green]")
        return

    type_map = {
        "loans": LoanContract,
        "repayments": RepaymentRecord,
        "budgets": Budget,
        "penalty_rules": PenaltyRule,
        "goals": ClientGoal,
    }

    count = 0
    for collection_name, data in pending:
        model_class = type_map.get(collection_name)
        if model_class and store.confirm(model_class, data.id, operator):
            count += 1

    console.print(f"[green]✓ 已确认 {count}/{len(pending)} 条记录[/green]")


# ─── 状态命令 ──────────────────────────────────────────────────────────────
@cli.command("status", help="查看系统状态和异常信息")
@click.option("--contract-no", help="贷款合同号（可选）")
@click.pass_context
def status_cmd(ctx: click.Context, contract_no: Optional[str]):
    """查看系统状态"""
    store = ctx.obj["store"]

    stats = store.get_stats()
    pending = store.get_pending_confirmations()
    conflicts = store.get_conflicts()

    exception_handler = ExceptionHandler()

    if contract_no:
        loan = store.get_by_business_key(LoanContract, contract_no=contract_no)
        if not loan:
            console.print(f"[red]✗ 未找到合同号 {contract_no}[/red]")
            return

        records = store.list(RepaymentRecord)
        loan_records = [r for r in records if r.contract_no == contract_no]
        penalty = store.get_by_business_key(PenaltyRule, contract_no=contract_no, rule_name="提前还款违约金规则")
        budget = store.get_by_business_key(Budget, customer_id=loan.customer_id, budget_month=date.today().replace(day=1).isoformat())
        if not budget:
            budgets = store.list(Budget)
            customer_budgets = [b for b in budgets if b.customer_id == loan.customer_id]
            budget = customer_budgets[0] if customer_budgets else None
        goal = store.get_by_business_key(ClientGoal, customer_id=loan.customer_id)

        if not loan_records:
            from ..exceptions.material_errors import RepaymentRecordsMissingError
            exception_handler.handle_exception(RepaymentRecordsMissingError(contract_no=contract_no))
        if not penalty:
            from ..exceptions.material_errors import PenaltyRuleMissingError
            exception_handler.handle_exception(PenaltyRuleMissingError(contract_no=contract_no))
        if not budget:
            from ..exceptions.material_errors import BudgetMissingError
            exception_handler.handle_exception(BudgetMissingError(customer_id=loan.customer_id))
        if not goal:
            from ..exceptions.material_errors import ClientGoalMissingError
            exception_handler.handle_exception(ClientGoalMissingError(customer_id=loan.customer_id))
        if hasattr(loan, 'is_confirmed') and not loan.is_confirmed:
            from ..exceptions.material_errors import PendingConfirmationError
            exception_handler.handle_exception(PendingConfirmationError(entity="贷款合同", entity_id=loan.id))

    panels = []

    stats_table = Table(show_header=False, box=box.SIMPLE)
    stats_table.add_column(style="cyan")
    stats_table.add_column(justify="right")
    for name, data in stats.items():
        label = {
            "loans": "贷款合同",
            "repayments": "还款流水",
            "budgets": "收入预算",
            "penalty_rules": "违约金规则",
            "goals": "客户目标",
        }.get(name, name)
        stats_table.add_row(label, f"{data['active']} 条")
    panels.append(Panel(stats_table, title="📊 数据统计", border_style="cyan"))

    if pending:
        pending_table = Table(show_header=False, box=box.SIMPLE)
        pending_table.add_column(style="yellow")
        pending_table.add_column()
        for collection_name, data in pending:
            label = {
                "loans": "贷款合同",
                "repayments": "还款流水",
                "budgets": "收入预算",
                "penalty_rules": "违约金规则",
                "goals": "客户目标",
            }.get(collection_name, collection_name)
            display_id = getattr(data, 'contract_no', None) or getattr(data, 'customer_id', None) or data.id
            pending_table.add_row(label, display_id)
        panels.append(Panel(pending_table, title=f"⏳ 待确认 ({len(pending)})", border_style="yellow"))

    if conflicts:
        conflict_table = Table(show_header=False, box=box.SIMPLE)
        conflict_table.add_column(style="red")
        conflict_table.add_column()
        for collection_name, record in conflicts:
            label = {
                "loans": "贷款合同",
                "repayments": "还款流水",
                "budgets": "收入预算",
                "penalty_rules": "违约金规则",
                "goals": "客户目标",
            }.get(collection_name, collection_name)
            conflict_table.add_row(label, record.id)
        panels.append(Panel(conflict_table, title=f"⚠️  冲突 ({len(conflicts)})", border_style="red"))

    console.print(Columns(panels))

    if exception_handler.has_errors:
        _print_error_summary(exception_handler, "材料完整性检查")
    elif contract_no:
        console.print("\n[green]✓ 所有材料齐全，可以开始模拟分析[/green]")


# ─── 模拟命令 ──────────────────────────────────────────────────────────────
@cli.command("simulate", help="运行提前还款模拟和情景对比")
@click.option("--contract-no", required=True, help="贷款合同号")
@click.option("--paid-months", type=int, help="已还期数（默认根据还款流水自动计算）")
@click.option("--amount", "prepay_amount", type=str, help="提前还款金额（如20万）")
@click.option("--strategy", type=click.Choice(["shorten_term", "reduce_payment", "mixed"]),
              help="提前还款策略")
@click.option("--level", "explanation_level", default="standard",
              type=click.Choice(["simple", "standard", "detailed", "expert"]),
              help="解释深度", show_default=True)
@click.pass_context
def simulate_cmd(
    ctx: click.Context,
    contract_no: str,
    paid_months: Optional[int],
    prepay_amount: Optional[str],
    strategy: Optional[str],
    explanation_level: str,
):
    """运行模拟"""
    store = ctx.obj["store"]
    exception_handler = ExceptionHandler()

    console.print(Panel.fit(
        f"[cyan]合同号:[/cyan] {contract_no}\n"
        f"[cyan]解释深度:[/cyan] {explanation_level}",
        title="🚀 提前还款模拟",
        border_style="cyan",
    ))

    loan = store.get_by_business_key(LoanContract, contract_no=contract_no)
    if not loan:
        console.print(f"[red]✗ 未找到合同号 {contract_no}[/red]")
        return

    records = store.list(RepaymentRecord)
    loan_records = sorted(
        [r for r in records if r.contract_no == contract_no],
        key=lambda r: r.period_no
    )

    if paid_months is None:
        paid_months = len(loan_records)

    penalty = store.get_by_business_key(PenaltyRule, contract_no=contract_no, rule_name="提前还款违约金规则")
    if not penalty:
        penalties = store.list(PenaltyRule)
        contract_penalties = [p for p in penalties if p.contract_no == contract_no]
        penalty = contract_penalties[0] if contract_penalties else None

    budgets = store.list(Budget)
    customer_budgets = [b for b in budgets if b.customer_id == loan.customer_id]
    budget = customer_budgets[0] if customer_budgets else None

    goals = store.list(ClientGoal)
    customer_goals = [g for g in goals if g.customer_id == loan.customer_id]
    goal = customer_goals[0] if customer_goals else None

    interpreter = ResultInterpreter(level=ExplanationLevel(explanation_level))

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("正在生成情景...", total=None)

        if prepay_amount:
            amount = _parse_amount(prepay_amount)
            strategy_enum = PrepayStrategy(strategy) if strategy else PrepayStrategy.SHORTEN_TERM
            strategy_name = "缩短期限" if strategy_enum == PrepayStrategy.SHORTEN_TERM else "减少月供"
            name = f"{strategy_name} - {_format_amount(amount)}元"

            scenario = create_scenario(
                name=name,
                strategy=strategy_enum,
                prepay_amount=amount,
                loan=loan,
                paid_months=paid_months,
                penalty_rule=penalty,
                budget=budget,
                goal=goal,
                existing_records=loan_records,
                exception_handler=exception_handler,
            )
            scenarios = [scenario]
        else:
            scenarios = generate_default_scenarios(
                loan=loan,
                paid_months=paid_months,
                goal=goal,
                budget=budget,
                penalty_rule=penalty,
                existing_records=loan_records,
                exception_handler=exception_handler,
            )

        progress.add_task("正在对比情景...", total=None)
        result = compare_scenarios(scenarios, goal)

    if exception_handler.has_errors:
        _print_error_summary(exception_handler)

    console.print("\n[cyan]📋 贷款概况[/cyan]")
    summary = get_repayment_summary(loan, paid_months, loan_records)
    loan_explanations = interpreter.explain_loan_summary(loan, summary, paid_months)
    for exp in loan_explanations:
        console.print(f"[bold]{exp.title}[/bold]")
        console.print(f"  {exp.content}")
        console.print()

    if result.optimal_scenario and result.optimal_scenario.result:
        console.print(f"\n[green]🏆 推荐方案[/green]")
        remaining_principal = summary.remaining_principal if summary else None
        prepay_explanations = interpreter.explain_prepay_result(
            result.optimal_scenario.result, loan, penalty, paid_months, remaining_principal
        )
        for exp in prepay_explanations:
            console.print(f"[bold]{exp.title}[/bold]")
            console.print(f"  {exp.content}")
            console.print()

    console.print("\n[cyan]📊 情景对比[/cyan]")
    table = Table(box=box.ROUNDED, show_lines=True)
    table.add_column("情景", style="cyan")
    table.add_column("策略", style="yellow")
    table.add_column("提前还款", justify="right")
    table.add_column("违约金", justify="right")
    table.add_column("新月供", justify="right")
    table.add_column("月供变化", justify="right")
    table.add_column("节省利息", justify="right")
    table.add_column("节省期数", justify="right")
    table.add_column("得分", justify="right")
    table.add_column("状态", style="magenta")

    for row in result.comparison_table:
        table.add_row(
            row["情景名称"],
            row["策略"],
            str(row["提前还款额"]),
            str(row["违约金"]),
            str(row["新月供"]),
            str(row["月供变化"]),
            str(row["节省利息"]),
            str(row["节省期数"]),
            str(row["得分"]),
            row["状态"],
        )

    console.print(table)

    if result.optimal_scenario and result.optimal_scenario.cashflow_analysis and budget:
        console.print("\n[cyan]💰 现金流分析[/cyan]")
        cashflow_explanations = interpreter.explain_cashflow_analysis(
            result.optimal_scenario.cashflow_analysis, budget
        )
        for exp in cashflow_explanations:
            console.print(f"[bold]{exp.title}[/bold]")
            console.print(f"  {exp.content}")
            console.print()

    console.print("\n[cyan]✅ 约束检查[/cyan]")
    if result.optimal_scenario:
        constraint_explanations = interpreter.explain_constraints(
            result.optimal_scenario.constraints
        )
        for exp in constraint_explanations:
            console.print(f"[bold]{exp.title}[/bold]")
            console.print(f"  {exp.content}")
            console.print()

    console.print("\n[cyan]💡 建议[/cyan]")
    for rec in result.recommendations:
        console.print(f"  {rec}")

    ctx.obj["last_result"] = result
    ctx.obj["last_loan"] = loan
    ctx.obj["last_goal"] = goal


def _parse_amount(amount_str: str) -> Decimal:
    """解析金额字符串"""
    amount_str = amount_str.replace(",", "").replace("，", "").strip()
    if amount_str.endswith("万") or amount_str.endswith("w") or amount_str.endswith("W"):
        num = float(amount_str[:-1])
        return ROUND(D(num * 10000))
    return ROUND(D(amount_str))


# ─── 报告命令 ──────────────────────────────────────────────────────────────
@cli.command("report", help="生成分析报告")
@click.option("--contract-no", required=True, help="贷款合同号")
@click.option("--format", "report_format", default="markdown",
              type=click.Choice(["markdown", "excel"]),
              help="报告格式", show_default=True)
@click.option("--output", "output_path", help="输出文件路径")
@click.option("--level", "explanation_level", default="standard",
              type=click.Choice(["simple", "standard", "detailed", "expert"]),
              help="解释深度", show_default=True)
@click.pass_context
def report_cmd(
    ctx: click.Context,
    contract_no: str,
    report_format: str,
    output_path: Optional[str],
    explanation_level: str,
):
    """生成报告"""
    store = ctx.obj["store"]
    exception_handler = ExceptionHandler()

    loan = store.get_by_business_key(LoanContract, contract_no=contract_no)
    if not loan:
        console.print(f"[red]✗ 未找到合同号 {contract_no}[/red]")
        return

    records = store.list(RepaymentRecord)
    loan_records = sorted(
        [r for r in records if r.contract_no == contract_no],
        key=lambda r: r.period_no
    )
    paid_months = len(loan_records)

    penalty = store.get_by_business_key(PenaltyRule, contract_no=contract_no, rule_name="提前还款违约金规则")
    if not penalty:
        penalties = store.list(PenaltyRule)
        contract_penalties = [p for p in penalties if p.contract_no == contract_no]
        penalty = contract_penalties[0] if contract_penalties else None

    budgets = store.list(Budget)
    customer_budgets = [b for b in budgets if b.customer_id == loan.customer_id]
    budget = customer_budgets[0] if customer_budgets else None

    goals = store.list(ClientGoal)
    customer_goals = [g for g in goals if g.customer_id == loan.customer_id]
    goal = customer_goals[0] if customer_goals else None

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        progress.add_task("正在生成情景...", total=None)
        scenarios = generate_default_scenarios(
            loan=loan,
            paid_months=paid_months,
            goal=goal,
            budget=budget,
            penalty_rule=penalty,
            existing_records=loan_records,
            exception_handler=exception_handler,
        )

        progress.add_task("正在对比情景...", total=None)
        scenario_result = compare_scenarios(scenarios, goal)

        progress.add_task("正在生成报告...", total=None)
        generator = ReportGenerator()
        interpreter = ResultInterpreter(level=ExplanationLevel(explanation_level))

        if not output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            ext = ".md" if report_format == "markdown" else ".xlsx"
            output_path = f"report_{contract_no}_{timestamp}{ext}"

        format_enum = ReportFormat.MARKDOWN if report_format == "markdown" else ReportFormat.EXCEL
        summary = get_repayment_summary(loan, paid_months, loan_records)

        if output_path:
            from pathlib import Path
            output_path = str(Path(output_path).with_suffix(""))

        output_file = generator.generate_report(
            loan=loan,
            summary=summary,
            scenario_result=scenario_result,
            paid_months=paid_months,
            format=format_enum,
            penalty_rule=penalty,
            budget=budget,
            goal=goal,
            existing_records=loan_records,
            exception_handler=exception_handler,
            explanation_level=ExplanationLevel(explanation_level),
            filename=output_path,
        )

    if exception_handler.has_errors:
        _print_error_summary(exception_handler)

    console.print(Panel.fit(
        f"[green]✓ 报告生成成功[/green]\n"
        f"[cyan]📄 文件:[/cyan] {output_file}\n"
        f"[cyan]📋 格式:[/cyan] {report_format}\n"
        f"[cyan]📝 解释深度:[/cyan] {explanation_level}\n\n"
        f"[cyan]快速查看:[/cyan] cat {output_file}" if report_format == "markdown" else f"[cyan]打开文件:[/cyan] open {output_file}",
        title="📄 报告生成完成",
        border_style="green",
    ))


# ─── 解决冲突命令 ──────────────────────────────────────────────────────────
@cli.command("resolve", help="解决数据冲突")
@click.option("--type", "data_type", required=True,
              type=click.Choice(["loan", "repayment", "budget", "penalty", "goal"]),
              help="数据类型")
@click.option("--id", "record_id", required=True, help="冲突记录ID")
@click.option("--action", required=True,
              type=click.Choice(["update", "skip", "keep"]),
              help="处理方式: update=用新数据更新, skip=保留旧数据, keep=保留冲突记录")
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def resolve_cmd(
    ctx: click.Context,
    data_type: str,
    record_id: str,
    action: str,
    operator: str,
):
    """解决冲突"""
    store = ctx.obj["store"]

    type_map = {
        "loan": LoanContract,
        "repayment": RepaymentRecord,
        "budget": Budget,
        "penalty": PenaltyRule,
        "goal": ClientGoal,
    }

    model_class = type_map[data_type]

    resolution_map = {
        "update": ConflictResolution.UPDATE,
        "skip": ConflictResolution.SKIP,
        "keep": ConflictResolution.ERROR,
    }

    resolution = resolution_map[action]
    result = store.resolve_conflict(model_class, record_id, resolution, operator)

    if action == "skip":
        console.print(f"[green]✓ 已跳过冲突记录 {record_id}，保留原有数据[/green]")
    elif action == "update" and result:
        console.print(f"[green]✓ 已更新记录 {record_id}[/green]")
    elif action == "keep":
        console.print(f"[green]✓ 已保留冲突记录 {record_id} 作为新数据[/green]")
    else:
        console.print(f"[red]✗ 解决冲突失败：记录不存在或状态不是冲突[/red]")


# ─── 备注命令 ──────────────────────────────────────────────────────────────
@cli.command("notes", help="更新记录备注")
@click.option("--type", "data_type", required=True,
              type=click.Choice(["loan", "repayment", "budget", "penalty", "goal"]),
              help="数据类型")
@click.option("--id", "record_id", required=True, help="记录ID")
@click.option("--text", "notes_text", required=True, help="备注内容")
@click.option("--operator", default="cli", help="操作人")
@click.pass_context
def notes_cmd(
    ctx: click.Context,
    data_type: str,
    record_id: str,
    notes_text: str,
    operator: str,
):
    """更新备注"""
    store = ctx.obj["store"]

    type_map = {
        "loan": LoanContract,
        "repayment": RepaymentRecord,
        "budget": Budget,
        "penalty": PenaltyRule,
        "goal": ClientGoal,
    }

    model_class = type_map[data_type]
    success = store.update_notes(model_class, record_id, notes_text, operator)

    if success:
        console.print(f"[green]✓ 备注已更新[/green]")
    else:
        console.print(f"[red]✗ 更新失败：记录不存在[/red]")


# ─── 导出命令 ──────────────────────────────────────────────────────────────
@cli.command("export", help="导出所有数据")
@click.option("--output-dir", default="export", help="导出目录", show_default=True)
@click.pass_context
def export_cmd(ctx: click.Context, output_dir: str):
    """导出数据"""
    store = ctx.obj["store"]

    exported_files = store.export_all(output_dir)

    if exported_files:
        console.print(f"[green]✓ 已导出 {len(exported_files)} 个文件到 {output_dir}[/green]")
        for f in exported_files:
            console.print(f"  - {f}")
    else:
        console.print(f"[yellow]⚠️  没有数据可导出[/yellow]")


# ─── 样例命令 ──────────────────────────────────────────────────────────────
@cli.command("demo", help="运行完整演示流程")
@click.option("--contract-no", default="LOAN001", help="演示用合同号", show_default=True)
@click.option("--level", "explanation_level", default="standard",
              type=click.Choice(["simple", "standard", "detailed", "expert"]),
              help="解释深度", show_default=True)
@click.pass_context
def demo_cmd(ctx: click.Context, contract_no: str, explanation_level: str):
    """运行完整演示流程"""
    console.print(Panel.fit(
        "[cyan]🏠 房贷提前还款规划 CLI 演示流程[/cyan]\n\n"
        "本演示将带领您完成从数据导入到报告生成的完整流程:\n"
        "1. 初始化数据（已包含样例数据）\n"
        "2. 查看系统状态\n"
        "3. 确认所有数据\n"
        "4. 运行模拟分析\n"
        "5. 生成分析报告",
        title="🚀 开始演示",
        border_style="cyan",
    ))

    console.input("\n按 Enter 继续...")

    console.print("\n[cyan]━━━━━━━━━━ 步骤 1: 查看系统状态 ━━━━━━━━━━[/cyan]")
    ctx.invoke(status_cmd, contract_no=contract_no)

    console.input("\n按 Enter 继续...")

    console.print("\n[cyan]━━━━━━━━━━ 步骤 2: 确认所有数据 ━━━━━━━━━━[/cyan]")
    ctx.invoke(confirm_all_cmd, operator="demo")

    console.input("\n按 Enter 继续...")

    console.print("\n[cyan]━━━━━━━━━━ 步骤 3: 运行模拟分析 ━━━━━━━━━━[/cyan]")
    ctx.invoke(simulate_cmd, contract_no=contract_no, paid_months=None,
               prepay_amount=None, strategy=None, explanation_level=explanation_level)

    console.input("\n按 Enter 继续...")

    console.print("\n[cyan]━━━━━━━━━━ 步骤 4: 生成分析报告 ━━━━━━━━━━[/cyan]")
    ctx.invoke(report_cmd, contract_no=contract_no, report_format="markdown",
               output_path=None, explanation_level=explanation_level)

    console.print("\n[green]━━━━━━━━━━ 演示完成 ━━━━━━━━━━[/green]")
    console.print("\n🎉 恭喜！您已完成完整的提前还款规划流程。")
    console.print("\n[cyan]常用命令:[/cyan]")
    console.print("  mortgage list           # 查看所有数据")
    console.print("  mortgage simulate       # 运行模拟分析")
    console.print("  mortgage report         # 生成分析报告")
    console.print("  mortgage --help         # 查看帮助")


def main():
    """主函数"""
    try:
        cli(obj={})
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️  操作已取消[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]✗ 发生错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
