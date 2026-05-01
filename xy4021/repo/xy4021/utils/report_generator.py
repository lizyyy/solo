from typing import List, Dict, Optional
from datetime import datetime

from dao.package_dao import PackageDAO
from dao.cycle_dao import CycleDAO
from dao.package_template_dao import PackageTemplateDAO
from business.state_machine import PackageStatus, CycleStatus


class ReportGenerator:
    @staticmethod
    def generate_inventory_report() -> Dict:
        packages = PackageDAO.get_all()
        status_counts = PackageDAO.count_by_status()
        
        templates = PackageTemplateDAO.get_all()
        template_counts = {}
        
        for t in templates:
            count = sum(1 for p in packages if p['template_id'] == t['id'])
            template_counts[t['name']] = count
        
        return {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'total_packages': len(packages),
            'status_distribution': status_counts,
            'template_distribution': template_counts,
            'packages': packages
        }

    @staticmethod
    def generate_cycle_report(cycle_id: int) -> Optional[Dict]:
        cycle = CycleDAO.get_by_id(cycle_id)
        if not cycle:
            return None
        
        packages = CycleDAO.get_cycle_packages_history(cycle_id)
        active_packages = PackageDAO.get_by_cycle(cycle_id)
        
        status_summary = {}
        for pkg in packages:
            status = pkg.get('status', '未知')
            status_summary[status] = status_summary.get(status, 0) + 1
        
        return {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'cycle': cycle,
            'total_packages': len(packages),
            'active_packages': len(active_packages),
            'status_summary': status_summary,
            'packages': packages
        }

    @staticmethod
    def generate_traceability_report(package_number: str = None, package_id: int = None) -> Optional[Dict]:
        if package_id:
            package = PackageDAO.get_by_id(package_id)
        elif package_number:
            package = PackageDAO.get_by_number(package_number)
        else:
            return None
        
        if not package:
            return None
        
        history = PackageDAO.get_status_history(package['id'])
        
        cycles = []
        for record in history:
            if record.get('cycle_id'):
                cycle = CycleDAO.get_by_id(record['cycle_id'])
                if cycle:
                    cycles.append({
                        'cycle': cycle,
                        'status_change': record
                    })
        
        return {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'package': package,
            'status_history': history,
            'related_cycles': cycles,
            'cycle_count': len(cycles)
        }

    @staticmethod
    def generate_failed_cycles_report() -> Dict:
        failed_cycles = CycleDAO.get_by_status(CycleStatus.FAILED.value)
        
        cycles_with_details = []
        total_isolated = 0
        
        for cycle in failed_cycles:
            packages = CycleDAO.get_cycle_packages_history(cycle['id'])
            isolated_packages = [
                p for p in packages 
                if p.get('status') == PackageStatus.ISOLATED.value
            ]
            total_isolated += len(isolated_packages)
            
            cycles_with_details.append({
                'cycle': cycle,
                'total_packages': len(packages),
                'isolated_packages': len(isolated_packages),
                'packages': packages
            })
        
        return {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'total_failed_cycles': len(failed_cycles),
            'total_isolated_packages': total_isolated,
            'failed_cycles': cycles_with_details
        }

    @staticmethod
    def generate_daily_summary_report(date: str = None) -> Dict:
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        all_cycles = CycleDAO.get_all()
        day_cycles = [
            c for c in all_cycles 
            if c.get('created_at', '').startswith(date)
        ]
        
        all_packages = PackageDAO.get_all()
        day_packages = [
            p for p in all_packages
            if p.get('created_at', '').startswith(date)
        ]
        
        status_counts = PackageDAO.count_by_status()
        
        return {
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'report_date': date,
            'cycles_created': len(day_cycles),
            'packages_created': len(day_packages),
            'current_inventory': status_counts,
            'cycles': day_cycles,
            'new_packages': day_packages
        }

    @staticmethod
    def format_report_text(report_data: Dict, report_type: str) -> str:
        lines = []
        lines.append('=' * 60)
        lines.append(f'器械包追踪系统 - {report_type}')
        lines.append(f'生成时间: {report_data.get("generated_at", "")}')
        lines.append('=' * 60)
        lines.append('')
        
        if report_type == '库存报告':
            lines.append(f'总计器械包数量: {report_data.get("total_packages", 0)}')
            lines.append('')
            lines.append('状态分布:')
            for status, count in report_data.get('status_distribution', {}).items():
                lines.append(f'  {status}: {count}')
            lines.append('')
            lines.append('模板分布:')
            for template, count in report_data.get('template_distribution', {}).items():
                lines.append(f'  {template}: {count}')
        
        elif report_type == '锅次报告':
            cycle = report_data.get('cycle', {})
            lines.append(f'锅次编号: {cycle.get("cycle_number", "")}')
            lines.append(f'灭菌锅号: {cycle.get("autoclave_id", "")}')
            lines.append(f'操作人: {cycle.get("operator", "")}')
            lines.append(f'状态: {cycle.get("status", "")}')
            lines.append(f'开始时间: {cycle.get("start_time", "")}')
            lines.append(f'结束时间: {cycle.get("end_time", "")}')
            lines.append(f'温度: {cycle.get("temperature", "")}')
            lines.append(f'压力: {cycle.get("pressure", "")}')
            lines.append(f'生物指示: {cycle.get("biological_indicator", "")}')
            lines.append(f'化学指示: {cycle.get("chemical_indicator", "")}')
            if cycle.get('failure_reason'):
                lines.append(f'失败原因: {cycle.get("failure_reason", "")}')
            lines.append('')
            lines.append(f'器械包总数: {report_data.get("total_packages", 0)}')
            lines.append(f'当前在锅次中: {report_data.get("active_packages", 0)}')
        
        elif report_type == '追溯报告':
            pkg = report_data.get('package', {})
            lines.append(f'器械包编号: {pkg.get("package_number", "")}')
            lines.append(f'模板类型: {pkg.get("template_name", "")}')
            lines.append(f'当前状态: {pkg.get("status", "")}')
            lines.append(f'创建时间: {pkg.get("created_at", "")}')
            lines.append('')
            lines.append(f'相关锅次数量: {report_data.get("cycle_count", 0)}')
            lines.append('')
            lines.append('状态历史:')
            for record in report_data.get('status_history', []):
                from_status = record.get('from_status') or '无'
                lines.append(f'  {record.get("changed_at", "")}: {from_status} -> {record.get("to_status", "")}')
                if record.get('reason'):
                    lines.append(f'    原因: {record.get("reason", "")}')
        
        elif report_type == '失败锅次报告':
            lines.append(f'失败锅次总数: {report_data.get("total_failed_cycles", 0)}')
            lines.append(f'已隔离器械包总数: {report_data.get("total_isolated_packages", 0)}')
            lines.append('')
            for cycle_detail in report_data.get('failed_cycles', []):
                cycle = cycle_detail.get('cycle', {})
                lines.append(f'锅次: {cycle.get("cycle_number", "")}')
                lines.append(f'  失败原因: {cycle.get("failure_reason", "")}')
                lines.append(f'  器械包数: {cycle_detail.get("total_packages", 0)}')
                lines.append(f'  已隔离: {cycle_detail.get("isolated_packages", 0)}')
                lines.append('')
        
        elif report_type == '每日汇总报告':
            lines.append(f'报告日期: {report_data.get("report_date", "")}')
            lines.append(f'新建锅次: {report_data.get("cycles_created", 0)}')
            lines.append(f'新建器械包: {report_data.get("packages_created", 0)}')
            lines.append('')
            lines.append('当前库存状态:')
            for status, count in report_data.get("current_inventory", {}).items():
                lines.append(f'  {status}: {count}')
        
        lines.append('')
        lines.append('=' * 60)
        lines.append('报告结束')
        lines.append('=' * 60)
        
        return '\n'.join(lines)
