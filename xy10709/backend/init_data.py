from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models, crud, schemas
import json

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("Initializing data...")

orgs_data = [
    {"name": "技术部", "code": "TECH", "description": "技术研发部门"},
    {"name": "产品部", "code": "PROD", "description": "产品设计部门"},
    {"name": "运营部", "code": "OPS", "description": "运营推广部门"},
    {"name": "财务部", "code": "FIN", "description": "财务管理部门"},
]

for org_data in orgs_data:
    org = schemas.OrganizationCreate(**org_data)
    try:
        crud.create_organization(db, org)
        print(f"Created organization: {org_data['name']}")
    except:
        db.rollback()
        print(f"Organization already exists: {org_data['name']}")

rules_data = [
    {
        "name": "恶意脚本检测",
        "rule_type": "content",
        "pattern": "<script>",
        "description": "检测HTML恶意脚本注入",
        "severity": "high",
        "action": "isolate"
    },
    {
        "name": "恶意软件关键词",
        "rule_type": "content",
        "pattern": "malware,virus,trojan",
        "description": "检测恶意软件相关关键词",
        "severity": "critical",
        "action": "isolate"
    },
    {
        "name": "可执行文件限制",
        "rule_type": "filetype",
        "pattern": "exe,bat,cmd",
        "description": "限制可执行文件上传",
        "severity": "medium",
        "action": "isolate"
    }
]

for rule_data in rules_data:
    rule = schemas.ScanRuleCreate(**rule_data)
    crud.create_scan_rule(db, rule)
    print(f"Created rule: {rule_data['name']}")

print("\nCreating sample upload tasks...")

org1 = db.query(models.Organization).filter(models.Organization.code == "TECH").first()
org2 = db.query(models.Organization).filter(models.Organization.code == "PROD").first()

safe_content = b"This is a safe document with normal content. No threats detected here."
task1 = crud.create_upload_task(db, safe_content, "safe_document.txt", org1.id, "admin")
crud.scan_upload_task(db, task1.id)
print(f"Created safe task: {task1.task_id}")

warning_content = b"This file contains the word malware which triggers a warning. Also includes trojan pattern."
task2 = crud.create_upload_task(db, warning_content, "suspicious_file.txt", org2.id, "user1")
crud.scan_upload_task(db, task2.id)
print(f"Created warning task: {task2.task_id}")

critical_content = b"Dangerous content with malware, virus, trojan, ransomware, and exploit all present."
task3 = crud.create_upload_task(db, critical_content, "malicious_file.txt", org1.id, "user2")
crud.scan_upload_task(db, task3.id)
print(f"Created critical task: {task3.task_id}")

exe_content = b"This is a fake exe file content"
task4 = crud.create_upload_task(db, exe_content, "program.exe", org2.id, "user3")
crud.scan_upload_task(db, task4.id)
print(f"Created exe task: {task4.task_id}")

print("\nManually releasing one task to demonstrate difference...")
crud.release_from_isolation(db, task2.id, "security_admin", "经过人工审核，确认是误报，予以放行")
print(f"Released task: {task2.task_id}")

print("\nData initialization complete!")
print("\nSample data summary:")
print(f"- 4 organizations created")
print(f"- 3 scan rules created")
print(f"- 4 upload tasks created (1 safe, 3 flagged)")
print(f"- 1 task manually released to show state difference")
print("\nKey states to observe:")
print("- Task 1: scanned/allowed (safe)")
print("- Task 2: released (warning -> manually approved)")
print("- Task 3: quarantined/isolated (critical)")
print("- Task 4: quarantined/isolated (exe file type)")

db.close()
