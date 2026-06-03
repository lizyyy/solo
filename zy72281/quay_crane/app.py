"""Flask 应用工厂."""
import os
from flask import Flask
from .config import Config
from .models import db


def create_app(config=None):
    app = Flask(
        __name__,
        template_folder=os.path.join(os.path.dirname(__file__), "templates"),
        static_folder=os.path.join(os.path.dirname(__file__), "static")
    )

    if config:
        app.config.from_object(config)
    else:
        app.config.from_object(Config)

    db.init_app(app)

    with app.app_context():
        from . import cli
        app.register_blueprint(cli.bp)

        from . import api
        app.register_blueprint(api.bp, url_prefix="/api")

        from . import dashboard
        app.register_blueprint(dashboard.bp)

        db.create_all()

    return app
