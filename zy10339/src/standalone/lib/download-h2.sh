#!/bin/bash
# 下载 H2 数据库驱动到 lib 目录

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR"

H2_VERSION="1.4.200"
H2_FILENAME="h2-$H2_VERSION.jar"
H2_URL="https://repo1.maven.org/maven2/com/h2database/h2/$H2_VERSION/$H2_FILENAME"

mkdir -p "$LIB_DIR"

if [ -f "$LIB_DIR/$H2_FILENAME" ]; then
    echo "✅ H2 驱动已存在: $LIB_DIR/$H2_FILENAME"
    exit 0
fi

echo "正在下载 H2 数据库驱动 v$H2_VERSION..."
echo "URL: $H2_URL"
echo ""

# 尝试多种方式下载
if command -v curl &> /dev/null; then
    curl --noproxy "*" -f -L -o "$LIB_DIR/$H2_FILENAME" "$H2_URL" 2>/dev/null || \
    curl -f -L -o "$LIB_DIR/$H2_FILENAME" "$H2_URL"
elif command -v wget &> /dev/null; then
    wget --no-proxy -O "$LIB_DIR/$H2_FILENAME" "$H2_URL" 2>/dev/null || \
    wget -O "$LIB_DIR/$H2_FILENAME" "$H2_URL"
else
    echo "❌ 未找到 curl 或 wget"
    echo "请手动下载: $H2_URL"
    echo "保存到: $LIB_DIR/$H2_FILENAME"
    exit 1
fi

if [ -f "$LIB_DIR/$H2_FILENAME" ] && [ -s "$LIB_DIR/$H2_FILENAME" ]; then
    echo ""
    echo "✅ H2 驱动下载成功!"
    echo "   文件: $LIB_DIR/$H2_FILENAME"
    echo ""
    echo "现在可以运行: ./run-standalone.sh"
else
    echo ""
    echo "❌ 下载失败"
    exit 1
fi
