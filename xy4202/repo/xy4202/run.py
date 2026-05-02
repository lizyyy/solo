from __init__ import create_app
from extensions import db
import os

app = create_app()

with app.app_context():
    # 创建导出和上传目录
    os.makedirs(app.config['EXPORT_FOLDER'], exist_ok=True)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
