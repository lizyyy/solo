from app.db import init_db
from app.routes import app

init_db()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
