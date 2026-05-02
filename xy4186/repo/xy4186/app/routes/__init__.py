from app.routes.import_routes import import_bp
from app.routes.query_routes import query_bp
from app.routes.validation_routes import validation_bp
from app.routes.export_routes import export_bp
from app.routes.opinion_routes import opinion_bp

__all__ = [
    'import_bp',
    'query_bp',
    'validation_bp',
    'export_bp',
    'opinion_bp'
]
