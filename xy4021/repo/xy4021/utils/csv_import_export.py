import csv
import os
from typing import List, Dict, Tuple, Optional
from datetime import datetime

from dao.package_template_dao import PackageTemplateDAO
from dao.package_dao import PackageDAO
from dao.cycle_dao import CycleDAO


class CSVImporter:
    REQUIRED_FIELDS = ['package_number', 'template_name']
    OPTIONAL_FIELDS = ['notes']

    @staticmethod
    def import_packages(file_path: str) -> Tuple[int, int, List[str]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f'文件不存在: {file_path}')
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            missing_fields = [field for field in CSVImporter.REQUIRED_FIELDS if field not in reader.fieldnames]
            if missing_fields:
                raise ValueError(f'CSV文件缺少必需字段: {", ".join(missing_fields)}')
            
            templates = {t['name']: t['id'] for t in PackageTemplateDAO.get_all()}
            
            for row_num, row in enumerate(reader, start=2):
                package_number = row.get('package_number', '').strip()
                template_name = row.get('template_name', '').strip()
                notes = row.get('notes', '').strip() or None
                
                if not package_number:
                    errors.append(f'第{row_num}行: 器械包编号为空')
                    skipped_count += 1
                    continue
                
                if not template_name:
                    errors.append(f'第{row_num}行: 模板名称为空')
                    skipped_count += 1
                    continue
                
                if template_name not in templates:
                    errors.append(f'第{row_num}行: 模板 "{template_name}" 不存在')
                    skipped_count += 1
                    continue
                
                existing = PackageDAO.get_by_number(package_number)
                if existing:
                    errors.append(f'第{row_num}行: 器械包编号 "{package_number}" 已存在')
                    skipped_count += 1
                    continue
                
                try:
                    PackageDAO.create(
                        template_id=templates[template_name],
                        package_number=package_number,
                        notes=notes
                    )
                    imported_count += 1
                except Exception as e:
                    errors.append(f'第{row_num}行: 导入失败 - {str(e)}')
                    skipped_count += 1
        
        return imported_count, skipped_count, errors


class CSVExporter:
    @staticmethod
    def export_inventory(file_path: str, status_filter: str = None) -> int:
        if status_filter:
            packages = PackageDAO.get_by_status(status_filter)
        else:
            packages = PackageDAO.get_all()
        
        fieldnames = [
            'id', 'package_number', 'template_name', 'status',
            'current_cycle_id', 'notes', 'created_at', 'updated_at'
        ]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for pkg in packages:
                writer.writerow({
                    'id': pkg.get('id', ''),
                    'package_number': pkg.get('package_number', ''),
                    'template_name': pkg.get('template_name', ''),
                    'status': pkg.get('status', ''),
                    'current_cycle_id': pkg.get('current_cycle_id', ''),
                    'notes': pkg.get('notes', ''),
                    'created_at': pkg.get('created_at', ''),
                    'updated_at': pkg.get('updated_at', '')
                })
        
        return len(packages)

    @staticmethod
    def export_cycle_traceability(file_path: str, cycle_id: int = None) -> int:
        if cycle_id:
            cycles = [CycleDAO.get_by_id(cycle_id)]
            if not cycles[0]:
                raise ValueError(f'锅次不存在: {cycle_id}')
        else:
            cycles = CycleDAO.get_all()
        
        fieldnames = [
            'cycle_id', 'cycle_number', 'autoclave_id', 'operator',
            'start_time', 'end_time', 'temperature', 'pressure',
            'biological_indicator', 'chemical_indicator', 'cycle_status',
            'failure_reason', 'package_id', 'package_number', 'template_name',
            'package_status', 'added_to_cycle_at', 'removed_from_cycle_at',
            'removal_reason'
        ]
        
        total_rows = 0
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for cycle in cycles:
                if not cycle:
                    continue
                
                packages = CycleDAO.get_cycle_packages_history(cycle['id'])
                
                for pkg in packages:
                    writer.writerow({
                        'cycle_id': cycle.get('id', ''),
                        'cycle_number': cycle.get('cycle_number', ''),
                        'autoclave_id': cycle.get('autoclave_id', ''),
                        'operator': cycle.get('operator', ''),
                        'start_time': cycle.get('start_time', ''),
                        'end_time': cycle.get('end_time', ''),
                        'temperature': cycle.get('temperature', ''),
                        'pressure': cycle.get('pressure', ''),
                        'biological_indicator': cycle.get('biological_indicator', ''),
                        'chemical_indicator': cycle.get('chemical_indicator', ''),
                        'cycle_status': cycle.get('status', ''),
                        'failure_reason': cycle.get('failure_reason', ''),
                        'package_id': pkg.get('package_id', ''),
                        'package_number': pkg.get('package_number', ''),
                        'template_name': pkg.get('template_name', ''),
                        'package_status': pkg.get('status', ''),
                        'added_to_cycle_at': pkg.get('added_at', ''),
                        'removed_from_cycle_at': pkg.get('removed_at', ''),
                        'removal_reason': pkg.get('removal_reason', '')
                    })
                    total_rows += 1
        
        return total_rows

    @staticmethod
    def export_package_history(file_path: str, package_id: int) -> int:
        package = PackageDAO.get_by_id(package_id)
        if not package:
            raise ValueError(f'器械包不存在: {package_id}')
        
        history = PackageDAO.get_status_history(package_id)
        
        fieldnames = [
            'history_id', 'package_number', 'template_name', 'cycle_id',
            'cycle_number', 'from_status', 'to_status', 'changed_at',
            'operator', 'reason', 'notes'
        ]
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for record in history:
                writer.writerow({
                    'history_id': record.get('id', ''),
                    'package_number': package.get('package_number', ''),
                    'template_name': package.get('template_name', ''),
                    'cycle_id': record.get('cycle_id', ''),
                    'cycle_number': record.get('cycle_number', ''),
                    'from_status': record.get('from_status', ''),
                    'to_status': record.get('to_status', ''),
                    'changed_at': record.get('changed_at', ''),
                    'operator': record.get('operator', ''),
                    'reason': record.get('reason', ''),
                    'notes': record.get('notes', '')
                })
        
        return len(history)
