.PHONY: help build up down logs test clean dev-backend dev-frontend

help:
	@echo "Migration Chaos Simulator - Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make up              启动所有服务（Docker）"
	@echo "  make down            停止所有服务"
	@echo "  make build           构建所有服务"
	@echo "  make logs            查看所有日志"
	@echo "  make dev-backend     开发模式运行后端"
	@echo "  make dev-frontend    开发模式运行前端"
	@echo "  make test            运行测试"
	@echo "  make clean           清理所有容器和卷"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

dev-backend:
	cd backend && go run cmd/server/main.go

dev-frontend:
	cd frontend && npm start

test:
	cd backend && go test ./... -v

clean:
	docker-compose down -v --remove-orphans
