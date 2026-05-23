.PHONY: help install setup test start clean build-node build-go seed-go test-go

.DEFAULT_GOAL := help

help:
	@echo "🚗 洗车会员排队API - Makefile"
	@echo ""
	@echo "Node.js 版本（推荐，当前环境可用）:"
	@echo "  make install    - 安装 Node.js 依赖"
	@echo "  make setup      - 初始化数据库 + 示例数据"
	@echo "  make test       - 运行自检脚本"
	@echo "  make start      - 启动 Node.js 服务"
	@echo ""
	@echo "Go 版本（需要先安装 Go）:"
	@echo "  make install-go - 安装 Go 依赖"
	@echo "  make seed-go    - 插入 Go 版本示例数据"
	@echo "  make test-go    - 运行 Go 版本自检"
	@echo "  make start-go   - 启动 Go 服务"
	@echo "  make build-go   - 编译 Go 二进制"
	@echo ""
	@echo "通用命令:"
	@echo "  make clean      - 清理数据库文件"

# Node.js 版本命令
install:
	@echo "📦 安装 Node.js 依赖..."
	npm install

setup:
	@echo "🔧 初始化数据库和示例数据..."
	npm run setup

test:
	@echo "🧪 运行自检脚本..."
	npm test

start:
	@echo "🚀 启动 Node.js 服务..."
	npm start

# Go 版本命令
install-go:
	@echo "📦 安装 Go 依赖..."
	go mod tidy

seed-go:
	@echo "🌱 插入 Go 版本示例数据..."
	go run scripts/seed_data.go

test-go:
	@echo "🧪 运行 Go 版本自检..."
	go run scripts/self_test.go

start-go:
	@echo "🚀 启动 Go 服务..."
	go run main.go

build-go:
	@echo "🔨 编译 Go 二进制..."
	go build -o car-wash-api main.go

# 通用命令
clean:
	@echo "🧹 清理数据库文件..."
	rm -f data/car-wash.db
	@echo "✅ 清理完成"
