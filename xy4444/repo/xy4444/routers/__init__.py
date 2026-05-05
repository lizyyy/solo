from routers.flight import router as flight_router
from routers.deice import router as deice_router
from routers.weather import router as weather_router
from routers.gate import router as gate_router
from routers.release import router as release_router
from routers.export import router as export_router

__all__ = [
    "flight_router",
    "deice_router",
    "weather_router",
    "gate_router",
    "release_router",
    "export_router"
]
