from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from database import init_database, get_db
from services import MigrationService
import uvicorn

app = FastAPI(
    title="食堂点餐系统数据迁移API",
    description="用于学校食堂点餐系统从旧版升级到新版的数据迁移服务",
    version="1.0.0"
)


class RerunSeedsRequest(BaseModel):
    seed_types: Optional[List[str]] = None


class ApplyMigrationRequest(BaseModel):
    dry_run: bool = True


@app.on_event("startup")
async def startup_event():
    init_database()


@app.get("/")
async def root():
    return {
        "service": "食堂点餐系统数据迁移API",
        "version": "1.0.0",
        "endpoints": {
            "GET /health": "健康检查",
            "POST /api/init": "一键初始化",
            "POST /api/import-old": "导入旧库样例",
            "GET /api/precheck": "预检差异",
            "POST /api/migrate": "应用迁移",
            "POST /api/rerun-seeds": "重跑种子（幂等）",
            "GET /api/report": "导出一致性报告",
            "GET /api/stats": "数据统计"
        }
    }


@app.get("/health")
async def health_check():
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")


@app.post("/api/init", summary="一键初始化")
async def one_click_init():
    """
    一键初始化数据库，写入所有种子数据（窗口、过敏原、角色、套餐）。
    幂等操作，重复执行会更新已有数据。
    """
    result = MigrationService.one_click_init()
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result["message"])


@app.post("/api/import-old", summary="导入旧库样例")
async def import_old_sample():
    """
    导入旧库样例数据，用于模拟旧版系统的数据状态。
    包含与新版数据有差异的样例数据。
    """
    result = MigrationService.import_old_sample()
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result["message"])


@app.get("/api/precheck", summary="预检差异")
async def precheck_diff():
    """
    检查当前数据库数据与预期种子数据的差异。
    返回：缺失项、不匹配项、冗余项。
    """
    result = MigrationService.precheck_diff()
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("message", "Precheck failed"))


@app.post("/api/migrate", summary="应用迁移")
async def apply_migration(request: ApplyMigrationRequest = None):
    """
    应用数据迁移，将数据库数据与预期种子数据对齐。
    
    - dry_run=true (默认): 仅预检，返回将执行的操作，不实际修改数据
    - dry_run=false: 实际执行迁移操作
    """
    dry_run = request.dry_run if request else True
    result = MigrationService.apply_migration(dry_run=dry_run)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result["message"])


@app.post("/api/rerun-seeds", summary="重跑种子（幂等）")
async def rerun_seeds(request: RerunSeedsRequest = None):
    """
    重跑种子数据，具有幂等性：
    - 不存在的种子：插入
    - 存在但hash不同：更新
    - 存在且hash相同：跳过
    
    seed_types 参数可指定要重跑的种子类型，不指定则重跑所有类型。
    可选类型: ["migration", "window", "allergen", "role", "package"]
    """
    seed_types = request.seed_types if request else None
    result = MigrationService.rerun_seeds(seed_types=seed_types)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result["message"])


@app.get("/api/report", summary="导出一致性报告")
async def export_report(format_type: str = Query("json", enum=["json", "markdown"])):
    """
    导出数据一致性报告。
    
    - format=json: 返回JSON格式报告
    - format=markdown: 返回Markdown格式报告
    """
    result = MigrationService.export_report(format_type=format_type)
    if result["success"]:
        if format_type == "markdown":
            return PlainTextResponse(
                content=result["content"],
                media_type="text/markdown"
            )
        else:
            return JSONResponse(content=result["content"])
    else:
        raise HTTPException(status_code=500, detail="Report generation failed")


@app.get("/api/stats", summary="数据统计")
async def get_stats():
    """
    获取当前数据库的数据统计信息。
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM windows")
        windows_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM allergens")
        allergens_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM roles")
        roles_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM packages")
        packages_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM batch_records")
        batches_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM manual_fixes")
        fixes_count = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT seed_type, status, COUNT(*) 
            FROM seed_inventory 
            GROUP BY seed_type, status
        ''')
        seed_stats = {}
        for row in cursor.fetchall():
            seed_type = row[0]
            status = row[1]
            count = row[2]
            if seed_type not in seed_stats:
                seed_stats[seed_type] = {}
            seed_stats[seed_type][status] = count
    
    return {
        "business_data": {
            "windows": windows_count,
            "allergens": allergens_count,
            "roles": roles_count,
            "packages": packages_count
        },
        "migration_data": {
            "batches": batches_count,
            "manual_fixes": fixes_count
        },
        "seed_inventory": seed_stats
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
