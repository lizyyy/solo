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
    print("社区充电桩容量排队系统")
    print("=" * 50)
    print("核心模块：")
    print("  1. 施工告示导入")
    print("  2. 无障碍坡道记录补录")
    print("  3. 点位清单生成与重算")
    print("  4. 冲突检测与人工确认")
    print("  5. 施工临时改道未同步地图复核")
    print("  6. 系统自检（重复导入/改道未同步/补录重算/导出一致）")
    print("  7. 审计追踪（谁改了什么、为什么、影响哪些结果）")
    print("  8. 统一数据源（页面/导出/接口共用同一份结果）")
    print("=" * 50)
