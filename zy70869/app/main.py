from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime
from .models import ValidationResult
from .processor import DataParser, SampleProcessor

app = FastAPI(
    title="药企QA样品管理系统API",
    description="样品数据验证系统，支持取样窗口校验、环境箱超温检测、延期审批验证",
    version="1.0.0"
)

processor = SampleProcessor()


@app.get("/")
async def root():
    return {
        "message": "药企QA样品管理系统API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/validate", response_model=ValidationResult)
async def validate_samples(
    samples_file: UploadFile = File(..., description="样品CSV文件"),
    plans_file: UploadFile = File(..., description="试验方案JSON文件"),
    chamber_file: Optional[UploadFile] = File(None, description="环境箱记录CSV/JSON文件"),
    check_duplicate: bool = True
):
    try:
        samples_content = await samples_file.read()
        samples = DataParser.parse_samples_csv(samples_content.decode('utf-8'))

        plans_content = await plans_file.read()
        plans = DataParser.parse_test_plans_json(plans_content.decode('utf-8'))

        chamber_records = []
        if chamber_file:
            chamber_content = await chamber_file.read()
            chamber_records = DataParser.parse_chamber_records(chamber_content.decode('utf-8'))

        result = processor.process(samples, plans, chamber_records, check_duplicate)

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据处理失败: {str(e)}"
        )


@app.post("/api/validate/raw", response_model=ValidationResult)
async def validate_raw_data(
    samples_csv: str,
    plans_json: str,
    chamber_json: Optional[str] = None,
    check_duplicate: bool = True
):
    try:
        samples = DataParser.parse_samples_csv(samples_csv)
        plans = DataParser.parse_test_plans_json(plans_json)
        chamber_records = []

        if chamber_json:
            chamber_records = DataParser.parse_chamber_records(chamber_json)

        result = processor.process(samples, plans, chamber_records, check_duplicate)

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据处理失败: {str(e)}"
        )


@app.get("/api/processed/count")
async def get_processed_count():
    return {
        "processed_batches_count": processor.dedup_manager.get_processed_count()
    }


@app.post("/api/dedup/reset")
async def reset_dedup():
    processor.dedup_manager = SampleProcessor().dedup_manager
    return {"message": "去重缓存已重置"}
