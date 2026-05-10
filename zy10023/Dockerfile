FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api-guardian ./cmd/server/main.go

FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/api-guardian /app/api-guardian
COPY --from=builder /app/config /app/config

EXPOSE 8080 8081 50051

CMD ["/app/api-guardian", "--config", "/app/config/config.yaml"]
