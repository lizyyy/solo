import os
import sys
import subprocess
import tempfile
import shutil
import uuid
from typing import Dict, Tuple, Optional
from dataclasses import dataclass
import time


@dataclass
class ExecutionResult:
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: int
    memory_usage_kb: Optional[int] = None
    error_message: Optional[str] = None
    timed_out: bool = False


class CodeExecutor:
    LANGUAGE_CONFIG = {
        "python": {
            "extensions": [".py"],
            "command": ["python3", "{file}"],
            "timeout": 30,
        },
        "javascript": {
            "extensions": [".js"],
            "command": ["node", "{file}"],
            "timeout": 30,
        },
        "java": {
            "extensions": [".java"],
            "compile": ["javac", "{file}"],
            "command": ["java", "-cp", "{dir}", "{classname}"],
            "timeout": 60,
        },
        "c++": {
            "extensions": [".cpp"],
            "compile": ["g++", "{file}", "-o", "{executable}"],
            "command": ["./{executable}"],
            "timeout": 60,
        },
        "go": {
            "extensions": [".go"],
            "command": ["go", "run", "{file}"],
            "timeout": 30,
        },
        "bash": {
            "extensions": [".sh"],
            "command": ["bash", "{file}"],
            "timeout": 30,
        }
    }

    @staticmethod
    def _get_language_config(language_name: str) -> Optional[Dict]:
        lang_lower = language_name.lower()
        if lang_lower in CodeExecutor.LANGUAGE_CONFIG:
            return CodeExecutor.LANGUAGE_CONFIG[lang_lower]
        
        for lang, config in CodeExecutor.LANGUAGE_CONFIG.items():
            if language_name.lower().startswith(lang):
                return config
        
        return CodeExecutor.LANGUAGE_CONFIG.get("python")

    @staticmethod
    def execute_code(
        code: str,
        language_name: str,
        timeout_seconds: int = None,
        input_data: str = None
    ) -> ExecutionResult:
        start_time = time.time()
        temp_dir = tempfile.mkdtemp(prefix=f"code_run_{uuid.uuid4().hex[:8]}_")
        
        try:
            config = CodeExecutor._get_language_config(language_name)
            if not config:
                return ExecutionResult(
                    success=False,
                    stdout="",
                    stderr="",
                    exit_code=-1,
                    execution_time_ms=0,
                    error_message=f"不支持的语言: {language_name}"
                )

            ext = config["extensions"][0]
            file_extension = ext
            file_name = f"main{file_extension}"
            file_path = os.path.join(temp_dir, file_name)

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(code)

            actual_timeout = timeout_seconds or config.get("timeout", 30)

            if "compile" in config:
                compile_cmd = [
                    part.format(
                        file=file_path,
                        dir=temp_dir,
                        classname="Main",
                        executable=os.path.join(temp_dir, "program")
                    )
                    for part in config["compile"]
                ]
                
                try:
                    compile_result = subprocess.run(
                        compile_cmd,
                        capture_output=True,
                        text=True,
                        timeout=actual_timeout,
                        cwd=temp_dir
                    )
                    
                    if compile_result.returncode != 0:
                        exec_time = int((time.time() - start_time) * 1000)
                        return ExecutionResult(
                            success=False,
                            stdout=compile_result.stdout,
                            stderr=compile_result.stderr,
                            exit_code=compile_result.returncode,
                            execution_time_ms=exec_time,
                            error_message="编译失败"
                        )
                except subprocess.TimeoutExpired:
                    exec_time = int((time.time() - start_time) * 1000)
                    return ExecutionResult(
                        success=False,
                        stdout="",
                        stderr=f"编译超时（超过{actual_timeout}秒）",
                        exit_code=-1,
                        execution_time_ms=exec_time,
                        timed_out=True,
                        error_message="编译超时被强制终止"
                    )

            run_cmd = [
                part.format(
                    file=file_path,
                    dir=temp_dir,
                    classname="Main",
                    executable=os.path.join(temp_dir, "program")
                )
                for part in config["command"]
            ]

            try:
                proc = subprocess.Popen(
                    run_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=temp_dir,
                    stdin=subprocess.PIPE if input_data else None
                )

                try:
                    stdout, stderr = proc.communicate(input=input_data, timeout=actual_timeout)
                    exit_code = proc.returncode
                    timed_out = False
                except subprocess.TimeoutExpired:
                    proc.kill()
                    try:
                        stdout, stderr = proc.communicate(timeout=2)
                    except:
                        stdout, stderr = "", ""
                    exit_code = -1
                    timed_out = True

                exec_time = int((time.time() - start_time) * 1000)

                if timed_out:
                    return ExecutionResult(
                        success=False,
                        stdout=stdout[:5000] if stdout else "",
                        stderr=stderr[:5000] if stderr else "",
                        exit_code=exit_code,
                        execution_time_ms=exec_time,
                        timed_out=True,
                        error_message=f"执行超时（超过{actual_timeout}秒被强制终止）"
                    )

                return ExecutionResult(
                    success=(exit_code == 0),
                    stdout=stdout[:10000] if stdout else "",
                    stderr=stderr[:10000] if stderr else "",
                    exit_code=exit_code,
                    execution_time_ms=exec_time,
                    timed_out=False,
                    error_message=None if exit_code == 0 else "程序执行出错"
                )

            except Exception as e:
                exec_time = int((time.time() - start_time) * 1000)
                return ExecutionResult(
                    success=False,
                    stdout="",
                    stderr=str(e),
                    exit_code=-1,
                    execution_time_ms=exec_time,
                    error_message=f"执行异常: {str(e)}"
                )

        finally:
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

    @staticmethod
    def execute_python(code: str, timeout: int = 30, input_data: str = None) -> ExecutionResult:
        return CodeExecutor.execute_code(code, "python", timeout, input_data)

    @staticmethod
    def execute_javascript(code: str, timeout: int = 30, input_data: str = None) -> ExecutionResult:
        return CodeExecutor.execute_code(code, "javascript", timeout, input_data)
