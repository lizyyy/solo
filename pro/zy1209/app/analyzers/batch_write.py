from typing import Dict, List, Any, Optional
from .base import BaseAnalyzer, AnalysisResult, Finding, Recommendation
from ..models.enums import AnalysisType, SeverityLevel


class BatchWriteAnalyzer(BaseAnalyzer):
    analysis_type = AnalysisType.BATCH_WRITE
    
    def analyze(self, inputs: Dict[str, Any]) -> AnalysisResult:
        batch_sample = inputs.get("batch_write_sample", {})
        config = self.config.get("batch_write", {})
        
        batch_size = config.get("batch_size", batch_sample.get("batch_size", 1000))
        total_records = config.get("total_records", batch_sample.get("total_records", 10000))
        single_insert_time = config.get("single_insert_time", batch_sample.get("single_insert_time_ms", 5))
        batch_insert_time = config.get("batch_insert_time", batch_sample.get("batch_insert_time_ms", 100))
        
        findings: List[Finding] = []
        recommendations: List[Recommendation] = []
        
        if total_records <= 0:
            total_records = 10000
        
        records_per_batch = batch_size if batch_size > 0 else 1000
        num_batches = total_records // records_per_batch + (1 if total_records % records_per_batch else 0)
        
        single_total_time = total_records * single_insert_time
        batch_total_time = num_batches * batch_insert_time
        
        time_savings = single_total_time - batch_total_time
        improvement_ratio = time_savings / single_total_time if single_total_time > 0 else 0
        
        metrics = {
            "batch_size": batch_size,
            "total_records": total_records,
            "num_batches": num_batches,
            "single_insert_time_ms": single_insert_time,
            "batch_insert_time_ms": batch_insert_time,
            "single_total_time_ms": single_total_time,
            "batch_total_time_ms": batch_total_time,
            "time_savings_ms": time_savings,
            "improvement_ratio": round(improvement_ratio, 3),
            "throughput_single": round(1000 / single_insert_time, 2) if single_insert_time > 0 else 0,
            "throughput_batch": round(records_per_batch * 1000 / batch_insert_time, 2) if batch_insert_time > 0 else 0
        }
        
        if improvement_ratio < 0.5:
            findings.append(Finding(
                id="BW-001",
                title="批量写入收益不明显",
                description=f"批量写入相比单条插入仅提升 {improvement_ratio*100:.1f}%，可能批量大小配置不合理",
                severity=SeverityLevel.MEDIUM,
                category="efficiency",
                evidence={
                    "improvement_ratio": improvement_ratio,
                    "batch_size": batch_size,
                    "single_time": single_insert_time,
                    "batch_time": batch_insert_time
                },
                impact="未能充分发挥批量写入的性能优势"
            ))
        
        if batch_size < 100:
            findings.append(Finding(
                id="BW-002",
                title="批量写入大小偏小",
                description=f"当前批量大小为 {batch_size}，建议至少设置为 100 或更多",
                severity=SeverityLevel.LOW,
                category="configuration",
                evidence={"batch_size": batch_size},
                impact="批量写入的收益可能未充分发挥"
            ))
        
        if batch_size > 10000:
            findings.append(Finding(
                id="BW-003",
                title="批量写入大小过大",
                description=f"当前批量大小为 {batch_size}，过大的批量可能导致内存压力或事务超时",
                severity=SeverityLevel.MEDIUM,
                category="configuration",
                evidence={"batch_size": batch_size},
                impact="可能导致内存溢出或事务超时"
            ))
        
        time_per_record_batch = batch_insert_time / records_per_batch if records_per_batch > 0 else 0
        if time_per_record_batch > single_insert_time * 0.5:
            findings.append(Finding(
                id="BW-004",
                title="批量写入效率偏低",
                description=f"批量写入单条平均耗时 {time_per_record_batch:.3f}ms，与单条插入相比效率提升有限",
                severity=SeverityLevel.HIGH,
                category="performance",
                evidence={
                    "batch_per_record": time_per_record_batch,
                    "single_per_record": single_insert_time,
                    "ratio": time_per_record_batch / single_insert_time if single_insert_time > 0 else 0
                },
                impact="批量写入可能存在配置或实现问题"
            ))
        
        if improvement_ratio >= 0.7:
            findings.append(Finding(
                id="BW-005",
                title="批量写入收益显著",
                description=f"批量写入相比单条插入提升 {improvement_ratio*100:.1f}%，配置合理",
                severity=SeverityLevel.INFO,
                category="best_practice",
                evidence={
                    "improvement_ratio": improvement_ratio,
                    "time_savings_ms": time_savings
                },
                impact="当前配置充分发挥了批量写入的优势"
            ))
        
        for finding in findings:
            if finding.id == "BW-001":
                recommendations.append(Recommendation(
                    id="R-BW-001",
                    finding_id=finding.id,
                    title="调整批量大小",
                    description="尝试调整批量大小，通常 1000-5000 条记录是一个较好的平衡点",
                    priority="medium",
                    estimated_effort="低",
                    expected_improvement="提升批量写入收益"
                ))
                recommendations.append(Recommendation(
                    id="R-BW-002",
                    finding_id=finding.id,
                    title="检查数据库配置",
                    description="检查数据库的 max_allowed_packet、innodb_buffer_pool_size 等配置",
                    priority="medium",
                    estimated_effort="中",
                    expected_improvement="优化批量写入环境"
                ))
            
            if finding.id == "BW-002":
                recommendations.append(Recommendation(
                    id="R-BW-003",
                    finding_id=finding.id,
                    title="增加批量大小",
                    description=f"建议将批量大小增加到至少 100，当前为 {batch_size}",
                    priority="low",
                    estimated_effort="低",
                    expected_improvement="提升批量写入效率"
                ))
            
            if finding.id == "BW-003":
                recommendations.append(Recommendation(
                    id="R-BW-004",
                    finding_id=finding.id,
                    title="减小批量大小",
                    description=f"建议将批量大小减小到 10000 以下，当前为 {batch_size}",
                    priority="medium",
                    estimated_effort="低",
                    expected_improvement="避免内存压力和事务超时"
                ))
            
            if finding.id == "BW-004":
                recommendations.append(Recommendation(
                    id="R-BW-005",
                    finding_id=finding.id,
                    title="检查批量写入实现",
                    description="检查批量写入是否使用了正确的批量插入语法（如 executemany 或 VALUES 多值）",
                    priority="high",
                    estimated_effort="中",
                    expected_improvement="显著提升批量写入效率"
                ))
        
        severity = self._calculate_severity(findings)
        
        return AnalysisResult(
            analysis_type=self.analysis_type,
            severity=severity,
            title="批量写入收益分析",
            description="分析批量写入相比单条插入的性能收益",
            findings=findings,
            recommendations=recommendations,
            metrics=metrics,
            raw_data={"batch_sample": batch_sample, "config": config}
        )
