"""
API 入口 —— 用 FastAPI 暴露分段函数优惠核算的接口

启动：
  uvicorn piecewise_discount.api:app --reload

接口：
  POST /import/function        导入分段函数
  POST /import/weight-table    导入评分权重表
  POST /import/boundary        导入边界值说明
  POST /supplement             补录评分权重表
  POST /calculate              单笔核算
  POST /recalculate            重跑（标记旧口径）
  GET  /records                查看核算记录
  GET  /gaps                   断档检查
  GET  /versions               参数版本页
  POST /demo                   跑演示数据
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

from .models import Segment as SegmentModel
from .models import PiecewiseFunction as FuncModel
from .models import ScoringWeightTable as TableModel
from .models import WeightEntry as EntryModel
from .models import BoundaryNote as NoteModel
from .engine import CalculationEngine
from .demo_data import load_demo_data


app = FastAPI(title="分段函数优惠核算", version="0.1.0")
_engine = CalculationEngine()


class SegmentIn(BaseModel):
    seg_no: int
    lower: float
    upper: float
    discount_rate: float


class FunctionIn(BaseModel):
    name: str
    segments: list[SegmentIn]


class WeightEntryIn(BaseModel):
    dimension: str
    weight: float
    score: float


class WeightTableIn(BaseModel):
    name: str
    entries: list[WeightEntryIn]
    version: int = 1
    remark: str = ""


class BoundaryIn(BaseModel):
    items: list[dict]


class CalculateIn(BaseModel):
    record_id: str
    original_price: float
    function_name: str
    weight_table_name: str
    remark: str = ""


class RecalculateIn(BaseModel):
    record_id: str
    mark_old_caliber: bool = False


class SupplementIn(BaseModel):
    table_name: str
    entries: list[WeightEntryIn]
    remark: str = ""


@app.post("/import/function")
def import_function(body: FunctionIn):
    segs = [SegmentModel(**s.model_dump()) for s in body.segments]
    func = FuncModel(name=body.name, segments=segs)
    _engine.import_function(func)
    return {"ok": True, "name": body.name}


@app.post("/import/weight-table")
def import_weight_table(body: WeightTableIn):
    entries = [EntryModel(**e.model_dump()) for e in body.entries]
    table = TableModel(name=body.name, entries=entries, version=body.version)
    _engine.import_weight_table(table, remark=body.remark)
    return {"ok": True, "name": body.name, "version": body.version}


@app.post("/import/boundary")
def import_boundary(body: BoundaryIn):
    notes = [NoteModel(**n) for n in body.items]
    _engine.import_boundary_notes(notes)
    return {"ok": True, "count": len(notes)}


@app.post("/supplement")
def supplement(body: SupplementIn):
    entries = [EntryModel(**e.model_dump()) for e in body.entries]
    _engine.supplement_weight_table(body.table_name, entries, remark=body.remark)
    table = _engine._weight_tables.get(body.table_name)
    return {"ok": True, "new_version": table.version if table else None}


@app.post("/calculate")
def calculate(body: CalculateIn):
    record = _engine.calculate(
        record_id=body.record_id,
        original_price=body.original_price,
        function_name=body.function_name,
        weight_table_name=body.weight_table_name,
        remark=body.remark,
    )
    return {
        "record_id": record.record_id,
        "final_price": record.final_price,
        "seg_no": record.seg_no,
        "discount_rate": record.discount_rate,
        "status": record.status.value,
        "gap_detail": record.gap_detail,
    }


@app.post("/recalculate")
def recalculate(body: RecalculateIn):
    record = _engine.recalculate(body.record_id, mark_old_caliber=body.mark_old_caliber)
    if record is None:
        return {"ok": False, "error": "记录不存在"}
    return {
        "record_id": record.record_id,
        "final_price": record.final_price,
        "seg_no": record.seg_no,
        "discount_rate": record.discount_rate,
        "status": record.status.value,
    }


@app.get("/records")
def get_records():
    return [
        {
            "record_id": r.record_id,
            "original_price": r.original_price,
            "score": r.score,
            "seg_no": r.seg_no,
            "discount_rate": r.discount_rate,
            "final_price": r.final_price,
            "status": r.status.value,
            "gap_detail": r.gap_detail,
            "remark": r.remark,
            "weight_table_version": r.weight_table_version,
        }
        for r in _engine.records
    ]


@app.get("/gaps")
def get_gaps():
    return {"report": _engine.format_gap_report()}


@app.get("/versions")
def get_versions():
    return {"page": _engine.version_manager.format_version_page()}


@app.post("/demo")
def run_demo():
    demo = load_demo_data()
    return {
        "boundary_notes": demo.format_boundary_notes(),
        "gap_report": demo.format_gap_report(),
        "versions": demo.version_manager.format_version_page(),
        "records": [
            {
                "record_id": r.record_id,
                "original_price": r.original_price,
                "final_price": r.final_price,
                "status": r.status.value,
                "gap_detail": r.gap_detail,
                "remark": r.remark,
            }
            for r in demo.records
        ],
    }
