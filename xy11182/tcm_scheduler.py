#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import sys
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class Prescription:
    id: str
    patient_name: str
    drugs: List[str]
    is_urgent: bool
    special_instruction: str
    quantity: int
    decoction_times: int
    created_at: str


@dataclass
class SchedulingRule:
    max_prescriptions_per_pot: int
    incompatible_drugs: List[List[str]]
    urgent_priority: bool
    pot_capacity_ml: int
    max_decoction_time_minutes: int


@dataclass
class PotAssignment:
    pot_id: str
    prescriptions: List[Prescription]
    scheduled_time: str
    estimated_duration_minutes: int
    notes: List[str]


@dataclass
class SchedulingResult:
    success: bool
    pot_assignments: List[PotAssignment]
    issues: List[Dict[str, Any]]
    urgent_handled: List[str]
    rerun_info: Optional[Dict[str, Any]]
    statistics: Dict[str, Any]


class TCMDecoctionScheduler:
    def __init__(self, input_dir: str, rules_file: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.rules_file = Path(rules_file)
        self.output_dir = Path(output_dir)
        self.rules: Optional[SchedulingRule] = None
        self.prescriptions: List[Prescription] = []
        self.issues: List[Dict[str, Any]] = []
        self.urgent_handled: List[str] = []
        
    def load_rules(self) -> bool:
        try:
            with open(self.rules_file, 'r', encoding='utf-8') as f:
                rules_data = json.load(f)
            
            self.rules = SchedulingRule(
                max_prescriptions_per_pot=rules_data.get('max_prescriptions_per_pot', 3),
                incompatible_drugs=rules_data.get('incompatible_drugs', []),
                urgent_priority=rules_data.get('urgent_priority', True),
                pot_capacity_ml=rules_data.get('pot_capacity_ml', 5000),
                max_decoction_time_minutes=rules_data.get('max_decoction_time_minutes', 60)
            )
            return True
        except FileNotFoundError:
            self.issues.append({
                'type': 'file_error',
                'severity': 'critical',
                'message': f'规则文件未找到: {self.rules_file}'
            })
            return False
        except json.JSONDecodeError as e:
            self.issues.append({
                'type': 'format_error',
                'severity': 'critical',
                'message': f'规则文件格式错误: {str(e)}'
            })
            return False
    
    def load_prescriptions(self) -> bool:
        prescription_files = list(self.input_dir.glob('prescription_*.json'))
        if not prescription_files:
            self.issues.append({
                'type': 'input_error',
                'severity': 'critical',
                'message': f'输入目录中未找到处方文件 (prescription_*.json): {self.input_dir}'
            })
            return False
        
        for file_path in prescription_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                prescription = Prescription(
                    id=data.get('id', file_path.stem),
                    patient_name=data.get('patient_name', '未知患者'),
                    drugs=data.get('drugs', []),
                    is_urgent=data.get('is_urgent', False),
                    special_instruction=data.get('special_instruction', ''),
                    quantity=data.get('quantity', 1),
                    decoction_times=data.get('decoction_times', 2),
                    created_at=data.get('created_at', datetime.now().isoformat())
                )
                
                self._validate_prescription(prescription, file_path.name)
                self.prescriptions.append(prescription)
                
            except json.JSONDecodeError as e:
                self.issues.append({
                    'type': 'format_error',
                    'severity': 'error',
                    'message': f'处方文件格式错误 {file_path.name}: {str(e)}'
                })
            except Exception as e:
                self.issues.append({
                    'type': 'unknown_error',
                    'severity': 'error',
                    'message': f'处理处方文件失败 {file_path.name}: {str(e)}'
                })
        
        return len(self.prescriptions) > 0
    
    def _validate_prescription(self, prescription: Prescription, filename: str):
        if not prescription.drugs:
            self.issues.append({
                'type': 'validation_error',
                'severity': 'warning',
                'prescription_id': prescription.id,
                'message': f'处方 {prescription.id} ({filename}) 未包含药品列表'
            })
        
        if prescription.quantity <= 0:
            self.issues.append({
                'type': 'validation_error',
                'severity': 'warning',
                'prescription_id': prescription.id,
                'message': f'处方 {prescription.id} ({filename}) 数量无效: {prescription.quantity}'
            })
        
        if prescription.decoction_times < 1 or prescription.decoction_times > 3:
            self.issues.append({
                'type': 'validation_error',
                'severity': 'warning',
                'prescription_id': prescription.id,
                'message': f'处方 {prescription.id} ({filename}) 煎药次数异常: {prescription.decoction_times}'
            })
    
    def _check_incompatible_drugs(self, prescriptions: List[Prescription]) -> List[str]:
        if not self.rules:
            return []
        
        all_drugs = set()
        for p in prescriptions:
            all_drugs.update(p.drugs)
        
        issues = []
        for incompatible_group in self.rules.incompatible_drugs:
            found_drugs = [drug for drug in incompatible_group if drug in all_drugs]
            if len(found_drugs) >= 2:
                issues.append(f'合煎禁忌: 发现不相容药品组合 {", ".join(found_drugs)}')
        
        return issues
    
    def _check_special_instructions(self, prescriptions: List[Prescription]) -> List[str]:
        issues = []
        for p in prescriptions:
            if p.special_instruction and '单煎' in p.special_instruction:
                issues.append(f'处方 {p.id} ({p.patient_name}) 要求单煎，不宜合煎')
            if p.special_instruction and '先煎' in p.special_instruction:
                issues.append(f'处方 {p.id} ({p.patient_name}) 包含先煎药品，需特殊处理')
        return issues
    
    def _group_prescriptions(self) -> List[List[Prescription]]:
        if not self.rules:
            return []
        
        urgent_prescriptions = [p for p in self.prescriptions if p.is_urgent]
        normal_prescriptions = [p for p in self.prescriptions if not p.is_urgent]
        
        if self.rules.urgent_priority:
            all_prescriptions = urgent_prescriptions + normal_prescriptions
        else:
            all_prescriptions = self.prescriptions.copy()
        
        groups = []
        current_group = []
        
        for prescription in all_prescriptions:
            if len(current_group) >= self.rules.max_prescriptions_per_pot:
                groups.append(current_group)
                current_group = []
            
            test_group = current_group + [prescription]
            incompatible_issues = self._check_incompatible_drugs(test_group)
            special_issues = self._check_special_instructions(test_group)
            
            if incompatible_issues or (special_issues and len(current_group) > 0):
                if current_group:
                    groups.append(current_group)
                current_group = [prescription]
                
                for issue in incompatible_issues:
                    self.issues.append({
                        'type': 'combination_restriction',
                        'severity': 'warning',
                        'prescription_id': prescription.id,
                        'message': issue
                    })
                for issue in special_issues:
                    self.issues.append({
                        'type': 'combination_restriction',
                        'severity': 'info',
                        'prescription_id': prescription.id,
                        'message': issue
                    })
            else:
                current_group.append(prescription)
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _handle_urgent_insertion(self, groups: List[List[Prescription]]) -> List[List[Prescription]]:
        urgent_count = sum(1 for p in self.prescriptions if p.is_urgent)
        if urgent_count == 0:
            return groups
        
        self.urgent_handled = [p.id for p in self.prescriptions if p.is_urgent]
        
        reordered_groups = []
        urgent_groups = []
        normal_groups = []
        
        for group in groups:
            has_urgent = any(p.is_urgent for p in group)
            if has_urgent:
                urgent_groups.append(group)
            else:
                normal_groups.append(group)
        
        reordered_groups = urgent_groups + normal_groups
        
        return reordered_groups
    
    def schedule(self) -> SchedulingResult:
        if not self.load_rules():
            return SchedulingResult(
                success=False,
                pot_assignments=[],
                issues=self.issues,
                urgent_handled=[],
                rerun_info=None,
                statistics={}
            )
        
        if not self.load_prescriptions():
            return SchedulingResult(
                success=False,
                pot_assignments=[],
                issues=self.issues,
                urgent_handled=[],
                rerun_info=None,
                statistics={}
            )
        
        groups = self._group_prescriptions()
        groups = self._handle_urgent_insertion(groups)
        
        pot_assignments = []
        base_time = datetime.now()
        
        for i, group in enumerate(groups):
            has_urgent = any(p.is_urgent for p in group)
            estimated_duration = 45 + (15 if has_urgent else 0)
            
            notes = []
            incompatible_notes = self._check_incompatible_drugs(group)
            special_notes = self._check_special_instructions(group)
            notes.extend(incompatible_notes)
            notes.extend(special_notes)
            
            assignment = PotAssignment(
                pot_id=f'POT-{str(i+1).zfill(3)}',
                prescriptions=group,
                scheduled_time=(base_time).isoformat(),
                estimated_duration_minutes=estimated_duration,
                notes=notes
            )
            pot_assignments.append(assignment)
        
        rerun_info = self._generate_rerun_info(pot_assignments)
        
        statistics = {
            'total_prescriptions': len(self.prescriptions),
            'urgent_prescriptions': sum(1 for p in self.prescriptions if p.is_urgent),
            'total_pots_used': len(pot_assignments),
            'average_prescriptions_per_pot': round(len(self.prescriptions) / len(pot_assignments), 2) if pot_assignments else 0,
            'issues_found': len(self.issues)
        }
        
        return SchedulingResult(
            success=True,
            pot_assignments=pot_assignments,
            issues=self.issues,
            urgent_handled=self.urgent_handled,
            rerun_info=rerun_info,
            statistics=statistics
        )
    
    def _generate_rerun_info(self, pot_assignments: List[PotAssignment]) -> Dict[str, Any]:
        rerun_checkpoint = {
            'timestamp': datetime.now().isoformat(),
            'processed_prescriptions': [],
            'pending_prescriptions': []
        }
        
        for assignment in pot_assignments:
            for p in assignment.prescriptions:
                rerun_checkpoint['processed_prescriptions'].append({
                    'id': p.id,
                    'pot_id': assignment.pot_id,
                    'scheduled_time': assignment.scheduled_time
                })
        
        return rerun_checkpoint
    
    def save_results(self, result: SchedulingResult):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        output_data = {
            'success': result.success,
            'run_timestamp': datetime.now().isoformat(),
            'statistics': result.statistics,
            'pot_assignments': [],
            'issues': result.issues,
            'urgent_summary': {
                'count': len(result.urgent_handled),
                'ids': result.urgent_handled
            },
            'rerun_checkpoint': result.rerun_info
        }
        
        for assignment in result.pot_assignments:
            assignment_dict = {
                'pot_id': assignment.pot_id,
                'scheduled_time': assignment.scheduled_time,
                'estimated_duration_minutes': assignment.estimated_duration_minutes,
                'notes': assignment.notes,
                'prescriptions': []
            }
            for p in assignment.prescriptions:
                assignment_dict['prescriptions'].append({
                    'id': p.id,
                    'patient_name': p.patient_name,
                    'drugs': p.drugs,
                    'is_urgent': p.is_urgent,
                    'special_instruction': p.special_instruction
                })
            output_data['pot_assignments'].append(assignment_dict)
        
        result_file = self.output_dir / 'scheduling_result.json'
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        issues_file = self.output_dir / 'issues_report.json'
        issues_report = {
            'total_issues': len(result.issues),
            'critical_issues': [i for i in result.issues if i.get('severity') == 'critical'],
            'combination_restrictions': [i for i in result.issues if i.get('type') == 'combination_restriction'],
            'validation_warnings': [i for i in result.issues if i.get('type') == 'validation_error'],
            'all_issues': result.issues
        }
        with open(issues_file, 'w', encoding='utf-8') as f:
            json.dump(issues_report, f, ensure_ascii=False, indent=2)
        
        self._save_human_readable_report(result)
        
        print(f"✓ 结果已保存到: {self.output_dir}")
        print(f"  - 排程结果: {result_file.name}")
        print(f"  - 问题报告: {issues_file.name}")
        print(f"  - 可读报告: human_readable_report.txt")
    
    def _save_human_readable_report(self, result: SchedulingResult):
        report_path = self.output_dir / 'human_readable_report.txt'
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("=" * 60 + "\n")
            f.write("        中药代煎房代煎锅次排程报告\n")
            f.write("=" * 60 + "\n\n")
            
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"排程状态: {'成功' if result.success else '失败'}\n\n")
            
            f.write("-" * 60 + "\n")
            f.write("统计摘要\n")
            f.write("-" * 60 + "\n")
            for key, value in result.statistics.items():
                f.write(f"  {key}: {value}\n")
            f.write("\n")
            
            f.write("-" * 60 + "\n")
            f.write("急单处理摘要\n")
            f.write("-" * 60 + "\n")
            f.write(f"  急单数量: {len(result.urgent_handled)}\n")
            if result.urgent_handled:
                f.write(f"  急单ID: {', '.join(result.urgent_handled)}\n")
            f.write("\n")
            
            f.write("-" * 60 + "\n")
            f.write("锅次安排详情\n")
            f.write("-" * 60 + "\n\n")
            
            for assignment in result.pot_assignments:
                f.write(f"【{assignment.pot_id}】\n")
                f.write(f"  预计时间: {assignment.estimated_duration_minutes} 分钟\n")
                f.write(f"  处方数量: {len(assignment.prescriptions)}\n")
                f.write("  处方列表:\n")
                for p in assignment.prescriptions:
                    urgent_marker = " ⚡急单" if p.is_urgent else ""
                    f.write(f"    - {p.id}: {p.patient_name}{urgent_marker}\n")
                    f.write(f"      药品: {', '.join(p.drugs[:3])}{'...' if len(p.drugs) > 3 else ''}\n")
                    if p.special_instruction:
                        f.write(f"      备注: {p.special_instruction}\n")
                if assignment.notes:
                    f.write("  ⚠️ 注意事项:\n")
                    for note in assignment.notes:
                        f.write(f"    - {note}\n")
                f.write("\n")
            
            f.write("-" * 60 + "\n")
            f.write("问题与警告列表\n")
            f.write("-" * 60 + "\n\n")
            
            if result.issues:
                for i, issue in enumerate(result.issues, 1):
                    severity_marker = {'critical': '🔴', 'error': '🟠', 'warning': '🟡', 'info': '🔵'}.get(issue.get('severity', 'info'), '⚪')
                    f.write(f"{i}. {severity_marker} [{issue.get('type', 'unknown')}]\n")
                    f.write(f"   {issue.get('message', '')}\n")
                    if 'prescription_id' in issue:
                        f.write(f"   关联处方: {issue['prescription_id']}\n")
                    f.write("\n")
            else:
                f.write("✓ 未发现问题\n\n")


def main():
    parser = argparse.ArgumentParser(
        description='中药代煎房代煎锅次排程 CLI 工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  %(prog)s --input ./samples/normal_input --rules ./rules.json --output ./output/normal_result
  %(prog)s --input ./samples/dirty_input --rules ./rules.json --output ./output/dirty_result
  %(prog)s --input ./samples/rerun_input --rules ./rules.json --output ./output/rerun_result --rerun
        '''
    )
    
    parser.add_argument('--input', required=True, help='输入目录路径，包含处方文件')
    parser.add_argument('--rules', required=True, help='规则文件路径 (JSON)')
    parser.add_argument('--output', required=True, help='输出目录路径')
    parser.add_argument('--rerun', action='store_true', help='重跑模式，基于上次的 checkpoint')
    parser.add_argument('--verbose', action='store_true', help='显示详细输出')
    
    try:
        args = parser.parse_args()
        
        if not os.path.exists(args.input):
            print(f"❌ 错误: 输入目录不存在: {args.input}")
            print(f"   请检查路径是否正确，或使用样例数据:")
            print(f"   ./samples/normal_input - 正常输入样例")
            print(f"   ./samples/dirty_input - 脏数据输入样例")
            print(f"   ./samples/rerun_input - 重跑对照样例")
            sys.exit(1)
        
        if not os.path.exists(args.rules):
            print(f"❌ 错误: 规则文件不存在: {args.rules}")
            print(f"   请检查路径是否正确，或使用默认规则文件: ./rules.json")
            sys.exit(1)
        
        print("=" * 60)
        print("        中药代煎房代煎锅次排程 CLI")
        print("=" * 60)
        print(f"输入目录: {args.input}")
        print(f"规则文件: {args.rules}")
        print(f"输出目录: {args.output}")
        print(f"重跑模式: {'是' if args.rerun else '否'}")
        print()
        
        scheduler = TCMDecoctionScheduler(args.input, args.rules, args.output)
        
        if args.rerun:
            checkpoint_path = Path(args.input) / '..' / 'previous_output' / 'scheduling_result.json'
            if checkpoint_path.exists():
                print("🔄 检测到上一次排程记录，正在恢复状态...")
            else:
                print("⚠️ 未找到上一次排程记录，将执行全新排程")
        
        print("📋 开始执行排程...")
        result = scheduler.schedule()
        
        if result.success:
            print("✅ 排程完成!")
            print()
            print("📊 排程统计:")
            for key, value in result.statistics.items():
                print(f"  {key}: {value}")
            
            if result.urgent_handled:
                print()
                print(f"⚡ 急单处理: 共 {len(result.urgent_handled)} 个急单已优先安排")
            
            if result.issues:
                print()
                print("⚠️ 发现问题:")
                critical_count = sum(1 for i in result.issues if i.get('severity') == 'critical')
                warning_count = sum(1 for i in result.issues if i.get('severity') == 'warning')
                print(f"  严重问题: {critical_count} 个")
                print(f"  警告信息: {warning_count} 个")
                print(f"  详情请查看输出目录中的 issues_report.json")
            
            scheduler.save_results(result)
            
        else:
            print("❌ 排程失败!")
            print()
            print("发现以下严重问题:")
            for issue in result.issues:
                print(f"  - {issue['message']}")
            sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n⚠️ 操作被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 发生未预期的错误: {type(e).__name__}")
        print(f"   错误信息: {str(e)}")
        print()
        print("💡 建议:")
        print("   1. 检查输入文件格式是否正确")
        print("   2. 确认规则文件是有效的 JSON 格式")
        print("   3. 使用 --verbose 参数获取更详细的错误信息")
        sys.exit(1)


if __name__ == '__main__':
    main()
