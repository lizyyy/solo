#!/usr/bin/env python3
"""外包工时验收 CLI 工具"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def load_json(filename: str) -> Dict:
    """加载JSON数据文件"""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return {}
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(filename: str, data: Dict) -> None:
    """保存JSON数据文件"""
    filepath = os.path.join(DATA_DIR, filename)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class AcceptanceEngine:
    """验收引擎"""
    
    def __init__(self):
        self.tasks = load_json('tasks.json').get('tasks', [])
        self.time_reports = load_json('time_reports.json').get('reports', [])
        self.deliverables = load_json('deliverables.json').get('deliverables', [])
        self.feedbacks = load_json('acceptance_feedback.json').get('feedbacks', [])
        self.settlements = load_json('settlements.json').get('settlements', [])
        self.reworks = load_json('reworks.json').get('reworks', [])
    
    def save_data(self):
        """保存数据"""
        save_json('settlements.json', {'settlements': self.settlements})
        save_json('reworks.json', {'reworks': self.reworks})
    
    def get_task(self, task_id: str) -> Optional[Dict]:
        """获取任务"""
        for t in self.tasks:
            if t['task_id'] == task_id:
                return t
        return None
    
    def get_reports_by_task(self, task_id: str) -> List[Dict]:
        """获取任务的工时申报"""
        return [r for r in self.time_reports if r['task_id'] == task_id]
    
    def get_deliverables_by_task(self, task_id: str) -> List[Dict]:
        """获取任务的交付物"""
        return [d for d in self.deliverables if d['task_id'] == task_id]
    
    def get_feedback(self, task_id: str) -> Optional[Dict]:
        """获取任务的验收意见"""
        for f in self.feedbacks:
            if f['task_id'] == task_id:
                return f
        return None
    
    def is_task_settled(self, task_id: str) -> bool:
        """检查任务是否已结算"""
        return any(s['task_id'] == task_id and s['status'] == 'confirmed' 
                   for s in self.settlements)
    
    def get_existing_settlement(self, task_id: str) -> Optional[Dict]:
        """获取已存在的结算记录"""
        for s in self.settlements:
            if s['task_id'] == task_id:
                return s
        return None
    
    def calculate_settlement(self, task_id: str, report: Dict) -> Dict:
        """计算单个申报的结算"""
        task = self.get_task(task_id)
        feedback = self.get_feedback(task_id)
        deliverables = self.get_deliverables_by_task(task_id)
        all_reports = self.get_reports_by_task(task_id)
        reported_hours = report['hours']
        
        issues = []
        deduction_hours = 0
        actual_hours = reported_hours
        status = 'pending'
        
        if len(all_reports) > 1:
            sorted_reports = sorted(all_reports, key=lambda x: (x['submit_date'], x['report_id']))
            first_report = sorted_reports[0]
            if report['report_id'] != first_report['report_id']:
                issues.append(f'该任务已由 {first_report["developer"]} 在 {first_report["submit_date"]} 申报，重复申报')
                status = 'duplicate'
                actual_hours = 0
                deduction_hours = reported_hours
        
        if status != 'duplicate' and self.is_task_settled(task_id):
            issues.append('该任务已结算，重复申报')
            status = 'duplicate'
            actual_hours = 0
            deduction_hours = reported_hours
        
        if status != 'duplicate':
            if not deliverables:
                issues.append('未提交交付物')
                status = 'exception'
                actual_hours = 0
            
            if task and actual_hours > task['max_hours'] and status not in ['exception', 'failed']:
                overage = actual_hours - task['max_hours']
                issues.append(f'申报工时({reported_hours})超过任务上限({task["max_hours"]})，扣减{overage}工时')
                actual_hours = task['max_hours']
            
            if not feedback:
                issues.append('无验收意见')
                status = 'exception'
            elif feedback['status'] == 'failed':
                issues.append(f'验收未通过: {feedback["comment"]}')
                status = 'failed'
                actual_hours = 0
            elif feedback['status'] == 'pending':
                issues.append('验收待完成')
                status = 'exception'
            elif feedback['status'] == 'passed_with_deduction':
                deduction = feedback.get('deduction_hours', 0)
                if deduction > 0:
                    issues.append(f'验收通过但扣减{deduction}工时: {feedback["comment"]}')
                    actual_hours = max(0, actual_hours - deduction)
                    status = 'passed_with_deduction'
                else:
                    status = 'passed'
            elif feedback['status'] == 'passed':
                status = 'passed'
        
        if status not in ['duplicate', 'exception', 'failed']:
            for rework in self.reworks:
                if rework['report_id'] == report['report_id']:
                    rework_hours = rework.get('deduction_hours', 0)
                    if rework_hours > 0:
                        issues.append(f'返工扣减{rework_hours}工时: {rework["reason"]}')
                        actual_hours = max(0, actual_hours - rework_hours)
                        if status == 'passed':
                            status = 'passed_with_deduction'
        
        deduction_hours = reported_hours - actual_hours
        
        return {
            'report_id': report['report_id'],
            'task_id': task_id,
            'task_name': task['task_name'] if task else '未知任务',
            'developer': report['developer'],
            'max_hours': task['max_hours'] if task else 0,
            'reported_hours': reported_hours,
            'deduction_hours': deduction_hours,
            'actual_hours': actual_hours,
            'status': status,
            'issues': issues,
            'submit_date': report['submit_date']
        }
    
    def check_all(self) -> Dict:
        """核对所有申报"""
        results = {
            'total_reports': 0,
            'reports': [],
            'summary': {
                'passed': 0,
                'passed_with_deduction': 0,
                'failed': 0,
                'exception': 0,
                'duplicate': 0,
                'total_reported': 0,
                'total_deduction': 0,
                'total_actual': 0
            }
        }
        
        for report in self.time_reports:
            settlement = self.calculate_settlement(report['task_id'], report)
            results['reports'].append(settlement)
            results['total_reports'] += 1
            results['summary']['total_reported'] += settlement['reported_hours']
            results['summary']['total_deduction'] += settlement['deduction_hours']
            results['summary']['total_actual'] += settlement['actual_hours']
            
            if settlement['status'] in results['summary']:
                results['summary'][settlement['status']] += 1
        
        return results
    
    def get_developer_details(self, developer: Optional[str] = None) -> Dict:
        """获取人员明细"""
        results = {}
        
        for report in self.time_reports:
            dev = report['developer']
            if developer and dev != developer:
                continue
            
            if dev not in results:
                results[dev] = {
                    'developer': dev,
                    'reports': [],
                    'summary': {
                        'total_reported': 0,
                        'total_deduction': 0,
                        'total_actual': 0,
                        'count': 0
                    }
                }
            
            settlement = self.calculate_settlement(report['task_id'], report)
            results[dev]['reports'].append(settlement)
            results[dev]['summary']['total_reported'] += settlement['reported_hours']
            results[dev]['summary']['total_deduction'] += settlement['deduction_hours']
            results[dev]['summary']['total_actual'] += settlement['actual_hours']
            results[dev]['summary']['count'] += 1
        
        return results
    
    def mark_rework(self, report_id: str, deduction_hours: float, reason: str) -> Optional[Dict]:
        """标记返工"""
        report = next((r for r in self.time_reports if r['report_id'] == report_id), None)
        if not report:
            return None
        
        rework = {
            'rework_id': f'RW{len(self.reworks) + 1:03d}',
            'report_id': report_id,
            'task_id': report['task_id'],
            'developer': report['developer'],
            'deduction_hours': deduction_hours,
            'reason': reason,
            'create_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        self.reworks.append(rework)
        self.save_data()
        return rework
    
    def confirm_settlement(self) -> Dict:
        """确认结算"""
        checked = self.check_all()
        confirmed = []
        
        for report_result in checked['reports']:
            if report_result['status'] in ['passed', 'passed_with_deduction']:
                existing = self.get_existing_settlement(report_result['task_id'])
                if existing and existing['status'] == 'confirmed':
                    continue
                
                settlement = {
                    'settlement_id': f'S{len(self.settlements) + 1:03d}',
                    'report_id': report_result['report_id'],
                    'task_id': report_result['task_id'],
                    'task_name': report_result['task_name'],
                    'developer': report_result['developer'],
                    'reported_hours': report_result['reported_hours'],
                    'deduction_hours': report_result['deduction_hours'],
                    'actual_hours': report_result['actual_hours'],
                    'status': 'confirmed',
                    'issues': report_result['issues'],
                    'confirm_date': datetime.now().strftime('%Y-%m-%d')
                }
                
                if existing:
                    for i, s in enumerate(self.settlements):
                        if s['task_id'] == report_result['task_id']:
                            self.settlements[i] = settlement
                            break
                else:
                    self.settlements.append(settlement)
                
                confirmed.append(settlement)
        
        self.save_data()
        return {
            'newly_confirmed': confirmed,
            'total_confirmed': len([s for s in self.settlements if s['status'] == 'confirmed'])
        }

class CLI:
    """命令行接口"""
    
    def __init__(self):
        self.engine = AcceptanceEngine()
    
    def cmd_check(self, args):
        """核对命令"""
        results = self.engine.check_all()
        
        print('\n' + '=' * 80)
        print('外包工时验收 - 核对结果')
        print('=' * 80)
        print(f'\n总申报数: {results["total_reports"]}')
        print(f'\n汇总统计:')
        print(f'  通过: {results["summary"]["passed"]} 条')
        print(f'  通过但扣减: {results["summary"]["passed_with_deduction"]} 条')
        print(f'  验收失败: {results["summary"]["failed"]} 条')
        print(f'  异常: {results["summary"]["exception"]} 条')
        print(f'  重复申报: {results["summary"]["duplicate"]} 条')
        print(f'\n工时统计:')
        print(f'  申报总工时: {results["summary"]["total_reported"]} 小时')
        print(f'  扣减总工时: {results["summary"]["total_deduction"]} 小时')
        print(f'  可结算工时: {results["summary"]["total_actual"]} 小时')
        
        print('\n' + '-' * 80)
        print('详细结果:')
        print('-' * 80)
        
        for r in results['reports']:
            status_map = {
                'passed': '✓ 通过',
                'passed_with_deduction': '△ 通过但扣减',
                'failed': '✗ 失败',
                'exception': '! 异常',
                'duplicate': '⟳ 重复',
                'pending': '○ 待处理'
            }
            status_str = status_map.get(r['status'], r['status'])
            
            print(f'\n【{status_str}】 {r["task_id"]} - {r["task_name"]}')
            print(f'   申报人: {r["developer"]} | 申报日期: {r["submit_date"]}')
            print(f'   工时变化: 申报 {r["reported_hours"]}h → 扣减 {r["deduction_hours"]}h → 可结算 {r["actual_hours"]}h')
            print(f'   任务上限: {r["max_hours"]}h')
            
            if r['issues']:
                print(f'   依据说明:')
                for issue in r['issues']:
                    print(f'      - {issue}')
        
        print('\n' + '=' * 80)
    
    def cmd_details(self, args):
        """查看人员明细"""
        developer = args.developer if hasattr(args, 'developer') else None
        details = self.engine.get_developer_details(developer)
        
        if not details:
            print('未找到相关人员数据')
            return
        
        print('\n' + '=' * 80)
        print('外包工时验收 - 人员明细')
        print('=' * 80)
        
        for dev, data in details.items():
            print(f'\n【人员: {dev}】')
            print(f'   申报数量: {data["summary"]["count"]} 条')
            print(f'   工时变化: 申报 {data["summary"]["total_reported"]}h → 扣减 {data["summary"]["total_deduction"]}h → 可结算 {data["summary"]["total_actual"]}h')
            
            for r in data['reports']:
                status_map = {
                    'passed': '✓',
                    'passed_with_deduction': '△',
                    'failed': '✗',
                    'exception': '!',
                    'duplicate': '⟳',
                    'pending': '○'
                }
                status_str = status_map.get(r['status'], '?')
                print(f'      {status_str} {r["task_id"]}-{r["task_name"]}: {r["reported_hours"]}h → {r["actual_hours"]}h')
                if r['issues']:
                    for issue in r['issues']:
                        print(f'         - {issue}')
        
        print('\n' + '=' * 80)
    
    def cmd_rework(self, args):
        """标记返工"""
        result = self.engine.mark_rework(args.report_id, args.hours, args.reason)
        
        if result:
            print(f'\n✓ 成功标记返工')
            print(f'   返工ID: {result["rework_id"]}')
            print(f'   申报ID: {result["report_id"]}')
            print(f'   扣减工时: {result["deduction_hours"]}h')
            print(f'   原因: {result["reason"]}')
            
            report = next((r for r in self.engine.time_reports if r['report_id'] == args.report_id), None)
            if report:
                new_settlement = self.engine.calculate_settlement(report['task_id'], report)
                print(f'   重新计算后: {new_settlement["reported_hours"]}h → 扣减{new_settlement["deduction_hours"]}h → 可结算{new_settlement["actual_hours"]}h')
        else:
            print(f'\n✗ 未找到申报ID: {args.report_id}')
    
    def cmd_confirm(self, args):
        """确认结算"""
        checked = self.engine.check_all()
        before = [s for s in self.engine.settlements if s['status'] == 'confirmed']
        before_actual = sum(s['actual_hours'] for s in before)
        before_reported = sum(s['reported_hours'] for s in before)
        
        result = self.engine.confirm_settlement()
        
        print('\n' + '=' * 80)
        print('外包工时验收 - 结算确认')
        print('=' * 80)
        
        print(f'\n处理前已确认:')
        print(f'   已确认结算数: {len(before)} 条')
        print(f'   已确认申报工时: {before_reported} 小时')
        print(f'   已确认可结算工时: {before_actual} 小时')
        
        print(f'\n本次新增确认:')
        print(f'   新增确认数: {len(result["newly_confirmed"])} 条')
        
        for s in result['newly_confirmed']:
            print(f'      {s["task_id"]}-{s["task_name"]} ({s["developer"]}): {s["reported_hours"]}h → {s["actual_hours"]}h')
            if s['issues']:
                for issue in s['issues']:
                    print(f'         依据: {issue}')
        
        all_confirmed = [s for s in self.engine.settlements if s['status'] == 'confirmed']
        after_reported = sum(s['reported_hours'] for s in all_confirmed)
        after_actual = sum(s['actual_hours'] for s in all_confirmed)
        
        print(f'\n处理后汇总:')
        print(f'   总确认数: {result["total_confirmed"]} 条')
        print(f'   申报工时变化: {before_reported}h → {after_reported}h (增加 {after_reported - before_reported}h)')
        print(f'   可结算工时变化: {before_actual}h → {after_actual}h (增加 {after_actual - before_actual}h)')
        
        print(f'\n待处理:')
        print(f'   通过未确认: {checked["summary"]["passed"] + checked["summary"]["passed_with_deduction"] - len(result["newly_confirmed"]) - len(before)} 条')
        print(f'   异常/失败/重复: {checked["summary"]["exception"] + checked["summary"]["failed"] + checked["summary"]["duplicate"]} 条')
        
        print('\n' + '=' * 80)
    
    def cmd_export(self, args):
        """导出报告"""
        checked = self.engine.check_all()
        all_confirmed = [s for s in self.engine.settlements if s['status'] == 'confirmed']
        
        report = {
            'report_title': '外包工时结算报告',
            'generate_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'summary': {
                'total_reports': checked['total_reports'],
                'passed': checked['summary']['passed'],
                'passed_with_deduction': checked['summary']['passed_with_deduction'],
                'failed': checked['summary']['failed'],
                'exception': checked['summary']['exception'],
                'duplicate': checked['summary']['duplicate'],
                'total_reported_hours': checked['summary']['total_reported'],
                'total_deduction_hours': checked['summary']['total_deduction'],
                'total_actual_hours': checked['summary']['total_actual'],
                'confirmed_count': len(all_confirmed),
                'confirmed_actual_hours': sum(s['actual_hours'] for s in all_confirmed)
            },
            'details': [],
            'exceptions': []
        }
        
        for r in checked['reports']:
            detail = {
                'task_id': r['task_id'],
                'task_name': r['task_name'],
                'developer': r['developer'],
                'submit_date': r['submit_date'],
                'reported_hours': r['reported_hours'],
                'deduction_hours': r['deduction_hours'],
                'actual_hours': r['actual_hours'],
                'status': r['status'],
                'bases': r['issues']
            }
            report['details'].append(detail)
            
            if r['status'] in ['exception', 'failed', 'duplicate']:
                report['exceptions'].append(detail)
        
        output_file = args.output if hasattr(args, 'output') else 'settlement_report.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f'\n✓ 结算报告已导出: {output_file}')
        print(f'\n报告摘要:')
        print(f'   总申报数: {report["summary"]["total_reports"]} 条')
        print(f'   总申报工时: {report["summary"]["total_reported_hours"]} 小时')
        print(f'   总扣减工时: {report["summary"]["total_deduction_hours"]} 小时')
        print(f'   可结算工时: {report["summary"]["total_actual_hours"]} 小时')
        print(f'   已确认结算: {report["summary"]["confirmed_count"]} 条')
        print(f'   异常数量: {len(report["exceptions"])} 条')
        
        if args.format == 'text' or True:
            text_file = os.path.splitext(output_file)[0] + '.txt'
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write('=' * 70 + '\n')
                f.write('外包工时结算报告\n')
                f.write('=' * 70 + '\n')
                f.write(f'\n生成时间: {report["generate_date"]}\n')
                f.write('\n' + '-' * 70 + '\n')
                f.write('一、汇总统计\n')
                f.write('-' * 70 + '\n')
                f.write(f'\n申报状态:\n')
                f.write(f'  通过: {report["summary"]["passed"]} 条\n')
                f.write(f'  通过但扣减: {report["summary"]["passed_with_deduction"]} 条\n')
                f.write(f'  验收失败: {report["summary"]["failed"]} 条\n')
                f.write(f'  异常: {report["summary"]["exception"]} 条\n')
                f.write(f'  重复申报: {report["summary"]["duplicate"]} 条\n')
                f.write(f'\n工时统计:\n')
                f.write(f'  总申报工时: {report["summary"]["total_reported_hours"]} 小时\n')
                f.write(f'  总扣减工时: {report["summary"]["total_deduction_hours"]} 小时\n')
                f.write(f'  可结算工时: {report["summary"]["total_actual_hours"]} 小时\n')
                
                f.write('\n' + '-' * 70 + '\n')
                f.write('二、详细明细\n')
                f.write('-' * 70 + '\n')
                
                status_map = {
                    'passed': '通过',
                    'passed_with_deduction': '通过但扣减',
                    'failed': '验收失败',
                    'exception': '异常',
                    'duplicate': '重复申报'
                }
                
                for d in report['details']:
                    f.write(f'\n【{status_map.get(d["status"], d["status"])}】 {d["task_id"]} - {d["task_name"]}\n')
                    f.write(f'   申报人: {d["developer"]} | 申报日期: {d["submit_date"]}\n')
                    f.write(f'   工时变化: 申报 {d["reported_hours"]}h → 扣减 {d["deduction_hours"]}h → 可结算 {d["actual_hours"]}h\n')
                    if d['bases']:
                        f.write(f'   依据说明:\n')
                        for base in d['bases']:
                            f.write(f'      - {base}\n')
                
                if report['exceptions']:
                    f.write('\n' + '-' * 70 + '\n')
                    f.write('三、异常清单（需关注）\n')
                    f.write('-' * 70 + '\n')
                    for e in report['exceptions']:
                        f.write(f'\n【{status_map.get(e["status"], e["status"])}】 {e["task_id"]} - {e["task_name"]}\n')
                        f.write(f'   申报人: {e["developer"]}\n')
                        if e['bases']:
                            f.write(f'   问题说明:\n')
                            for base in e['bases']:
                                f.write(f'      - {base}\n')
                
                f.write('\n' + '=' * 70 + '\n')
                f.write('报告说明:\n')
                f.write('- 本报告用于供应商确认结算工时\n')
                f.write('- 如有疑问请联系项目负责人\n')
                f.write('=' * 70 + '\n')
            
            print(f'✓ 文本报告已导出: {text_file}')

def main():
    parser = argparse.ArgumentParser(
        description='外包工时验收 CLI - 管理外包工时的申报、验收和结算',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python outsourced_acceptance.py check          # 核对所有申报
  python outsourced_acceptance.py details        # 查看所有人员明细
  python outsourced_acceptance.py details --developer 张三  # 查看张三明细
  python outsourced_acceptance.py rework R001 8 "接口测试未通过"  # 标记返工
  python outsourced_acceptance.py confirm        # 确认可结算的申报
  python outsourced_acceptance.py export         # 导出结算报告
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    subparsers.add_parser('check', help='核对所有工时申报，显示处理结果')
    
    details_parser = subparsers.add_parser('details', help='查看人员明细')
    details_parser.add_argument('--developer', type=str, help='指定开发人员')
    
    rework_parser = subparsers.add_parser('rework', help='标记返工并扣减工时')
    rework_parser.add_argument('report_id', type=str, help='申报ID (如 R001)')
    rework_parser.add_argument('hours', type=float, help='扣减工时数')
    rework_parser.add_argument('reason', type=str, help='返工原因')
    
    subparsers.add_parser('confirm', help='确认所有通过的申报为已结算')
    
    export_parser = subparsers.add_parser('export', help='导出结算报告')
    export_parser.add_argument('--output', type=str, default='settlement_report.json', help='输出文件名')
    export_parser.add_argument('--format', type=str, default='text', help='输出格式')
    
    args = parser.parse_args()
    
    cli = CLI()
    
    if args.command == 'check':
        cli.cmd_check(args)
    elif args.command == 'details':
        cli.cmd_details(args)
    elif args.command == 'rework':
        cli.cmd_rework(args)
    elif args.command == 'confirm':
        cli.cmd_confirm(args)
    elif args.command == 'export':
        cli.cmd_export(args)

if __name__ == '__main__':
    main()
