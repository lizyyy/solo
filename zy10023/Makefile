.PHONY: all build clean test docker-up docker-down k8s-apply k8s-delete help

BINARY_NAME := api-guardian
DOCKER_TAG := api-guardian:latest

help:
	@echo "API Guardian Makefile"
	@echo ""
	@echo "Available commands:"
	@echo "  build        - Build the binary"
	@echo "  clean        - Clean build artifacts"
	@echo "  test         - Run tests"
	@echo "  docker-up    - Start services with Docker Compose"
	@echo "  docker-down  - Stop Docker Compose services"
	@echo "  docker-build - Build Docker image"
	@echo "  k8s-apply    - Apply Kubernetes manifests"
	@echo "  k8s-delete   - Delete Kubernetes resources"
	@echo "  run          - Run the server locally"
	@echo "  migrate      - Run database migrations"

build:
	@echo "Building ${BINARY_NAME}..."
	@go build -o bin/${BINARY_NAME} ./cmd/server/main.go
	@echo "Build complete: bin/${BINARY_NAME}"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf bin/
	@echo "Clean complete"

test:
	@echo "Running tests..."
	@go test -v ./internal/...

docker-build:
	@echo "Building Docker image: ${DOCKER_TAG}..."
	@docker build -t ${DOCKER_TAG} .
	@echo "Docker build complete"

docker-up: docker-build
	@echo "Starting services with Docker Compose..."
	@docker-compose up -d
	@echo "Services started. Check logs with: docker-compose logs -f"

docker-down:
	@echo "Stopping Docker Compose services..."
	@docker-compose down
	@echo "Services stopped"

docker-logs:
	@docker-compose logs -f

k8s-apply:
	@echo "Applying Kubernetes manifests..."
	@kubectl apply -f k8s/namespace.yaml
	@kubectl apply -f k8s/postgres.yaml
	@kubectl apply -f k8s/jaeger.yaml
	@kubectl apply -f k8s/api-guardian.yaml
	@echo "Kubernetes resources applied"

k8s-delete:
	@echo "Deleting Kubernetes resources..."
	@kubectl delete -f k8s/api-guardian.yaml --ignore-not-found
	@kubectl delete -f k8s/jaeger.yaml --ignore-not-found
	@kubectl delete -f k8s/postgres.yaml --ignore-not-found
	@kubectl delete -f k8s/namespace.yaml --ignore-not-found
	@echo "Kubernetes resources deleted"

k8s-logs:
	@kubectl logs -f -n api-guardian -l app=api-guardian

run: build
	@echo "Starting ${BINARY_NAME}..."
	@./bin/${BINARY_NAME} --config ./config/config.yaml

migrate: build
	@echo "Running database migrations..."
	@./bin/${BINARY_NAME} --config ./config/config.yaml --migrate

.PHONY: all build clean test docker-up docker-down k8s-apply k8s-delete help
