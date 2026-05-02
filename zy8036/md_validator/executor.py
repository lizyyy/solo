import os
import subprocess
import tempfile
import time
from dataclasses import dataclass
from typing import Dict, Optional

from .parser import CodeBlock


@dataclass
class ExecutionResult:
    success: bool
    output: str
    error: str
    duration: float
    timed_out: bool = False
    missing_env: Optional[str] = None


def check_env_vars(env_vars: list) -> Optional[str]:
    for var in env_vars:
        if var not in os.environ:
            return var
    return None


def sanitize_filename(block_id: str) -> str:
    return block_id.replace(":", "_").replace("/", "_").replace("\\", "_")


def execute_block(
    block: CodeBlock,
    work_dir: str,
    timeout: int = 30,
    env: Optional[Dict[str, str]] = None,
) -> ExecutionResult:
    missing_env = check_env_vars(block.env_vars)
    if missing_env:
        return ExecutionResult(
            success=False,
            output="",
            error=f"Missing environment variable: {missing_env}",
            duration=0.0,
            missing_env=missing_env,
        )

    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    start_time = time.time()
    timed_out = False
    output = ""
    error = ""

    safe_id = sanitize_filename(block.id)

    try:
        if block.language == "bash" or block.language == "shell":
            script_path = os.path.join(work_dir, f"{safe_id}.sh")
            with open(script_path, "w") as f:
                f.write("#!/bin/bash\n")
                f.write(block.code)
            os.chmod(script_path, 0o755)

            result = subprocess.run(
                [script_path],
                cwd=work_dir,
                env=full_env,
                timeout=timeout,
                capture_output=True,
                text=True,
            )
            output = result.stdout
            error = result.stderr
            success = result.returncode == 0

        elif block.language == "python":
            script_path = os.path.join(work_dir, f"{safe_id}.py")
            with open(script_path, "w") as f:
                f.write(block.code)

            result = subprocess.run(
                ["python3", script_path],
                cwd=work_dir,
                env=full_env,
                timeout=timeout,
                capture_output=True,
                text=True,
            )
            output = result.stdout
            error = result.stderr
            success = result.returncode == 0

        elif block.language == "javascript" or block.language == "js":
            script_path = os.path.join(work_dir, f"{safe_id}.js")
            with open(script_path, "w") as f:
                f.write(block.code)

            result = subprocess.run(
                ["node", script_path],
                cwd=work_dir,
                env=full_env,
                timeout=timeout,
                capture_output=True,
                text=True,
            )
            output = result.stdout
            error = result.stderr
            success = result.returncode == 0

        else:
            return ExecutionResult(
                success=False,
                output="",
                error=f"Unsupported language: {block.language}",
                duration=0.0,
            )

    except subprocess.TimeoutExpired:
        timed_out = True
        success = False
        error = "Execution timed out"
    except Exception as e:
        success = False
        error = str(e)

    duration = time.time() - start_time

    return ExecutionResult(
        success=success,
        output=output,
        error=error,
        duration=duration,
        timed_out=timed_out,
    )


def execute_with_temp_workspace(
    block: CodeBlock,
    timeout: int = 30,
    env: Optional[Dict[str, str]] = None,
) -> ExecutionResult:
    with tempfile.TemporaryDirectory(prefix=f"mdv_{block.id}_") as work_dir:
        return execute_block(block, work_dir, timeout, env)