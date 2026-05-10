
from app import create_app
from config import Config
import os

if __name__ == '__main__':
    app = create_app()
    
    if not os.path.exists(Config.EXPORT_DIR):
        os.makedirs(Config.EXPORT_DIR)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
