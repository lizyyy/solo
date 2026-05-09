import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from .models import Document, DocumentType
from .validator import DataValidator


class FileImporter:
    SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"]
    
    def __init__(self, validator: Optional[DataValidator] = None):
        self.validator = validator or DataValidator()
        self.import_errors: List[Dict[str, Any]] = []
    
    def _read_file(self, file_path: str) -> pd.DataFrame:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        if path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {path.suffix}")
        
        if path.suffix.lower() == ".csv":
            return pd.read_csv(path, dtype=str, encoding="utf-8-sig")
        else:
            return pd.read_excel(path, dtype=str)
    
    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = {
            "凭证号": "doc_number",
            "凭证编号": "doc_number",
            "供应商ID": "supplier_id",
            "供应商代码": "supplier_id",
            "供应商名称": "supplier_name",
            "供应商": "supplier_name",
            "金额": "amount",
            "凭证金额": "amount",
            "日期": "doc_date",
            "凭证日期": "doc_date",
            "开票日期": "doc_date",
            "到期日": "due_date",
            "到期日期": "due_date",
            "付款到期日": "due_date",
            "描述": "description",
            "备注": "description",
            "摘要": "description",
            "参考号": "reference",
            "关联凭证": "reference",
        }
        
        df.columns = df.columns.str.strip()
        new_columns = []
        for col in df.columns:
            new_columns.append(column_mapping.get(col, col))
        df.columns = new_columns
        
        return df
    
    def import_file(self, file_path: str, doc_type: DocumentType) -> List[Document]:
        documents = []
        self.import_errors = []
        
        df = self._read_file(file_path)
        df = self._normalize_columns(df)
        
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            doc = self.validator.create_document(row_dict, doc_type)
            
            if not doc.is_valid:
                self.import_errors.append({
                    "file": file_path,
                    "row": idx + 2,
                    "doc_number": doc.doc_number,
                    "errors": doc.validation_errors,
                    "data": row_dict
                })
            
            documents.append(doc)
        
        return documents
    
    def import_multiple(self, file_paths: List[Tuple[str, DocumentType]]) -> List[Document]:
        all_documents = []
        
        for file_path, doc_type in file_paths:
            docs = self.import_file(file_path, doc_type)
            all_documents.extend(docs)
        
        return all_documents
