import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models import DrillTask, DrillResult, Diagnosis, Node, Slot, Request
from app.schemas import (
    RiskAnalysis, ComparisonResult, ReportExport,
    Severity, DiagnosisResponse
)


class AnalysisService:
    def __init__(self, db: Session):
        self.db = db

    def analyze_task_risks(self, task_id: int) -> RiskAnalysis:
        task = self.db.query(DrillTask).filter(DrillTask.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        diagnoses = self.db.query(Diagnosis).filter(
            Diagnosis.task_id == task_id
        ).order_by(
            Diagnosis.severity.desc()
        ).all()

        critical = [d for d in diagnoses if d.severity == Severity.critical]
        high = [d for d in diagnoses if d.severity == Severity.high]
        medium = [d for d in diagnoses if d.severity == Severity.medium]
        low = [d for d in diagnoses if d.severity == Severity.low]
        info = [d for d in diagnoses if d.severity == Severity.info]

        diagnosis_responses = [
            DiagnosisResponse(
                id=d.id,
                task_id=d.task_id,
                diagnosis_type=d.diagnosis_type,
                severity=d.severity,
                title=d.title,
                description=d.description,
                recommendation=d.recommendation,
                affected_slots=d.affected_slots,
                affected_nodes=d.affected_nodes,
                affected_requests=d.affected_requests,
                details=d.details,
                created_at=d.created_at
            ) for d in diagnoses
        ]

        return RiskAnalysis(
            task_id=task_id,
            total_risks=len(diagnoses),
            critical_risks=len(critical),
            high_risks=len(high),
            medium_risks=len(medium),
            low_risks=len(low),
            risks=diagnosis_responses
        )

    def compare_tasks(self, task_ids: List[int]) -> ComparisonResult:
        tasks = self.db.query(DrillTask).filter(DrillTask.id.in_(task_ids)).all()
        if len(tasks) != len(task_ids):
            found_ids = [t.id for t in tasks]
            missing = [tid for tid in task_ids if tid not in found_ids]
            raise ValueError(f"Tasks not found: {missing}")

        comparison_metrics = {}
        insights = []

        for task in tasks:
            results = self.db.query(DrillResult).filter(
                DrillResult.task_id == task.id
            ).all()
            
            diagnoses = self.db.query(Diagnosis).filter(
                Diagnosis.task_id == task.id
            ).all()

            successes = len([r for r in results if r.status == "success"])
            failures = len([r for r in results if r.status == "failed"])
            redirects = len([r for r in results if r.redirect_count > 0])
            avg_latency = sum(r.latency_ms for r in results) / len(results) if results else 0
            
            critical_diags = len([d for d in diagnoses if d.severity == "critical"])
            high_diags = len([d for d in diagnoses if d.severity == "high"])

            comparison_metrics[f"task_{task.id}"] = {
                "name": task.task_name,
                "config": {
                    "enable_moved_redirect": task.enable_moved_redirect,
                    "enable_ask_redirect": task.enable_ask_redirect,
                    "enable_read_write_routing": task.enable_read_write_routing,
                    "enable_replication_lag": task.enable_replication_lag,
                    "enable_sentinel_failover": task.enable_sentinel_failover,
                    "enable_client_retry": task.enable_client_retry,
                    "enable_lua_transaction_failure": task.enable_lua_transaction_failure,
                    "replication_lag_ms": task.replication_lag_ms,
                    "max_retries": task.max_retries
                },
                "results": {
                    "total": len(results),
                    "successes": successes,
                    "failures": failures,
                    "redirects": redirects,
                    "avg_latency_ms": round(avg_latency, 2)
                },
                "diagnoses": {
                    "total": len(diagnoses),
                    "critical": critical_diags,
                    "high": high_diags
                },
                "status": task.status,
                "started_at": task.started_at.isoformat() if task.started_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None
            }

        if len(tasks) >= 2:
            task_list = list(comparison_metrics.values())
            
            min_failures = min(t["results"]["failures"] for t in task_list)
            max_failures = max(t["results"]["failures"] for t in task_list)
            
            if min_failures < max_failures:
                insights.append(f"失败次数差异显著：从 {min_failures} 到 {max_failures} 次")
            
            min_latency = min(t["results"]["avg_latency_ms"] for t in task_list)
            max_latency = max(t["results"]["avg_latency_ms"] for t in task_list)
            
            if max_latency > min_latency * 1.5:
                insights.append(f"延迟差异较大：最低 {min_latency}ms vs 最高 {max_latency}ms")
            
            for task in task_list:
                if task["diagnoses"]["critical"] > 0:
                    insights.append(f"任务 '{task['name']}' 检测到 {task['diagnoses']['critical']} 个严重问题")
            
            tasks_with_failover = [t for t in task_list if t["config"]["enable_sentinel_failover"]]
            if tasks_with_failover:
                insights.append(f"注意：{len(tasks_with_failover)} 个任务启用了故障转移模拟")

        return ComparisonResult(
            task_ids=task_ids,
            comparison_metrics=comparison_metrics,
            insights=insights
        )


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def export_json_report(self, task_id: int) -> ReportExport:
        task = self.db.query(DrillTask).filter(DrillTask.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        results = self.db.query(DrillResult).filter(
            DrillResult.task_id == task_id
        ).all()

        diagnoses = self.db.query(Diagnosis).filter(
            Diagnosis.task_id == task_id
        ).all()

        nodes = self.db.query(Node).all()
        slots = self.db.query(Slot).all()
        requests = self.db.query(Request).all()

        report_data = {
            "report_version": "1.0",
            "generated_at": datetime.utcnow().isoformat(),
            "task": {
                "id": task.id,
                "name": task.task_name,
                "description": task.description,
                "status": task.status,
                "config": {
                    "enable_moved_redirect": task.enable_moved_redirect,
                    "enable_ask_redirect": task.enable_ask_redirect,
                    "enable_read_write_routing": task.enable_read_write_routing,
                    "enable_replication_lag": task.enable_replication_lag,
                    "enable_sentinel_failover": task.enable_sentinel_failover,
                    "enable_client_retry": task.enable_client_retry,
                    "enable_lua_transaction_failure": task.enable_lua_transaction_failure,
                    "replication_lag_ms": task.replication_lag_ms,
                    "max_retries": task.max_retries,
                    "seed": task.seed
                },
                "timing": {
                    "started_at": task.started_at.isoformat() if task.started_at else None,
                    "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                    "created_at": task.created_at.isoformat()
                }
            },
            "cluster_state": {
                "nodes": [
                    {
                        "id": n.id,
                        "node_id": n.node_id,
                        "host": n.host,
                        "port": n.port,
                        "role": n.role,
                        "master_id": n.master_id,
                        "state": n.state,
                        "is_alive": n.is_alive
                    } for n in nodes
                ],
                "slots": {
                    "total": len(slots),
                    "migrating": len([s for s in slots if s.is_migrating]),
                    "importing": len([s for s in slots if s.is_importing]),
                    "stable": len([s for s in slots if s.state == "stable"])
                },
                "total_requests_loaded": len(requests)
            },
            "results_summary": {
                "total": len(results),
                "success": len([r for r in results if r.status == "success"]),
                "failed": len([r for r in results if r.status == "failed"]),
                "redirected": len([r for r in results if r.status == "redirected"]),
                "redirect_details": {
                    "moved_count": len([r for r in results if r.redirect_type == "MOVED"]),
                    "ask_count": len([r for r in results if r.redirect_type == "ASK"]),
                    "avg_redirect_count": round(
                        sum(r.redirect_count for r in results) / len(results), 2
                    ) if results else 0
                },
                "latency_stats": {
                    "avg_ms": round(sum(r.latency_ms for r in results) / len(results), 2) if results else 0,
                    "max_ms": max(r.latency_ms for r in results) if results else 0,
                    "min_ms": min(r.latency_ms for r in results) if results else 0
                }
            },
            "diagnoses": [
                {
                    "id": d.id,
                    "type": d.diagnosis_type,
                    "severity": d.severity,
                    "title": d.title,
                    "description": d.description,
                    "recommendation": d.recommendation,
                    "affected_slots": d.affected_slots,
                    "affected_nodes": d.affected_nodes,
                    "affected_requests": d.affected_requests,
                    "details": d.details
                } for d in diagnoses
            ]
        }

        return ReportExport(
            format="json",
            content=json.dumps(report_data, ensure_ascii=False, indent=2),
            filename=f"drill_report_{task_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )

    def export_markdown_report(self, task_id: int) -> ReportExport:
        task = self.db.query(DrillTask).filter(DrillTask.id == task_id).first()
        if not task:
            raise ValueError(f"Task {task_id} not found")

        analysis = AnalysisService(self.db).analyze_task_risks(task_id)
        
        results = self.db.query(DrillResult).filter(
            DrillResult.task_id == task_id
        ).all()

        nodes = self.db.query(Node).all()
        slots = self.db.query(Slot).all()

        md_lines = []
        md_lines.append(f"# Redis Cluster 演练报告")
        md_lines.append("")
        md_lines.append(f"**任务名称**: {task.task_name}")
        md_lines.append(f"**任务ID**: {task.id}")
        md_lines.append(f"**状态**: {task.status}")
        md_lines.append(f"**生成时间**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")

        md_lines.append("## 1. 演练配置")
        md_lines.append("")
        md_lines.append("| 配置项 | 值 |")
        md_lines.append("|--------|-----|")
        md_lines.append(f"| MOVED 重定向 | {'启用' if task.enable_moved_redirect else '禁用'} |")
        md_lines.append(f"| ASK 重定向 | {'启用' if task.enable_ask_redirect else '禁用'} |")
        md_lines.append(f"| 读写路由 | {'启用' if task.enable_read_write_routing else '禁用'} |")
        md_lines.append(f"| 复制延迟模拟 | {'启用' if task.enable_replication_lag else '禁用'} |")
        md_lines.append(f"| Sentinel 故障转移 | {'启用' if task.enable_sentinel_failover else '禁用'} |")
        md_lines.append(f"| 客户端重试 | {'启用' if task.enable_client_retry else '禁用'} |")
        md_lines.append(f"| Lua/事务失败模拟 | {'启用' if task.enable_lua_transaction_failure else '禁用'} |")
        md_lines.append(f"| 复制延迟 | {task.replication_lag_ms}ms |")
        md_lines.append(f"| 最大重试次数 | {task.max_retries} |")
        md_lines.append(f"| 随机种子 | {task.seed} |")
        md_lines.append("")

        md_lines.append("## 2. 集群状态")
        md_lines.append("")
        md_lines.append(f"**节点数量**: {len(nodes)}")
        md_lines.append(f"**Master 节点**: {len([n for n in nodes if n.role == 'master'])}")
        md_lines.append(f"**Slave 节点**: {len([n for n in nodes if n.role == 'slave'])}")
        md_lines.append(f"**可用节点**: {len([n for n in nodes if n.is_alive])}")
        md_lines.append("")
        md_lines.append("### 节点详情")
        md_lines.append("")
        md_lines.append("| 节点ID | 角色 | 主机 | 端口 | 状态 |")
        md_lines.append("|--------|------|------|------|------|")
        for node in nodes:
            md_lines.append(f"| {node.node_id[:8]}... | {node.role} | {node.host} | {node.port} | {'在线' if node.is_alive else '离线'} |")
        md_lines.append("")

        md_lines.append("### 槽位分布")
        md_lines.append("")
        md_lines.append(f"**总槽位数**: {len(slots)} / 16384")
        md_lines.append(f"**迁移中**: {len([s for s in slots if s.is_migrating])}")
        md_lines.append(f"**导入中**: {len([s for s in slots if s.is_importing])}")
        md_lines.append(f"**稳定状态**: {len([s for s in slots if s.state == 'stable'])}")
        md_lines.append("")

        md_lines.append("## 3. 演练结果统计")
        md_lines.append("")
        
        total = len(results)
        success = len([r for r in results if r.status == "success"])
        failed = len([r for r in results if r.status == "failed"])
        redirected = len([r for r in results if r.status == "redirected"])
        
        md_lines.append(f"**总请求数**: {total}")
        md_lines.append(f"**成功**: {success} ({success/total*100:.1f}%)")
        md_lines.append(f"**失败**: {failed} ({failed/total*100:.1f}%)")
        md_lines.append(f"**重定向**: {redirected} ({redirected/total*100:.1f}%)")
        md_lines.append("")

        moved_count = len([r for r in results if r.redirect_type == "MOVED"])
        ask_count = len([r for r in results if r.redirect_type == "ASK"])
        if moved_count or ask_count:
            md_lines.append("### 重定向详情")
            md_lines.append("")
            md_lines.append(f"**MOVED 重定向**: {moved_count}")
            md_lines.append(f"**ASK 重定向**: {ask_count}")
            if total > 0:
                avg_redirect = sum(r.redirect_count for r in results) / total
                md_lines.append(f"**平均重定向次数**: {avg_redirect:.2f}")
            md_lines.append("")

        if results:
            avg_latency = sum(r.latency_ms for r in results) / len(results)
            max_latency = max(r.latency_ms for r in results)
            min_latency = min(r.latency_ms for r in results)
            
            md_lines.append("### 延迟统计")
            md_lines.append("")
            md_lines.append(f"**平均延迟**: {avg_latency:.2f}ms")
            md_lines.append(f"**最大延迟**: {max_latency:.2f}ms")
            md_lines.append(f"**最小延迟**: {min_latency:.2f}ms")
            md_lines.append("")

        md_lines.append("## 4. 风险分析")
        md_lines.append("")
        md_lines.append(f"**总诊断数**: {analysis.total_risks}")
        md_lines.append(f"**严重**: {analysis.critical_risks}")
        md_lines.append(f"**高危**: {analysis.high_risks}")
        md_lines.append(f"**中危**: {analysis.medium_risks}")
        md_lines.append(f"**低危**: {analysis.low_risks}")
        md_lines.append("")

        severity_order = ["critical", "high", "medium", "low", "info"]
        for sev in severity_order:
            sev_risks = [r for r in analysis.risks if r.severity == sev]
            if sev_risks:
                sev_name = {
                    "critical": "严重",
                    "high": "高危",
                    "medium": "中危",
                    "low": "低危",
                    "info": "信息"
                }.get(sev, sev)
                
                md_lines.append(f"### {sev_name}问题 ({len(sev_risks)})")
                md_lines.append("")
                
                for risk in sev_risks:
                    md_lines.append(f"#### {risk.title}")
                    md_lines.append("")
                    if risk.description:
                        md_lines.append(f"**描述**: {risk.description}")
                    if risk.recommendation:
                        md_lines.append(f"")
                        md_lines.append(f"**建议**: {risk.recommendation}")
                    md_lines.append("")

        md_lines.append("---")
        md_lines.append("")
        md_lines.append("*此报告由 Redis Cluster Drill Platform 自动生成*")

        return ReportExport(
            format="markdown",
            content="\n".join(md_lines),
            filename=f"drill_report_{task_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        )
