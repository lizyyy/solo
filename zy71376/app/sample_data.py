from typing import List, Dict

SAMPLE_PIPELINE_LOG = """2024-01-15 10:30:00 [INFO] Starting CI pipeline #456 for commit a1b2c3d
2024-01-15 10:30:01 [INFO] Checking out repository...
2024-01-15 10:30:05 [INFO] Restoring cache...
2024-01-15 10:30:05 [DEBUG] Cache key: pip-v1-hash-abc123def456
2024-01-15 10:30:06 [DEBUG] Cache key mismatch: expected abc123def456, got 789xyz012
2024-01-15 10:30:06 [WARN] Cache miss unexpectedly, cache key mismatch detected
2024-01-15 10:30:07 [INFO] Cache fingerprint changed from last run
2024-01-15 10:30:10 [INFO] Installing dependencies...
2024-01-15 10:30:10 [INFO] pip install -r requirements.txt
2024-01-15 10:30:15 [DEBUG] Found leftover __pycache__ directory from previous build
2024-01-15 10:30:15 [WARN] Leftover file detected: target/classes/com/example/Test.class
2024-01-15 10:30:16 [WARN] Previous build artifact detected in workspace
2024-01-15 10:30:16 [WARN] Workspace not clean before build
2024-01-15 10:30:20 [INFO] Setting up environment...
2024-01-15 10:30:20 [INFO] export CI=true
2024-01-15 10:30:20 [INFO] export BUILD_NUMBER=456
2024-01-15 10:30:21 [INFO] export JAVA_HOME=/usr/lib/jvm/java-11
2024-01-15 10:30:21 [DEBUG] Environment variable changed: JAVA_HOME was /usr/lib/jvm/java-8
2024-01-15 10:30:22 [WARN] Version mismatch between runs detected for PYTHONPATH
2024-01-15 10:30:25 [INFO] Running tests...
2024-01-15 10:30:25 [INFO] pytest tests/ -v
2024-01-15 10:31:00 [ERROR] Test failure: test_cache_invalidation
2024-01-15 10:31:00 [ERROR] AssertionError: expected cache hit, got cache miss
2024-01-15 10:31:05 [ERROR] Test failure: test_clean_workspace
2024-01-15 10:31:05 [ERROR] FileNotFoundError: stale test result file found
2024-01-15 10:31:10 [ERROR] Test failure: test_env_consistency
2024-01-15 10:31:10 [ERROR] Environment variable JAVA_HOME mismatch
2024-01-15 10:31:15 [WARN] 3 tests failed, 127 passed
2024-01-15 10:31:16 [INFO] Generating test report...
2024-01-15 10:31:20 [INFO] JUnit XML report generated at target/test-results.xml
2024-01-15 10:31:25 [INFO] Saving cache for next run...
2024-01-15 10:31:25 [DEBUG] Cache key: pip-v1-hash-789xyz012
2024-01-15 10:31:30 [INFO] Cache saved successfully
2024-01-15 10:31:30 [ERROR] CI pipeline #456 failed with exit code 1
"""

SAMPLE_REQUIREMENTS_TXT = """requests==2.31.0
flask==3.0.0
sqlalchemy==2.0.23
pytest==7.4.3
numpy==1.26.2
pandas==2.1.4
"""

SAMPLE_REQUIREMENTS_TXT_OLD = """requests==2.30.0
flask==2.3.0
sqlalchemy==2.0.22
pytest==7.4.2
numpy==1.26.1
pandas==2.1.3
"""

SAMPLE_PACKAGE_JSON = """{
  "name": "ci-test-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.2",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "eslint": "^8.55.0"
  }
}
"""

SAMPLE_ENV_VARS_RUN1 = """CI=true
BUILD_NUMBER=456
BRANCH=main
COMMIT_SHA=a1b2c3d4e5f6
JAVA_HOME=/usr/lib/jvm/java-11
PYTHONPATH=/opt/python3.11
PATH=/usr/local/bin:/usr/bin:/bin
NODE_ENV=production
DATABASE_URL=postgresql://localhost:5432/test
"""

SAMPLE_ENV_VARS_RUN2 = """CI=true
BUILD_NUMBER=457
BRANCH=main
COMMIT_SHA=b2c3d4e5f6a7
JAVA_HOME=/usr/lib/jvm/java-8
PYTHONPATH=/opt/python3.10
PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin
NODE_ENV=staging
DATABASE_URL=postgresql://localhost:5432/test
"""

SAMPLE_COMMIT_HASHES = """a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0  refs/heads/main
b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1  refs/heads/feature/cache-fix
c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2  refs/pull/123/head
"""

SAMPLE_TEST_REPORT = """<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="CI Tests" tests="130" failures="3" errors="0" time="45.32">
  <testsuite name="cache_tests" tests="20" failures="1" errors="0" time="12.5">
    <testcase classname="cache_tests" name="test_cache_hit" time="0.1"/>
    <testcase classname="cache_tests" name="test_cache_invalidation" time="0.2">
      <failure message="expected cache hit, got cache miss">
        AssertionError at line 42 in test_cache.py
        Expected: 'hit'
        Actual: 'miss'
      </failure>
    </testcase>
    <testcase classname="cache_tests" name="test_cache_expiry" time="0.1"/>
  </testsuite>
  <testsuite name="workspace_tests" tests="15" failures="1" errors="0" time="8.3">
    <testcase classname="workspace_tests" name="test_clean_workspace" time="0.15">
      <failure message="stale test result file found">
        FileNotFoundError: target/test-results.xml already exists
        at line 28 in test_workspace.py
      </failure>
    </testcase>
    <testcase classname="workspace_tests" name="test_git_status" time="0.1"/>
  </testsuite>
  <testsuite name="env_tests" tests="10" failures="1" errors="0" time="5.2">
    <testcase classname="env_tests" name="test_env_consistency" time="0.08">
      <failure message="JAVA_HOME mismatch">
        AssertionError: Expected /usr/lib/jvm/java-11, got /usr/lib/jvm/java-8
        at line 35 in test_env.py
      </failure>
    </testcase>
  </testsuite>
  <testsuite name="other_tests" tests="85" failures="0" errors="0" time="19.32">
    <testcase classname="other_tests" name="test_feature_a" time="0.5"/>
    <testcase classname="other_tests" name="test_feature_b" time="0.3"/>
  </testsuite>
</testsuites>
"""

SAMPLE_PRESETS = {
    "default": {
        "description": "完整样例：包含所有三种典型CI缓存污染问题",
        "materials": [
            {
                "material_type": "pipeline_log",
                "name": "CI流水线日志 #456",
                "source": "GitHub Actions - Run #456",
                "content": SAMPLE_PIPELINE_LOG,
                "meta": {"pipeline_id": "456", "runner": "ubuntu-latest"},
            },
            {
                "material_type": "dependency_cache",
                "name": "requirements.txt (当前)",
                "source": "代码仓库 - HEAD",
                "content": SAMPLE_REQUIREMENTS_TXT,
                "meta": {"file_path": "requirements.txt", "commit": "a1b2c3d"},
            },
            {
                "material_type": "dependency_cache",
                "name": "requirements.txt (上次成功)",
                "source": "代码仓库 - 上次成功提交",
                "content": SAMPLE_REQUIREMENTS_TXT_OLD,
                "meta": {"file_path": "requirements.txt", "commit": "b2c3d4e"},
            },
            {
                "material_type": "dependency_cache",
                "name": "package.json",
                "source": "代码仓库 - HEAD",
                "content": SAMPLE_PACKAGE_JSON,
                "meta": {"file_path": "package.json", "commit": "a1b2c3d"},
            },
            {
                "material_type": "env_vars",
                "name": "环境变量 - 运行#456(失败)",
                "source": "CI Runner #456",
                "content": SAMPLE_ENV_VARS_RUN1,
                "meta": {"run_id": "456", "status": "failed"},
            },
            {
                "material_type": "env_vars",
                "name": "环境变量 - 运行#455(成功)",
                "source": "CI Runner #455",
                "content": SAMPLE_ENV_VARS_RUN2,
                "meta": {"run_id": "455", "status": "success"},
            },
            {
                "material_type": "commit_hash",
                "name": "提交哈希记录",
                "source": "Git Repository",
                "content": SAMPLE_COMMIT_HASHES,
                "meta": {"repo": "example/project"},
            },
            {
                "material_type": "test_report",
                "name": "JUnit测试报告",
                "source": "pytest runner",
                "content": SAMPLE_TEST_REPORT,
                "meta": {"format": "junit-xml", "total_tests": 130},
            },
        ],
    },
    "cache_only": {
        "description": "仅缓存问题样例：缓存键不匹配导致的偶发失败",
        "materials": [
            {
                "material_type": "pipeline_log",
                "name": "CI流水线日志 - 缓存问题",
                "source": "GitLab CI",
                "content": SAMPLE_PIPELINE_LOG,
                "meta": {"pipeline_id": "789"},
            },
            {
                "material_type": "dependency_cache",
                "name": "requirements.txt",
                "source": "代码仓库",
                "content": SAMPLE_REQUIREMENTS_TXT,
                "meta": {"file_path": "requirements.txt"},
            },
        ],
    },
    "clean": {
        "description": "正常样例：无缓存污染的干净运行",
        "materials": [
            {
                "material_type": "pipeline_log",
                "name": "CI流水线日志 - 正常运行",
                "source": "GitHub Actions",
                "content": """2024-01-15 10:00:00 [INFO] Starting CI pipeline #500
2024-01-15 10:00:05 [INFO] Restoring cache: cache key matched
2024-01-15 10:00:06 [INFO] Cache hit successfully
2024-01-15 10:00:10 [INFO] Installing dependencies
2024-01-15 10:00:30 [INFO] All tests passed (150 tests)
2024-01-15 10:00:35 [INFO] Tests passed, build successful
2024-01-15 10:00:40 [INFO] CI pipeline completed successfully
""",
                "meta": {"pipeline_id": "500", "status": "success"},
            },
            {
                "material_type": "dependency_cache",
                "name": "requirements.txt",
                "source": "代码仓库",
                "content": SAMPLE_REQUIREMENTS_TXT,
                "meta": {"file_path": "requirements.txt"},
            },
            {
                "material_type": "env_vars",
                "name": "环境变量",
                "source": "CI Runner",
                "content": SAMPLE_ENV_VARS_RUN1,
                "meta": {},
            },
        ],
    },
}


def get_preset(preset_name: str) -> Dict:
    return SAMPLE_PRESETS.get(preset_name, SAMPLE_PRESETS["default"])


def list_presets() -> List[Dict]:
    return [
        {"name": name, "description": data["description"], "material_count": len(data["materials"])}
        for name, data in SAMPLE_PRESETS.items()
    ]
