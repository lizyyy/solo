from app import create_app, db

app = create_app('development')

with app.app_context():
    db.create_all()
    print("数据库初始化完成")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
