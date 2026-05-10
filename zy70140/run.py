from app import create_app, db
import os

app = create_app()

def init_db():
    with app.app_context():
        db.create_all()
        print("数据库初始化完成")

if __name__ == '__main__':
    if not os.path.exists('audit.db'):
        init_db()
    app.run(debug=True, port=5000, host='0.0.0.0')
