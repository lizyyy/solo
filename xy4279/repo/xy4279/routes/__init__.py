from routes.operation_routes import router as operation_router
from routes.import_routes import router as import_router
from routes.compare_routes import router as compare_router
from routes.check_routes import router as check_router
from routes.simulation_routes import router as simulation_router
from routes.export_routes import router as export_router
from routes.risk_routes import router as risk_router

__all__ = [
    "operation_router", "import_router", "compare_router", 
    "check_router", "simulation_router", "export_router", "risk_router"
]
