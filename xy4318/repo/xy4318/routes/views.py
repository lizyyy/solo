from flask import Blueprint, render_template

views_bp = Blueprint('views', __name__)

@views_bp.route('/')
def index():
    return render_template('index.html')

@views_bp.route('/detail/<int:risk_id>')
def detail(risk_id):
    return render_template('detail.html', risk_id=risk_id)
