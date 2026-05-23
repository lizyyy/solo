with open('app/services.py', 'w') as f:
    f.write('from typing import Dict, List, Optional
')
    f.write('from datetime import datetime, date
')
    f.write('import uuid
')
    f.write('import pandas as pd
')
    f.write('import json
')
    f.write('from io import StringIO
')
    f.write('from app.models import (
')
    f.write('    ClaimRecord, FlightInfo, PhotoIndex, CompensationRule,
')
    f.write('    ComparisonResult, ReviewRecord, ReconciliationSummary,
')
    f.write('    ReviewStatus, DiscrepancyType, DiscrepancyItem
')
    f.write(')
')
    f.write('

')
print('Step1 done')
