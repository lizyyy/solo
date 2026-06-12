from services.data_repository import DataRepository
from services.audit_service import AuditService
from services.import_service import ImportService
from services.conflict_service import ConflictService
from services.point_service import PointService
from services.self_check_service import SelfCheckService


def create_services():
    repo = DataRepository()
    audit = AuditService(repo)
    import_svc = ImportService(repo, audit)
    conflict_svc = ConflictService(repo, audit)
    point_svc = PointService(repo, audit)
    self_check_svc = SelfCheckService(repo, audit)

    return {
        "repository": repo,
        "audit": audit,
        "import_service": import_svc,
        "conflict_service": conflict_svc,
        "point_service": point_svc,
        "self_check_service": self_check_svc,
    }


if __name__ == "__main__":
    import uvicorn
    from api.routes import create_app

    app = create_app()
    print("=" * 70)
    print("社区充电桩容量排队系统 - FastAPI 后端服务")
    print("=" * 70)
    print("启动地址: http://127.0.0.1:8000")
    print("API 文档: http://127.0.0.1:8000/docs")
    print("模块清单: http://127.0.0.1:8000/api/v1/")
    print("=" * 70)
    print()
    uvicorn.run(app, host="127.0.0.1", port=8000)
