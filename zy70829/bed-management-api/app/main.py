from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from typing import Optional
import json
from .models import ImportResponse
from .rules import BedManagementRules
from .processor import DataProcessor

app = FastAPI(title="床位管理导入API", version="1.0.0")

rules_engine = BedManagementRules()
processor = DataProcessor(rules_engine)


@app.post("/api/import", response_model=ImportResponse, summary="批量导入床位数据")
async def import_bed_data(
    batch_id: str = Form(..., description="批次ID，用于幂等性控制"),
    bed_csv: Optional[UploadFile] = File(None, description="床位表CSV文件"),
    patient_flow_json: Optional[UploadFile] = File(None, description="患者流转JSON文件"),
    cleaning_order_json: Optional[UploadFile] = File(None, description="保洁工单JSON文件")
):
    """
    批量导入床位相关数据，支持同时上传：
    - 床位表CSV
    - 患者流转JSON
    - 保洁工单JSON
    
    返回结果按正常项、待确认项、失败项分开返回
    """
    bed_csv_content = None
    patient_flow_data = None
    cleaning_order_data = None

    if bed_csv:
        if not bed_csv.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="床位表必须是CSV格式")
        content = await bed_csv.read()
        bed_csv_content = content.decode('utf-8')

    if patient_flow_json:
        if not patient_flow_json.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="患者流转必须是JSON格式")
        content = await patient_flow_json.read()
        patient_flow_data = json.loads(content.decode('utf-8'))

    if cleaning_order_json:
        if not cleaning_order_json.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="保洁工单必须是JSON格式")
        content = await cleaning_order_json.read()
        cleaning_order_data = json.loads(content.decode('utf-8'))

    if not any([bed_csv_content, patient_flow_data, cleaning_order_data]):
        raise HTTPException(status_code=400, detail="至少上传一种数据文件")

    result = processor.process_import(
        batch_id=batch_id,
        bed_csv=bed_csv_content,
        patient_flows=patient_flow_data,
        cleaning_orders=cleaning_order_data
    )

    return result


@app.get("/api/health", summary="健康检查")
async def health_check():
    return {"status": "healthy", "service": "bed-management-api"}


@app.get("/api/batches", summary="查询已处理批次")
async def get_processed_batches():
    return {"processed_batches": list(rules_engine.processed_batches)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
