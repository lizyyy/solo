"""FastAPI Web API 应用"""

import json
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from narrtool.database import (
    init_db,
    session_scope,
    Screening,
    Subtitle,
    Narration,
    VolunteerSchedule,
    CheckResult,
    CheckType,
    CheckStatus,
    Severity,
)
from narrtool.services import ScreeningService, CheckService
from narrtool.exporters import MarkdownExporter, CSVExporter, JSONExporter
from narrtool.config import config


class ScreeningCreate(BaseModel):
    movie_name: str
    screening_time: str
    duration: float
    location: Optional[str] = None


class ScreeningResponse(BaseModel):
    id: int
    movie_name: str
    screening_time: str
    duration: float
    location: Optional[str]
    created_at: str
    updated_at: str


class CheckResultResponse(BaseModel):
    id: int
    screening_id: int
    check_type: str
    severity: str
    status: str
    description: str
    related_ids: Optional[str]
    time_start: Optional[float]
    time_end: Optional[float]
    notes: Optional[str]
    created_at: str
    updated_at: str


class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class StatisticsResponse(BaseModel):
    total: int
    by_type: Dict[str, int]
    by_status: Dict[str, int]
    by_severity: Dict[str, int]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    init_db()
    yield


def create_app() -> FastAPI:
    """创建 FastAPI 应用"""
    app = FastAPI(
        title="口述影像检查工具 API",
        description="给口述影像志愿者使用的本地命令行工具 API",
        version="1.0.0",
        lifespan=lifespan,
    )
    
    @app.get("/", response_class=HTMLResponse)
    async def index():
        """获取复核页面"""
        static_dir = Path(__file__).parent / "static"
        index_path = static_dir / "index.html"
        
        if index_path.exists():
            return FileResponse(index_path)
        
        return HTMLResponse(
            content="""
            <html>
                <head><title>口述影像检查工具</title></head>
                <body>
                    <h1>口述影像检查工具</h1>
                    <p>API 服务正在运行中。</p>
                    <p>请查看 <a href="/docs">API 文档</a></p>
                </body>
            </html>
            """,
            status_code=200
        )
    
    @app.get("/api/screenings", response_model=List[ScreeningResponse])
    async def list_screenings():
        """获取所有场次"""
        with session_scope() as session:
            screenings = session.query(Screening).order_by(Screening.screening_time).all()
            return [_screening_to_response(s) for s in screenings]
    
    @app.post("/api/screenings", response_model=ScreeningResponse)
    async def create_screening(screening: ScreeningCreate):
        """创建新场次"""
        try:
            screening_time = datetime.fromisoformat(screening.screening_time)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的时间格式，请使用 ISO 格式")
        
        with session_scope() as session:
            service = ScreeningService(session)
            s = service.create_screening(
                movie_name=screening.movie_name,
                screening_time=screening_time,
                duration=screening.duration,
                location=screening.location,
            )
            return _screening_to_response(s)
    
    @app.get("/api/screenings/{screening_id}", response_model=ScreeningResponse)
    async def get_screening(screening_id: int):
        """获取单个场次"""
        with session_scope() as session:
            screening = session.query(Screening).filter(Screening.id == screening_id).first()
            if not screening:
                raise HTTPException(status_code=404, detail="场次不存在")
            return _screening_to_response(screening)
    
    @app.delete("/api/screenings/{screening_id}")
    async def delete_screening(screening_id: int):
        """删除场次"""
        with session_scope() as session:
            service = ScreeningService(session)
            if service.delete_screening(screening_id):
                return {"message": "删除成功"}
            raise HTTPException(status_code=404, detail="场次不存在")
    
    @app.post("/api/screenings/{screening_id}/import/subtitles")
    async def import_subtitles(screening_id: int, file: UploadFile = File(...)):
        """导入 SRT 字幕"""
        temp_path = config.data_dir / f"temp_{screening_id}.srt"
        
        try:
            content = await file.read()
            with open(temp_path, 'wb') as f:
                f.write(content)
            
            with session_scope() as session:
                service = ScreeningService(session)
                count = service.import_subtitles(screening_id, temp_path)
                return {"message": f"成功导入 {count} 条字幕", "count": count}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        finally:
            if temp_path.exists():
                temp_path.unlink()
    
    @app.post("/api/screenings/{screening_id}/import/script")
    async def import_script(screening_id: int, file: UploadFile = File(...)):
        """导入口述稿 JSON"""
        temp_path = config.data_dir / f"temp_script_{screening_id}.json"
        
        try:
            content = await file.read()
            with open(temp_path, 'wb') as f:
                f.write(content)
            
            with session_scope() as session:
                service = ScreeningService(session)
                count = service.import_script(screening_id, temp_path)
                return {"message": f"成功导入 {count} 条口述段落", "count": count}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        finally:
            if temp_path.exists():
                temp_path.unlink()
    
    @app.post("/api/screenings/{screening_id}/import/volunteers")
    async def import_volunteers(screening_id: int, file: UploadFile = File(...)):
        """导入志愿者排班"""
        temp_path = config.data_dir / f"temp_volunteers_{screening_id}.csv"
        
        try:
            content = await file.read()
            with open(temp_path, 'wb') as f:
                f.write(content)
            
            with session_scope() as session:
                service = ScreeningService(session)
                count = service.import_volunteers(screening_id, temp_path)
                return {"message": f"成功导入 {count} 条志愿者记录", "count": count}
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        finally:
            if temp_path.exists():
                temp_path.unlink()
    
    @app.post("/api/screenings/{screening_id}/checks")
    async def run_checks(screening_id: int):
        """运行检查"""
        with session_scope() as session:
            screening = session.query(Screening).filter(
                Screening.id == screening_id
            ).first()
            if not screening:
                raise HTTPException(status_code=404, detail="场次不存在")
            
            service = CheckService(session)
            results = service.run_checks(screening_id)
            return {"message": f"完成检查，发现 {len(results)} 个问题", "count": len(results)}
    
    @app.get("/api/screenings/{screening_id}/checks", response_model=List[CheckResultResponse])
    async def list_check_results(
        screening_id: int,
        check_type: Optional[str] = None,
        status: Optional[str] = None,
        severity: Optional[str] = None,
    ):
        """获取检查结果"""
        with session_scope() as session:
            service = CheckService(session)
            
            c_type = CheckType(check_type) if check_type else None
            c_status = CheckStatus(status) if status else None
            c_severity = Severity(severity) if severity else None
            
            try:
                results = service.get_results(
                    screening_id=screening_id,
                    check_type=c_type,
                    status=c_status,
                    severity=c_severity,
                )
                return [_result_to_response(r) for r in results]
            except ValueError:
                raise HTTPException(status_code=400, detail="无效的筛选参数")
    
    @app.get("/api/checks/{result_id}", response_model=CheckResultResponse)
    async def get_check_result(result_id: int):
        """获取单个检查结果"""
        with session_scope() as session:
            service = CheckService(session)
            result = service.get_result(result_id)
            if not result:
                raise HTTPException(status_code=404, detail="检查结果不存在")
            return _result_to_response(result)
    
    @app.patch("/api/checks/{result_id}")
    async def update_check_status(result_id: int, update: StatusUpdate):
        """更新检查结果状态（改判）"""
        try:
            status = CheckStatus(update.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的状态: {update.status}")
        
        with session_scope() as session:
            service = CheckService(session)
            if service.update_status(result_id, status, update.notes):
                return {"message": "更新成功"}
            raise HTTPException(status_code=404, detail="检查结果不存在")
    
    @app.put("/api/checks/{result_id}/notes")
    async def add_notes(result_id: int, notes: str = Form(...)):
        """添加备注"""
        with session_scope() as session:
            service = CheckService(session)
            if service.add_notes(result_id, notes):
                return {"message": "备注添加成功"}
            raise HTTPException(status_code=404, detail="检查结果不存在")
    
    @app.get("/api/screenings/{screening_id}/statistics", response_model=StatisticsResponse)
    async def get_statistics(screening_id: Optional[int] = None):
        """获取检查统计"""
        with session_scope() as session:
            service = CheckService(session)
            stats = service.get_statistics(screening_id=screening_id)
            return StatisticsResponse(**stats)
    
    @app.get("/api/screenings/{screening_id}/export/markdown")
    async def export_markdown(screening_id: int):
        """导出 Markdown 交付单"""
        with session_scope() as session:
            screening = session.query(Screening).filter(
                Screening.id == screening_id
            ).first()
            if not screening:
                raise HTTPException(status_code=404, detail="场次不存在")
            
            exporter = MarkdownExporter(session)
            output_path = config.export_dir / f"delivery_{screening_id}.md"
            exporter.export(screening_id, output_path)
            
            return FileResponse(
                output_path,
                media_type="text/markdown",
                filename=f"{screening.movie_name}_交付单.md"
            )
    
    @app.get("/api/screenings/{screening_id}/export/csv")
    async def export_csv(screening_id: int, include_dismissed: bool = False):
        """导出 CSV 问题清单"""
        with session_scope() as session:
            screening = session.query(Screening).filter(
                Screening.id == screening_id
            ).first()
            if not screening:
                raise HTTPException(status_code=404, detail="场次不存在")
            
            exporter = CSVExporter(session)
            output_path = config.export_dir / f"issues_{screening_id}.csv"
            exporter.export(screening_id, output_path, include_dismissed=include_dismissed)
            
            return FileResponse(
                output_path,
                media_type="text/csv",
                filename=f"{screening.movie_name}_问题清单.csv"
            )
    
    @app.get("/api/screenings/{screening_id}/export/json")
    async def export_json(screening_id: int, include_source_data: bool = True):
        """导出 JSON 审计包"""
        with session_scope() as session:
            screening = session.query(Screening).filter(
                Screening.id == screening_id
            ).first()
            if not screening:
                raise HTTPException(status_code=404, detail="场次不存在")
            
            exporter = JSONExporter(session)
            output_path = config.export_dir / f"audit_{screening_id}.json"
            exporter.export(screening_id, output_path, include_source_data=include_source_data)
            
            return FileResponse(
                output_path,
                media_type="application/json",
                filename=f"{screening.movie_name}_审计包.json"
            )
    
    return app


def _screening_to_response(screening: Screening) -> ScreeningResponse:
    """将 Screening 模型转换为响应模型"""
    return ScreeningResponse(
        id=screening.id,
        movie_name=screening.movie_name,
        screening_time=screening.screening_time.isoformat() if screening.screening_time else "",
        duration=screening.duration,
        location=screening.location,
        created_at=screening.created_at.isoformat() if screening.created_at else "",
        updated_at=screening.updated_at.isoformat() if screening.updated_at else "",
    )


def _result_to_response(result: CheckResult) -> CheckResultResponse:
    """将 CheckResult 模型转换为响应模型"""
    return CheckResultResponse(
        id=result.id,
        screening_id=result.screening_id,
        check_type=result.check_type.value,
        severity=result.severity.value,
        status=result.status.value,
        description=result.description,
        related_ids=result.related_ids,
        time_start=result.time_start,
        time_end=result.time_end,
        notes=result.notes,
        created_at=result.created_at.isoformat() if result.created_at else "",
        updated_at=result.updated_at.isoformat() if result.updated_at else "",
    )


app = create_app()
