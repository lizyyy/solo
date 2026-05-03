"""量子电路作业验收员 - CLI主程序"""

import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List

import click

from .parser import QasmParser, GateRuleValidator, GateRule, RuleViolation, ParsedQasm
from .simulator import StateVectorSimulator, SimulationResult
from .grading import GradingEngine, GradingConfig, ScoreResult, ProblemSet
from .exporter import Exporter, create_summary_csv_row
from . import examples


def load_json_file(filepath: str) -> Dict:
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_qasm_file(filepath: str) -> str:
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def parse_gate_rules(rules_dict: Dict) -> GateRule:
    rules = GateRule()
    
    if "forbidden_gates" in rules_dict:
        rules.forbidden_gates = set(rules_dict["forbidden_gates"])
    if "allowed_gates" in rules_dict:
        rules.allowed_gates = set(rules_dict["allowed_gates"])
    if "max_depth" in rules_dict:
        rules.max_depth = rules_dict["max_depth"]
    if "max_qubits" in rules_dict:
        rules.max_qubits = rules_dict["max_qubits"]
    if "min_qubits" in rules_dict:
        rules.min_qubits = rules_dict["min_qubits"]
    if "required_qubits" in rules_dict:
        rules.required_qubits = rules_dict["required_qubits"]
    
    return rules


def parse_grading_config(config_dict: Dict) -> GradingConfig:
    config = GradingConfig()
    
    if "max_score" in config_dict:
        config.max_score = config_dict["max_score"]
    if "syntax_error_penalty" in config_dict:
        config.syntax_error_penalty = config_dict["syntax_error_penalty"]
    if "forbidden_gate_penalty" in config_dict:
        config.forbidden_gate_penalty = config_dict["forbidden_gate_penalty"]
    if "depth_exceed_penalty" in config_dict:
        config.depth_exceed_penalty = config_dict["depth_exceed_penalty"]
    if "qubit_misuse_penalty" in config_dict:
        config.qubit_misuse_penalty = config_dict["qubit_misuse_penalty"]
    if "probability_deviation_penalty" in config_dict:
        config.probability_deviation_penalty = config_dict["probability_deviation_penalty"]
    if "probability_tolerance" in config_dict:
        config.probability_tolerance = config_dict["probability_tolerance"]
    
    return config


@click.group()
@click.version_option(version="0.1.0", prog_name="qc-grader")
def main():
    """量子电路作业验收员 - 量子计算课程作业自动评分工具
    
    功能包括：
    - init: 生成示例文件
    - check: 检查QASM语法和门规则
    - simulate: 执行状态向量模拟
    - grade: 自动评分
    - report: 导出评分报告
    """
    pass


@main.command()
@click.option("--output-dir", "-o", default=".", help="输出目录")
@click.option("--type", "-t", "example_type", default="all", 
              type=click.Choice(["all", "bell", "hadamard", "ghz", "config"]),
              help="示例类型")
def init(output_dir, example_type):
    """生成示例文件
    
    创建示例QASM文件、期望分布JSON和配置文件。
    """
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    created_files = []
    
    if example_type in ["all", "bell"]:
        bell_path = out_path / "bell_state.qasm"
        with open(bell_path, 'w', encoding='utf-8') as f:
            f.write(examples.EXAMPLE_QASM_BELL_STATE)
        created_files.append(str(bell_path))
        click.echo(f"✅ 创建Bell态示例: {bell_path}")
    
    if example_type in ["all", "hadamard"]:
        hadamard_path = out_path / "hadamard.qasm"
        with open(hadamard_path, 'w', encoding='utf-8') as f:
            f.write(examples.EXAMPLE_QASM_HADAMARD)
        created_files.append(str(hadamard_path))
        click.echo(f"✅ 创建Hadamard示例: {hadamard_path}")
    
    if example_type in ["all", "ghz"]:
        ghz_path = out_path / "ghz_state.qasm"
        with open(ghz_path, 'w', encoding='utf-8') as f:
            f.write(examples.EXAMPLE_QASM_3QUBIT_GHZ)
        created_files.append(str(ghz_path))
        click.echo(f"✅ 创建GHZ态示例: {ghz_path}")
    
    if example_type in ["all", "config"]:
        expected_path = out_path / "expected_distributions.json"
        with open(expected_path, 'w', encoding='utf-8') as f:
            json.dump(examples.EXAMPLE_PROBLEM_SET, f, indent=2, ensure_ascii=False)
        created_files.append(str(expected_path))
        click.echo(f"✅ 创建期望分布配置: {expected_path}")
        
        rules_path = out_path / "gate_rules.json"
        with open(rules_path, 'w', encoding='utf-8') as f:
            json.dump(examples.EXAMPLE_GATE_RULES, f, indent=2, ensure_ascii=False)
        created_files.append(str(rules_path))
        click.echo(f"✅ 创建门规则配置: {rules_path}")
    
    click.echo("")
    click.echo("📋 已创建以下示例文件:")
    for f in created_files:
        click.echo(f"   - {f}")
    click.echo("")
    click.echo("💡 使用方法:")
    click.echo("   1. qc-grader check --qasm bell_state.qasm")
    click.echo("   2. qc-grader simulate --qasm bell_state.qasm")
    click.echo("   3. qc-grader grade --qasm bell_state.qasm --problem problem_2")


@main.command()
@click.option("--qasm", "-q", required=True, help="QASM文件路径")
@click.option("--rules", "-r", help="门规则JSON文件路径或题目ID")
@click.option("--problem", "-p", help="题目ID（用于从内置题库加载规则）")
@click.option("--config", "-c", help="题库配置JSON文件")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def check(qasm, rules, problem, config, verbose):
    """检查QASM语法和门规则
    
    验证QASM语法正确性、门使用规则、量子比特使用等。
    """
    click.echo("🔍 开始检查...")
    click.echo(f"   QASM文件: {qasm}")
    
    qasm_content = load_qasm_file(qasm)
    
    parser = QasmParser()
    parsed, parse_errors = parser.parse(qasm_content)
    
    if parse_errors:
        click.echo("")
        click.echo("❌ 语法错误:")
        for error in parse_errors:
            click.echo(f"   - {error}")
    else:
        click.echo("✅ 语法检查通过")
    
    if parsed:
        click.echo("")
        click.echo("📊 电路统计:")
        click.echo(f"   量子比特数: {parsed.num_qubits}")
        click.echo(f"   使用量子比特: {sorted(list(parsed.used_qubits))}")
        click.echo(f"   门深度: {parsed.gate_depth}")
        click.echo(f"   门操作数: {len(parsed.gates)}")
        
        if parsed.gate_count:
            click.echo("")
            click.echo("📋 门使用统计:")
            for gate, count in sorted(parsed.gate_count.items()):
                click.echo(f"   {gate}: {count}次")
    
    gate_rules_dict = {}
    
    if config and problem:
        problem_set_data = load_json_file(config)
        if problem in problem_set_data:
            gate_rules_dict = problem_set_data[problem].get("gate_rules", {})
            click.echo(f"")
            click.echo(f"📋 加载题目 {problem} 规则")
    elif problem:
        if problem in examples.EXAMPLE_PROBLEM_SET:
            gate_rules_dict = examples.EXAMPLE_PROBLEM_SET[problem].get("gate_rules", {})
            click.echo(f"")
            click.echo(f"📋 使用内置题目 {problem} 规则")
    
    if rules:
        if os.path.exists(rules):
            gate_rules_dict = load_json_file(rules)
            click.echo(f"")
            click.echo(f"📋 加载规则文件: {rules}")
        else:
            click.echo(f"⚠️ 规则文件不存在: {rules}")
    
    if gate_rules_dict and parsed:
        gate_rules = parse_gate_rules(gate_rules_dict)
        validator = GateRuleValidator()
        violations = validator.validate(parsed, gate_rules)
        
        if violations:
            click.echo("")
            click.echo("⚠️ 规则违规:")
            for v in violations:
                click.echo(f"   ❌ {v.rule_name}: {v.message}")
                if verbose:
                    click.echo(f"      详情: {v.details}")
        else:
            click.echo("")
            click.echo("✅ 门规则检查通过")
        
        if verbose:
            click.echo("")
            click.echo("📋 应用的规则:")
            if gate_rules.forbidden_gates:
                click.echo(f"   禁用门: {gate_rules.forbidden_gates}")
            if gate_rules.allowed_gates:
                click.echo(f"   允许门: {gate_rules.allowed_gates}")
            if gate_rules.max_depth:
                click.echo(f"   最大门深: {gate_rules.max_depth}")
            if gate_rules.max_qubits:
                click.echo(f"   最大量子比特: {gate_rules.max_qubits}")
    
    click.echo("")
    if parse_errors or (gate_rules_dict and parsed and violations):
        click.echo("❌ 检查未通过")
    else:
        click.echo("✅ 所有检查通过")


@main.command()
@click.option("--qasm", "-q", required=True, help="QASM文件路径")
@click.option("--shots", "-s", default=1024, help="采样次数", type=int)
@click.option("--show-statevector", "-v", is_flag=True, help="显示状态向量")
@click.option("--output", "-o", help="输出JSON文件路径")
def simulate(qasm, shots, show_statevector, output):
    """执行状态向量模拟
    
    对QASM电路进行状态向量模拟，输出概率分布和采样结果。
    """
    click.echo("⚛️  开始模拟...")
    click.echo(f"   QASM文件: {qasm}")
    click.echo(f"   采样次数: {shots}")
    
    qasm_content = load_qasm_file(qasm)
    
    parser = QasmParser()
    parsed, parse_errors = parser.parse(qasm_content)
    
    if parse_errors:
        click.echo("")
        click.echo("❌ 语法错误，无法模拟:")
        for error in parse_errors:
            click.echo(f"   - {error}")
        return
    
    if not parsed:
        click.echo("❌ 无法解析QASM")
        return
    
    click.echo("")
    click.echo("📊 电路信息:")
    click.echo(f"   量子比特数: {parsed.num_qubits}")
    click.echo(f"   门深度: {parsed.gate_depth}")
    click.echo(f"   门操作数: {len(parsed.gates)}")
    
    try:
        simulator = StateVectorSimulator()
        result = simulator.simulate(parsed, shots=shots)
        
        click.echo("")
        click.echo("📈 概率分布:")
        if result.probabilities:
            sorted_probs = sorted(result.probabilities.items(), key=lambda x: x[1], reverse=True)
            for state, prob in sorted_probs:
                if prob > 1e-6:
                    bar = "█" * int(prob * 50)
                    click.echo(f"   |{state}⟩: {prob:.6f} {bar}")
        else:
            click.echo("   (无概率输出)")
        
        click.echo("")
        click.echo("🎲 采样结果:")
        if result.counts:
            sorted_counts = sorted(result.counts.items(), key=lambda x: x[1], reverse=True)
            max_count = max(result.counts.values()) if result.counts else 1
            for state, count in sorted_counts:
                freq = count / shots
                bar = "█" * int(freq * 50)
                click.echo(f"   |{state}⟩: {count}次 ({freq:.2%}) {bar}")
        
        if show_statevector and result.statevector is not None:
            click.echo("")
            click.echo("⚛️  状态向量:")
            for i, amplitude in enumerate(result.statevector):
                if abs(amplitude) > 1e-10:
                    binary = format(i, f'0{result.num_qubits}b')
                    click.echo(f"   |{binary}⟩: {amplitude:.6f}")
        
        if output:
            output_data = {
                "num_qubits": result.num_qubits,
                "num_shots": result.num_shots,
                "circuit_depth": result.circuit_depth,
                "probabilities": result.probabilities,
                "counts": result.counts,
                "top_states": result.final_state_labels
            }
            if show_statevector:
                output_data["statevector"] = result.statevector.tolist()
            
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            
            click.echo("")
            click.echo(f"💾 结果已保存到: {output}")
        
        click.echo("")
        click.echo("✅ 模拟完成")
        
    except Exception as e:
        click.echo(f"")
        click.echo(f"❌ 模拟出错: {e}")


@main.command()
@click.option("--qasm", "-q", required=True, help="QASM文件路径")
@click.option("--problem", "-p", required=True, help="题目ID")
@click.option("--expected", "-e", help="期望分布JSON文件路径")
@click.option("--rules", "-r", help="门规则JSON文件路径")
@click.option("--config", "-c", help="题库配置JSON文件")
@click.option("--shots", "-s", default=1024, help="采样次数", type=int)
@click.option("--student", "-n", default="", help="学生姓名")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def grade(qasm, problem, expected, rules, config, shots, student, verbose):
    """自动评分
    
    综合检查语法、门规则、概率分布，输出最终得分和扣分原因。
    """
    click.echo("📝 开始评分...")
    click.echo(f"   QASM文件: {qasm}")
    click.echo(f"   题目ID: {problem}")
    if student:
        click.echo(f"   学生姓名: {student}")
    
    qasm_content = load_qasm_file(qasm)
    
    expected_distribution = {}
    gate_rules_dict = {}
    grading_config_dict = {}
    
    if config:
        problem_set_data = load_json_file(config)
        if problem in problem_set_data:
            prob_data = problem_set_data[problem]
            expected_distribution = prob_data.get("expected_distribution", {})
            gate_rules_dict = prob_data.get("gate_rules", {})
            grading_config_dict = prob_data.get("grading_config", {})
            click.echo(f"   配置文件: {config}")
    elif problem in examples.EXAMPLE_PROBLEM_SET:
        expected_distribution = examples.get_expected_distribution(problem)
        gate_rules_dict = examples.get_gate_rules(problem)
        grading_config_dict = examples.get_grading_config(problem)
        click.echo("   使用内置题库配置")
    
    if expected:
        if os.path.exists(expected):
            expected_data = load_json_file(expected)
            if problem in expected_data:
                expected_distribution = expected_data[problem].get("expected_distribution", expected_distribution)
            else:
                expected_distribution = expected_data
            click.echo(f"   期望分布: {expected}")
    
    if rules:
        if os.path.exists(rules):
            gate_rules_dict = load_json_file(rules)
            click.echo(f"   规则文件: {rules}")
    
    parser = QasmParser()
    parsed, parse_errors = parser.parse(qasm_content)
    
    rule_violations: List[RuleViolation] = []
    if gate_rules_dict and parsed and not parse_errors:
        gate_rules = parse_gate_rules(gate_rules_dict)
        validator = GateRuleValidator()
        rule_violations = validator.validate(parsed, gate_rules)
    
    simulation_result: Optional[SimulationResult] = None
    if parsed and not parse_errors:
        try:
            simulator = StateVectorSimulator()
            simulation_result = simulator.simulate(parsed, shots=shots)
        except Exception as e:
            if verbose:
                click.echo(f"   ⚠️  模拟失败: {e}")
    
    grading_config = parse_grading_config(grading_config_dict)
    grading_engine = GradingEngine(grading_config)
    
    score_result = grading_engine.grade_submission(
        parsed_qasm=parsed,
        parse_errors=parse_errors,
        rule_violations=rule_violations,
        simulation_result=simulation_result,
        expected_distribution=expected_distribution
    )
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("📊 评分结果")
    click.echo("=" * 50)
    
    status_emoji = {
        "passed": "✅",
        "partial": "⚠️",
        "failed": "❌"
    }.get(score_result.status.value, "❓")
    
    status_text = {
        "passed": "通过",
        "partial": "部分通过",
        "failed": "未通过"
    }.get(score_result.status.value, "未知")
    
    click.echo("")
    click.echo(f"总分: {score_result.total_score:.2f} / {score_result.max_score:.2f}")
    click.echo(f"得分率: {score_result.percentage:.2f}%")
    click.echo(f"状态: {status_emoji} {status_text}")
    click.echo(f"评语: {score_result.summary_message}")
    
    if score_result.passed_checks:
        click.echo("")
        click.echo("✅ 通过的检查:")
        for check in score_result.passed_checks:
            click.echo(f"   - {check}")
    
    if score_result.deductions:
        click.echo("")
        click.echo("❌ 扣分项:")
        for deduction in score_result.deductions:
            click.echo(f"   - [{deduction.deduction_type}] {deduction.description}")
            click.echo(f"     扣分: -{deduction.points_deducted:.2f} 分")
            if verbose and deduction.details:
                click.echo(f"     详情: {deduction.details}")
    
    if verbose:
        click.echo("")
        click.echo("📋 详细信息:")
        if "circuit_stats" in score_result.details:
            stats = score_result.details["circuit_stats"]
            click.echo(f"   电路统计:")
            click.echo(f"     量子比特: {stats.get('num_qubits', 0)}")
            click.echo(f"     门深度: {stats.get('gate_depth', 0)}")
            click.echo(f"     门数: {stats.get('num_gates', 0)}")
        
        if "probability_comparison" in score_result.details:
            click.echo(f"   概率对比:")
            comparisons = score_result.details["probability_comparison"]
            for state, info in comparisons.items():
                if info.get("absolute_difference", 0) > 0.001:
                    click.echo(f"     |{state}⟩: 模拟={info['simulated']:.4f}, "
                              f"期望={info['expected']:.4f}, 偏差={info['absolute_difference']:.4f}")
    
    click.echo("")
    if score_result.status.value == "passed":
        click.echo("🎉 作业通过验收！")
    elif score_result.status.value == "partial":
        click.echo("💡 作业部分通过，建议检查扣分项")
    else:
        click.echo("⚠️  作业未通过，请检查错误并重新提交")


@main.command()
@click.option("--qasm", "-q", required=True, help="QASM文件路径")
@click.option("--problem", "-p", required=True, help="题目ID")
@click.option("--output-dir", "-o", default="reports", help="输出目录")
@click.option("--expected", "-e", help="期望分布JSON文件路径")
@click.option("--rules", "-r", help="门规则JSON文件路径")
@click.option("--config", "-c", help="题库配置JSON文件")
@click.option("--shots", "-s", default=1024, help="采样次数", type=int)
@click.option("--student", "-n", default="", help="学生姓名")
@click.option("--format", "-f", "fmt", default="all", 
              type=click.Choice(["all", "json", "markdown"]),
              help="输出格式")
def report(qasm, problem, output_dir, expected, rules, config, shots, student, fmt):
    """导出评分报告
    
    生成包含所有证据的报告包，支持JSON、Markdown和CSV格式。
    """
    click.echo("📄 生成评分报告...")
    click.echo(f"   QASM文件: {qasm}")
    click.echo(f"   题目ID: {problem}")
    click.echo(f"   输出目录: {output_dir}")
    if student:
        click.echo(f"   学生姓名: {student}")
    
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    
    qasm_content = load_qasm_file(qasm)
    
    expected_distribution = {}
    gate_rules_dict = {}
    grading_config_dict = {}
    
    if config:
        problem_set_data = load_json_file(config)
        if problem in problem_set_data:
            prob_data = problem_set_data[problem]
            expected_distribution = prob_data.get("expected_distribution", {})
            gate_rules_dict = prob_data.get("gate_rules", {})
            grading_config_dict = prob_data.get("grading_config", {})
    elif problem in examples.EXAMPLE_PROBLEM_SET:
        expected_distribution = examples.get_expected_distribution(problem)
        gate_rules_dict = examples.get_gate_rules(problem)
        grading_config_dict = examples.get_grading_config(problem)
    
    if expected and os.path.exists(expected):
        expected_data = load_json_file(expected)
        if problem in expected_data:
            expected_distribution = expected_data[problem].get("expected_distribution", expected_distribution)
        else:
            expected_distribution = expected_data
    
    if rules and os.path.exists(rules):
        gate_rules_dict = load_json_file(rules)
    
    parser = QasmParser()
    parsed, parse_errors = parser.parse(qasm_content)
    
    rule_violations: List[RuleViolation] = []
    if gate_rules_dict and parsed and not parse_errors:
        gate_rules = parse_gate_rules(gate_rules_dict)
        validator = GateRuleValidator()
        rule_violations = validator.validate(parsed, gate_rules)
    
    simulation_result: Optional[SimulationResult] = None
    if parsed and not parse_errors:
        try:
            simulator = StateVectorSimulator()
            simulation_result = simulator.simulate(parsed, shots=shots)
        except Exception:
            pass
    
    grading_config = parse_grading_config(grading_config_dict)
    grading_engine = GradingEngine(grading_config)
    
    score_result = grading_engine.grade_submission(
        parsed_qasm=parsed,
        parse_errors=parse_errors,
        rule_violations=rule_violations,
        simulation_result=simulation_result,
        expected_distribution=expected_distribution
    )
    
    exporter = Exporter(output_dir)
    
    timestamp = __import__('datetime').datetime.now().strftime("%Y%m%d_%H%M%S")
    base_filename = f"report_{problem}_{timestamp}"
    if student:
        base_filename = f"report_{student}_{problem}_{timestamp}"
    
    generated_files = []
    
    if fmt in ["all", "json"]:
        json_path = exporter.export_json(
            score_result=score_result,
            parsed_qasm=parsed,
            simulation_result=simulation_result,
            rule_violations=rule_violations,
            expected_distribution=expected_distribution,
            qasm_content=qasm_content,
            problem_id=problem,
            student_name=student,
            filename=f"{base_filename}.json"
        )
        generated_files.append(json_path)
        click.echo(f"✅ 生成JSON报告: {json_path}")
    
    if fmt in ["all", "markdown"]:
        md_path = exporter.export_markdown(
            score_result=score_result,
            parsed_qasm=parsed,
            simulation_result=simulation_result,
            rule_violations=rule_violations,
            expected_distribution=expected_distribution,
            qasm_content=qasm_content,
            problem_id=problem,
            student_name=student,
            filename=f"{base_filename}.md"
        )
        generated_files.append(md_path)
        click.echo(f"✅ 生成Markdown报告: {md_path}")
    
    csv_row = create_summary_csv_row(
        score_result=score_result,
        problem_id=problem,
        student_name=student,
        submission_time=__import__('datetime').datetime.now().isoformat()
    )
    
    csv_path = out_path / f"{base_filename}_summary.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        import csv as csv_module
        writer = csv_module.DictWriter(f, fieldnames=list(csv_row.keys()))
        writer.writeheader()
        writer.writerow(csv_row)
    
    generated_files.append(str(csv_path))
    click.echo(f"✅ 生成CSV摘要: {csv_path}")
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("📦 报告包已生成")
    click.echo("=" * 50)
    click.echo("")
    click.echo(f"📁 输出目录: {output_dir}")
    click.echo("")
    click.echo("📄 生成的文件:")
    for f in generated_files:
        click.echo(f"   - {f}")
    click.echo("")
    click.echo("📊 评分摘要:")
    click.echo(f"   总分: {score_result.total_score:.2f} / {score_result.max_score:.2f}")
    click.echo(f"   得分率: {score_result.percentage:.2f}%")
    click.echo(f"   状态: {score_result.status.value}")
    click.echo("")
    click.echo("✅ 报告生成完成！")


@main.command()
@click.option("--problem", "-p", help="显示特定题目详情")
def problems(problem):
    """查看内置题库
    
    列出所有内置题目配置或查看特定题目详情。
    """
    if problem:
        if problem in examples.EXAMPLE_PROBLEM_SET:
            prob = examples.EXAMPLE_PROBLEM_SET[problem]
            click.echo(f"📋 题目: {problem}")
            click.echo(f"   描述: {prob.get('description', '无描述')}")
            click.echo("")
            click.echo("📊 期望分布:")
            for state, prob_val in prob.get("expected_distribution", {}).items():
                click.echo(f"   |{state}⟩: {prob_val}")
            click.echo("")
            click.echo("🔒 门规则:")
            rules = prob.get("gate_rules", {})
            if "forbidden_gates" in rules:
                click.echo(f"   禁用门: {rules['forbidden_gates']}")
            if "allowed_gates" in rules:
                click.echo(f"   允许门: {rules['allowed_gates']}")
            if "max_depth" in rules:
                click.echo(f"   最大门深: {rules['max_depth']}")
            if "max_qubits" in rules:
                click.echo(f"   最大量子比特: {rules['max_qubits']}")
            if "required_qubits" in rules:
                click.echo(f"   必需量子比特: {rules['required_qubits']}")
            click.echo("")
            click.echo("⚖️  评分配置:")
            grading = prob.get("grading_config", {})
            if "max_score" in grading:
                click.echo(f"   满分: {grading['max_score']}")
            if "probability_tolerance" in grading:
                click.echo(f"   概率容差: {grading['probability_tolerance']}")
        else:
            click.echo(f"❌ 未找到题目: {problem}")
            click.echo("")
            click.echo("可用题目:")
            for pid in examples.list_example_problems():
                click.echo(f"   - {pid}")
    else:
        click.echo("📚 内置题库")
        click.echo("")
        for pid in examples.list_example_problems():
            desc = examples.get_problem_description(pid)
            click.echo(f"📋 {pid}")
            click.echo(f"   描述: {desc}")
            if pid in examples.EXAMPLE_PROBLEM_SET:
                grading = examples.EXAMPLE_PROBLEM_SET[pid].get("grading_config", {})
                click.echo(f"   满分: {grading.get('max_score', 100)} 分")
            click.echo("")
        
        click.echo("💡 使用 qc-grader problems -p <题目ID> 查看详细信息")


if __name__ == "__main__":
    main()
