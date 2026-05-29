import re
from typing import List, Dict, Optional
from string import Template
from datetime import datetime
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import ANOMALY_TYPES
from .material_service import get_batch, get_material_content


SCRIPT_TEMPLATES = {
    "cache_miss_error": Template("""#!/bin/bash
# CI缓存污染 - 缓存命中错误复现脚本
# 批次: $batch_no
# 生成时间: $generated_at

set -e

echo "=== 缓存命中错误复现脚本 ==="
echo "批次: $batch_no"
echo ""

echo "[1/4] 清理旧缓存..."
rm -rf ~/.cache/pip
rm -rf ~/.npm
rm -rf node_modules
echo "✓ 缓存已清理"

echo ""
echo "[2/4] 检查当前依赖定义..."
cat requirements.txt 2>/dev/null || echo "未找到requirements.txt"
cat package.json 2>/dev/null || echo "未找到package.json"

echo ""
echo "[3/4] 计算依赖指纹..."
python3 -c "
import hashlib
import sys

def calc_fingerprint(content):
    return hashlib.md5(content.encode()).hexdigest()

# 检查requirements.txt
try:
    with open('requirements.txt') as f:
        content = f.read()
    print(f'requirements.txt 指纹: {calc_fingerprint(content)}')
except FileNotFoundError:
    pass

# 检查package.json
try:
    with open('package.json') as f:
        content = f.read()
    print(f'package.json 指纹: {calc_fingerprint(content)}')
except FileNotFoundError:
    pass
"

echo ""
echo "[4/4] 重新安装依赖并运行测试..."
echo "注意：这将模拟CI环境的完整流程"
echo ""

# $extra_commands

echo ""
echo "=== 复现脚本执行完成 ==="
echo "如果问题重现，说明缓存配置存在问题"
echo "建议：检查CI缓存键生成逻辑，确保依赖文件变更时缓存失效"
"""),

    "test_artifact_leftover": Template("""#!/bin/bash
# CI缓存污染 - 测试产物未清复现脚本
# 批次: $batch_no
# 生成时间: $generated_at

set -e

echo "=== 测试产物未清复现脚本 ==="
echo "批次: $batch_no"
echo ""

echo "[1/5] 检查是否存在遗留测试产物..."
find . -name "*.pyc" -o -name "__pycache__" -o -name "target" -o -name "dist" -o -name "build" 2>/dev/null | head -20

echo ""
echo "[2/5] 检查当前工作目录状态..."
ls -la
git status --short 2>/dev/null || echo "非git仓库"

echo ""
echo "[3/5] 模拟CI清理步骤..."
echo "执行: git clean -fdx"
git clean -fdx 2>/dev/null || echo "git clean失败，手动清理..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
rm -rf target dist build 2>/dev/null || true
echo "✓ 清理完成"

echo ""
echo "[4/5] 重新运行完整构建..."
# $build_commands

echo ""
echo "[5/5] 检查产物是否仍然存在..."
find . -name "*.pyc" -o -name "__pycache__" -o -name "target" -o -name "dist" 2>/dev/null | head -10

echo ""
echo "=== 复现脚本执行完成 ==="
echo "如果清理后问题消失，说明CI工作区未正确清理"
echo "建议：在CI流程开始时强制执行 git clean -fdx"
"""),

    "env_var_drift": Template("""#!/bin/bash
# CI缓存污染 - 环境变量漂移复现脚本
# 批次: $batch_no
# 生成时间: $generated_at

set -e

echo "=== 环境变量漂移复现脚本 ==="
echo "批次: $batch_no"
echo ""

echo "[1/4] 导出当前环境变量..."
env > current_env.txt
echo "✓ 已导出到 current_env.txt"

echo ""
echo "[2/4] 对比预期环境变量..."
echo "预期环境变量:"
cat << 'EXPECTED_ENV'
$expected_env
EXPECTED_ENV

echo ""
echo "[3/4] 检查关键变量差异..."
python3 -c "
import os

critical_vars = $critical_vars
print('关键环境变量检查:')
for var in critical_vars:
    val = os.environ.get(var, 'NOT_SET')
    print(f'  {var}={val}')
"

echo ""
echo "[4/4] 使用纯净环境重新运行..."
echo "执行: env -i PATH=$$PATH HOME=$$HOME $run_command"
echo ""

# $extra_commands

echo ""
echo "=== 复现脚本执行完成 ==="
echo "如果纯净环境下正常，说明环境变量存在漂移"
echo "建议：在CI配置中显式声明所有必需的环境变量"
"""),

    "dependency_conflict": Template("""#!/bin/bash
# CI缓存污染 - 依赖冲突复现脚本
# 批次: $batch_no
# 生成时间: $generated_at

set -e

echo "=== 依赖冲突复现脚本 ==="
echo "批次: $batch_no"
echo ""

echo "[1/5] 清理所有缓存..."
pip cache purge 2>/dev/null || true
npm cache clean --force 2>/dev/null || true
rm -rf ~/.cache/pip ~/.npm node_modules venv .venv
echo "✓ 缓存已清理"

echo ""
echo "[2/5] 创建全新虚拟环境..."
python3 -m venv .repro_venv
source .repro_venv/bin/activate
echo "✓ 虚拟环境已创建"

echo ""
echo "[3/5] 重新安装所有依赖..."
pip install --no-cache-dir -r requirements.txt 2>&1 | tee install_log.txt
echo "✓ 依赖安装完成"

echo ""
echo "[4/5] 检查已安装版本..."
pip list | tee installed_versions.txt

echo ""
echo "[5/5] 运行测试..."
# $test_command

echo ""
echo "=== 复现脚本执行完成 ==="
echo "检查 install_log.txt 和 installed_versions.txt 分析依赖冲突"
echo "建议：锁定所有依赖版本 (pip freeze > requirements.txt)"
"""),

    "unknown": Template("""#!/bin/bash
# CI缓存污染 - 未知异常复现脚本
# 批次: $batch_no
# 生成时间: $generated_at

set -e

echo "=== 未知异常复现脚本 ==="
echo "批次: $batch_no"
echo ""

echo "[1/3] 完整清理环境..."
git clean -fdx 2>/dev/null || true
rm -rf ~/.cache/pip ~/.npm node_modules venv .venv __pycache__
echo "✓ 环境已清理"

echo ""
echo "[2/3] 完整重新构建..."
# $build_commands

echo ""
echo "[3/3] 运行完整测试套件..."
# $test_command

echo ""
echo "=== 复现脚本执行完成 ==="
echo "建议：增加CI日志详细程度以便进一步分析"
"""),
}


def generate_script_for_cluster(cluster: models.FailureCluster, batch: models.Batch,
                                 db: Session) -> schemas.ReproductionScriptCreate:
    template = SCRIPT_TEMPLATES.get(cluster.cluster_type)
    if not template:
        template = SCRIPT_TEMPLATES["unknown"]

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    env_vars = _extract_env_vars(db, batch.id)
    expected_env = "\n".join([f"{k}={v}" for k, v in env_vars.items()]) or "# 未检测到环境变量数据"

    critical_vars = list(env_vars.keys())[:10] or ["PATH", "HOME", "CI"]

    commands = _extract_commands_from_logs(db, cluster)
    build_commands = "\n# ".join(commands.get("build", ["# 未检测到构建命令"]))
    test_command = commands.get("test", ["pytest tests/"])[0]
    run_command = commands.get("run", ["./run_tests.sh"])[0]
    extra_commands = "\n# ".join(commands.get("extra", []))

    content = template.safe_substitute(
        batch_no=batch.batch_no,
        generated_at=generated_at,
        expected_env=expected_env,
        critical_vars=str(critical_vars),
        build_commands=build_commands,
        test_command=test_command,
        run_command=run_command,
        extra_commands=extra_commands,
    )

    script_type = "bash"

    return schemas.ReproductionScriptCreate(
        batch_id=batch.id,
        cluster_id=cluster.id,
        name=f"reproduce_{cluster.cluster_type}_{batch.batch_no}",
        script_type=script_type,
        content=content,
        description=f"复现{ANOMALY_TYPES.get(cluster.cluster_type, cluster.cluster_type)}的脚本，基于聚类ID {cluster.id}",
        meta={
            "cluster_id": cluster.id,
            "cluster_type": cluster.cluster_type,
            "severity": cluster.severity,
            "generated_at": generated_at,
        },
    )


def _extract_env_vars(db: Session, batch_id: int) -> Dict[str, str]:
    env_vars = {}
    env_materials = db.query(models.Material).filter(
        models.Material.batch_id == batch_id,
        models.Material.material_type == "env_vars",
    ).all()

    for mat in env_materials:
        content = get_material_content(mat.id, db)
        if content:
            for line in content.splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")

    env_logs = db.query(models.ParsedLogEntry).filter(
        models.ParsedLogEntry.batch_id == batch_id,
        models.ParsedLogEntry.category == "env_var",
    ).all()

    for log in env_logs:
        meta = log.meta or {}
        if "name" in meta and "value" in meta:
            env_vars[meta["name"]] = meta["value"]

    return env_vars


def _extract_commands_from_logs(db: Session, cluster: models.FailureCluster) -> Dict[str, List[str]]:
    commands = {
        "build": [],
        "test": [],
        "run": [],
        "extra": [],
    }

    log_ids = cluster.sample_log_ids or []
    logs = db.query(models.ParsedLogEntry).filter(
        models.ParsedLogEntry.id.in_(log_ids),
    ).all()

    for log in logs:
        raw = log.raw_text
        if "npm install" in raw or "pip install" in raw or "yarn install" in raw:
            commands["build"].append(raw.strip())
        elif "pytest" in raw or "npm test" in raw or "yarn test" in raw:
            commands["test"].append(raw.strip())
        elif "./" in raw or "sh " in raw or "bash " in raw:
            commands["run"].append(raw.strip())
        else:
            if len(raw) < 200:
                commands["extra"].append(raw.strip())

    if not commands["test"]:
        commands["test"] = ["pytest tests/ -v"]
    if not commands["run"]:
        commands["run"] = ["./scripts/run_ci.sh"]

    return commands


def generate_reproduction_scripts(db: Session, batch_id: int,
                                  cluster_id: Optional[int] = None) -> Dict:
    batch = get_batch(db, batch_id)
    if not batch:
        raise ValueError(f"Batch {batch_id} not found")

    if cluster_id:
        clusters = db.query(models.FailureCluster).filter(
            models.FailureCluster.id == cluster_id,
            models.FailureCluster.is_normal_result == False,
        ).all()
    else:
        clusters = db.query(models.FailureCluster).filter(
            models.FailureCluster.batch_id == batch_id,
            models.FailureCluster.is_normal_result == False,
        ).all()

    if not clusters:
        raise ValueError(f"No failure clusters found for batch {batch_id}")

    saved_scripts = []
    for cluster in clusters:
        script_create = generate_script_for_cluster(cluster, batch, db)

        db_script = models.ReproductionScript(
            batch_id=script_create.batch_id,
            cluster_id=script_create.cluster_id,
            name=script_create.name,
            script_type=script_create.script_type,
            content=script_create.content,
            description=script_create.description,
            meta=script_create.meta,
        )
        db.add(db_script)
        saved_scripts.append(db_script)

    db.commit()

    for script in saved_scripts:
        db.refresh(script)

    batch.status = "scripts_generated"
    db.commit()

    return {
        "batch_id": batch_id,
        "batch_no": batch.batch_no,
        "scripts_generated": len(saved_scripts),
        "scripts": [
            {
                "id": s.id,
                "name": s.name,
                "type": s.script_type,
                "cluster_id": s.cluster_id,
                "cluster_type": s.meta.get("cluster_type") if s.meta else None,
            }
            for s in saved_scripts
        ],
    }


def list_reproduction_scripts(db: Session, batch_id: Optional[int] = None,
                              cluster_id: Optional[int] = None,
                              skip: int = 0, limit: int = 100) -> List[models.ReproductionScript]:
    query = db.query(models.ReproductionScript)
    if batch_id:
        query = query.filter(models.ReproductionScript.batch_id == batch_id)
    if cluster_id:
        query = query.filter(models.ReproductionScript.cluster_id == cluster_id)
    return query.order_by(models.ReproductionScript.created_at.desc()).offset(skip).limit(limit).all()
