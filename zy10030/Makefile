.PHONY: build run test clean docker-up docker-down help

APP_NAME := grayscale-simulator
DOCKER_COMPOSE := docker-compose

help:
	@echo "Available commands:"
	@echo "  build        - Build the Go application"
	@echo "  run          - Run the application locally"
	@echo "  test         - Run tests"
	@echo "  clean        - Clean build artifacts"
	@echo "  docker-up    - Start all services with Docker Compose"
	@echo "  docker-down  - Stop all services"
	@echo "  docker-build - Build Docker image"
	@echo "  migrate      - Run database migrations"
	@echo "  logs         - Show application logs"

build:
	@echo "Building $(APP_NAME)..."
	go build -o bin/$(APP_NAME) cmd/server/main.go
	@echo "Build complete: bin/$(APP_NAME)"

run: build
	@echo "Starting $(APP_NAME)..."
	./bin/$(APP_NAME)

test:
	@echo "Running tests..."
	go test -v ./...

clean:
	@echo "Cleaning..."
	rm -rf bin/
	rm -rf reports/
	go clean

docker-up:
	@echo "Starting all services..."
	$(DOCKER_COMPOSE) up -d
	@echo "Services started. App running on http://localhost:8080"

docker-down:
	@echo "Stopping all services..."
	$(DOCKER_COMPOSE) down

docker-build:
	@echo "Building Docker image..."
	$(DOCKER_COMPOSE) build

migrate:
	@echo "Running database migrations..."
	docker exec -i grayscale-postgres psql -U postgres -d grayscale_simulator < migrations/init.sql

logs:
	$(DOCKER_COMPOSE) logs -f app

ps:
	$(DOCKER_COMPOSE) ps

health:
	curl http://localhost:8080/api/v1/health

demo-scenario:
	@echo "=== Running Demo Scenario ==="
	@echo "1. Creating a gray release..."
	curl -X POST http://localhost:8080/api/v1/releases \
		-H "Content-Type: application/json" \
		-d '{"service_name":"order-service","version":"v2.0.0","description":"New checkout flow","strategy":"percentage","strategy_config":{"percentage":50},"created_by":"admin"}'
	
	@echo ""
	@echo "2. Creating a fault injection config (timeout)..."
	curl -X POST http://localhost:8080/api/v1/faults \
		-H "Content-Type: application/json" \
		-d '{"name":"DB Timeout","fault_type":"timeout","target_service":"order-service","enabled":true,"config":{"min_timeout":"1s","max_timeout":"3s"},"probability":0.3,"created_by":"tester"}'
	
	@echo ""
	@echo "3. Simulating requests to test fault injection..."
	for i in 1 2 3 4 5; do \
		echo "Request $$i:"; \
		curl -s http://localhost:8080/api/v1/faults/simulate?target_service=order-service; \
		echo ""; \
		sleep 1; \
	done

stress-test:
	@echo "Running stress test (1000 concurrent requests)..."
	@for i in $$(seq 1 1000); do \
		curl -s http://localhost:8080/api/v1/health > /dev/null & \
	done
	@wait
	@echo "Stress test complete"

