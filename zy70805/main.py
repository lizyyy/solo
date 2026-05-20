from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from typing import List, Dict, Optional, Any
import pandas as pd
import json
import hashlib
from datetime import datetime
from models import (
    CustomsDeclaration, TariffRule, ReturnReceipt,
    ProcessingResult, NormalItem, PendingItem, FailedItem,
    BatchSubmissionRequest, BatchSubmissionResponse
)
from processors import (
    CurrencyConverter, CategoryMerger, DuplicateTaxDetector,
    DeclarationProcessor
)
from idempotency import IdempotencyManager

app = FastAPI(title="跨境电商关务处理API", version="1.0.0")

idempotency_manager = IdempotencyManager()
currency_converter = CurrencyConverter()
category_merger = CategoryMerger()
duplicate_tax_detector = DuplicateTaxDetector()


@app.get("/")
async def root():
    return {"message": "跨境电商关务处理API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/v1/process/batch", response_model=BatchSubmissionResponse)
async def process_batch(
    batch_id: str = Form(...),
    declaration_csv: UploadFile = File(...),
    tariff_json: UploadFile = File(...),
    return_receipt_json: Optional[UploadFile] = File(None)
):
    if idempotency_manager.is_batch_processed(batch_id):
        processed_result = idempotency_manager.get_batch_result(batch_id)
        return BatchSubmissionResponse(
            batch_id=batch_id,
            status="already_processed",
            message="该批次已处理完成，请勿重复提交",
            result=processed_result,
            processed_at=idempotency_manager.get_batch_time(batch_id)
        )
    
    try:
        declarations = await parse_declaration_csv(declaration_csv)
        tariff_rules = await parse_tariff_json(tariff_json)
        return_receipts = await parse_return_receipts(return_receipt_json) if return_receipt_json else []
        
        processor = DeclarationProcessor(
            currency_converter=currency_converter,
            category_merger=category_merger,
            duplicate_tax_detector=duplicate_tax_detector,
            tariff_rules=tariff_rules,
            return_receipts=return_receipts
        )
        
        result = processor.process_declarations(declarations, batch_id)
        
        idempotency_manager.store_batch_result(batch_id, result)
        
        return BatchSubmissionResponse(
            batch_id=batch_id,
            status="success",
            message="批次处理完成",
            result=result,
            processed_at=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/v1/process/declaration")
async def process_single_declaration(declaration: Dict[str, Any]):
    return {"message": "单条申报处理", "data": declaration}


@app.get("/api/v1/batch/{batch_id}")
async def get_batch_result(batch_id: str):
    if not idempotency_manager.is_batch_processed(batch_id):
        raise HTTPException(status_code=404, detail="批次不存在或未处理")
    
    result = idempotency_manager.get_batch_result(batch_id)
    return {
        "batch_id": batch_id,
        "processed_at": idempotency_manager.get_batch_time(batch_id),
        "result": result
    }


@app.get("/api/v1/rules/currency-rates")
async def get_currency_rates():
    return currency_converter.get_all_rates()


@app.get("/api/v1/rules/tariff-categories")
async def get_tariff_categories():
    return category_merger.get_all_categories()


async def parse_declaration_csv(file: UploadFile) -> List[CustomsDeclaration]:
    content = await file.read()
    df = pd.read_csv(pd.io.common.BytesIO(content))
    
    declarations = []
    for _, row in df.iterrows():
        declarations.append(CustomsDeclaration(
            order_id=str(row.get("order_id", "")),
            sku_code=str(row.get("sku_code", "")),
            product_name=str(row.get("product_name", "")),
            category_code=str(row.get("category_code", "")),
            amount=float(row.get("amount", 0)),
            currency=str(row.get("currency", "USD")),
            quantity=int(row.get("quantity", 1)),
            declared_tariff_rate=float(row.get("declared_tariff_rate", 0)),
            declaration_date=str(row.get("declaration_date", datetime.now().date())),
            consignee=str(row.get("consignee", "")),
            destination_country=str(row.get("destination_country", "CN"))
        ))
    
    return declarations


async def parse_tariff_json(file: UploadFile) -> List[TariffRule]:
    content = await file.read()
    data = json.loads(content)
    
    tariff_rules = []
    for item in data:
        tariff_rules.append(TariffRule(
            hs_code=item.get("hs_code", ""),
            category_name=item.get("category_name", ""),
            tariff_rate=float(item.get("tariff_rate", 0)),
            description=item.get("description", ""),
            effective_date=item.get("effective_date", ""),
            expiry_date=item.get("expiry_date", "")
        ))
    
    return tariff_rules


async def parse_return_receipts(file: UploadFile) -> List[ReturnReceipt]:
    content = await file.read()
    data = json.loads(content)
    
    receipts = []
    for item in data:
        receipts.append(ReturnReceipt(
            receipt_id=item.get("receipt_id", ""),
            order_id=item.get("order_id", ""),
            return_code=item.get("return_code", ""),
            return_reason=item.get("return_reason", ""),
            suggestion=item.get("suggestion", ""),
            return_date=item.get("return_date", "")
        ))
    
    return receipts


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=9000)
