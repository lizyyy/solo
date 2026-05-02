from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import io
import csv
from app.models import Dataset, BudgetLedger, BudgetTransaction, AuditLog, QueryCache
from app.services.budget_manager import budget_manager
from app.services.audit_service import audit_service
from app.services.cache_manager import cache_manager


class ReportGenerator:
    """审计报告生成器"""
    
    def __init__(self):
        pass
    
    def generate_report(self,
                       db: Session,
                       dataset_id: int,
                       report_format: str = "markdown",
                       include_transactions: bool = True,
                       include_audit_logs: bool = True,
                       include_cache_stats: bool = True) -> str:
        """
        生成审计报告
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            report_format: 报告格式: 'markdown' 或 'csv'
            include_transactions: 是否包含预算交易记录
            include_audit_logs: 是否包含审计日志
            include_cache_stats: 是否包含缓存统计
            
        Returns:
            报告内容字符串
        """
        # 获取数据集信息
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        # 获取预算信息
        budget_summary = budget_manager.get_budget_summary(db, dataset_id)
        
        # 获取审计统计
        audit_stats = audit_service.get_statistics(db, dataset_id)
        
        # 获取缓存统计
        cache_stats = cache_manager.get_cache_stats(db, dataset_id)
        
        # 获取交易记录
        transactions = []
        if include_transactions:
            transactions = budget_manager.get_transactions(db, dataset_id, limit=1000)
        
        # 获取审计日志
        audit_logs = []
        if include_audit_logs:
            audit_logs = audit_service.get_logs(db, dataset_id, limit=1000)
        
        if report_format.lower() == 'csv':
            return self._generate_csv_report(
                dataset=dataset,
                budget_summary=budget_summary,
                audit_stats=audit_stats,
                cache_stats=cache_stats,
                transactions=transactions,
                audit_logs=audit_logs,
                include_transactions=include_transactions,
                include_audit_logs=include_audit_logs,
                include_cache_stats=include_cache_stats
            )
        else:
            return self._generate_markdown_report(
                dataset=dataset,
                budget_summary=budget_summary,
                audit_stats=audit_stats,
                cache_stats=cache_stats,
                transactions=transactions,
                audit_logs=audit_logs,
                include_transactions=include_transactions,
                include_audit_logs=include_audit_logs,
                include_cache_stats=include_cache_stats
            )
    
    def _generate_markdown_report(self,
                                  dataset: Dataset,
                                  budget_summary: Dict[str, Any],
                                  audit_stats: Dict[str, Any],
                                  cache_stats: Dict[str, Any],
                                  transactions: List[BudgetTransaction],
                                  audit_logs: List[AuditLog],
                                  include_transactions: bool,
                                  include_audit_logs: bool,
                                  include_cache_stats: bool) -> str:
        """生成Markdown格式报告"""
        lines = []
        
        # 标题
        lines.append("# 匿名指标保险箱 - 审计报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append(f"**数据集**: {dataset.name} (ID: {dataset.id})")
        lines.append(f"**数据集描述**: {dataset.description or '无'}")
        lines.append("")
        
        # 预算摘要
        lines.append("## 1. 预算摘要")
        lines.append("")
        
        if budget_summary.get('exists'):
            lines.append("| 项目 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 总预算 (ε) | {budget_summary.get('total_epsilon', 0):.4f} |")
            lines.append(f"| 剩余预算 (ε) | {budget_summary.get('remaining_epsilon', 0):.4f} |")
            lines.append(f"| 已消费预算 (ε) | {budget_summary.get('consumed_epsilon', 0):.4f} |")
            lines.append(f"| 已退回预算 (ε) | {budget_summary.get('refunded_epsilon', 0):.4f} |")
            lines.append(f"| 使用率 | {budget_summary.get('usage_percentage', 0):.2f}% |")
            lines.append(f"| 交易次数 | {budget_summary.get('transaction_count', 0)} |")
            lines.append(f"| Delta (δ) | {budget_summary.get('delta', 1e-5)} |")
            lines.append(f"| 样本抑制阈值 | {budget_summary.get('suppression_threshold', 5)} |")
        else:
            lines.append("> 该数据集暂无预算账本")
        
        lines.append("")
        
        # 审计统计
        lines.append("## 2. 查询审计统计")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总查询次数 | {audit_stats.get('total_queries', 0)} |")
        lines.append(f"| 成功次数 | {audit_stats.get('success_count', 0)} |")
        lines.append(f"| 失败次数 | {audit_stats.get('failed_count', 0)} |")
        lines.append(f"| 拒绝次数 | {audit_stats.get('rejected_count', 0)} |")
        lines.append(f"| 总消耗预算 (ε) | {audit_stats.get('total_epsilon_consumed', 0):.4f} |")
        lines.append(f"| 平均每次查询消耗 (ε) | {audit_stats.get('average_epsilon_per_query', 0):.4f} |")
        lines.append("")
        
        # 按查询类型统计
        query_type_stats = audit_stats.get('query_type_statistics', {})
        if query_type_stats:
            lines.append("### 2.1 按查询类型统计")
            lines.append("")
            lines.append("| 查询类型 | 次数 | 总消耗预算 (ε) |")
            lines.append("|----------|------|-----------------|")
            for qt, stats in query_type_stats.items():
                lines.append(f"| {qt} | {stats.get('count', 0)} | {stats.get('total_epsilon', 0):.4f} |")
            lines.append("")
        
        # 缓存统计
        if include_cache_stats:
            lines.append("## 3. 缓存统计")
            lines.append("")
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 总缓存条目 | {cache_stats.get('total_cache_entries', 0)} |")
            lines.append(f"| 有效条目 | {cache_stats.get('active_entries', 0)} |")
            lines.append(f"| 过期条目 | {cache_stats.get('expired_entries', 0)} |")
            lines.append(f"| 总命中次数 | {cache_stats.get('total_hits', 0)} |")
            lines.append(f"| 平均命中率 | {cache_stats.get('average_hits_per_entry', 0):.2f} |")
            lines.append("")
            
            # 节省的预算
            dataset_stats = cache_stats.get('dataset_statistics', {})
            if dataset_stats:
                total_epsilon_saved = sum(
                    s.get('total_epsilon_saved', 0) for s in dataset_stats.values()
                )
                lines.append(f"> 缓存累计节省隐私预算: {total_epsilon_saved:.4f} ε")
                lines.append("")
        
        # 预算交易记录
        if include_transactions and transactions:
            lines.append("## 4. 预算交易记录")
            lines.append("")
            lines.append("| 时间 | 类型 | 消耗/退回 (ε) | 操作前 (ε) | 操作后 (ε) | 原因 |")
            lines.append("|------|------|---------------|-----------|-----------|------|")
            
            for tx in transactions:
                tx_type = "消费" if tx.epsilon_used > 0 else "退回"
                epsilon_value = abs(tx.epsilon_used)
                reason = tx.reason or "-"
                lines.append(
                    f"| {tx.created_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                    f"{tx_type} | "
                    f"{epsilon_value:.4f} | "
                    f"{tx.epsilon_before:.4f} | "
                    f"{tx.epsilon_after:.4f} | "
                    f"{reason} |"
                )
            lines.append("")
        
        # 审计日志
        if include_audit_logs and audit_logs:
            lines.append("## 5. 查询审计日志")
            lines.append("")
            lines.append("| 时间 | 查询类型 | 状态 | 消耗预算 (ε) | 结果哈希 |")
            lines.append("|------|----------|------|--------------|----------|")
            
            for log in audit_logs:
                result_hash = log.result_hash[:16] + "..." if log.result_hash else "-"
                lines.append(
                    f"| {log.created_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                    f"{log.query_type} | "
                    f"{log.status} | "
                    f"{log.epsilon_used:.4f} | "
                    f"{result_hash} |"
                )
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("*此报告由匿名指标保险箱自动生成*")
        lines.append(f"*数据集创建时间: {dataset.created_at.strftime('%Y-%m-%d %H:%M:%S UTC') if dataset.created_at else '未知'}*")
        
        return "\n".join(lines)
    
    def _generate_csv_report(self,
                             dataset: Dataset,
                             budget_summary: Dict[str, Any],
                             audit_stats: Dict[str, Any],
                             cache_stats: Dict[str, Any],
                             transactions: List[BudgetTransaction],
                             audit_logs: List[AuditLog],
                             include_transactions: bool,
                             include_audit_logs: bool,
                             include_cache_stats: bool) -> str:
        """生成CSV格式报告"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 元数据
        writer.writerow(["# 匿名指标保险箱 - 审计报告"])
        writer.writerow(["生成时间", datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')])
        writer.writerow(["数据集", dataset.name, f"ID: {dataset.id}"])
        writer.writerow(["数据集描述", dataset.description or "无"])
        writer.writerow([])
        
        # 预算摘要
        writer.writerow(["## 预算摘要"])
        writer.writerow(["项目", "值"])
        
        if budget_summary.get('exists'):
            writer.writerow(["总预算 (ε)", f"{budget_summary.get('total_epsilon', 0):.4f}"])
            writer.writerow(["剩余预算 (ε)", f"{budget_summary.get('remaining_epsilon', 0):.4f}"])
            writer.writerow(["已消费预算 (ε)", f"{budget_summary.get('consumed_epsilon', 0):.4f}"])
            writer.writerow(["已退回预算 (ε)", f"{budget_summary.get('refunded_epsilon', 0):.4f}"])
            writer.writerow(["使用率 (%)", f"{budget_summary.get('usage_percentage', 0):.2f}"])
            writer.writerow(["交易次数", budget_summary.get('transaction_count', 0)])
            writer.writerow(["Delta (δ)", budget_summary.get('delta', 1e-5)])
            writer.writerow(["样本抑制阈值", budget_summary.get('suppression_threshold', 5)])
        else:
            writer.writerow(["状态", "该数据集暂无预算账本"])
        writer.writerow([])
        
        # 审计统计
        writer.writerow(["## 查询审计统计"])
        writer.writerow(["指标", "值"])
        writer.writerow(["总查询次数", audit_stats.get('total_queries', 0)])
        writer.writerow(["成功次数", audit_stats.get('success_count', 0)])
        writer.writerow(["失败次数", audit_stats.get('failed_count', 0)])
        writer.writerow(["拒绝次数", audit_stats.get('rejected_count', 0)])
        writer.writerow(["总消耗预算 (ε)", f"{audit_stats.get('total_epsilon_consumed', 0):.4f}"])
        writer.writerow(["平均每次查询消耗 (ε)", f"{audit_stats.get('average_epsilon_per_query', 0):.4f}"])
        writer.writerow([])
        
        # 缓存统计
        if include_cache_stats:
            writer.writerow(["## 缓存统计"])
            writer.writerow(["指标", "值"])
            writer.writerow(["总缓存条目", cache_stats.get('total_cache_entries', 0)])
            writer.writerow(["有效条目", cache_stats.get('active_entries', 0)])
            writer.writerow(["过期条目", cache_stats.get('expired_entries', 0)])
            writer.writerow(["总命中次数", cache_stats.get('total_hits', 0)])
            writer.writerow(["平均命中率", f"{cache_stats.get('average_hits_per_entry', 0):.2f}"])
            writer.writerow([])
        
        # 预算交易记录
        if include_transactions and transactions:
            writer.writerow(["## 预算交易记录"])
            writer.writerow(["时间", "类型", "消耗/退回 (ε)", "操作前 (ε)", "操作后 (ε)", "原因"])
            
            for tx in transactions:
                tx_type = "消费" if tx.epsilon_used > 0 else "退回"
                epsilon_value = abs(tx.epsilon_used)
                writer.writerow([
                    tx.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    tx_type,
                    f"{epsilon_value:.4f}",
                    f"{tx.epsilon_before:.4f}",
                    f"{tx.epsilon_after:.4f}",
                    tx.reason or "-"
                ])
            writer.writerow([])
        
        # 审计日志
        if include_audit_logs and audit_logs:
            writer.writerow(["## 查询审计日志"])
            writer.writerow(["时间", "查询类型", "状态", "消耗预算 (ε)", "结果哈希"])
            
            for log in audit_logs:
                result_hash = log.result_hash[:16] + "..." if log.result_hash else "-"
                writer.writerow([
                    log.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    log.query_type,
                    log.status,
                    f"{log.epsilon_used:.4f}",
                    result_hash
                ])
        
        return output.getvalue()


report_generator = ReportGenerator()
