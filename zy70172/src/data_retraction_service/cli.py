import sys
from pathlib import Path

src_path = Path(__file__).parent.parent
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

import click
import json
from datetime import datetime

from data_retraction_service.database import init_db, SessionLocal
from data_retraction_service.sample_data import init_sample_data, get_test_scenarios
from data_retraction_service.services import RetractionWorkflowService
from data_retraction_service.validation import (
    ModelImpactService,
    ReceiptService,
    ComplianceReportService
)


@click.group()
def cli():
    """训练数据撤回服务命令行工具"""
    pass


@cli.command()
@click.option("--reset", is_flag=True, help="重置数据库（清除所有数据）")
def init(reset: bool):
    """初始化数据库和样例数据"""
    
    if reset:
        from data_retraction_service.config import Config
        db_path = Config.DB_PATH
        if db_path.exists():
            db_path.unlink()
            click.echo(f"已删除旧数据库: {db_path}")
    
    init_db()
    data = init_sample_data()
    
    click.echo("✅ 数据库初始化完成")
    click.echo(f"   - 用户: {len(data['users'])} 个")
    click.echo(f"   - 数据集: {len(data['datasets'])} 个")
    click.echo(f"   - 特征: {len(data['features'])} 个")
    click.echo(f"   - 数据记录: {len(data['records'])} 条")
    click.echo(f"   - 模型: {len(data['models'])} 个")
    click.echo(f"   - 特征-模型关联: {len(data['links'])} 条")


@cli.command("scenarios")
def list_scenarios():
    """列出所有可用的测试场景"""
    scenarios = get_test_scenarios()
    
    click.echo(f"📋 可用测试场景 ({len(scenarios)} 个):\n")
    
    for i, s in enumerate(scenarios, 1):
        type_color = {"normal": "green", "error_validation": "red", "duplicate": "yellow"}
        color = type_color.get(s["scenario_type"], "white")
        
        click.echo(f"{i}. [{s['scenario_type']}] {s['name']}")
        click.echo(f"   描述: {s['description']}")
        click.echo(f"   预期结果: {s['expected_status'].upper()}\n")


@cli.command()
@click.argument("scenario_index", type=int)
@click.option("--auto-execute", is_flag=True, help="自动审批并执行")
@click.option("--verbose", is_flag=True, help="显示详细信息")
def run(scenario_index: int, auto_execute: bool, verbose: bool):
    """运行指定的测试场景"""
    scenarios = get_test_scenarios()
    
    if scenario_index < 1 or scenario_index > len(scenarios):
        click.echo(f"❌ 场景索引无效，有效范围: 1-{len(scenarios)}")
        sys.exit(1)
    
    scenario = scenarios[scenario_index - 1]
    click.echo(f"\n▶️ 运行场景: {scenario['name']}")
    click.echo(f"   描述: {scenario['description']}")
    click.echo(f"   类型: {scenario['scenario_type']}")
    click.echo(f"   预期: {scenario['expected_status']}\n")
    
    db = SessionLocal()
    try:
        workflow = RetractionWorkflowService(db)
        
        result = workflow.submit_and_process(
            requester_id=scenario["user_id"],
            retraction_reason=scenario["retraction_reason"],
            location_criteria=scenario["location_criteria"],
            auto_approve=auto_execute
        )
        
        request_id = result["request_id"]
        status = result["status"]
        
        if status == "REJECTED":
            click.echo(f"❌ 请求被拒绝 ({request_id})")
            click.echo(f"   原因: {result['rejection_reason']}")
        elif auto_execute and status == "COMPLETED":
            click.echo(f"✅ 请求已自动完成 ({request_id})")
            click.echo(f"   完成时间: {result['completed_at']}")
        elif status == "APPROVED":
            click.echo(f"✅ 请求已自动批准 ({request_id})")
            if auto_execute:
                click.echo(f"   执行中...")
                exec_result = workflow.execute_approved_request(request_id)
                click.echo(f"✅ 执行完成")
                click.echo(f"   - 清理特征: {exec_result['features_cleaned']}")
                click.echo(f"   - 受影响模型: {exec_result['models_impacted']}")
                click.echo(f"   - 生成回执: {exec_result['receipts_generated']}")
                click.echo(f"   - 生成报告: {exec_result['reports_generated']}")
        else:
            click.echo(f"📝 请求已提交 ({request_id})")
            click.echo(f"   状态: {status}")
            if "located_records" in result:
                click.echo(f"   定位到记录: {result['located_records']} 条")
        
        if verbose:
            click.echo(f"\n📊 规则评估详情:")
            for eval_item in result.get("rule_evaluations", []):
                status_icon = "✅" if eval_item["passed"] else "❌"
                click.echo(f"   {status_icon} {eval_item['rule_id']}: {eval_item['passed']}")
                if eval_item.get("notes"):
                    click.echo(f"      备注: {eval_item['notes']}")
        
        return result
    except Exception as e:
        click.echo(f"❌ 执行出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


@cli.command("run-all")
@click.option("--verbose", is_flag=True, help="显示详细信息")
def run_all(verbose: bool):
    """运行所有测试场景"""
    scenarios = get_test_scenarios()
    click.echo(f"🧪 运行全部 {len(scenarios)} 个测试场景\n")
    
    results = []
    for i, scenario in enumerate(scenarios, 1):
        from data_retraction_service.database import SessionLocal
        from data_retraction_service.services import RetractionWorkflowService
        
        db = SessionLocal()
        try:
            workflow = RetractionWorkflowService(db)
            result = workflow.submit_and_process(
                requester_id=scenario["user_id"],
                retraction_reason=scenario["retraction_reason"],
                location_criteria=scenario["location_criteria"],
                auto_approve=False
            )
            
            actual_status = result["status"].lower()
            expected = scenario["expected_status"]
            passed = actual_status == expected
            
            results.append({
                "index": i,
                "name": scenario["name"],
                "passed": passed,
                "expected": expected,
                "actual": actual_status,
                "request_id": result.get("request_id")
            })
            
            icon = "✅" if passed else "❌"
            click.echo(f"{icon} [{i:02d}] {scenario['name']}")
            if not passed:
                click.echo(f"   预期: {expected}, 实际: {actual_status}")
        except Exception as e:
            results.append({
                "index": i,
                "name": scenario["name"],
                "passed": False,
                "expected": scenario["expected_status"],
                "actual": f"error: {str(e)}",
                "request_id": None
            })
            click.echo(f"💥 [{i:02d}] {scenario['name']}: {e}")
        finally:
            db.close()
    
    passed = sum(1 for r in results if r["passed"])
    total = len(results)
    click.echo(f"\n{'='*50}")
    click.echo(f"结果: {passed}/{total} 通过")
    if passed == total:
        click.echo("🎉 所有场景通过!")
    else:
        click.echo(f"⚠️  {total - passed} 个场景未通过")
    
    return results


@cli.command("query")
@click.argument("request_id")
@click.option("--details", type=click.Choice(["all", "impacts", "receipts", "report"]), 
              multiple=True, help="要显示的详细信息")
def query_request(request_id: str, details: tuple):
    """查询撤回请求状态和详情"""
    from data_retraction_service.services import RequestService
    from data_retraction_service.validation import (
        ModelImpactService,
        ReceiptService,
        ComplianceReportService
    )
    
    db = SessionLocal()
    try:
        request_service = RequestService(db)
        req = request_service.get_request(request_id)
        
        if not req:
            click.echo(f"❌ 未找到请求: {request_id}")
            return
        
        click.echo(f"\n📋 请求信息:")
        click.echo(f"   ID: {req.id}")
        click.echo(f"   申请人: {req.requester_id}")
        click.echo(f"   状态: {req.status}")
        click.echo(f"   原因: {req.retraction_reason}")
        click.echo(f"   创建时间: {req.created_at}")
        if req.approved_at:
            click.echo(f"   批准时间: {req.approved_at}")
        if req.completed_at:
            click.echo(f"   完成时间: {req.completed_at}")
        if req.rejection_reason:
            click.echo(f"   拒绝原因: {req.rejection_reason}")
        
        show_all = "all" in details or not details
        
        if show_all or "impacts" in details:
            impact_service = ModelImpactService(db)
            impacts = impact_service.get_impacts_for_request(request_id)
            
            if impacts:
                click.echo(f"\n📊 模型影响 ({len(impacts)}):")
                for imp in impacts:
                    retrain = "需要" if imp.retraining_required else "不需要"
                    click.echo(f"   - {imp.model_id}: {imp.severity.upper()}")
                    click.echo(f"     影响特征: {imp.affected_features_count}, 重训练: {retrain}")
        
        if show_all or "receipts" in details:
            receipt_service = ReceiptService(db)
            receipts = receipt_service.get_receipts_for_request(request_id)
            
            if receipts:
                click.echo(f"\n📜 执行回执 ({len(receipts)}):")
                for r in receipts:
                    click.echo(f"   - [{r.id}] {r.receipt_type}")
                    click.echo(f"     签名: {r.signature[:16]}...")
                    click.echo(f"     时间: {r.created_at}")
        
        if show_all or "report" in details:
            report_service = ComplianceReportService(db)
            reports = report_service.get_reports_for_request(request_id)
            
            if reports:
                report = reports[0]
                click.echo(f"\n📄 合规报告:")
                click.echo(f"   类型: {report.report_type}")
                click.echo(f"   状态: {report.status}")
                click.echo(f"   生成时间: {report.generated_at}")
                
                if report.content and "compliance_checks" in report.content:
                    checks = report.content["compliance_checks"]
                    click.echo(f"   合规检查:")
                    for k, v in checks.items():
                        icon = "✅" if v else "❌"
                        click.echo(f"      {icon} {k}")
    finally:
        db.close()


@cli.command("server")
@click.option("--host", default="127.0.0.1", help="监听地址")
@click.option("--port", default=5000, type=int, help="监听端口")
@click.option("--debug", is_flag=True, help="调试模式")
def start_server(host: str, port: int, debug: bool):
    """启动HTTP API服务器"""
    from data_retraction_service.api import create_app
    
    app = create_app()
    click.echo(f"🚀 启动训练数据撤回服务 API 服务器")
    click.echo(f"   地址: http://{host}:{port}")
    click.echo(f"   健康检查: http://{host}:{port}/health")
    click.echo(f"   测试场景: http://{host}:{port}/api/test/scenarios")
    
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    cli()
