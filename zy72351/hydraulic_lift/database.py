import os
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "hydraulic_lift.db")


def init_db(app=None, db_path=None):
    if app is not None:
        db.init_app(app)
        with app.app_context():
            db.create_all()
    else:
        db.create_all()


def get_db_uri(db_path=None):
    path = db_path or DEFAULT_DB_PATH
    return "sqlite:///{}".format(path)
