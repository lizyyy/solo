from flask import Flask
from config import Config
from app.database import db


def create_app(config_class=Config, start_background_jobs=False):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)

    with app.app_context():
        from app import routes
        app.register_blueprint(routes.bp)

        from app import background
        background.init_app(app, start_jobs=start_background_jobs)

    return app
