#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import os
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from deep_sea_cleaner import DeepSeaCleaner
from deep_sea_cleaner.models import FailReason


app = FastAPI(title="深海采样数据清洗 API", version="1.0.0")

cleaner = DeepSeaCleaner()


class CleanRequest(BaseModel):
    sample_file: str = Field(..., description="样例文件名，如 pack01_demo.csv")
    batch_id: Optional[str] = Field(None, description="批次ID，不指定则自动生成")


class ReviewRequest(BaseModel):
    record_id: str = Field(..., description="记录ID")
    reviewer: str = Field(..., description="评审人姓名")
    fail_reason: FailReason = Field(..., description="失败原因：formula/unit/threshold/format")
    field_name: Optional[str] = Field(
        None,
        description="改判字段名：temperature/salinity/depth/latitude/longitude",
    )
    original_value: Optional[str] = Field(None, description="原始值")
    overridden_value: Optional[str] = Field(None, description="改判值")
    justification: str = Field("", description="改判理由")
    source_note: str = Field("", description="来源说明（如船上记录本第几页）")


@app.get("/", tags=["根路径"])
async def root():
    return {
        "name": "深海采样数据清洗服务",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "list_samples": "GET /api/samples",
            "run_clean": "POST /api/clean",
            "get_latest_result": "GET /api/result/latest",
            "get_result_by_batch": "GET /api/result/{batch_id}",
            "get_anomalies": "GET /api/anomalies",
            "get_duplicates": "GET /api/duplicates",
            "add_review": "POST /api/review",
            "get_review_chain": "GET /api/review/chain/{record_id}",
            "get_all_reviews": "GET /api/manual_reviews",
        },
    }


@app.get("/api/samples", tags=["数据管理"])
async def list_samples():
    """列出可用的样例包"""
    samples = cleaner.list_samples()
    return {
        "samples": samples,
        "default": "pack01_demo.csv",
    }


@app.post("/api/clean", tags=["清洗任务"])
async def run_clean(req: CleanRequest):
    """
    触发一次清洗任务

    - **sample_file**: 样例文件名（必填）
    - **batch_id**: 批次ID，不填则自动生成
    """
    try:
        result = cleaner.run_clean(req.sample_file, batch_id=req.batch_id)
        return {
            "success": True,
            "batch_id": result["batch_id"],
            "run_time": result["run_time"],
            "output_file": f"output/{result['batch_id']}.json",
            "summary": result["summary"],
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/result/latest", tags=["结果查询"])
async def get_latest_result(
    include_records: bool = Query(True, description="是否包含完整 records 列表"),
    include_anomalies: bool = Query(True, description="是否包含 anomaly_details"),
    include_duplicates: bool = Query(True, description="是否包含 duplicate_details"),
):
    """获取最近一次清洗结果"""
    result = cleaner.get_last_result()
    if not result:
        raise HTTPException(status_code=404, detail="没有找到最近一次运行结果，请先调用 POST /api/clean 触发清洗")

    resp = {
        "batch_id": result["batch_id"],
        "sample_file": result["sample_file"],
        "run_time": result["run_time"],
        "summary": result["summary"],
    }
    if include_records:
        resp["records"] = result["records"]
    if include_anomalies:
        resp["anomaly_details"] = result["anomaly_details"]
    if include_duplicates:
        resp["duplicate_details"] = result["duplicate_details"]
    return resp


@app.get("/api/result/{batch_id}", tags=["结果查询"])
async def get_result_by_batch(
    batch_id: str,
    include_records: bool = Query(True, description="是否包含完整 records 列表"),
    include_anomalies: bool = Query(True, description="是否包含 anomaly_details"),
    include_duplicates: bool = Query(True, description="是否包含 duplicate_details"),
):
    """按批次ID获取清洗结果"""
    result = cleaner._load_result(batch_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")

    resp = {
        "batch_id": result["batch_id"],
        "sample_file": result["sample_file"],
        "run_time": result["run_time"],
        "summary": result["summary"],
    }
    if include_records:
        resp["records"] = result["records"]
    if include_anomalies:
        resp["anomaly_details"] = result["anomaly_details"]
    if include_duplicates:
        resp["duplicate_details"] = result["duplicate_details"]
    return resp


@app.get("/api/anomalies", tags=["结果查询"])
async def get_anomalies(
    batch_id: Optional[str] = Query(None, description="批次ID，不填则取最近一次"),
    anomaly_type: Optional[str] = Query(None, description="按异常类型过滤：duplicate_bottle/missing_value/lat_lon_format/unit_mismatch/formula_error/threshold_outlier/invalid_value"),
):
    """获取异常明细"""
    try:
        anomalies = cleaner.get_anomalies(batch_id=batch_id, anomaly_type=anomaly_type)
        return {
            "batch_id": batch_id or cleaner.last_batch_id,
            "total": len(anomalies),
            "anomalies": anomalies,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/duplicates", tags=["结果查询"])
async def get_duplicates(
    batch_id: Optional[str] = Query(None, description="批次ID，不填则取最近一次"),
):
    """获取重复采样瓶明细"""
    try:
        duplicates = cleaner.get_duplicates(batch_id=batch_id)
        return {
            "batch_id": batch_id or cleaner.last_batch_id,
            "total": len(duplicates),
            "duplicates": duplicates,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/review", tags=["人工改判"])
async def add_review(req: ReviewRequest):
    """
    添加一条人工改判记录。添加后重新运行清洗，改判会生效。

    - **fail_reason**: 卡在 formula / unit / threshold / format 哪一类
    - **field_name**: 改判的字段，如 temperature
    - **original_value**: 原始值（如 50.0）
    - **overridden_value**: 改判值（如 35.0）
    - **source_note**: 来源说明，比如"深海调查船记录簿 Vol.7 第12页"
    """
    try:
        review = cleaner.add_manual_review(
            record_id=req.record_id,
            reviewer=req.reviewer,
            fail_reason=req.fail_reason.value,
            field_name=req.field_name,
            original_value=req.original_value,
            overridden_value=req.overridden_value,
            justification=req.justification,
            source_note=req.source_note,
        )
        return {
            "success": True,
            "review_id": review.review_id,
            "record_id": review.record_id,
            "hint": "请重新调用 POST /api/clean 使改判生效",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/review/chain/{record_id}", tags=["人工改判"])
async def get_review_chain(record_id: str):
    """查看某条记录的完整改判追溯链"""
    chain = cleaner.get_review_chain(record_id)
    return {
        "record_id": record_id,
        "total": len(chain),
        "chain": chain,
    }


@app.get("/api/manual_reviews", tags=["人工改判"])
async def get_all_reviews():
    """获取所有人工改判记录"""
    reviews = []
    for record_id in cleaner.review_tracker.reviews:
        chain = cleaner.get_review_chain(record_id)
        for r in chain:
            reviews.append(r)
    return {
        "total": len(reviews),
        "reviews": sorted(reviews, key=lambda x: x["review_time"], reverse=True),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
