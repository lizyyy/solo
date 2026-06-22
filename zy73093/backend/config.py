#!/usr/bin/env python3
"""统一配置：后端/前端端口、API地址等。所有验证脚本从此读取。"""
import os

# 后端端口：与 server.js 中的 PORT 保持一致
BACKEND_PORT = int(os.environ.get('BACKEND_PORT', 3002))
# 前端端口：与静态服务器端口一致
FRONTEND_PORT = int(os.environ.get('FRONTEND_PORT', 8080))

API_BASE = f"http://localhost:{BACKEND_PORT}"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"


def no_proxy_env():
    """返回适合传给子进程/当前进程的无代理环境变量dict。"""
    env = os.environ.copy()
    for k in list(env.keys()):
        if 'proxy' in k.lower():
            del env[k]
    env['NO_PROXY'] = '*'
    env['no_proxy'] = '*'
    return env


def apply_no_proxy():
    """在当前进程中彻底清除代理设置。"""
    for k in list(os.environ.keys()):
        if 'proxy' in k.lower():
            del os.environ[k]
    os.environ['NO_PROXY'] = '*'
    os.environ['no_proxy'] = '*'


if __name__ == '__main__':
    print(f"BACKEND_PORT = {BACKEND_PORT}")
    print(f"FRONTEND_PORT = {FRONTEND_PORT}")
    print(f"API_BASE      = {API_BASE}")
    print(f"FRONTEND_URL  = {FRONTEND_URL}")
