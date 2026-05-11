"""数据导入器"""

import csv
import json
import os
from typing import List, Dict, Any, Optional

from .models import (
    DossierCatalog,
    TransferBatch,
    ReceiptRecord,
    TransferStage,
    ReceiptStatus,
    ReturnReason,
    ImportResult,
    ImportProblem,
)
from .storage import Storage


class Importer:
    """数据导入器"""
    
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def import_file(self, file_type: str, file_path: str) -> ImportResult:
        if not os.path.exists(file_path):
            return ImportResult(
                success=False,
                success_count=0,
                problem_count=0,
                error=f"文件不存在: {file_path}"
            )
        
        if file_type == "catalog":
            return self._import_catalog(file_path)
        elif file_type == "batch":
            return self._import_batch(file_path)
        elif file_type == "receipt":
            return self._import_receipt(file_path)
        else:
            return ImportResult(
                success=False,
                success_count=0,
                problem_count=0,
                error=f"未知文件类型: {file_type}"
            )
    
    def _read_file(self, file_path: str) -> List[Dict[str, Any]]:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".json":
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return [data]
            else:
                raise ValueError("JSON文件格式错误")
        
        elif ext in [".csv", ".txt"]:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                return [row for row in reader]
        
        raise ValueError(f"不支持的文件格式: {ext}")
    
    def _import_catalog(self, file_path: str) -> ImportResult:
        problems: List[ImportProblem] = []
        success_count = 0
        source_file = os.path.basename(file_path)
        
        try:
            rows = self._read_file(file_path)
        except Exception as e:
            return ImportResult(
                success=False,
                success_count=0,
                problem_count=0,
                error=f"读取文件失败: {e}"
            )
        
        for line_num, row in enumerate(rows, start=2):
            problem = None
            
            case_id = self._get_str(row, "case_id")
            item_id = self._get_str(row, "item_id")
            item_name = self._get_str(row, "item_name")
            
            if not case_id:
                problem = ImportProblem(line_num, source_file, "缺少 case_id 字段", str(row))
            elif not item_id:
                problem = ImportProblem(line_num, source_file, "缺少 item_id 字段", str(row))
            elif not item_name:
                problem = ImportProblem(line_num, source_file, "缺少 item_name 字段", str(row))
            else:
                try:
                    page_start = self._get_int(row, "page_start")
                    page_end = self._get_int(row, "page_end")
                    page_count = self._get_int(row, "page_count")
                    
                    if page_start is None or page_start <= 0:
                        problem = ImportProblem(line_num, source_file, f"无效的 page_start: {page_start}", str(row))
                    elif page_end is None or page_end < page_start:
                        problem = ImportProblem(line_num, source_file, f"无效的 page_end: {page_end}", str(row))
                    elif page_count is None or page_count <= 0:
                        problem = ImportProblem(line_num, source_file, f"无效的 page_count: {page_count}", str(row))
                    else:
                        catalog = DossierCatalog(
                            case_id=case_id,
                            item_id=item_id,
                            item_name=item_name,
                            page_start=page_start,
                            page_end=page_end,
                            page_count=page_count,
                            notes=self._get_str(row, "notes")
                        )
                        
                        if self.storage.save_catalog(catalog):
                            success_count += 1
                        else:
                            problem = ImportProblem(line_num, source_file, "保存目录失败", str(row))
                except Exception as e:
                    problem = ImportProblem(line_num, source_file, f"解析失败: {e}", str(row))
            
            if problem:
                problems.append(problem)
                self.storage.save_import_problem(problem, "catalog", source_file)
        
        self.storage.add_history(
            "import",
            True,
            f"导入卷宗目录: 成功 {success_count} 条, 问题 {len(problems)} 条"
        )
        
        return ImportResult(
            success=True,
            success_count=success_count,
            problem_count=len(problems),
            problems=problems
        )
    
    def _import_batch(self, file_path: str) -> ImportResult:
        problems: List[ImportProblem] = []
        success_count = 0
        source_file = os.path.basename(file_path)
        
        try:
            rows = self._read_file(file_path)
        except Exception as e:
            return ImportResult(
                success=False,
                success_count=0,
                problem_count=0,
                error=f"读取文件失败: {e}"
            )
        
        for line_num, row in enumerate(rows, start=2):
            problem = None
            
            batch_id = self._get_str(row, "batch_id")
            case_id = self._get_str(row, "case_id")
            from_stage = self._get_str(row, "from_stage")
            to_stage = self._get_str(row, "to_stage")
            
            if not batch_id:
                problem = ImportProblem(line_num, source_file, "缺少 batch_id 字段", str(row))
            elif not case_id:
                problem = ImportProblem(line_num, source_file, "缺少 case_id 字段", str(row))
            elif not from_stage:
                problem = ImportProblem(line_num, source_file, "缺少 from_stage 字段", str(row))
            elif not to_stage:
                problem = ImportProblem(line_num, source_file, "缺少 to_stage 字段", str(row))
            else:
                try:
                    from_stage_enum = TransferStage(from_stage)
                    to_stage_enum = TransferStage(to_stage)
                    
                    total_pages = self._get_int(row, "total_pages")
                    dossier_count = self._get_int(row, "dossier_count")
                    transfer_date = self._get_str(row, "transfer_date")
                    transfer_person = self._get_str(row, "transfer_person")
                    
                    if total_pages is None or total_pages <= 0:
                        problem = ImportProblem(line_num, source_file, f"无效的 total_pages: {total_pages}", str(row))
                    elif dossier_count is None or dossier_count <= 0:
                        problem = ImportProblem(line_num, source_file, f"无效的 dossier_count: {dossier_count}", str(row))
                    elif not transfer_date:
                        problem = ImportProblem(line_num, source_file, "缺少 transfer_date 字段", str(row))
                    elif not transfer_person:
                        problem = ImportProblem(line_num, source_file, "缺少 transfer_person 字段", str(row))
                    else:
                        batch = TransferBatch(
                            batch_id=batch_id,
                            case_id=case_id,
                            from_stage=from_stage_enum,
                            to_stage=to_stage_enum,
                            total_pages=total_pages,
                            dossier_count=dossier_count,
                            transfer_date=transfer_date,
                            transfer_person=transfer_person,
                            status=ReceiptStatus.PENDING,
                            notes=self._get_str(row, "notes")
                        )
                        
                        if self.storage.save_batch(batch):
                            success_count += 1
                        else:
                            problem = ImportProblem(line_num, source_file, "保存批次失败", str(row))
                except ValueError as e:
                    problem = ImportProblem(line_num, source_file, f"无效的阶段值: {e}", str(row))
                except Exception as e:
                    problem = ImportProblem(line_num, source_file, f"解析失败: {e}", str(row))
            
            if problem:
                problems.append(problem)
                self.storage.save_import_problem(problem, "batch", source_file)
        
        self.storage.add_history(
            "import",
            True,
            f"导入移交批次: 成功 {success_count} 条, 问题 {len(problems)} 条"
        )
        
        return ImportResult(
            success=True,
            success_count=success_count,
            problem_count=len(problems),
            problems=problems
        )
    
    def _import_receipt(self, file_path: str) -> ImportResult:
        problems: List[ImportProblem] = []
        success_count = 0
        source_file = os.path.basename(file_path)
        
        try:
            rows = self._read_file(file_path)
        except Exception as e:
            return ImportResult(
                success=False,
                success_count=0,
                problem_count=0,
                error=f"读取文件失败: {e}"
            )
        
        for line_num, row in enumerate(rows, start=2):
            problem = None
            
            receipt_id = self._get_str(row, "receipt_id")
            batch_id = self._get_str(row, "batch_id")
            case_id = self._get_str(row, "case_id")
            receipt_date = self._get_str(row, "receipt_date")
            receipt_person = self._get_str(row, "receipt_person")
            
            if not receipt_id:
                problem = ImportProblem(line_num, source_file, "缺少 receipt_id 字段", str(row))
            elif not batch_id:
                problem = ImportProblem(line_num, source_file, "缺少 batch_id 字段", str(row))
            elif not case_id:
                problem = ImportProblem(line_num, source_file, "缺少 case_id 字段", str(row))
            elif not receipt_date:
                problem = ImportProblem(line_num, source_file, "缺少 receipt_date 字段", str(row))
            elif not receipt_person:
                problem = ImportProblem(line_num, source_file, "缺少 receipt_person 字段", str(row))
            else:
                try:
                    status_str = self._get_str(row, "status") or "pending"
                    status = ReceiptStatus(status_str)
                    
                    return_reason_str = self._get_str(row, "return_reason")
                    return_reason = ReturnReason(return_reason_str) if return_reason_str else None
                    
                    receipt = ReceiptRecord(
                        receipt_id=receipt_id,
                        batch_id=batch_id,
                        case_id=case_id,
                        receipt_date=receipt_date,
                        receipt_person=receipt_person,
                        received_page_count=self._get_int(row, "received_page_count"),
                        missing_pages=self._get_str(row, "missing_pages"),
                        extra_pages=self._get_str(row, "extra_pages"),
                        status=status,
                        return_reason=return_reason,
                        return_notes=self._get_str(row, "return_notes")
                    )
                    
                    if self.storage.save_receipt(receipt):
                        success_count += 1
                    else:
                        problem = ImportProblem(line_num, source_file, "保存签收记录失败", str(row))
                except ValueError as e:
                    problem = ImportProblem(line_num, source_file, f"无效的枚举值: {e}", str(row))
                except Exception as e:
                    problem = ImportProblem(line_num, source_file, f"解析失败: {e}", str(row))
            
            if problem:
                problems.append(problem)
                self.storage.save_import_problem(problem, "receipt", source_file)
        
        self.storage.add_history(
            "import",
            True,
            f"导入签收记录: 成功 {success_count} 条, 问题 {len(problems)} 条"
        )
        
        return ImportResult(
            success=True,
            success_count=success_count,
            problem_count=len(problems),
            problems=problems
        )
    
    def _get_str(self, row: Dict, key: str) -> Optional[str]:
        value = row.get(key) or row.get(key.lower())
        if value is None or value == "":
            return None
        return str(value).strip()
    
    def _get_int(self, row: Dict, key: str) -> Optional[int]:
        value = self._get_str(row, key)
        if value is None:
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None
