.PHONY: build run dev clean docker-up docker-down test help

GO_BINARY=chaos-payment

help:
	@echo "Chaos Payment Platform - Makefile Commands"
	@echo ""
	@echo "Available targets:"
	@echo "  build       - Build the Go binary"
	@echo "  run         - Run the application"
	@echo "  dev         - Run with live reload (requires air)"
	@echo "  clean       - Remove build artifacts"
	@echo "  docker-up   - Start PostgreSQL and Redis containers"
	@echo "  docker-down - Stop and remove containers"
	@echo "  deps        - Download Go dependencies"
	@echo ""

build:
	@echo "🏗️  Building..."
	go build -o $(GO_BINARY) ./cmd
	@echo "✅ Build complete: ./$(GO_BINARY)"

run: build
	@echo "🚀 Running application..."
	./$(GO_BINARY)

dev:
	@echo "🔧 Running in development mode..."
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "❌ 'air' is not installed. Install with: go install github.com/cosmtrek/air@latest"; \
		exit 1; \
	fi

clean:
	@echo "🧹 Cleaning up..."
	rm -f $(GO_BINARY)
	@echo "✅ Clean complete"

docker-up:
	@echo "🐳 Starting infrastructure..."
	docker-compose up -d
	@echo "⏳ Waiting for services to be ready..."
	@sleep 5
	@echo "✅ Services ready"

docker-down:
	@echo "🛑 Stopping infrastructure..."
	docker-compose down
	@echo "✅ Services stopped"

deps:
	@echo "📦 Downloading dependencies..."
	go mod download
	go mod tidy
	@echo "✅ Dependencies ready"
