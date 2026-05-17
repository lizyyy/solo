import requests
import os
import tempfile
import shutil
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:8000/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.ENDC}")

def wait_for_server(timeout=10):
    print_info("等待服务器启动...")
    start = time.time()
    while time.time() - start < timeout:
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=2)
            if response.status_code == 200:
                print_success("服务器已启动")
                return True
        except:
            pass
        time.sleep(0.5)
    print_error("服务器启动超时")
    return False

def test_student_import():
    print_info("\n=== 测试学生导入 ===")
    test_students = [
        {"student_id": "2021001001", "name": "张三", "class_name": "计科1班", "email": "zhangsan@test.com"},
        {"student_id": "2021001002", "name": "李四", "class_name": "计科1班"},
        {"student_id": "2021001003", "name": "王五", "class_name": "计科1班"},
        {"student_id": "2021001004", "name": "赵六", "class_name": "计科2班"},
        {"student_id": "2021001005", "name": "钱七", "class_name": "计科2班"},
        {"name": "缺学号的学生", "class_name": "计科1班"},
    ]
    response = requests.post(f"{BASE_URL}/students/import", json={"students": test_students})
    result = response.json()
    if result.get("imported") == 5 and len(result.get("errors", [])) == 1:
        print_success("学生导入成功，正确识别了缺字段错误")
        print_info(f"  导入: {result.get('imported')}, 跳过: {result.get('skipped')}, 错误: {len(result.get('errors', []))}")
        return True
    else:
        print_error(f"学生导入失败: {result}")
        return False

def test_assignment_creation():
    print_info("\n=== 测试作业创建 ===")
    deadline = (datetime.utcnow() + timedelta(days=7)).isoformat()
    assignment_data = {
        "name": "期末大作业",
        "deadline": deadline,
        "allowed_file_types": ".pdf,.docx,.zip"
    }
    response = requests.post(f"{BASE_URL}/assignments", json=assignment_data)
    result = response.json()
    if response.status_code == 200 and "id" in result:
        print_success(f"作业创建成功: {result.get('name')}, ID: {result.get('id')}")
        return result.get("id")
    else:
        print_error(f"作业创建失败: {result}")
        return None

def test_student_list():
    print_info("\n=== 测试学生列表查询 ===")
    response = requests.get(f"{BASE_URL}/students")
    result = response.json()
    students = result.get("students", [])
    if len(students) >= 5:
        print_success(f"学生列表查询成功，共 {len(students)} 名学生")
        return True
    else:
        print_error(f"学生列表查询失败: {result}")
        return False

def test_filename_parsing():
    print_info("\n=== 测试学号解析 ===")
    test_cases = [
        ("2021001001_张三_期末大作业.pdf", "2021001001"),
        ("学号2021001002_李四.docx", "2021001002"),
        ("作业_2021001003王五.zip", "2021001003"),
        ("ID-2021001004-赵六.pdf", "2021001004"),
        ("无学号的作业.pdf", None),
    ]
    success_count = 0
    for filename, expected in test_cases:
        from main import parse_student_id_from_filename
        result = parse_student_id_from_filename(filename)
        if result == expected:
            success_count += 1
            print_success(f"  {filename} -> {result}")
        else:
            print_error(f"  {filename} -> {result} (期望: {expected})")
    print_info(f"学号解析成功率: {success_count}/{len(test_cases)}")
    return success_count == len(test_cases)

def test_file_type_validation():
    print_info("\n=== 测试文件类型验证 ===")
    from main import validate_file_type
    test_cases = [
        ("test.pdf", ".pdf,.docx", True),
        ("test.docx", ".pdf,.docx", True),
        ("test.exe", ".pdf,.docx", False),
        ("test.zip", "*", True),
    ]
    success_count = 0
    for filename, allowed, expected in test_cases:
        result = validate_file_type(filename, allowed)
        if result == expected:
            success_count += 1
            print_success(f"  {filename} (允许: {allowed}) -> {result}")
        else:
            print_error(f"  {filename} (允许: {allowed}) -> {result} (期望: {expected})")
    return success_count == len(test_cases)

def test_directory_scan(assignment_id):
    print_info("\n=== 测试目录扫描 ===")
    test_dir = tempfile.mkdtemp()
    try:
        test_files = [
            "2021001001_张三_作业.pdf",
            "2021001002_李四_作业.docx",
            "2021001003_王五_作业.exe",
            "无学号的文件.pdf",
        ]
        for filename in test_files:
            with open(os.path.join(test_dir, filename), "w") as f:
                f.write("test content")
        response = requests.post(f"{BASE_URL}/assignments/{assignment_id}/scan-directory",
                               params={"directory_path": test_dir})
        result = response.json()
        if result.get("total_files") == 4:
            print_success(f"目录扫描成功，发现 {result.get('total_files')} 个文件")
            for f in result.get("files", []):
                if f.get("needs_review"):
                    print_warning(f"  需要复核: {f.get('filename')}")
            return True
        else:
            print_error(f"目录扫描失败: {result}")
            return False
    finally:
        shutil.rmtree(test_dir)

def test_submission_processing(assignment_id):
    print_info("\n=== 测试作业提交处理 ===")
    success_count = 0
    test_file = tempfile.NamedTemporaryFile(suffix=".pdf", prefix="2021001001_张三_", delete=False)
    test_file.write(b"test content")
    test_file.close()
    try:
        with open(test_file.name, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/assignments/{assignment_id}/process-file",
                files={"file": (os.path.basename(test_file.name), f, "application/pdf")}
            )
        result = response.json()
        if result.get("success") and result.get("student_id") == "2021001001":
            print_success(f"首次提交成功: {result.get('status')}")
            success_count += 1
        else:
            print_error(f"首次提交失败: {result}")
            return False
    finally:
        os.unlink(test_file.name)
    print_info("  测试补交覆盖...")
    test_file2 = tempfile.NamedTemporaryFile(suffix=".pdf", prefix="2021001001_张三_补交_", delete=False)
    test_file2.write(b"updated content")
    test_file2.close()
    try:
        with open(test_file2.name, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/assignments/{assignment_id}/process-file",
                files={"file": (os.path.basename(test_file2.name), f, "application/pdf")}
            )
        result = response.json()
        if result.get("success") and result.get("resubmit_count") == 1:
            print_success(f"补交覆盖成功，补交次数: {result.get('resubmit_count')}")
            success_count += 1
        else:
            print_error(f"补交覆盖失败: {result}")
    finally:
        os.unlink(test_file2.name)
    return success_count == 2

def test_needs_manual_review(assignment_id):
    print_info("\n=== 测试需要人工复核的错误 ===")
    test_file = tempfile.NamedTemporaryFile(suffix=".pdf", prefix="无学号_", delete=False)
    test_file.write(b"test content")
    test_file.close()
    try:
        with open(test_file.name, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/assignments/{assignment_id}/process-file",
                files={"file": (os.path.basename(test_file.name), f, "application/pdf")}
            )
        result = response.json()
        detail = result.get("detail", {})
        if isinstance(detail, dict) and detail.get("code") == "needs_manual_review":
            print_success(f"正确识别需要人工复核的情况: {detail.get('message')}")
            return True
        else:
            print_error(f"需要人工复核的识别失败: {result}")
            return False
    finally:
        os.unlink(test_file.name)

def test_already_processed(assignment_id):
    print_info("\n=== 测试已处理状态的错误 ===")
    response = requests.get(f"{BASE_URL}/assignments/{assignment_id}/submissions")
    submissions = response.json().get("submissions", [])
    if not submissions:
        print_warning("没有提交记录，跳过此测试")
        return True
    sub_id = submissions[0]["id"]
    response = requests.post(f"{BASE_URL}/submissions/{sub_id}/mark-processed")
    if response.status_code != 200:
        print_error("标记处理状态失败")
        return False
    test_file = tempfile.NamedTemporaryFile(suffix=".pdf", prefix="2021001001_张三_再交_", delete=False)
    test_file.write(b"content")
    test_file.close()
    try:
        with open(test_file.name, "rb") as f:
            response = requests.post(
                f"{BASE_URL}/assignments/{assignment_id}/process-file",
                files={"file": (os.path.basename(test_file.name), f, "application/pdf")}
            )
        result = response.json()
        detail = result.get("detail", {})
        if isinstance(detail, dict) and detail.get("code") == "already_processed":
            print_success(f"正确识别已处理的情况: {detail.get('message')}")
            return True
        else:
            print_error(f"已处理状态的识别失败: {result}")
            return False
    finally:
        os.unlink(test_file.name)

def test_missing_submissions(assignment_id):
    print_info("\n=== 测试缺交查询 ===")
    response = requests.get(f"{BASE_URL}/assignments/{assignment_id}/missing")
    result = response.json()
    if result.get("missing_count") == 4:
        print_success(f"缺交查询成功: 总学生{result.get('total_students')}, 已交{result.get('submitted_count')}, 缺交{result.get('missing_count')}")
        for student in result.get("missing_students", []):
            print_warning(f"  缺交: {student.get('student_id')} - {student.get('name')}")
        return True
    else:
        print_error(f"缺交查询失败: {result}")
        return False

def test_report_generation(assignment_id):
    print_info("\n=== 测试报告导出 ===")
    response = requests.get(f"{BASE_URL}/assignments/{assignment_id}/report", params={"format": "excel"})
    if response.status_code == 200 and "content-disposition" in response.headers:
        print_success(f"Excel报告导出成功")
        print_info(f"  文件大小: {len(response.content)} bytes")
    else:
        print_error(f"Excel报告导出失败")
        return False
    response = requests.get(f"{BASE_URL}/assignments/{assignment_id}/report", params={"format": "csv"})
    if response.status_code == 200:
        print_success(f"CSV报告导出成功")
        return True
    else:
        print_error(f"CSV报告导出失败")
        return False

def main():
    print_info("=" * 60)
    print_info("作业收齐补交系统 - 自检脚本")
    print_info("=" * 60)
    if not wait_for_server():
        print_error("请先启动服务器: python main.py")
        return
    results = []
    results.append(("学生导入", test_student_import()))
    assignment_id = test_assignment_creation()
    results.append(("作业创建", assignment_id is not None))
    if assignment_id is None:
        print_error("无法继续后续测试")
        return
    results.append(("学生列表", test_student_list()))
    results.append(("学号解析", test_filename_parsing()))
    results.append(("文件类型验证", test_file_type_validation()))
    results.append(("目录扫描", test_directory_scan(assignment_id)))
    results.append(("提交处理与补交", test_submission_processing(assignment_id)))
    results.append(("人工复核错误", test_needs_manual_review(assignment_id)))
    results.append(("已处理状态错误", test_already_processed(assignment_id)))
    results.append(("缺交查询", test_missing_submissions(assignment_id)))
    results.append(("报告导出", test_report_generation(assignment_id)))
    print_info("\n" + "=" * 60)
    print_info("测试结果汇总")
    print_info("=" * 60)
    passed = sum(1 for _, r in results if r)
    total = len(results)
    for name, result in results:
        if result:
            print_success(name)
        else:
            print_error(name)
    print_info(f"\n总计: {passed}/{total} 项测试通过")
    if passed == total:
        print_success("\n所有测试通过！系统功能正常。")
    else:
        print_error(f"\n有 {total - passed} 项测试失败，请检查。")

if __name__ == "__main__":
    main()
