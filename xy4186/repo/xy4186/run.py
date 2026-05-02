import os
from app import create_app

app = create_app(os.getenv('FLASK_ENV', 'default'))

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    
    print("=" * 60)
    print("广告串播合规回放台 API 服务")
    print("=" * 60)
    print(f"数据库: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"上传目录: {app.config['UPLOAD_FOLDER']}")
    print(f"导出目录: {app.config['EXPORT_FOLDER']}")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
