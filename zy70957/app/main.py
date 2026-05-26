from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import uvicorn

from .service import data_service
from .models import BatchProcessResult, BatchStatus

app = FastAPI(
    title="后勤服务中心 - 报修数据处理API",
    description="处理学生报修、维修工信息、满意度评分数据的统一接口",
    version="1.0.0"
)


@app.get("/")
async def root():
    return {
        "message": "后勤服务中心报修数据处理系统",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/upload": "上传并处理CSV/JSON文件",
            "GET /api/batch/{batch_id}": "查询批次处理状态",
            "GET /api/batches": "查询所有批次记录",
            "POST /api/clear": "清空历史数据（测试用）"
        }
    }


@app.post("/api/upload", response_model=BatchProcessResult)
async def upload_files(
    repair_csv: Optional[UploadFile] = File(None, description="报修记录CSV文件"),
    worker_json: Optional[UploadFile] = File(None, description="维修工信息JSON文件"),
    rating_json: Optional[UploadFile] = File(None, description="评分记录JSON文件")
):
    repair_content = None
    worker_content = None
    rating_content = None

    if repair_csv:
        if not repair_csv.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="报修记录必须是CSV文件")
        content = await repair_csv.read()
        repair_content = content.decode('utf-8')

    if worker_json:
        if not worker_json.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="维修工信息必须是JSON文件")
        content = await worker_json.read()
        worker_content = content.decode('utf-8')

    if rating_json:
        if not rating_json.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="评分记录必须是JSON文件")
        content = await rating_json.read()
        rating_content = content.decode('utf-8')

    if not any([repair_content, worker_content, rating_content]):
        raise HTTPException(status_code=400, detail="至少需要上传一个文件")

    result = data_service.process_batch(
        repair_csv=repair_content,
        worker_json=worker_content,
        rating_json=rating_content
    )

    return result


@app.get("/api/batch/{batch_id}", response_model=Optional[BatchStatus])
async def get_batch(batch_id: str):
    status = data_service.get_batch_status(batch_id)
    if not status:
        raise HTTPException(status_code=404, detail="批次不存在")
    return status


@app.get("/api/batches", response_model=list[BatchStatus])
async def list_batches():
    return data_service.get_all_batches()


@app.post("/api/clear")
async def clear_data():
    data_service.clear_history()
    return {"message": "历史数据已清空"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
