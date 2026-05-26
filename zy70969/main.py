from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from typing import List
import json

import models
import schemas
import services
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="园林养护药剂喷洒作业管理API",
    description="用于管理园林养护药剂喷洒作业的导入、验证和报告生成",
    version="1.0.0"
)


@app.post("/api/chemicals/import", summary="导入药剂库存JSON")
def import_chemicals(
    file: UploadFile = File(..., description="药剂库存JSON文件"),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        chemicals = json.loads(content)
        if not isinstance(chemicals, list):
            chemicals = [chemicals]
        count = services.ChemicalService.import_chemicals(db, chemicals)
        return {"message": f"成功导入 {count} 条药剂记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.get("/api/chemicals", response_model=List[schemas.ChemicalInventoryResponse], summary="获取所有药剂")
def get_chemicals(db: Session = Depends(get_db)):
    chemicals = db.query(models.ChemicalInventory).all()
    return chemicals


@app.post("/api/weather/import", summary="导入天气记录JSON")
def import_weather(
    file: UploadFile = File(..., description="天气记录JSON文件"),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        weather_records = json.loads(content)
        if not isinstance(weather_records, list):
            weather_records = [weather_records]
        count = services.WeatherService.import_weather(db, weather_records)
        return {"message": f"成功导入 {count} 条天气记录"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.get("/api/weather", response_model=List[schemas.WeatherRecordResponse], summary="获取所有天气记录")
def get_weather(db: Session = Depends(get_db)):
    records = db.query(models.WeatherRecord).all()
    return records


@app.post("/api/spray/upload", response_model=schemas.SubmissionResponse, summary="上传作业CSV进行处理")
def upload_spray_csv(
    file: UploadFile = File(..., description="作业记录CSV文件"),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read().decode("utf-8")
        records = services.parse_csv_content(content)
        result = services.SprayRecordService.process_submission(db, records)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"处理失败: {str(e)}")


@app.post("/api/spray/submit", response_model=schemas.SubmissionResponse, summary="直接提交作业记录进行处理")
def submit_spray_records(
    records: List[dict],
    db: Session = Depends(get_db)
):
    try:
        result = services.SprayRecordService.process_submission(db, records)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"处理失败: {str(e)}")


@app.get("/api/batches", response_model=List[schemas.BatchListResponse], summary="获取所有提交批次")
def get_batches(db: Session = Depends(get_db)):
    return services.ReportService.get_all_batches(db)


@app.get("/api/report/{batch_no}", response_model=schemas.ReportResponse, summary="获取批次处理报告")
def get_report(batch_no: str, db: Session = Depends(get_db)):
    report = services.ReportService.get_report_by_batch(db, batch_no)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@app.get("/api/report/{batch_no}/text", response_class=PlainTextResponse, summary="获取纯文本格式报告")
def get_report_text(batch_no: str, db: Session = Depends(get_db)):
    report = services.ReportService.get_report_by_batch(db, batch_no)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report["report_content"]


@app.get("/api/records/{record_id}", response_model=schemas.RecordDetailResponse, summary="获取单条记录详情")
def get_record_detail(record_id: int, db: Session = Depends(get_db)):
    detail = services.SprayRecordService.get_record_detail(db, record_id)
    if not detail:
        raise HTTPException(status_code=404, detail="记录不存在")
    return detail


@app.get("/", summary="API根路径")
def root():
    return {
        "name": "园林养护药剂喷洒作业管理API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "导入药剂": "POST /api/chemicals/import",
            "查看药剂": "GET /api/chemicals",
            "导入天气": "POST /api/weather/import",
            "查看天气": "GET /api/weather",
            "上传作业CSV": "POST /api/spray/upload",
            "提交作业记录": "POST /api/spray/submit",
            "查看批次列表": "GET /api/batches",
            "查看批次报告": "GET /api/report/{batch_no}",
            "单条记录详情": "GET /api/records/{record_id}"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
