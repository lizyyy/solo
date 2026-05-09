FROM golang:1.21-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o grayscale-simulator cmd/server/main.go

FROM alpine:3.19

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/grayscale-simulator /app/
COPY config.yaml /app/
COPY migrations/ /app/migrations/

RUN mkdir -p /app/reports

EXPOSE 8080

ENTRYPOINT ["/app/grayscale-simulator"]

