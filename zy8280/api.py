import csv
import io
import json
import tempfile
from typing import List, Optional

import yaml
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from lab_guardian import Guardian, DataSample


app = FastAPI(
    title="实验室传感器数据复核API",
    description="批量复核传感器和手工记录里的单位与阈值",
    version="0.1.0",
)


class SampleItem(BaseModel):
    id: str
    parameter: str
    value: float
    unit: str
    source: Optional[str] = "unknown"


class AnalysisRequest(BaseModel):
    samples: List[SampleItem]
    unit_aliases: Optional[dict] = None
    thresholds: dict


class AnalysisResult(BaseModel):
    id: str
    parameter: str
    original_value: float
    original_unit: str
    normalized_value: float
    target_unit: str
    status: str
    message: str
    source: str


class StatisticsResponse(BaseModel):
    total: int
    by_status: dict
    by_parameter: dict
    by_source: dict


class AnalysisResponse(BaseModel):
    statistics: StatisticsResponse
    results: List[AnalysisResult]


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_data(request: AnalysisRequest):
    """
    分析数据并判定状态
    
    接收样本数据、单位别名和阈值配置，返回分析结果
    """
    try:
        guardian = Guardian()
        
        if request.unit_aliases:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
                yaml.dump(request.unit_aliases, f)
                alias_path = f.name
            guardian.unit_converter.load_aliases(alias_path)
        
        if request.thresholds:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(request.thresholds, f)
                threshold_path = f.name
            guardian.threshold_validator.load_thresholds(threshold_path)
        
        guardian.samples = [
            DataSample(
                id=s.id,
                parameter=s.parameter,
                value=s.value,
                unit=s.unit,
                source=s.source or "unknown",
            )
            for s in request.samples
        ]
        
        results = guardian.analyze()
        stats = guardian.get_statistics()
        
        return AnalysisResponse(
            statistics=StatisticsResponse(**stats),
            results=[
                AnalysisResult(
                    id=r.sample.id,
                    parameter=r.sample.parameter,
                    original_value=r.sample.value,
                    original_unit=r.sample.unit,
                    normalized_value=r.normalized_value,
                    target_unit=r.target_unit,
                    status=r.status.value,
                    message=r.message,
                    source=r.sample.source,
                )
                for r in results
            ],
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/analyze/files")
async def analyze_files(
    samples: UploadFile = File(...),
    aliases: UploadFile = File(None),
    thresholds: UploadFile = File(...),
):
    """
    上传文件并分析
    
    接收CSV样本文件、YAML单位别名文件和JSON阈值配置文件
    """
    try:
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as f:
            f.write(await samples.read())
            samples_path = f.name
        
        alias_path = None
        if aliases:
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.yaml', delete=False) as f:
                f.write(await aliases.read())
                alias_path = f.name
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.json', delete=False) as f:
            f.write(await thresholds.read())
            threshold_path = f.name
        
        guardian = Guardian(
            samples_file=samples_path,
            alias_file=alias_path,
            threshold_file=threshold_path,
        )
        
        results = guardian.analyze()
        stats = guardian.get_statistics()
        
        return AnalysisResponse(
            statistics=StatisticsResponse(**stats),
            results=[
                AnalysisResult(
                    id=r.sample.id,
                    parameter=r.sample.parameter,
                    original_value=r.sample.value,
                    original_unit=r.sample.unit,
                    normalized_value=r.normalized_value,
                    target_unit=r.target_unit,
                    status=r.status.value,
                    message=r.message,
                    source=r.sample.source,
                )
                for r in results
            ],
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
