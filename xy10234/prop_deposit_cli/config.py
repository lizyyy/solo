import os
from dataclasses import dataclass, field
from typing import List

BASE_DIR = os.environ.get('PROP_DEPOSIT_BASE_DIR', 
                         os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data_storage'))

DATA_DIR = os.path.join(BASE_DIR, "data")
PROBLEMS_DIR = os.path.join(BASE_DIR, "problems")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")


@dataclass
class DepositRules:
    DEFAULT_DEPOSIT_RATE: float = 1.0  
    MAX_DELAY_DAYS: int = 7  
    DELAY_FEE_RATE: float = 0.1  
    DAMAGE_DENOMINATOR: int = 10  
    MIN_DAMAGE_FEE: int = 50  


RULES = DepositRules()


def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PROBLEMS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
