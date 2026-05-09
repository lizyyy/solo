.PHONY: build run clean help

help:
	@echo "Chaos Simulator - 混沌工程模拟平台"
	@echo ""
	@echo "Usage:"
	@echo "  make build     编译所有二进制文件"
	@echo "  make server    启动服务器"
	@echo "  make cli       编译CLI工具"
	@echo "  make run       启动服务器(快捷方式)"
	@echo "  make clean     清理构建产物"
	@echo ""
	@echo "Requirements:"
	@echo "  - MySQL 5.7+  (默认 127.0.0.1:3306)"
	@echo "  - Redis 5+    (默认 127.0.0.1:6379)"
	@echo ""
	@echo "如果没有MySQL/Redis，可以只运行 message_queue_backlog、goroutine_leak、config_drift 场景"

build:
	@echo "Building server..."
	go build -o bin/chaos-simulator ./cmd/chaos-simulator
	@echo "Building CLI..."
	go build -o bin/chaos-cli ./cmd/chaos-cli
	@echo "Done! Binaries in bin/"

server: build
	./bin/chaos-simulator

cli: build
	@echo "Use: ./bin/chaos-cli [command]"

run:
	go run ./cmd/chaos-simulator

clean:
	rm -rf bin/
