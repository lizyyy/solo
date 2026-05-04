from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    db.init_app(app)
    CORS(app)
    
    from routes.main import main as main_blueprint
    from routes.api import api as api_blueprint
    
    app.register_blueprint(main_blueprint)
    app.register_blueprint(api_blueprint, url_prefix='/api')
    
    return app

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {'db': db}

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        from models.sample_data import init_sample_data
        init_sample_data()
    app.run(debug=True, port=5000)
