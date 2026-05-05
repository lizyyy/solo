from flask import Flask, jsonify, request
from flask_restful import Api
import os
from datetime import datetime
from extensions import db

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forensic.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化扩展
db.init_app(app)
api = Api(app)

# 确保数据目录
os.makedirs('data', exist_ok=True)
os.makedirs('exports', exist_ok=True)

# 导入模型（在db初始化之后）
import models

# 导入路由
from routes.cases import cases_bp
from routes.evidence import evidence_bp
from routes.inspection import inspection_bp
from routes.inventory import inventory_bp
from routes.risk import risk_bp
from routes.export import export_bp
from routes.query import query_bp

# 注册蓝图
app.register_blueprint(cases_bp, url_prefix='/api/cases')
app.register_blueprint(evidence_bp, url_prefix='/api/evidence')
app.register_blueprint(inspection_bp, url_prefix='/api/inspection')
app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
app.register_blueprint(risk_bp, url_prefix='/api/risk')
app.register_blueprint(export_bp, url_prefix='/api/export')
app.register_blueprint(query_bp, url_prefix='/api/query')

# 初始化数据库
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return jsonify({
        'name': '司法鉴定所管理系统 API',
        'version': '1.0.0',
        'status': '运行中',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
