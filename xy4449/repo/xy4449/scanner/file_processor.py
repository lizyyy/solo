from datetime import datetime, date
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple
import os
import re
import csv

import pandas as pd

from models import (
    WorkOrder, WorkOrderStatus,
    PaperStock,
    MaintenanceRecord, MaintenanceType, MaintenanceStatus,
    CuttingTemplate, CuttingSize
)
from config import settings


class FileType(str, Enum):
    PDF_ORDER = "pdf_order"
    CSV_STOCK = "csv_stock"
    CSV_MAINTENANCE = "csv_maintenance"
    CSV_TEMPLATE = "csv_template"
    UNKNOWN = "unknown"


class FileProcessor:
    def __init__(self):
        self.processed_files: set = set()
    
    def detect_file_type(self, file_path: str) -> FileType:
        file_name = os.path.basename(file_path).lower()
        
        if file_path.endswith('.pdf'):
            return FileType.PDF_ORDER
        
        if file_path.endswith('.csv'):
            if 'stock' in file_name or 'inventory' in file_name or 'paper' in file_name:
                return FileType.CSV_STOCK
            elif 'maintenance' in file_name or '保养' in file_name:
                return FileType.CSV_MAINTENANCE
            elif 'template' in file_name or 'template' in file_name or '裁切' in file_name:
                return FileType.CSV_TEMPLATE
            else:
                return self._detect_csv_content(file_path)
        
        return FileType.UNKNOWN
    
    def _detect_csv_content(self, file_path: str) -> FileType:
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                header = f.readline().lower()
                
                stock_keywords = ['paper', 'stock', 'quantity', '纸张', '库存', '数量']
                maintenance_keywords = ['machine', 'maintenance', 'scheduled', '机器', '保养', '日期']
                template_keywords = ['cutting', 'template', 'width', 'height', '裁切', '模板', '宽度']
                
                stock_count = sum(1 for kw in stock_keywords if kw in header)
                maintenance_count = sum(1 for kw in maintenance_keywords if kw in header)
                template_count = sum(1 for kw in template_keywords if kw in header)
                
                if stock_count >= 2:
                    return FileType.CSV_STOCK
                elif maintenance_count >= 2:
                    return FileType.CSV_MAINTENANCE
                elif template_count >= 2:
                    return FileType.CSV_TEMPLATE
        except Exception:
            pass
        
        return FileType.UNKNOWN
    
    def process_pdf_order(self, file_path: str) -> WorkOrder:
        file_name = os.path.basename(file_path)
        
        work_order = WorkOrder(
            file_name=file_name,
            file_path=file_path,
            status=WorkOrderStatus.PENDING
        )
        
        customer_name, job_name, quantity = self._extract_info_from_filename(file_name)
        work_order.customer_name = customer_name
        work_order.job_name = job_name
        work_order.quantity = quantity
        
        work_order.add_note(f"文件已添加到处理队列: {file_name}")
        
        return work_order
    
    def _extract_info_from_filename(self, filename: str) -> Tuple[Optional[str], Optional[str], Optional[int]]:
        customer_name = None
        job_name = None
        quantity = None
        
        name_without_ext = os.path.splitext(filename)[0]
        
        quantity_match = re.search(r'(\d+)\s*张|\((\d+)\)|x(\d+)', name_without_ext, re.IGNORECASE)
        if quantity_match:
            for g in quantity_match.groups():
                if g:
                    quantity = int(g)
                    break
        
        parts = re.split(r'[-_#\s]+', name_without_ext)
        if len(parts) >= 2:
            customer_name = parts[0]
            job_name = '_'.join(parts[1:])
        
        return customer_name, job_name, quantity
    
    def process_csv_stock(self, file_path: str) -> List[PaperStock]:
        stocks = []
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            df.columns = [col.strip().lower() for col in df.columns]
            
            for idx, row in df.iterrows():
                stock_id = self._get_value(row, ['id', '编号', 'stock_id']) or f"STK{idx+1:03d}"
                
                paper_type = self._get_value(row, ['paper_type', '纸张类型', 'type', '类型'])
                if not paper_type:
                    continue
                
                stock = PaperStock(
                    id=str(stock_id),
                    paper_type=str(paper_type),
                    paper_size=self._get_value(row, ['paper_size', '尺寸', 'size']),
                    paper_width=self._get_float_value(row, ['width', '宽度', 'paper_width']),
                    paper_height=self._get_float_value(row, ['height', '高度', 'paper_height']),
                    quantity=self._get_int_value(row, ['quantity', '数量', '库存数量', 'stock']),
                    minimum_threshold=self._get_int_value(row, ['threshold', '警戒线', 'min_threshold'], default=100),
                    supplier=self._get_value(row, ['supplier', '供应商', 'vendor']),
                    location=self._get_value(row, ['location', '库位', '位置'])
                )
                
                stocks.append(stock)
        except Exception as e:
            print(f"处理库存CSV时出错: {e}")
        
        return stocks
    
    def process_csv_maintenance(self, file_path: str) -> List[MaintenanceRecord]:
        records = []
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            df.columns = [col.strip().lower() for col in df.columns]
            
            for idx, row in df.iterrows():
                record_id = self._get_value(row, ['id', '编号', 'maintenance_id']) or f"MT{idx+1:03d}"
                
                scheduled_date = self._parse_date(self._get_value(row, ['date', '日期', 'scheduled_date', '计划日期']))
                if not scheduled_date:
                    continue
                
                machine_id = self._get_value(row, ['machine_id', '机器编号', '设备编号']) or f"M{idx+1:02d}"
                machine_name = self._get_value(row, ['machine_name', '机器名称', '设备名称', 'machine']) or "未知设备"
                
                maintenance_type = self._parse_maintenance_type(
                    self._get_value(row, ['type', '类型', 'maintenance_type', '保养类型'])
                )
                
                status = self._parse_maintenance_status(
                    self._get_value(row, ['status', '状态'])
                )
                
                record = MaintenanceRecord(
                    id=str(record_id),
                    machine_id=str(machine_id),
                    machine_name=str(machine_name),
                    maintenance_type=maintenance_type,
                    status=status,
                    scheduled_date=scheduled_date,
                    scheduled_start_time=self._get_value(row, ['start_time', '开始时间']),
                    scheduled_end_time=self._get_value(row, ['end_time', '结束时间']),
                    technician=self._get_value(row, ['technician', '技术员', '负责人']),
                    description=self._get_value(row, ['description', '描述', '内容', '备注']) or "常规保养"
                )
                
                records.append(record)
        except Exception as e:
            print(f"处理保养CSV时出错: {e}")
        
        return records
    
    def process_csv_template(self, file_path: str) -> List[CuttingTemplate]:
        templates = []
        
        try:
            df = pd.read_csv(file_path, encoding='utf-8-sig')
            df.columns = [col.strip().lower() for col in df.columns]
            
            template_groups = {}
            for idx, row in df.iterrows():
                template_id = self._get_value(row, ['template_id', '模板编号', 'id']) or f"TMP{idx+1:03d}"
                
                if template_id not in template_groups:
                    template_groups[template_id] = {
                        'row': row,
                        'cuttings': []
                    }
                
                cutting_width = self._get_float_value(row, ['cut_width', '裁切宽度', '成品宽度'])
                cutting_height = self._get_float_value(row, ['cut_height', '裁切高度', '成品高度'])
                cutting_quantity = self._get_int_value(row, ['cut_quantity', '裁切数量', '成品数量'], default=1)
                
                if cutting_width and cutting_height:
                    template_groups[template_id]['cuttings'].append(
                        CuttingSize(
                            width=cutting_width,
                            height=cutting_height,
                            quantity=cutting_quantity
                        )
                    )
            
            for template_id, data in template_groups.items():
                row = data['row']
                
                template = CuttingTemplate(
                    id=str(template_id),
                    name=self._get_value(row, ['name', '名称', 'template_name']) or f"模板 {template_id}",
                    description=self._get_value(row, ['description', '描述', '说明']),
                    paper_width=self._get_float_value(row, ['paper_width', '纸张宽度', '原纸宽度'], default=0),
                    paper_height=self._get_float_value(row, ['paper_height', '纸张高度', '原纸高度'], default=0),
                    cuttings=data['cuttings'],
                    total_sheets_required=self._get_int_value(row, ['sheets_required', '所需张数'], default=1),
                    tags=self._parse_tags(self._get_value(row, ['tags', '标签'])),
                    machine_compatible=self._parse_machine_list(self._get_value(row, ['machines', '适用机器', '兼容机器']))
                )
                
                template.calculate_total_pieces()
                template.calculate_waste()
                
                templates.append(template)
        except Exception as e:
            print(f"处理模板CSV时出错: {e}")
        
        return templates
    
    def _get_value(self, row, keys: List[str], default=None):
        for key in keys:
            if key in row.index and pd.notna(row[key]):
                return str(row[key]).strip()
        return default
    
    def _get_int_value(self, row, keys: List[str], default: int = 0) -> int:
        value = self._get_value(row, keys)
        if value:
            try:
                return int(float(value))
            except ValueError:
                pass
        return default
    
    def _get_float_value(self, row, keys: List[str], default: float = 0) -> float:
        value = self._get_value(row, keys)
        if value:
            try:
                return float(value)
            except ValueError:
                pass
        return default
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        if not date_str:
            return None
        
        date_formats = ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y', '%Y%m%d']
        
        for fmt in date_formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt).date()
            except ValueError:
                continue
        
        return None
    
    def _parse_maintenance_type(self, type_str: Optional[str]) -> MaintenanceType:
        if not type_str:
            return MaintenanceType.PREVENTIVE
        
        type_lower = str(type_str).lower()
        
        if 'preventive' in type_lower or '预防' in type_lower or '定期' in type_lower:
            return MaintenanceType.PREVENTIVE
        elif 'corrective' in type_lower or '修复' in type_lower or '故障' in type_lower:
            return MaintenanceType.CORRECTIVE
        elif 'inspection' in type_lower or '检查' in type_lower or '检验' in type_lower:
            return MaintenanceType.INSPECTION
        elif 'calibration' in type_lower or '校准' in type_lower:
            return MaintenanceType.CALIBRATION
        
        return MaintenanceType.PREVENTIVE
    
    def _parse_maintenance_status(self, status_str: Optional[str]) -> MaintenanceStatus:
        if not status_str:
            return MaintenanceStatus.SCHEDULED
        
        status_lower = str(status_str).lower()
        
        if 'scheduled' in status_lower or '计划' in status_lower or '待执行' in status_lower:
            return MaintenanceStatus.SCHEDULED
        elif 'progress' in status_lower or '进行' in status_lower or '执行中' in status_lower:
            return MaintenanceStatus.IN_PROGRESS
        elif 'completed' in status_lower or '完成' in status_lower or '已完成' in status_lower:
            return MaintenanceStatus.COMPLETED
        elif 'cancelled' in status_lower or '取消' in status_lower:
            return MaintenanceStatus.CANCELLED
        
        return MaintenanceStatus.SCHEDULED
    
    def _parse_tags(self, tags_str: Optional[str]) -> List[str]:
        if not tags_str:
            return []
        
        separators = [',', ';', '|', '，', '；']
        for sep in separators:
            if sep in tags_str:
                return [t.strip() for t in tags_str.split(sep) if t.strip()]
        
        return [tags_str.strip()]
    
    def _parse_machine_list(self, machines_str: Optional[str]) -> List[str]:
        return self._parse_tags(machines_str)
    
    def mark_processed(self, file_path: str):
        self.processed_files.add(file_path)
    
    def is_processed(self, file_path: str) -> bool:
        return file_path in self.processed_files
