from flask import Blueprint, render_template, send_from_directory, current_app
import os

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        filename
    )
