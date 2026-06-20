import sys
import os
import io
import json
sys.path.insert(0, ".")

import pandas as pd
import numpy as np

if os.path.exists("medical_review.db"):
    os.remove("medical_review.db")

from app import app
from models import init_db
init_db()

client = app.test_client()
client.testing = True
