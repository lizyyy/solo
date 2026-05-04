import os
import pandas as pd
import yaml
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import current_app
from models import db, Project, DatasetVersion

ALLOWED_EXTENSIONS = {'csv', 'yaml', 'yml'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def save_file(file, upload_folder, subfolder=''):
    if not file or not allowed_file(file.filename):
        raise ValueError('Invalid file type')
    
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    name, ext = os.path.splitext(filename)
    new_filename = f"{name}_{timestamp}{ext}"
    
    save_path = os.path.join(upload_folder, subfolder)
    os.makedirs(save_path, exist_ok=True)
    
    file_path = os.path.join(save_path, new_filename)
    file.save(file_path)
    
    return file_path, new_filename

def process_raw_data(file_path, project_id):
    df = pd.read_csv(file_path)
    
    version = f"v{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    dataset_version = DatasetVersion(
        project_id=project_id,
        version=version,
        file_path=file_path,
        file_name=os.path.basename(file_path),
        row_count=len(df),
        column_count=len(df.columns),
        columns=','.join(df.columns.tolist())
    )
    
    db.session.add(dataset_version)
    db.session.commit()
    
    return dataset_version

def load_yaml_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)

def validate_yaml_file(file_path, expected_keys=None):
    try:
        data = load_yaml_file(file_path)
        if expected_keys:
            for key in expected_keys:
                if key not in data:
                    return False, f"Missing key: {key}"
        return True, None
    except yaml.YAMLError as e:
        return False, f"YAML parse error: {str(e)}"
    except Exception as e:
        return False, str(e)
