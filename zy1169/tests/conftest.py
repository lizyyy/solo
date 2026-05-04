import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from models import db
from config import TestConfig


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def test_data_path():
    return os.path.join(os.path.dirname(__file__), '..', 'seeds')


@pytest.fixture
def good_data_path(test_data_path):
    return os.path.join(test_data_path, 'good')


@pytest.fixture
def bad_data_path(test_data_path):
    return os.path.join(test_data_path, 'bad')
