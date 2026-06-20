with open('run_e2e.py','r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    # Fix f-string backslash issue
    if "q001[\\\"current_status\\\"]" in line:
        lines[i] = line.replace("q001[\\\"current_status\\\"]", "q001.get(chr(34)+chr(99)+chr(117)+chr(114)+chr(114)+chr(101)+chr(110)+chr(116)+chr(95)+chr(115)+chr(116)+chr(97)+chr(116)+chr(117)+chr(115)+chr(34))")
    elif 'q002[' in line and 'current_status' in line:
        cs = 'current_status'
        lines[i] = line.replace('q002[\"current_status\"]', f'q002.get("{cs}")')
    elif 'q003[' in line and 'current_status' in line:
        cs = 'current_status'
        lines[i] = line.replace('q003[\"current_status\"]', f'q003.get("{cs}")')
    elif 'q001_after[' in line and 'current_status' in line:
        cs = 'current_status'
        lines[i] = line.replace('q001_after[\"current_status\"]', f'q001_after.get("{cs}")')

with open('run_e2e.py','w') as f:
    f.writelines(lines)
print('Done')
