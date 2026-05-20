from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import json
from models import ProcessResult
from processor import DataProcessor

app = FastAPI(
    title="工厂返修数据处理API",
    description="用于处理返修记录、工单、物料批次的统一接口，解决导入混乱问题",
    version="1.0.0"
)

processor = DataProcessor()


@app.get("/")
async def root():
    return {
        "message": "工厂返修数据处理API",
        "version": "1.0.0",
        "endpoints": {
            "POST /upload/repair-csv": "上传返修CSV文件",
            "POST /upload/work-order": "上传工单JSON",
            "POST /upload/material-batch": "上传物料批次JSON",
            "POST /process": "直接提交JSON数据处理",
            "GET /stats": "获取当前处理统计"
        }
    }


@app.post("/upload/repair-csv", response_model=ProcessResult)
async def upload_repair_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")

    try:
        content = await file.read()
        csv_content = content.decode('utf-8')
        result = processor.process_repair_csv(csv_content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/upload/work-order")
async def upload_work_order(file: UploadFile = File(...)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="只支持JSON文件")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        if isinstance(data, dict):
            data = [data]
        loaded, errors = processor.load_work_orders(data)
        return {
            "loaded": loaded,
            "total": len(data),
            "errors": errors,
            "message": f"成功加载 {loaded} 个工单"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/upload/material-batch")
async def upload_material_batch(file: UploadFile = File(...)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="只支持JSON文件")

    try:
        content = await file.read()
        data = json.loads(content.decode('utf-8'))
        if isinstance(data, dict):
            data = [data]
        loaded, errors = processor.load_material_batches(data)
        return {
            "loaded": loaded,
            "total": len(data),
            "errors": errors,
            "message": f"成功加载 {loaded} 个物料批次"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/process", response_model=ProcessResult)
async def process_data(data: Dict[str, Any]):
    try:
        records = data.get("records", [])
        if not records:
            raise HTTPException(status_code=400, detail="缺少records数据")

        import pandas as pd
        df = pd.DataFrame(records)
        csv_content = df.to_csv(index=False)

        result = processor.process_repair_csv(csv_content)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.get("/stats")
async def get_stats():
    return {
        "processed_batches": len(processor.processed_batches),
        "work_orders_count": len(processor.work_orders),
        "material_batches_count": len(processor.material_batches),
        "repair_records_count": len(processor.repair_records)
    }


@app.post("/reset")
async def reset_processor():
    global processor
    processor = DataProcessor()
    return {"message": "处理器已重置，所有数据已清空"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
