from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import date
import os
import tempfile
from app.services import (
    DataStore, DataImporter, ComparisonEngine, 
    ReviewService, RecalculationService, ReportGenerator, ExplanationGenerator
)
from app.models import ReviewStatus

global_store = DataStore()



def create_app() -> FastAPI:
    app = FastAPI(
        title="航班延误申诉自动比对系统 API",
        description="提供数据导入、自动比对、人工复核、报告生成等功能",
        version="1.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def get_data_store() -> DataStore:
        return global_store

    def get_data_importer(store: DataStore = Depends(get_data_store)) -> DataImporter:
        return DataImporter(store)

    def get_comparison_engine(store: DataStore = Depends(get_data_store)) -> ComparisonEngine:
        return ComparisonEngine(store)

    def get_review_service(store: DataStore = Depends(get_data_store)) -> ReviewService:
        return ReviewService(store)

    def get_recalculation_service(
        store: DataStore = Depends(get_data_store),
        engine: ComparisonEngine = Depends(get_comparison_engine)
    ) -> RecalculationService:
        return RecalculationService(store, engine)

    def get_explanation_generator() -> ExplanationGenerator:
        return ExplanationGenerator()

    def get_report_generator(
        store: DataStore = Depends(get_data_store),
        explainer: ExplanationGenerator = Depends(get_explanation_generator)
    ) -> ReportGenerator:
        return ReportGenerator(store, explainer)

    @app.get("/", tags=["系统"], summary="系统健康检查")
    async def root():
        return {"status": "ok", "message": "航班延误申诉自动比对系统 API 运行正常"}

    @app.post("/api/import/claims/csv", tags=["数据导入"], summary="导入申诉数据 (CSV)")
    async def import_claims_csv(
        file: UploadFile = File(...),
        importer: DataImporter = Depends(get_data_importer)
    ):
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="请上传CSV格式文件")
        content = await file.read()
        csv_content = content.decode('utf-8')
        result = importer.import_claims_csv(csv_content)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
        return result

    @app.post("/api/import/claims/json", tags=["数据导入"], summary="导入申诉数据 (JSON)")
    async def import_claims_json(
        file: UploadFile = File(...),
        importer: DataImporter = Depends(get_data_importer)
    ):
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="请上传JSON格式文件")
        content = await file.read()
        json_content = content.decode('utf-8')
        result = importer.import_claims_json(json_content)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
        return result

    @app.post("/api/import/flights/csv", tags=["数据导入"], summary="导入航班数据 (CSV)")
    async def import_flights_csv(
        file: UploadFile = File(...),
        importer: DataImporter = Depends(get_data_importer)
    ):
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="请上传CSV格式文件")
        content = await file.read()
        csv_content = content.decode('utf-8')
        result = importer.import_flights_csv(csv_content)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
        return result

    @app.post("/api/import/flights/json", tags=["数据导入"], summary="导入航班数据 (JSON)")
    async def import_flights_json(
        file: UploadFile = File(...),
        importer: DataImporter = Depends(get_data_importer)
    ):
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="请上传JSON格式文件")
        content = await file.read()
        json_content = content.decode('utf-8')
        result = importer.import_flights_json(json_content)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
        return result

    @app.post("/api/import/photos", tags=["数据导入"], summary="导入照片索引数据")
    async def import_photos(
        file: UploadFile = File(...),
        importer: DataImporter = Depends(get_data_importer)
    ):
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="请上传JSON格式文件")
        content = await file.read()
        json_content = content.decode('utf-8')
        result = importer.import_photos_index(json_content)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
        return result

    @app.post("/api/import/rules", tags=["数据导入"], summary="导入赔付规则数据")
    async def import_rules(
        file: UploadFile = File(...),
        importer: DataImporter = Depends(get_data_importer)
    ):
        if not file.filename.endswith('.json'):
            raise HTTPException(status_code=400, detail="请上传JSON格式文件")
        content = await file.read()
        json_content = content.decode('utf-8')
        result = importer.import_rules_json(json_content)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "导入失败"))
        return result

    @app.post("/api/compare/all", tags=["自动比对"], summary="批量自动比对所有申诉")
    async def compare_all(
        engine: ComparisonEngine = Depends(get_comparison_engine),
        store: DataStore = Depends(get_data_store)
    ):
        results = engine.compare_all()
        return {
            "success": True,
            "total": len(results),
            "results": [result.model_dump() for result in results]
        }

    @app.post("/api/compare/{claim_id}", tags=["自动比对"], summary="比对单条申诉")
    async def compare_single(
        claim_id: str,
        engine: ComparisonEngine = Depends(get_comparison_engine),
        store: DataStore = Depends(get_data_store)
    ):
        claim = store.get_claim(claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail=f"未找到申诉ID: {claim_id}")
        result = engine.compare_claim(claim)
        store.add_comparison_result(result)
        return {"success": True, "result": result.model_dump()}

    @app.get("/api/comparisons", tags=["自动比对"], summary="获取所有比对结果")
    async def get_all_comparisons(
        store: DataStore = Depends(get_data_store)
    ):
        results = store.get_all_comparison_results()
        return {
            "success": True,
            "count": len(results),
            "results": [result.model_dump() for result in results]
        }

    @app.get("/api/comparisons/{claim_id}", tags=["自动比对"], summary="获取单条比对结果")
    async def get_comparison(
        claim_id: str,
        store: DataStore = Depends(get_data_store)
    ):
        result = store.get_comparison_result(claim_id)
        if not result:
            raise HTTPException(status_code=404, detail=f"未找到申诉ID: {claim_id}")
        return {"success": True, "result": result.model_dump()}

    @app.post("/api/review/{claim_id}", tags=["人工复核"], summary="人工复核单条申诉")
    async def review_claim(
        claim_id: str,
        reviewer: str = Form(...),
        status: ReviewStatus = Form(...),
        reviewed_amount: float = Form(...),
        review_notes: str = Form(...),
        adjustment_reason: Optional[str] = Form(None),
        review_service: ReviewService = Depends(get_review_service)
    ):
        result = review_service.review_claim(
            claim_id=claim_id,
            reviewer=reviewer,
            status=status,
            reviewed_amount=reviewed_amount,
            review_notes=review_notes,
            adjustment_reason=adjustment_reason
        )
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "复核失败"))
        return result

    @app.get("/api/review/pending", tags=["人工复核"], summary="获取待复核列表")
    async def get_pending_reviews(
        review_service: ReviewService = Depends(get_review_service)
    ):
        results = review_service.get_pending_reviews()
        return {
            "success": True,
            "count": len(results),
            "results": [result.model_dump() for result in results]
        }

    @app.post("/api/recalculate/{claim_id}", tags=["重新计算"], summary="重新计算单条申诉")
    async def recalculate_claim(
        claim_id: str,
        reason: str = Form("重新计算"),
        recalc_service: RecalculationService = Depends(get_recalculation_service)
    ):
        result = recalc_service.recalculate_claim(claim_id, reason)
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "重新计算失败"))
        return result

    @app.post("/api/recalculate/all", tags=["重新计算"], summary="重新计算所有申诉")
    async def recalculate_all(
        reason: str = Form("批量重新计算"),
        recalc_service: RecalculationService = Depends(get_recalculation_service)
    ):
        results = recalc_service.recalculate_all(reason)
        return {
            "success": True,
            "total": len(results),
            "results": results
        }

    @app.get("/api/report/{claim_id}", tags=["报告生成"], summary="生成单条申诉详细报告")
    async def get_detail_report(
        claim_id: str,
        report_generator: ReportGenerator = Depends(get_report_generator)
    ):
        report = report_generator.generate_detail_report(claim_id)
        if not report.get("success"):
            raise HTTPException(status_code=404, detail=report.get("error", "生成报告失败"))
        return report

    @app.get("/api/export/csv", tags=["报告导出"], summary="导出CSV格式报告")
    async def export_csv(
        report_generator: ReportGenerator = Depends(get_report_generator)
    ):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig') as f:
            temp_path = f.name
        result = report_generator.export_to_csv(temp_path)
        if not result.get("success"):
            os.unlink(temp_path)
            raise HTTPException(status_code=400, detail=result.get("error", "导出失败"))
        return FileResponse(
            temp_path,
            media_type="text/csv",
            filename=f"reconciliation_report_{date.today()}.csv"
        )

    @app.get("/api/export/excel", tags=["报告导出"], summary="导出Excel格式报告")
    async def export_excel(
        report_generator: ReportGenerator = Depends(get_report_generator)
    ):
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
            temp_path = f.name
        result = report_generator.export_to_excel(temp_path)
        if not result.get("success"):
            os.unlink(temp_path)
            raise HTTPException(status_code=400, detail=result.get("error", "导出失败"))
        return FileResponse(
            temp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"reconciliation_report_{date.today()}.xlsx"
        )

    @app.get("/api/statistics/summary", tags=["汇总统计"], summary="获取汇总统计")
    async def get_summary_statistics(
        report_generator: ReportGenerator = Depends(get_report_generator)
    ):
        summary = report_generator.generate_summary()
        return {"success": True, "summary": summary.model_dump()}

    @app.get("/api/statistics/claims", tags=["汇总统计"], summary="获取申诉列表统计")
    async def get_claims_statistics(
        store: DataStore = Depends(get_data_store)
    ):
        claims = store.get_all_claims()
        total_amount = sum(claim.claim_amount for claim in claims)
        return {
            "success": True,
            "total_claims": len(claims),
            "total_claimed_amount": total_amount,
            "claims": [claim.model_dump() for claim in claims]
        }

    @app.get("/api/statistics/flights", tags=["汇总统计"], summary="获取航班列表统计")
    async def get_flights_statistics(
        store: DataStore = Depends(get_data_store)
    ):
        flights = store.get_all_flights()
        delayed_flights = [f for f in flights if f.delay_minutes > 0]
        avg_delay = sum(f.delay_minutes for f in delayed_flights) / len(delayed_flights) if delayed_flights else 0
        return {
            "success": True,
            "total_flights": len(flights),
            "delayed_flights": len(delayed_flights),
            "average_delay_minutes": round(avg_delay, 2),
            "flights": [flight.model_dump() for flight in flights]
        }

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
