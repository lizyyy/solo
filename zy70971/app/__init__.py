import os

from flask import Flask

from .extensions import db
from .routes import bp


def create_app() -> Flask:
    app = Flask(__name__)
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    db_path = os.path.join(base, "garden.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{db_path}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    from . import models  # noqa: F401

    with app.app_context():
        db.create_all()

    app.register_blueprint(bp, url_prefix="/api")
    return app
