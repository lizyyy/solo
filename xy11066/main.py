from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import io
from models import ImportResult, ProbeMissingSegmentRequest
from import_service import ColdChainClaimImportService

app = FastAPI(title="冷链小仓冷链温控索赔 API", version="1.0.0")

import_service = ColdChainClaimImportService()


@app.post("/api/cold-chain-claims/import", response_model=ImportResult, summary="导入冷链温控索赔数据")
async def import_cold_chain_claims(file: UploadFile = File(..., description="Excel文件，包含索赔数据")):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支持Excel文件格式(.xlsx, .xls)")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        result = import_service.import_from_dataframe(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")


@app.post("/api/cold-chain-claims/handle-probe-missing", summary="处理温度探头缺段问题（添加人工备注）")
async def handle_probe_missing_segment(request: ProbeMissingSegmentRequest):
    success, message = import_service.handle_probe_missing_segment(
        request.claim_id,
        request.manual_remark,
        request.operator
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@app.get("/api/cold-chain-claims/{claim_id}", summary="查询单个索赔单详情")
async def get_claim(claim_id: str):
    if claim_id not in import_service.existing_claims:
        raise HTTPException(status_code=404, detail="索赔单不存在")
    return import_service.existing_claims[claim_id]


@app.get("/api/cold-chain-claims", summary="查询所有索赔单列表")
async def get_all_claims():
    return list(import_service.existing_claims.values())


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
