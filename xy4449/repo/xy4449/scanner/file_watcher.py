import asyncio
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from pathlib import Path

from config import settings
from scanner.file_processor import FileProcessor, FileType
from models import (
    WorkOrder, WorkOrderStatus,
    PaperStock,
    MaintenanceRecord,
    CuttingTemplate,
    PreflightResult
)


class ScannerConfig:
    def __init__(
        self,
        scan_interval: int = 10,
        input_dir: Optional[str] = None,
        process_on_start: bool = True
    ):
        self.scan_interval = scan_interval
        self.input_dir = input_dir or settings.INPUT_DIR
        self.process_on_start = process_on_start


class FileScanner:
    def __init__(self, config: Optional[ScannerConfig] = None):
        self.config = config or ScannerConfig()
        self.processor = FileProcessor()
        
        self.work_orders: Dict[str, WorkOrder] = {}
        self.paper_stocks: Dict[str, PaperStock] = {}
        self.maintenance_records: Dict[str, MaintenanceRecord] = {}
        self.cutting_templates: Dict[str, CuttingTemplate] = {}
        self.preflight_results: Dict[str, PreflightResult] = {}
        
        self._running = False
        self._scan_task: Optional[asyncio.Task] = None
        
        self.on_new_order: Optional[Callable[[WorkOrder], None]] = None
        self.on_stock_updated: Optional[Callable[[List[PaperStock]], None]] = None
        self.on_maintenance_updated: Optional[Callable[[List[MaintenanceRecord]], None]] = None
        self.on_template_updated: Optional[Callable[[List[CuttingTemplate]], None]] = None
    
    async def start(self):
        self._running = True
        
        if self.config.process_on_start:
            await self.scan_once()
        
        while self._running:
            await asyncio.sleep(self.config.scan_interval)
            if self._running:
                await self.scan_once()
    
    def stop(self):
        self._running = False
    
    async def scan_once(self):
        input_dir = Path(self.config.input_dir)
        
        if not input_dir.exists():
            return
        
        files_to_process = []
        for file_path in input_dir.iterdir():
            if file_path.is_file() and not self.processor.is_processed(str(file_path)):
                files_to_process.append(str(file_path))
        
        for file_path in files_to_process:
            await self.process_file(file_path)
    
    async def process_file(self, file_path: str):
        file_type = self.processor.detect_file_type(file_path)
        
        if file_type == FileType.PDF_ORDER:
            await self._process_pdf_order(file_path)
        elif file_type == FileType.CSV_STOCK:
            await self._process_csv_stock(file_path)
        elif file_type == FileType.CSV_MAINTENANCE:
            await self._process_csv_maintenance(file_path)
        elif file_type == FileType.CSV_TEMPLATE:
            await self._process_csv_template(file_path)
        
        self.processor.mark_processed(file_path)
    
    async def _process_pdf_order(self, file_path: str):
        work_order = self.processor.process_pdf_order(file_path)
        
        if work_order.id in self.work_orders:
            existing = self.work_orders[work_order.id]
            existing.add_note(f"文件已更新: {os.path.basename(file_path)}")
            existing.file_path = file_path
            existing.status = WorkOrderStatus.PENDING
            existing.update_timestamp()
        else:
            self.work_orders[work_order.id] = work_order
        
        if self.on_new_order:
            self.on_new_order(work_order)
    
    async def _process_csv_stock(self, file_path: str):
        stocks = self.processor.process_csv_stock(file_path)
        
        for stock in stocks:
            if stock.id in self.paper_stocks:
                existing = self.paper_stocks[stock.id]
                if existing.quantity != stock.quantity:
                    existing.add_note(f"库存更新: {existing.quantity} -> {stock.quantity}")
                existing.quantity = stock.quantity
                existing.updated_at = datetime.now()
            else:
                self.paper_stocks[stock.id] = stock
        
        if self.on_stock_updated:
            self.on_stock_updated(list(self.paper_stocks.values()))
    
    async def _process_csv_maintenance(self, file_path: str):
        records = self.processor.process_csv_maintenance(file_path)
        
        for record in records:
            self.maintenance_records[record.id] = record
        
        if self.on_maintenance_updated:
            self.on_maintenance_updated(list(self.maintenance_records.values()))
    
    async def _process_csv_template(self, file_path: str):
        templates = self.processor.process_csv_template(file_path)
        
        for template in templates:
            self.cutting_templates[template.id] = template
        
        if self.on_template_updated:
            self.on_template_updated(list(self.cutting_templates.values()))
    
    def get_work_order(self, order_id: str) -> Optional[WorkOrder]:
        return self.work_orders.get(order_id)
    
    def get_all_work_orders(self) -> List[WorkOrder]:
        return list(self.work_orders.values())
    
    def get_paper_stock(self, stock_id: str) -> Optional[PaperStock]:
        return self.paper_stocks.get(stock_id)
    
    def get_all_paper_stocks(self) -> List[PaperStock]:
        return list(self.paper_stocks.values())
    
    def get_maintenance_record(self, record_id: str) -> Optional[MaintenanceRecord]:
        return self.maintenance_records.get(record_id)
    
    def get_all_maintenance_records(self) -> List[MaintenanceRecord]:
        return list(self.maintenance_records.values())
    
    def get_cutting_template(self, template_id: str) -> Optional[CuttingTemplate]:
        return self.cutting_templates.get(template_id)
    
    def get_all_cutting_templates(self) -> List[CuttingTemplate]:
        return list(self.cutting_templates.values())
    
    def add_preflight_result(self, result: PreflightResult):
        self.preflight_results[result.id] = result
    
    def get_preflight_result(self, result_id: str) -> Optional[PreflightResult]:
        return self.preflight_results.get(result_id)
    
    def get_preflight_results_for_order(self, order_id: str) -> List[PreflightResult]:
        return [
            r for r in self.preflight_results.values()
            if r.work_order_id == order_id
        ]
    
    def get_active_maintenance(self) -> List[MaintenanceRecord]:
        return [
            r for r in self.maintenance_records.values()
            if r.is_active or r.is_scheduled_for_today
        ]
    
    def get_low_stock_items(self) -> List[PaperStock]:
        return [
            s for s in self.paper_stocks.values()
            if s.is_low
        ]
