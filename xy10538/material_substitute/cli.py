import click
import json
import sys
from typing import Optional
from tabulate import tabulate
from .core import MaterialSubstituteApp
from .utils import format_money, format_percent


def get_app(workspace: Optional[str] = None) -> MaterialSubstituteApp:
    return MaterialSubstituteApp(workspace)


def print_json(data: dict) -> None:
    click.echo(json.dumps(data, ensure_ascii=False, indent=2))


def check_initialized(app: MaterialSubstituteApp) -> bool:
    if not app.is_initialized():
        click.echo("错误: 工作区未初始化，请先运行 'ms init'")
        return False
    return True


def get_status_color(status: str) -> str:
    colors = {
        "CREATED": "blue",
        "PENDING_LEVEL1": "yellow",
        "PENDING_LEVEL2": "yellow",
        "AUTO_APPROVED": "green",
        "APPROVED": "green",
        "USED": "cyan",
        "REJECTED": "red",
        "REVOKED": "red",
        "CANCELLED": "red"
    }
    return colors.get(status, "white")


def get_check_status_icon(passed: bool) -> str:
    return "✓" if passed else "✗"


@click.group()
@click.version_option(version="1.0.0", prog_name="material-substitute")
@click.pass_context
def cli(ctx: click.Context) -> None:
    ctx.obj = {}


@cli.command()
@click.option("--force", is_flag=True, help="强制重新初始化")
@click.option("--workspace", "-w", type=str, help="工作区路径")
def init(force: bool, workspace: Optional[str]) -> None:
    app = get_app(workspace)
    result = app.init(force=force)
    
    if result["success"]:
        click.echo(click.style("✓ 工作区初始化成功", fg="green"))
        click.echo(f"  工作区路径: {result['workspace']}")
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="yellow"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def status(workspace: Optional[str], output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    state = app._get_state()
    
    if output_json:
        print_json({
            "initialized": True,
            "bom_count": len(state["bom"]),
            "inventory_count": len(state["inventory"]),
            "substitute_relations_count": sum(len(v) for v in state["substitute_relations"].values()),
            "customer_restrictions_count": len(state["customer_restrictions"]),
            "applications_count": len(state["applications"]),
            "initialized_at": state.get("initialized_at"),
            "last_modified_at": state.get("last_modified_at")
        })
        return
    
    click.echo(click.style("工作区状态", fg="cyan", bold=True))
    click.echo(f"  初始化时间: {state.get('initialized_at', 'N/A')}")
    click.echo(f"  最后修改: {state.get('last_modified_at', 'N/A')}")
    click.echo()
    click.echo(click.style("数据统计", fg="cyan", bold=True))
    click.echo(f"  BOM产品数: {len(state['bom'])}")
    click.echo(f"  库存物料数: {len(state['inventory'])}")
    click.echo(f"  替代关系数: {sum(len(v) for v in state['substitute_relations'].values())}")
    click.echo(f"  客户限制数: {len(state['customer_restrictions'])}")
    click.echo(f"  审批申请数: {len(state['applications'])}")


@cli.command("import-sample")
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.option("--operator", "-o", default="admin", help="操作人")
def import_sample(workspace: Optional[str], operator: str) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    click.echo(click.style("加载内置样例数据...", fg="yellow"))
    result = app.load_sample_data(operator=operator)
    
    if result["success"]:
        click.echo(click.style("✓ 样例数据加载成功", fg="green"))
        click.echo()
        click.echo("BOM (产品清单):")
        for product_code, product in app._get_state()["bom"].items():
            click.echo(f"  {product_code}: {product['product_name']}")
        
        click.echo()
        click.echo("库存物料分类:")
        click.echo("  电子料: RES-001~003 (电阻), CAP-001~003 (电容), PCB-001 (电路板)")
        click.echo("  包装料: BOX-001~002 (包装箱)")
        click.echo("  结构件: FRAME-001~002 (塑料边框)")
        
        click.echo()
        click.echo("客户限制:")
        click.echo("  CUST-001 (苹果公司): 禁止替代 CAP-001")
        click.echo("  CUST-002 (华为技术): 禁止替代所有物料")
    else:
        click.echo(click.style("✗ 样例数据加载失败", fg="red"))
        print_json(result)


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("product_code")
@click.argument("component_code")
@click.argument("substitute_material")
@click.option("--customer", "-c", help="客户编码")
@click.option("--quantity", "-q", type=float, default=1.0, help="需求数量")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def check(workspace: Optional[str], product_code: str, component_code: str,
          substitute_material: str, customer: Optional[str], quantity: float,
          output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    click.echo(click.style(f"检查替代物料: {component_code} -> {substitute_material}", fg="cyan", bold=True))
    click.echo()
    
    result = app.check_substitute(product_code, component_code, substitute_material, customer, quantity)
    
    if output_json:
        print_json(result)
        return
    
    click.echo(click.style("检查项目:", fg="yellow"))
    for check in result["checks"]:
        icon = get_check_status_icon(check["passed"])
        color = "green" if check["passed"] else "red"
        click.echo(f"  {click.style(icon, fg=color)} {check['name']}: {check['message']}")
    
    click.echo()
    
    click.echo(click.style("成本分析:", fg="yellow"))
    if result["original_cost"] > 0:
        click.echo(f"  原始物料成本: {format_money(result['original_cost'])}")
        click.echo(f"  替代物料成本: {format_money(result['substitute_cost'])}")
        diff = result["cost_difference"]
        diff_pct = result["cost_difference_percent"]
        color = "red" if diff > 0 else "green" if diff < 0 else "white"
        click.echo(f"  成本差异: {click.style(f'{format_money(diff)} ({diff_pct:.1f}%)', fg=color)}")
    
    click.echo()
    
    if result["can_substitute"]:
        if result["needs_approval"]:
            click.echo(click.style("✓ 可以替代，但需要审批", fg="yellow"))
            click.echo(f"  审批级别: {result['approval_level']} 级")
            click.echo(f"  原因: {'; '.join(result['reasons'])}")
        else:
            click.echo(click.style("✓ 可以自动替代，无需审批", fg="green"))
    else:
        click.echo(click.style("✗ 不可替代", fg="red"))
        click.echo(f"  原因: {'; '.join(result['reasons'])}")


@cli.command("create")
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.option("--product", "-p", required=True, help="产品编码")
@click.option("--component", "-c", required=True, help="原始物料编码")
@click.option("--substitute", "-s", required=True, help="替代物料编码")
@click.option("--customer", "-C", help="客户编码")
@click.option("--quantity", "-q", type=float, default=1.0, help="需求数量")
@click.option("--reason", "-r", default="生产缺料", help="替代原因")
@click.option("--operator", "-o", default="planner", help="操作人")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def create_application(workspace: Optional[str], product: str, component: str,
                      substitute: str, customer: Optional[str], quantity: float,
                      reason: str, operator: str, output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    click.echo(click.style("创建替代申请...", fg="yellow"))
    
    result = app.create_application(product, component, substitute, customer, 
                                   quantity, reason, operator)
    
    if output_json:
        print_json(result)
        return
    
    if result["success"]:
        app_data = result["application"]
        click.echo(click.style(f"✓ 申请创建成功: {app_data['application_id']}", fg="green"))
        click.echo()
        click.echo("申请详情:")
        click.echo(f"  产品: {product}")
        click.echo(f"  原始物料: {component} -> 替代物料: {substitute}")
        click.echo(f"  数量: {quantity}")
        status_color = get_status_color(app_data["status"])
        click.echo(f"  状态: {click.style(app_data['status'], fg=status_color)}")
        
        check = result["check_result"]
        if check["original_cost"] > 0:
            diff = check["cost_difference"]
            diff_pct = check["cost_difference_percent"]
            color = "red" if diff > 0 else "green" if diff < 0 else "white"
            click.echo(f"  成本变化: {click.style(f'{format_money(diff)} ({diff_pct:.1f}%)', fg=color)}")
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))
        if "existing_application" in result:
            click.echo(f"  已有申请: {result['existing_application']['application_id']}")
            click.echo(f"  状态: {result['existing_application']['status']}")


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id")
@click.option("--level", "-l", type=int, required=True, help="审批级别 (1或2)")
@click.option("--comment", "-c", default="", help="审批意见")
@click.option("--operator", "-o", default="approver", help="操作人")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def approve(workspace: Optional[str], application_id: str, level: int,
            comment: str, operator: str, output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.approve(application_id, level, operator, comment)
    
    if output_json:
        print_json(result)
        return
    
    if result["success"]:
        app_data = result["application"]
        status_color = get_status_color(app_data["status"])
        click.echo(click.style(f"✓ 审批成功: {application_id}", fg="green"))
        click.echo(f"  新状态: {click.style(app_data['status'], fg=status_color)}")
        click.echo(f"  审批人: {operator} (级别 {level})")
        if comment:
            click.echo(f"  意见: {comment}")
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id")
@click.option("--comment", "-c", default="", help="拒绝原因")
@click.option("--operator", "-o", default="approver", help="操作人")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def reject(workspace: Optional[str], application_id: str, comment: str,
           operator: str, output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.reject(application_id, operator, comment)
    
    if output_json:
        print_json(result)
        return
    
    if result["success"]:
        click.echo(click.style(f"✓ 申请已拒绝: {application_id}", fg="green"))
        if comment:
            click.echo(f"  原因: {comment}")
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id")
@click.option("--operator", "-o", default="operator", help="操作人")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def use(workspace: Optional[str], application_id: str, operator: str, output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.use_application(application_id, operator)
    
    if output_json:
        print_json(result)
        return
    
    if result["success"]:
        click.echo(click.style(f"✓ 申请已标记为投料使用: {application_id}", fg="cyan"))
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id")
@click.option("--reason", "-r", default="", help="撤销原因")
@click.option("--operator", "-o", default="operator", help="操作人")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def revoke(workspace: Optional[str], application_id: str, reason: str,
           operator: str, output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.revoke(application_id, operator, reason)
    
    if output_json:
        print_json(result)
        return
    
    if result["success"]:
        click.echo(click.style(f"✓ 申请已撤销: {application_id}", fg="green"))
        if reason:
            click.echo(f"  原因: {reason}")
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))


@cli.command("correct")
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id")
@click.argument("field")
@click.argument("old_value")
@click.argument("new_value")
@click.option("--reason", "-r", default="", help="修正原因")
@click.option("--operator", "-o", default="admin", help="操作人")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def manual_correct(workspace: Optional[str], application_id: str, field: str,
                   old_value: str, new_value: str, reason: str, operator: str,
                   output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.manual_correct(application_id, field, old_value, new_value, operator, reason)
    
    if output_json:
        print_json(result)
        return
    
    if result["success"]:
        click.echo(click.style(f"✓ 人工修正已记录: {application_id}", fg="green"))
        click.echo(f"  字段: {field}")
        click.echo(f"  原值: {old_value}")
        click.echo(f"  新值: {new_value}")
        click.echo(f"  操作人: {operator}")
        if reason:
            click.echo(f"  原因: {reason}")
    else:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def detail(workspace: Optional[str], application_id: str, output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.get_application_detail(application_id)
    
    if not result["success"]:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))
        return
    
    app_data = result["application"]
    
    if output_json:
        print_json(app_data)
        return
    
    status_color = get_status_color(app_data["status"])
    
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo(click.style(f"申请详情: {application_id}", fg="cyan", bold=True))
    click.echo(click.style("=" * 60, fg="cyan"))
    
    click.echo()
    click.echo(click.style("基本信息", fg="yellow", bold=True))
    click.echo(f"  产品: {app_data['product_code']}")
    click.echo(f"  原始物料: {app_data['component_code']}")
    click.echo(f"  替代物料: {app_data['substitute_material']}")
    click.echo(f"  数量: {app_data['quantity']}")
    click.echo(f"  客户: {app_data['customer_code'] or 'N/A'}")
    click.echo(f"  原因: {app_data['reason']}")
    click.echo(f"  状态: {click.style(app_data['status'], fg=status_color)}")
    click.echo(f"  创建人: {app_data.get('created_by', 'N/A')}")
    click.echo(f"  创建时间: {app_data.get('created_at', 'N/A')}")
    
    check = app_data.get("check_result", {})
    if check:
        click.echo()
        click.echo(click.style("检查结果", fg="yellow", bold=True))
        for c in check.get("checks", []):
            icon = get_check_status_icon(c["passed"])
            color = "green" if c["passed"] else "red"
            click.echo(f"  {click.style(icon, fg=color)} {c['name']}: {c['message']}")
        
        if check.get("original_cost"):
            click.echo()
            click.echo(click.style("成本分析", fg="yellow", bold=True))
            click.echo(f"  原始物料成本: {format_money(check['original_cost'])}")
            click.echo(f"  替代物料成本: {format_money(check['substitute_cost'])}")
            diff = check.get("cost_difference", 0)
            diff_pct = check.get("cost_difference_percent", 0)
            color = "red" if diff > 0 else "green" if diff < 0 else "white"
            click.echo(f"  成本差异: {click.style(f'{format_money(diff)} ({diff_pct:.1f}%)', fg=color)}")
    
    history = app_data.get("approval_history", [])
    if history:
        click.echo()
        click.echo(click.style("审批历史", fg="yellow", bold=True))
        for idx, item in enumerate(history, 1):
            click.echo(f"  [{idx}] {item['action']} (级别 {item['level']})")
            click.echo(f"      审批人: {item['approver']}")
            click.echo(f"      时间: {item['timestamp']}")
            if item.get("comment"):
                click.echo(f"      意见: {item['comment']}")
    
    corrections = app_data.get("manual_corrections", [])
    if corrections:
        click.echo()
        click.echo(click.style("人工修正记录", fg="yellow", bold=True))
        for idx, c in enumerate(corrections, 1):
            click.echo(f"  [{idx}] {c['field']}: {c['old_value']} -> {c['new_value']}")
            click.echo(f"      操作人: {c['operator']}")
            click.echo(f"      时间: {c['timestamp']}")
            if c.get("reason"):
                click.echo(f"      原因: {c['reason']}")
    
    click.echo()
    click.echo(click.style("=" * 60, fg="cyan"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.option("--status", "-s", help="按状态筛选")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def list(workspace: Optional[str], status: Optional[str], output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.list_applications(status)
    
    if output_json:
        print_json(result)
        return
    
    apps = result["applications"]
    
    if not apps:
        click.echo("没有找到申请")
        return
    
    headers = ["申请ID", "产品", "原始物料", "替代物料", "状态"]
    rows = []
    for a in apps:
        rows.append([
            a["application_id"],
            a["product_code"],
            a["component_code"],
            a["substitute_material"],
            click.style(a["status"], fg=get_status_color(a["status"]))
        ])
    
    click.echo(tabulate(rows, headers=headers, tablefmt="grid"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.argument("application_id", required=False)
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def report(workspace: Optional[str], application_id: Optional[str], output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.generate_report(application_id)
    
    if not result["success"]:
        click.echo(click.style(f"✗ {result['message']}", fg="red"))
        return
    
    report_data = result["report"]
    
    if output_json:
        print_json(report_data)
        return
    
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo(click.style("审批报告", fg="cyan", bold=True))
    click.echo(f"生成时间: {report_data['generated_at']}")
    click.echo(click.style("=" * 60, fg="cyan"))
    
    summary = report_data["summary"]
    click.echo()
    click.echo(click.style("申请汇总", fg="yellow", bold=True))
    click.echo(f"  总计: {summary['total']}")
    click.echo(f"  待审批: {summary['pending']}")
    click.echo(f"  已通过: {summary['approved']}")
    click.echo(f"  已使用: {summary['used']}")
    click.echo(f"  已拒绝: {summary['rejected']}")
    click.echo(f"  已撤销: {summary['revoked']}")
    
    cost = report_data["cost_analysis"]
    click.echo()
    click.echo(click.style("成本分析", fg="yellow", bold=True))
    click.echo(f"  原始成本总计: {format_money(cost['total_original_cost'])}")
    click.echo(f"  替代成本总计: {format_money(cost['total_substitute_cost'])}")
    diff = cost["total_difference"]
    color = "red" if diff > 0 else "green" if diff < 0 else "white"
    click.echo(f"  总成本差异: {click.style(format_money(diff), fg=color)}")
    
    if cost["cost_changes"]:
        click.echo()
        click.echo(click.style("成本变更明细", fg="yellow", bold=True))
        headers = ["申请ID", "原始成本", "替代成本", "差异"]
        rows = []
        for c in cost["cost_changes"]:
            diff_color = "red" if c["difference"] > 0 else "green"
            rows.append([
                c["application_id"],
                format_money(c["original"]),
                format_money(c["substitute"]),
                click.style(format_money(c["difference"]), fg=diff_color)
            ])
        click.echo(tabulate(rows, headers=headers, tablefmt="grid"))
    
    click.echo()
    click.echo(click.style("=" * 60, fg="cyan"))


@cli.command()
@click.option("--workspace", "-w", type=str, help="工作区路径")
@click.option("--application", "-a", help="按申请筛选")
@click.option("--limit", "-n", type=int, default=50, help="显示最近N条")
@click.option("--json", "-j", "output_json", is_flag=True, help="输出JSON格式")
def history(workspace: Optional[str], application: Optional[str], limit: int,
            output_json: bool) -> None:
    app = get_app(workspace)
    
    if not check_initialized(app):
        return
    
    result = app.get_history(application, limit)
    
    if output_json:
        print_json(result)
        return
    
    history_list = result["history"]
    
    if not history_list:
        click.echo("没有历史记录")
        return
    
    click.echo(click.style(f"最近 {len(history_list)} 条操作历史", fg="cyan", bold=True))
    click.echo()
    
    for item in history_list:
        click.echo(f"{click.style(item['id'], fg='yellow')} | {item['timestamp']} | {item['operator']}")
        click.echo(f"  操作: {item['action']}")
        click.echo(f"  详情: {json.dumps(item['details'], ensure_ascii=False)}")
        click.echo()


if __name__ == "__main__":
    cli()
