
import subprocess
import sys
result = subprocess.run([sys.executable, "cbw.py", "--create-sample", "test_cron.txt"], capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("RC:", result.returncode)

