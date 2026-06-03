import os
from flask import Flask

from src.models.db import init_db
from src.routes.api import bp


def create_app(db_path=None):
    app = Flask(__name__)

    if db_path:
        from src.models import db as db_module
        db_module.DB_PATH = db_path

    init_db(db_path)
    app.register_blueprint(bp)

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
