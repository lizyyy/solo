import os

target = 'track_prediction_patch/examples/demo_verification.py'

lines = []
lines.append('"""')
lines.append('Verification Script')
lines.append('"""')
lines.append('')
lines.append('import json')
lines.append('import sys')
lines.append("sys.path.insert(0, '.')")
lines.append('')
lines.append('from track_prediction_patch.models import CandidateRecord')
lines.append('from track_prediction_patch.core import PatchWorkflow')
lines.append('')

with open(target, 'w') as f:
    f.write('\n'.join(lines) + '\n')
print('OK')
