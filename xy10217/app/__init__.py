from flask import Flask, render_template
from flask_cors import CORS
import os

def create_app():
    app = Flask(__name__, 
                static_folder=os.path.join(os.path.dirname(__file__), '..', 'static'),
                template_folder=os.path.join(os.path.dirname(__file__), '..', 'templates'))
    CORS(app)
    
    from app.routes import main_bp
    app.register_blueprint(main_bp)
    
    @app.route('/')
    def index():
        return render_template('index.html')
    
    return app
