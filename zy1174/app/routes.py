from flask import Blueprint, render_template, send_from_directory
import os

main = Blueprint('main', __name__)

@main.route('/')
def index():
    return render_template('index.html')

@main.route('/static/<path:filename>')
def serve_static(filename):
    return send_from_directory('static', filename)
