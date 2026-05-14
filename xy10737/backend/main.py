from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from typing import List
from models import (
    Experiment, ExperimentCreate, ExperimentUpdate,
    CorrectionRequest, ExportRequest
)
from database import db
import services

app = FastAPI(title="A/B实验配置台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "A/B实验配置台 API", "version": "1.0.0"}


@app.get("/api/experiments", response_model=List[Experiment])
def get_experiments():
    return db.get_all_experiments()


@app.get("/api/experiments/{exp_id}", response_model=Experiment)
def get_experiment(exp_id: str):
    exp = db.get_experiment(exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="实验不存在")
    return exp


@app.post("/api/experiments", response_model=Experiment)
def create_experiment(data: ExperimentCreate):
    return services.create_experiment(data.model_dump())


@app.put("/api/experiments/{exp_id}", response_model=Experiment)
def update_experiment(exp_id: str, data: ExperimentUpdate):
    exp = services.update_experiment(exp_id, data.model_dump(exclude_none=True))
    if not exp:
        raise HTTPException(status_code=404, detail="实验不存在")
    return exp


@app.post("/api/corrections")
def apply_correction(request: CorrectionRequest):
    result = services.apply_correction(
        request.experiment_id,
        request.corrections,
        request.reason
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.post("/api/export")
def export_experiment(request: ExportRequest):
    result = services.export_experiment(
        request.experiment_id,
        request.format,
        request.include_report
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    
    return Response(
        content=result["content"],
        media_type=result["content_type"],
        headers={
            "Content-Disposition": f"attachment; filename={result['filename']}"
        }
    )


@app.get("/api/validation/summary")
def get_validation_summary():
    return services.get_validation_summary()


@app.get("/api/validate/traffic/{exp_id}")
def validate_traffic(exp_id: str):
    exp = db.get_experiment(exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="实验不存在")
    return services.validate_traffic_ratio(exp.groups)


@app.post("/api/recalculate/{exp_id}", response_model=Experiment)
def recalculate_report(exp_id: str):
    exp = db.get_experiment(exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="实验不存在")
    
    traffic_validation = services.validate_traffic_ratio(exp.groups)
    if not traffic_validation["is_valid"]:
        raise HTTPException(status_code=400, detail="流量比例无效，无法重新计算")
    
    exp.report = services.recalculate_report(exp)
    exp.need_recalculation = False
    exp.updated_at = services.datetime.now()
    return exp


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
