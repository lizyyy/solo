import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from src.storage.database import DAOFactory
from src.models.models import (
    Team, Material, BorrowRecord, BorrowItem,
    MaterialStatus, ReturnStatus
)
from src.storage.undo_manager import UndoManager, EntityType, OperationType


@dataclass
class ImportResult:
    success: bool
    total_count: int = 0
    imported_count: int = 0
    skipped_count: int = 0
    errors: List[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.warnings is None:
            self.warnings = []


class CSVImporter:
    def __init__(self):
        self.dao_factory = DAOFactory
        self.undo_manager = UndoManager()
    
    def import_materials(self, file_path: str) -> ImportResult:
        result = ImportResult(success=False)
        path = Path(file_path)
        
        if not path.exists():
            result.errors.append(f"文件不存在: {file_path}")
            return result
        
        material_dao = self.dao_factory.get_material_dao()
        
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            result.total_count = len(rows)
            
            for row_num, row in enumerate(rows, 1):
                try:
                    barcode = self._get_value(row, ['barcode', '条形码', '物资编号'])
                    if not barcode:
                        result.warnings.append(f"第 {row_num} 行: 缺少条形码，跳过")
                        result.skipped_count += 1
                        continue
                    
                    existing = material_dao.get_by_barcode(barcode)
                    if existing:
                        result.warnings.append(f"第 {row_num} 行: 条形码 {barcode} 已存在，跳过")
                        result.skipped_count += 1
                        continue
                    
                    material_type = self._get_value(row, ['material_type', '类型', '物资类型']) or '未知类型'
                    material_name = self._get_value(row, ['material_name', '名称', '物资名称', 'name']) or '未知物资'
                    specification = self._get_value(row, ['specification', '规格', '型号'])
                    
                    weight_str = self._get_value(row, ['weight_kg', '重量', '重量(kg)'])
                    try:
                        weight_kg = float(weight_str) if weight_str else 0.0
                    except ValueError:
                        weight_kg = 0.0
                    
                    description = self._get_value(row, ['description', '描述', '备注'])
                    
                    material = material_dao.create(
                        barcode=barcode,
                        material_type=material_type,
                        material_name=material_name,
                        specification=specification,
                        weight_kg=weight_kg,
                        status=MaterialStatus.AVAILABLE,
                        description=description
                    )
                    
                    self.undo_manager.log_create(EntityType.MATERIAL, material)
                    result.imported_count += 1
                    
                except Exception as e:
                    result.errors.append(f"第 {row_num} 行: {str(e)}")
                    result.skipped_count += 1
            
            result.success = True
            return result
            
        except Exception as e:
            result.errors.append(f"文件读取失败: {str(e)}")
            return result
    
    def import_teams(self, file_path: str) -> ImportResult:
        result = ImportResult(success=False)
        path = Path(file_path)
        
        if not path.exists():
            result.errors.append(f"文件不存在: {file_path}")
            return result
        
        team_dao = self.dao_factory.get_team_dao()
        
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            result.total_count = len(rows)
            
            for row_num, row in enumerate(rows, 1):
                try:
                    team_code = self._get_value(row, ['team_code', '队伍编号', '志愿队编号'])
                    if not team_code:
                        result.warnings.append(f"第 {row_num} 行: 缺少队伍编号，跳过")
                        result.skipped_count += 1
                        continue
                    
                    existing = team_dao.get_by_code(team_code)
                    if existing:
                        result.warnings.append(f"第 {row_num} 行: 队伍编号 {team_code} 已存在，跳过")
                        result.skipped_count += 1
                        continue
                    
                    team_name = self._get_value(row, ['team_name', '队伍名称', '志愿队名称', '名称']) or f"队伍{team_code}"
                    booth_number = self._get_value(row, ['booth_number', '摊位号', '摊位编号'])
                    contact_person = self._get_value(row, ['contact_person', '联系人', '负责人'])
                    contact_phone = self._get_value(row, ['contact_phone', '联系电话', '电话'])
                    
                    team = team_dao.create(
                        team_code=team_code,
                        team_name=team_name,
                        booth_number=booth_number,
                        contact_person=contact_person,
                        contact_phone=contact_phone
                    )
                    
                    self.undo_manager.log_create(EntityType.TEAM, team)
                    result.imported_count += 1
                    
                except Exception as e:
                    result.errors.append(f"第 {row_num} 行: {str(e)}")
                    result.skipped_count += 1
            
            result.success = True
            return result
            
        except Exception as e:
            result.errors.append(f"文件读取失败: {str(e)}")
            return result
    
    def import_borrow_records(self, file_path: str) -> ImportResult:
        result = ImportResult(success=False)
        path = Path(file_path)
        
        if not path.exists():
            result.errors.append(f"文件不存在: {file_path}")
            return result
        
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        team_dao = self.dao_factory.get_team_dao()
        material_dao = self.dao_factory.get_material_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            result.total_count = len(rows)
            
            for row_num, row in enumerate(rows, 1):
                try:
                    borrow_code = self._get_value(row, ['borrow_code', '借出编号', '借出单号'])
                    team_code = self._get_value(row, ['team_code', '队伍编号', '志愿队编号'])
                    
                    if not borrow_code:
                        result.warnings.append(f"第 {row_num} 行: 缺少借出编号，跳过")
                        result.skipped_count += 1
                        continue
                    
                    if not team_code:
                        result.warnings.append(f"第 {row_num} 行: 缺少队伍编号，跳过")
                        result.skipped_count += 1
                        continue
                    
                    existing = borrow_dao.get_by_code(borrow_code)
                    if existing:
                        result.warnings.append(f"第 {row_num} 行: 借出编号 {borrow_code} 已存在，跳过")
                        result.skipped_count += 1
                        continue
                    
                    team = team_dao.get_by_code(team_code)
                    if not team:
                        result.warnings.append(f"第 {row_num} 行: 队伍编号 {team_code} 不存在，跳过")
                        result.skipped_count += 1
                        continue
                    
                    borrow_date = self._parse_datetime(
                        self._get_value(row, ['borrow_date', '借出日期', '借出时间'])
                    ) or datetime.now()
                    
                    expected_return_date = self._parse_datetime(
                        self._get_value(row, ['expected_return_date', '预计归还日期', '预计归还时间'])
                    )
                    
                    deposit_str = self._get_value(row, ['deposit_amount', '押金金额', '押金'])
                    try:
                        deposit_amount = float(deposit_str) if deposit_str else 0.0
                    except ValueError:
                        deposit_amount = 0.0
                    
                    deposit_slip_code = self._get_value(row, ['deposit_slip_code', '押金条编号', '押金单号'])
                    borrower_name = self._get_value(row, ['borrower_name', '借出人', '经办人'])
                    
                    barcodes_str = self._get_value(row, ['barcodes', '物资条形码', '条形码', '物资编号'])
                    barcodes = [b.strip() for b in barcodes_str.split(',') if b.strip()] if barcodes_str else []
                    
                    borrow_record = borrow_dao.create(
                        borrow_code=borrow_code,
                        team_id=team.id,
                        borrow_date=borrow_date,
                        expected_return_date=expected_return_date,
                        deposit_amount=deposit_amount,
                        deposit_slip_code=deposit_slip_code,
                        borrower_name=borrower_name,
                        status=ReturnStatus.PENDING
                    )
                    
                    self.undo_manager.log_create(EntityType.BORROW_RECORD, borrow_record)
                    
                    material_count = 0
                    for barcode in barcodes:
                        material = material_dao.get_by_barcode(barcode)
                        if material:
                            borrow_item = borrow_item_dao.create(
                                borrow_record_id=borrow_record.id,
                                material_id=material.id,
                                quantity=1,
                                returned_quantity=0,
                                is_returned=False
                            )
                            material_dao.update_status(material.id, MaterialStatus.BORROWED)
                            material_count += 1
                        else:
                            result.warnings.append(f"第 {row_num} 行: 物资条形码 {barcode} 不存在")
                    
                    result.imported_count += 1
                    if material_count > 0:
                        result.warnings.append(f"第 {row_num} 行: 成功添加 {material_count} 件借出物资")
                    
                except Exception as e:
                    result.errors.append(f"第 {row_num} 行: {str(e)}")
                    result.skipped_count += 1
            
            result.success = True
            return result
            
        except Exception as e:
            result.errors.append(f"文件读取失败: {str(e)}")
            return result
    
    def _get_value(self, row: Dict[str, str], keys: List[str]) -> Optional[str]:
        for key in keys:
            if key in row:
                value = row[key].strip()
                if value:
                    return value
            lower_key = key.lower()
            if lower_key in row:
                value = row[lower_key].strip()
                if value:
                    return value
        return None
    
    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        
        return None


class JSONLImporter:
    def __init__(self):
        self.dao_factory = DAOFactory
        self.undo_manager = UndoManager()
    
    def import_field_records(self, file_path: str) -> ImportResult:
        result = ImportResult(success=False)
        path = Path(file_path)
        
        if not path.exists():
            result.errors.append(f"文件不存在: {file_path}")
            return result
        
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        team_dao = self.dao_factory.get_team_dao()
        material_dao = self.dao_factory.get_material_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            result.total_count = len(lines)
            
            for line_num, line in enumerate(lines, 1):
                try:
                    line = line.strip()
                    if not line:
                        continue
                    
                    data = json.loads(line)
                    
                    borrow_code = data.get('borrow_code') or data.get('借出编号')
                    team_code = data.get('team_code') or data.get('队伍编号')
                    
                    if not borrow_code:
                        result.warnings.append(f"第 {line_num} 行: 缺少借出编号，跳过")
                        result.skipped_count += 1
                        continue
                    
                    if not team_code:
                        result.warnings.append(f"第 {line_num} 行: 缺少队伍编号，跳过")
                        result.skipped_count += 1
                        continue
                    
                    existing = borrow_dao.get_by_code(borrow_code)
                    if existing:
                        result.warnings.append(f"第 {line_num} 行: 借出编号 {borrow_code} 已存在，跳过")
                        result.skipped_count += 1
                        continue
                    
                    team = team_dao.get_by_code(team_code)
                    if not team:
                        result.warnings.append(f"第 {line_num} 行: 队伍编号 {team_code} 不存在，跳过")
                        result.skipped_count += 1
                        continue
                    
                    borrow_date = self._parse_datetime(data.get('borrow_date') or data.get('借出时间')) or datetime.now()
                    expected_return_date = self._parse_datetime(data.get('expected_return_date') or data.get('预计归还时间'))
                    
                    deposit_amount = float(data.get('deposit_amount', 0) or data.get('押金金额', 0))
                    deposit_slip_code = data.get('deposit_slip_code') or data.get('押金条编号')
                    borrower_name = data.get('borrower_name') or data.get('借出人')
                    
                    barcodes = data.get('barcodes') or data.get('物资条形码') or []
                    if isinstance(barcodes, str):
                        barcodes = [b.strip() for b in barcodes.split(',') if b.strip()]
                    
                    borrow_record = borrow_dao.create(
                        borrow_code=borrow_code,
                        team_id=team.id,
                        borrow_date=borrow_date,
                        expected_return_date=expected_return_date,
                        deposit_amount=deposit_amount,
                        deposit_slip_code=deposit_slip_code,
                        borrower_name=borrower_name,
                        status=ReturnStatus.PENDING
                    )
                    
                    self.undo_manager.log_create(EntityType.BORROW_RECORD, borrow_record)
                    
                    material_count = 0
                    for barcode in barcodes:
                        material = material_dao.get_by_barcode(barcode)
                        if material:
                            borrow_item = borrow_item_dao.create(
                                borrow_record_id=borrow_record.id,
                                material_id=material.id,
                                quantity=1,
                                returned_quantity=0,
                                is_returned=False
                            )
                            material_dao.update_status(material.id, MaterialStatus.BORROWED)
                            material_count += 1
                    
                    result.imported_count += 1
                    
                except json.JSONDecodeError as e:
                    result.errors.append(f"第 {line_num} 行: JSON 解析错误 - {str(e)}")
                    result.skipped_count += 1
                except Exception as e:
                    result.errors.append(f"第 {line_num} 行: {str(e)}")
                    result.skipped_count += 1
            
            result.success = True
            return result
            
        except Exception as e:
            result.errors.append(f"文件读取失败: {str(e)}")
            return result
    
    def _parse_datetime(self, value) -> Optional[datetime]:
        if not value:
            return None
        
        if isinstance(value, datetime):
            return value
        
        if isinstance(value, str):
            formats = [
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y-%m-%d",
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        
        return None


def get_csv_importer() -> CSVImporter:
    return CSVImporter()


def get_jsonl_importer() -> JSONLImporter:
    return JSONLImporter()
