import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app
client = TestClient(app)

GREEN = "[92m"
RED = "[91m"
YELLOW = "[93m"
BLUE = "[94m"
ENDC = "[0m"
BOLD = "[1m"

def print_step(n, t):
    sep = "=" * 60
    print(f"
{BOLD}{BLUE}{sep}{ENDC}")
    print(f"{BOLD}{BLUE} 步骤 {n}: {t}{ENDC}")
    print(f"{BOLD}{BLUE}{sep}{ENDC}")

def ok(m): print(f"{GREEN}OK - {m}{ENDC}")
def fail(m): print(f"{RED}FAIL - {m}{ENDC}")
def info(m): print(f"{YELLOW}  {m}{ENDC}")

results = []
sep = "=" * 60
print(f"
{BOLD}{GREEN}{sep}{ENDC}")
print(f"{BOLD}{GREEN}  API 闭环测试{ENDC}")
print(f"{BOLD}{GREEN}{sep}{ENDC}")

