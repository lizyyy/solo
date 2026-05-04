import json
from typing import Dict, Any
from dataclasses import asdict
from .models import AnalysisReport, RiskLevel


class ReportExporter:
    @staticmethod
    def to_json(report: AnalysisReport) -> str:
        def convert(obj):
            if isinstance(obj, RiskLevel):
                return obj.value
            return obj
        
        return json.dumps(asdict(report), default=convert, indent=2, ensure_ascii=False)

    @staticmethod
    def to_markdown(report: AnalysisReport) -> str:
        lines = []
        
        lines.append(f"# 数据库连接池分析报告")
        lines.append(f"")
        lines.append(f"**报告ID**: {report.report_id}")
        lines.append(f"**生成时间**: {report.generated_at}")
        lines.append(f"")
        lines.append("---")
        lines.append(f"")
        
        lines.append("## 📊 摘要")
        lines.append(f"")
        lines.append(f"```")
        lines.append(f"{report.summary}")
        lines.append(f"```")
        lines.append(f"")
        
        lines.append("## 🗄️ 数据库限制")
        lines.append(f"")
        lines.append(f"| 指标 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 最大连接数 | {report.database_limits.max_connections} |")
        lines.append(f"| 预留连接数 | {report.database_limits.reserved_connections} |")
        lines.append(f"| 超级用户预留 | {report.database_limits.superuser_reserved_connections} |")
        lines.append(f"| **可用连接** | **{report.database_limits.max_connections - report.database_limits.reserved_connections - report.database_limits.superuser_reserved_connections}** |")
        if report.database_limits.max_connections_per_tenant:
            lines.append(f"| 单租户最大连接 | {report.database_limits.max_connections_per_tenant} |")
        lines.append(f"")
        
        lines.append("## 📈 连接预算汇总")
        lines.append(f"")
        lines.append(f"| 指标 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 理论最大连接 | {report.total_max_possible} |")
        lines.append(f"| 理论最小连接 | {report.total_min_possible} |")
        lines.append(f"| 预期峰值连接 | {round(report.total_expected_peak, 1)} |")
        lines.append(f"| 剩余可用空间 | {report.remaining_headroom} |")
        lines.append(f"| 利用率 | {round(report.utilization_percentage, 1)}% |")
        lines.append(f"")
        
        lines.append("## 🔧 各服务连接预算")
        lines.append(f"")
        lines.append(f"| 服务 | 实例数 | 单实例最大 | 最大可能 | 预期峰值 | 利用率 |")
        lines.append(f"|------|--------|-----------|---------|---------|--------|")
        for budget in report.connection_budgets:
            lines.append(
                f"| {budget.service_name} | "
                f"{budget.instances} | "
                f"{budget.pool_config.max_pool_size} | "
                f"{budget.max_possible_connections} | "
                f"{round(budget.expected_peak_connections, 1)} | "
                f"{round(budget.utilization_ratio * 100, 1)}% |"
            )
        lines.append(f"")
        
        lines.append("## ⚠️ 风险评估")
        lines.append(f"")
        
        critical_risks = [r for r in report.risks if r.risk_level == RiskLevel.CRITICAL]
        high_risks = [r for r in report.risks if r.risk_level == RiskLevel.HIGH]
        medium_risks = [r for r in report.risks if r.risk_level == RiskLevel.MEDIUM]
        low_risks = [r for r in report.risks if r.risk_level == RiskLevel.LOW]
        
        if critical_risks:
            lines.append(f"### 🔴 严重风险 ({len(critical_risks)})")
            lines.append(f"")
            for risk in critical_risks:
                lines.append(f"#### {risk.description}")
                if risk.service_name:
                    lines.append(f"- **服务**: {risk.service_name}")
                if risk.tenant_id:
                    lines.append(f"- **租户**: {risk.tenant_id}")
                lines.append(f"- **详情**: {json.dumps(risk.details, ensure_ascii=False)}")
                lines.append(f"- **建议**: {risk.suggested_mitigation}")
                lines.append(f"")
        
        if high_risks:
            lines.append(f"### 🟠 高风险 ({len(high_risks)})")
            lines.append(f"")
            for risk in high_risks:
                lines.append(f"#### {risk.description}")
                if risk.service_name:
                    lines.append(f"- **服务**: {risk.service_name}")
                if risk.tenant_id:
                    lines.append(f"- **租户**: {risk.tenant_id}")
                lines.append(f"- **详情**: {json.dumps(risk.details, ensure_ascii=False)}")
                lines.append(f"- **建议**: {risk.suggested_mitigation}")
                lines.append(f"")
        
        if medium_risks:
            lines.append(f"### 🟡 中等风险 ({len(medium_risks)})")
            lines.append(f"")
            for risk in medium_risks:
                lines.append(f"#### {risk.description}")
                if risk.service_name:
                    lines.append(f"- **服务**: {risk.service_name}")
                if risk.tenant_id:
                    lines.append(f"- **租户**: {risk.tenant_id}")
                lines.append(f"- **详情**: {json.dumps(risk.details, ensure_ascii=False)}")
                lines.append(f"- **建议**: {risk.suggested_mitigation}")
                lines.append(f"")
        
        if not report.risks:
            lines.append(f"✅ 未发现风险")
            lines.append(f"")
        
        if report.simulation_results:
            lines.append("## 🎯 模拟结果")
            lines.append(f"")
            
            max_conn = max(r.total_connections for r in report.simulation_results)
            min_conn = min(r.total_connections for r in report.simulation_results)
            avg_conn = sum(r.total_connections for r in report.simulation_results) / len(report.simulation_results)
            total_timeouts = sum(r.timeout_events for r in report.simulation_results)
            total_retries = sum(r.retry_events for r in report.simulation_results)
            max_wait = max(r.wait_queue_size for r in report.simulation_results)
            
            lines.append(f"| 指标 | 值 |")
            lines.append(f"|------|-----|")
            lines.append(f"| 模拟时长 | {len(report.simulation_results) * 5 // 60} 分钟 |")
            lines.append(f"| 峰值连接 | {max_conn} |")
            lines.append(f"| 最低连接 | {min_conn} |")
            lines.append(f"| 平均连接 | {round(avg_conn, 1)} |")
            lines.append(f"| 超时事件总数 | {total_timeouts} |")
            lines.append(f"| 重试事件总数 | {total_retries} |")
            lines.append(f"| 最大等待队列 | {max_wait} |")
            lines.append(f"")
            
            lines.append("### 各服务峰值连接分布")
            lines.append(f"")
            service_peaks = {}
            for result in report.simulation_results:
                for svc, conn in result.connections_by_service.items():
                    service_peaks[svc] = max(service_peaks.get(svc, 0), conn)
            
            for svc, peak in service_peaks.items():
                lines.append(f"- **{svc}**: {peak} 连接")
            lines.append(f"")
        
        lines.append("---")
        lines.append(f"")
        lines.append("*此报告由 pool-analyzer 生成*")
        
        return "\n".join(lines)

    @staticmethod
    def export_json(report: AnalysisReport, output_path: str):
        json_content = ReportExporter.to_json(report)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(json_content)

    @staticmethod
    def export_markdown(report: AnalysisReport, output_path: str):
        md_content = ReportExporter.to_markdown(report)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
