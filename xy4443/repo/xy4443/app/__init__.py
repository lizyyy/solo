from flask import Flask
from flask_cors import CORS
import os

app = Flask(__name__, 
            static_folder='../static',
            template_folder='../templates')
CORS(app)

# 配置
app.config['SECRET_KEY'] = 'intertidal-2024-secret-key'
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
app.config['DATA_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max upload

# 创建必要的目录
for folder in [app.config['UPLOAD_FOLDER'], app.config['DATA_FOLDER']]:
    if not os.path.exists(folder):
        os.makedirs(folder)

from app import routes
