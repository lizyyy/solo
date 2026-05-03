import json
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
import pandas as pd


class InvoiceItem(BaseModel):
    item_name: str
    quantity: float
    unit_price: float
    amount: float


class InvoiceData(BaseModel):
    invoice_number: str
    invoice_date: str
    vendor_name: str
    vendor_tax_id: str
    total_amount: float
    tax_amount: float
    items: List[InvoiceItem]
    buyer_name: Optional[str] = None
    buyer_tax_id: Optional[str] = None
    ocr_confidence: Optional[float] = None
    raw_json: Dict[str, Any]
    
    @field_validator('invoice_date')
    @classmethod
    def parse_date(cls, v: str) -> str:
        if not v:
            return v
        try:
            if isinstance(v, str):
                v = v.strip()
                formats = [
                    '%Y-%m-%d',
                    '%Y/%m/%d',
                    '%Y年%m月%d日',
                    '%m-%d-%Y',
                    '%m/%d/%Y',
                ]
                for fmt in formats:
                    try:
                        return datetime.strptime(v, fmt).strftime('%Y-%m-%d')
                    except ValueError:
                        continue
                return v
        except Exception:
            return v
        return v


class ClaimData(BaseModel):
    claim_id: str
    policy_number: str
    claimant_name: str
    claim_date: str
    claim_amount: float
    invoice_number: Optional[str] = None
    diagnosis: Optional[str] = None
    hospital_name: Optional[str] = None
    raw_data: Dict[str, Any]


class RiskSample(BaseModel):
    vendor_name: str
    vendor_tax_id: Optional[str] = None
    risk_level: str
    risk_type: str
    sample_count: int = 1
    last_occurrence: Optional[str] = None
    raw_data: Dict[str, Any]


class InvoiceParser:
    def __init__(self):
        self.parsed_data: List[InvoiceData] = []
        
    def parse_file(self, file_path: Path) -> List[InvoiceData]:
        if file_path.suffix == '.json':
            return self._parse_json_file(file_path)
        elif file_path.suffix == '.jsonl':
            return self._parse_jsonl_file(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path.suffix}")
    
    def _parse_json_file(self, file_path: Path) -> List[InvoiceData]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            return [self._parse_single_invoice(item) for item in data]
        else:
            return [self._parse_single_invoice(data)]
    
    def _parse_jsonl_file(self, file_path: Path) -> List[InvoiceData]:
        invoices = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    data = json.loads(line)
                    invoices.append(self._parse_single_invoice(data))
        return invoices
    
    def _parse_single_invoice(self, data: Dict[str, Any]) -> InvoiceData:
        items = []
        if 'items' in data and isinstance(data['items'], list):
            for item in data['items']:
                items.append(InvoiceItem(
                    item_name=item.get('item_name', item.get('name', '')),
                    quantity=float(item.get('quantity', 1)),
                    unit_price=float(item.get('unit_price', item.get('price', 0))),
                    amount=float(item.get('amount', 0))
                ))
        
        invoice_number = data.get('invoice_number', data.get('invoice_no', ''))
        invoice_date = data.get('invoice_date', data.get('date', ''))
        vendor_name = data.get('vendor_name', data.get('merchant_name', data.get('seller_name', '')))
        vendor_tax_id = data.get('vendor_tax_id', data.get('tax_id', data.get('seller_tax_id', '')))
        
        total_amount = float(data.get('total_amount', data.get('amount', data.get('total', 0))))
        tax_amount = float(data.get('tax_amount', data.get('tax', 0)))
        
        return InvoiceData(
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            vendor_name=vendor_name,
            vendor_tax_id=vendor_tax_id,
            total_amount=total_amount,
            tax_amount=tax_amount,
            items=items,
            buyer_name=data.get('buyer_name', data.get('purchaser_name')),
            buyer_tax_id=data.get('buyer_tax_id', data.get('purchaser_tax_id')),
            ocr_confidence=float(data['ocr_confidence']) if 'ocr_confidence' in data and data['ocr_confidence'] else None,
            raw_json=data
        )
    
    def parse_directory(self, dir_path: Path) -> List[InvoiceData]:
        all_invoices = []
        for ext in ['*.json', '*.jsonl']:
            for file_path in dir_path.glob(ext):
                all_invoices.extend(self.parse_file(file_path))
        return all_invoices


class ClaimParser:
    def __init__(self):
        self.parsed_data: List[ClaimData] = []
        
    def parse_file(self, file_path: Path) -> List[ClaimData]:
        if file_path.suffix == '.csv':
            return self._parse_csv_file(file_path)
        elif file_path.suffix == '.xlsx':
            return self._parse_excel_file(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path.suffix}")
    
    def _parse_csv_file(self, file_path: Path) -> List[ClaimData]:
        df = pd.read_csv(file_path, encoding='utf-8')
        return self._parse_dataframe(df)
    
    def _parse_excel_file(self, file_path: Path) -> List[ClaimData]:
        df = pd.read_excel(file_path)
        return self._parse_dataframe(df)
    
    def _parse_dataframe(self, df: pd.DataFrame) -> List[ClaimData]:
        claims = []
        
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            
            claim_id = str(row_dict.get('claim_id', row_dict.get('理赔单号', row_dict.get('id', ''))))
            policy_number = str(row_dict.get('policy_number', row_dict.get('保单号', '')))
            claimant_name = str(row_dict.get('claimant_name', row_dict.get('申请人', row_dict.get('姓名', ''))))
            
            claim_date = str(row_dict.get('claim_date', row_dict.get('理赔日期', row_dict.get('date', ''))))
            try:
                claim_date = datetime.strptime(claim_date.split()[0], '%Y-%m-%d').strftime('%Y-%m-%d')
            except (ValueError, TypeError):
                pass
            
            try:
                claim_amount = float(row_dict.get('claim_amount', row_dict.get('理赔金额', row_dict.get('amount', 0))))
            except (ValueError, TypeError):
                claim_amount = 0.0
            
            claims.append(ClaimData(
                claim_id=claim_id,
                policy_number=policy_number,
                claimant_name=claimant_name,
                claim_date=claim_date,
                claim_amount=claim_amount,
                invoice_number=str(row_dict.get('invoice_number', row_dict.get('发票号', ''))),
                diagnosis=str(row_dict.get('diagnosis', row_dict.get('诊断', row_dict.get('病症', '')))),
                hospital_name=str(row_dict.get('hospital_name', row_dict.get('医院名称', row_dict.get('hospital', '')))),
                raw_data=row_dict
            ))
        
        return claims


class RiskSampleParser:
    def __init__(self):
        self.parsed_data: List[RiskSample] = []
        
    def parse_file(self, file_path: Path) -> List[RiskSample]:
        if file_path.suffix == '.csv':
            return self._parse_csv_file(file_path)
        elif file_path.suffix == '.json':
            return self._parse_json_file(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path.suffix}")
    
    def _parse_csv_file(self, file_path: Path) -> List[RiskSample]:
        df = pd.read_csv(file_path, encoding='utf-8')
        return self._parse_dataframe(df)
    
    def _parse_json_file(self, file_path: Path) -> List[RiskSample]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            return [self._parse_single_sample(item) for item in data]
        else:
            return [self._parse_single_sample(data)]
    
    def _parse_dataframe(self, df: pd.DataFrame) -> List[RiskSample]:
        samples = []
        
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            
            try:
                sample_count = int(row_dict.get('sample_count', row_dict.get('出现次数', 1)))
            except (ValueError, TypeError):
                sample_count = 1
            
            samples.append(RiskSample(
                vendor_name=str(row_dict.get('vendor_name', row_dict.get('商户名称', row_dict.get('merchant_name', '')))),
                vendor_tax_id=str(row_dict.get('vendor_tax_id', row_dict.get('税号', row_dict.get('tax_id', '')))) if row_dict.get('vendor_tax_id') or row_dict.get('税号') else None,
                risk_level=str(row_dict.get('risk_level', row_dict.get('风险等级', 'medium'))),
                risk_type=str(row_dict.get('risk_type', row_dict.get('风险类型', 'unknown'))),
                sample_count=sample_count,
                last_occurrence=str(row_dict.get('last_occurrence', row_dict.get('最后出现日期'))) if row_dict.get('last_occurrence') else None,
                raw_data=row_dict
            ))
        
        return samples
    
    def _parse_single_sample(self, data: Dict[str, Any]) -> RiskSample:
        return RiskSample(
            vendor_name=data.get('vendor_name', data.get('merchant_name', '')),
            vendor_tax_id=data.get('vendor_tax_id', data.get('tax_id')),
            risk_level=data.get('risk_level', 'medium'),
            risk_type=data.get('risk_type', 'unknown'),
            sample_count=int(data.get('sample_count', 1)),
            last_occurrence=data.get('last_occurrence'),
            raw_data=data
        )
