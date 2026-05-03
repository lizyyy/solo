"""导出模块 - 支持Markdown、CSV、JSON格式的报告导出"""

import json
import csv
from dataclasses import asdict
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from .grading import ScoreResult, ScoreStatus
from .parser import ParsedQasm, RuleViolation
from .simulator import SimulationResult


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        import numpy as np
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.complex128) or isinstance(obj, complex):
            return {"real": float(obj.real), "imag": float(obj.imag)}
        if isinstance(obj, np.float64):
            return float(obj)
        if isinstance(obj, np.int64):
            return int(obj)
        return super().default(obj)


class Exporter:
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_json(self,
                    score_result: ScoreResult,
                    parsed_qasm: Optional[ParsedQasm] = None,
                    simulation_result: Optional[SimulationResult] = None,
                    rule_violations: List[RuleViolation] = None,
                    expected_distribution: Optional[Dict[str, float]] = None,
                    qasm_content: str = "",
                    problem_id: str = "",
                    student_name: str = "",
                    filename: Optional[str] = None) -> str:
        
        data = self._build_report_data(
            score_result, parsed_qasm, simulation_result,
            rule_violations, expected_distribution, qasm_content,
            problem_id, student_name
        )
        
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"grade_report_{problem_id or 'unknown'}_{timestamp}.json"
        
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, cls=NumpyEncoder)
        
        return str(filepath)

    def export_markdown(self,
                        score_result: ScoreResult,
                        parsed_qasm: Optional[ParsedQasm] = None,
                        simulation_result: Optional[SimulationResult] = None,
                        rule_violations: List[RuleViolation] = None,
                        expected_distribution: Optional[Dict[str, float]] = None,
                        qasm_content: str = "",
                        problem_id: str = "",
                        student_name: str = "",
                        filename: Optional[str] = None) -> str:
        
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"grade_report_{problem_id or 'unknown'}_{timestamp}.md"
        
        filepath = self.output_dir / filename
        
        md_content = self._generate_markdown(
            score_result, parsed_qasm, simulation_result,
            rule_violations, expected_distribution, qasm_content,
            problem_id, student_name
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return str(filepath)

    def export_csv(self,
                   score_results: List[Dict],
                   filename: Optional[str] = None) -> str:
        
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"grade_summary_{timestamp}.csv"
        
        filepath = self.output_dir / filename
        
        all_keys = set()
        for result in score_results:
            all_keys.update(result.keys())
        
        fieldnames = sorted(all_keys)
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for result in score_results:
                writer.writerow(result)
        
        return str(filepath)

    def export_all_formats(self,
                           score_result: ScoreResult,
                           parsed_qasm: Optional[ParsedQasm] = None,
                           simulation_result: Optional[SimulationResult] = None,
                           rule_violations: List[RuleViolation] = None,
                           expected_distribution: Optional[Dict[str, float]] = None,
                           qasm_content: str = "",
                           problem_id: str = "",
                           student_name: str = "",
                           base_filename: Optional[str] = None) -> Dict[str, str]:
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = base_filename or f"grade_report_{problem_id or 'unknown'}_{timestamp}"
        
        files = {}
        
        files["json"] = self.export_json(
            score_result, parsed_qasm, simulation_result,
            rule_violations, expected_distribution, qasm_content,
            problem_id, student_name, f"{base}.json"
        )
        
        files["markdown"] = self.export_markdown(
            score_result, parsed_qasm, simulation_result,
            rule_violations, expected_distribution, qasm_content,
            problem_id, student_name, f"{base}.md"
        )
        
        return files

    def _build_report_data(self,
                           score_result: ScoreResult,
                           parsed_qasm: Optional[ParsedQasm],
                           simulation_result: Optional[SimulationResult],
                           rule_violations: List[RuleViolation],
                           expected_distribution: Optional[Dict[str, float]],
                           qasm_content: str,
                           problem_id: str,
                           student_name: str) -> Dict[str, Any]:
        
        data = {
            "report_metadata": {
                "generated_at": datetime.now().isoformat(),
                "problem_id": problem_id,
                "student_name": student_name,
                "tool_version": "0.1.0"
            },
            "score_summary": {
                "total_score": score_result.total_score,
                "max_score": score_result.max_score,
                "percentage": score_result.percentage,
                "status": score_result.status.value,
                "summary_message": score_result.summary_message
            },
            "passed_checks": score_result.passed_checks,
            "deductions": [],
            "circuit_analysis": {},
            "simulation_results": {},
            "qasm_source": qasm_content
        }
        
        for deduction in score_result.deductions:
            data["deductions"].append({
                "type": deduction.deduction_type,
                "description": deduction.description,
                "points_deducted": deduction.points_deducted,
                "max_possible": deduction.max_possible,
                "severity": deduction.severity,
                "details": deduction.details
            })
        
        if parsed_qasm:
            data["circuit_analysis"] = {
                "num_qubits": parsed_qasm.num_qubits,
                "num_used_qubits": len(parsed_qasm.used_qubits),
                "used_qubits": sorted(list(parsed_qasm.used_qubits)),
                "gate_depth": parsed_qasm.gate_depth,
                "gate_count": parsed_qasm.gate_count,
                "total_gates": len(parsed_qasm.gates),
                "num_measurements": len(parsed_qasm.measurements)
            }
        
        if simulation_result:
            data["simulation_results"] = {
                "num_qubits": simulation_result.num_qubits,
                "num_shots": simulation_result.num_shots,
                "circuit_depth": simulation_result.circuit_depth,
                "probabilities": simulation_result.probabilities,
                "counts": simulation_result.counts,
                "top_states": simulation_result.final_state_labels[:10]
            }
        
        if expected_distribution:
            data["expected_distribution"] = expected_distribution
        
        if rule_violations:
            data["rule_violations"] = [
                {
                    "rule_name": v.rule_name,
                    "violation_type": v.violation_type,
                    "message": v.message,
                    "details": v.details,
                    "severity": v.severity
                }
                for v in rule_violations
            ]
        
        data["details"] = score_result.details
        
        return data

    def _generate_markdown(self,
                           score_result: ScoreResult,
                           parsed_qasm: Optional[ParsedQasm],
                           simulation_result: Optional[SimulationResult],
                           rule_violations: List[RuleViolation],
                           expected_distribution: Optional[Dict[str, float]],
                           qasm_content: str,
                           problem_id: str,
                           student_name: str) -> str:
        
        lines = []
        
        lines.append("# 量子电路作业评分报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        if problem_id:
            lines.append(f"**题目编号**: {problem_id}")
        if student_name:
            lines.append(f"**学生姓名**: {student_name}")
        lines.append("")
        
        status_emoji = {
            ScoreStatus.PASSED: "✅",
            ScoreStatus.PARTIAL: "⚠️",
            ScoreStatus.FAILED: "❌"
        }.get(score_result.status, "❓")
        
        status_text = {
            ScoreStatus.PASSED: "通过",
            ScoreStatus.PARTIAL: "部分通过",
            ScoreStatus.FAILED: "未通过"
        }.get(score_result.status, "未知")
        
        lines.append("## 评分摘要")
        lines.append("")
        lines.append(f"| 项目 | 结果 |")
        lines.append(f"|------|------|")
        lines.append(f"| 总分 | {score_result.total_score:.2f} / {score_result.max_score:.2f} |")
        lines.append(f"| 得分率 | {score_result.percentage:.2f}% |")
        lines.append(f"| 状态 | {status_emoji} {status_text} |")
        lines.append("")
        lines.append(f"**评语**: {score_result.summary_message}")
        lines.append("")
        
        if score_result.passed_checks:
            lines.append("## ✅ 通过的检查项")
            lines.append("")
            for check in score_result.passed_checks:
                lines.append(f"- [x] {check}")
            lines.append("")
        
        if score_result.deductions:
            lines.append("## ❌ 扣分项")
            lines.append("")
            lines.append("| 扣分类型 | 描述 | 扣分数 | 最高可扣 |")
            lines.append("|----------|------|--------|----------|")
            for deduction in score_result.deductions:
                lines.append(f"| {deduction.deduction_type} | {deduction.description} | {deduction.points_deducted:.2f} | {deduction.max_possible:.2f} |")
            lines.append("")
        
        if parsed_qasm:
            lines.append("## 🔬 电路分析")
            lines.append("")
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            lines.append(f"| 量子比特总数 | {parsed_qasm.num_qubits} |")
            lines.append(f"| 实际使用量子比特 | {len(parsed_qasm.used_qubits)} |")
            lines.append(f"| 使用的量子比特 | {sorted(list(parsed_qasm.used_qubits))} |")
            lines.append(f"| 门深度 | {parsed_qasm.gate_depth} |")
            lines.append(f"| 门操作总数 | {len(parsed_qasm.gates)} |")
            lines.append("")
            
            if parsed_qasm.gate_count:
                lines.append("### 门统计")
                lines.append("")
                lines.append("| 门类型 | 次数 |")
                lines.append("|--------|------|")
                for gate, count in sorted(parsed_qasm.gate_count.items()):
                    lines.append(f"| {gate} | {count} |")
                lines.append("")
        
        if simulation_result:
            lines.append("## 📊 模拟结果")
            lines.append("")
            lines.append(f"**模拟量子比特数**: {simulation_result.num_qubits}")
            lines.append(f"**采样次数**: {simulation_result.num_shots}")
            lines.append(f"**电路深度**: {simulation_result.circuit_depth}")
            lines.append("")
            
            if simulation_result.probabilities:
                lines.append("### 概率分布")
                lines.append("")
                lines.append("| 状态 | 概率 |")
                lines.append("|------|------|")
                for state, prob in sorted(simulation_result.probabilities.items(), 
                                          key=lambda x: x[1], reverse=True):
                    if prob > 1e-6:
                        lines.append(f"| |{state}⟩ | {prob:.6f} |")
                lines.append("")
            
            if expected_distribution and simulation_result.probabilities:
                lines.append("### 期望分布对比")
                lines.append("")
                lines.append("| 状态 | 模拟概率 | 期望概率 | 绝对偏差 |")
                lines.append("|------|----------|----------|----------|")
                
                all_states = set(simulation_result.probabilities.keys()) | set(expected_distribution.keys())
                for state in sorted(all_states):
                    sim = simulation_result.probabilities.get(state, 0.0)
                    exp = expected_distribution.get(state, 0.0)
                    diff = abs(sim - exp)
                    lines.append(f"| |{state}⟩ | {sim:.6f} | {exp:.6f} | {diff:.6f} |")
                lines.append("")
        
        if qasm_content:
            lines.append("## 📝 QASM 源代码")
            lines.append("")
            lines.append("```qasm")
            lines.append(qasm_content.strip())
            lines.append("```")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由量子电路作业验收员自动生成*")
        
        return "\n".join(lines)


def create_summary_csv_row(score_result: ScoreResult,
                            problem_id: str = "",
                            student_name: str = "",
                            submission_time: str = "") -> Dict[str, Any]:
    return {
        "problem_id": problem_id,
        "student_name": student_name,
        "submission_time": submission_time,
        "total_score": score_result.total_score,
        "max_score": score_result.max_score,
        "percentage": score_result.percentage,
        "status": score_result.status.value,
        "num_deductions": len(score_result.deductions),
        "num_passed_checks": len(score_result.passed_checks),
        "summary_message": score_result.summary_message
    }
