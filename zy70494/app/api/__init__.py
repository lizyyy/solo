from flask import Blueprint

bp = Blueprint('api', __name__)

from app.api import suppliers, compression, evidence, reports, query, correction
