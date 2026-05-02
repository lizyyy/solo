from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import config

db = SQLAlchemy()


def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)

    from routes.pottery_routes import pottery_bp
    from routes.group_routes import group_bp
    from routes.import_routes import import_bp
    from routes.export_routes import export_bp
    from routes.review_routes import review_bp

    app.register_blueprint(pottery_bp, url_prefix='/api/pottery')
    app.register_blueprint(group_bp, url_prefix='/api/groups')
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(export_bp, url_prefix='/api/export')
    app.register_blueprint(review_bp, url_prefix='/api/review')

    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app('development')
    app.run(host='0.0.0.0', port=5000, debug=True)
