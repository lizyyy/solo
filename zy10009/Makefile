.PHONY: deps build run clean docker-up docker-down test

deps:
	go mod download

build: deps
	go build -o bin/chaos-demo ./cmd/server

run: deps
	go run ./cmd/server

clean:
	rm -rf bin/

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

test:
	go test -v ./...

fmt:
	go fmt ./...

lint:
	golangci-lint run ./...
