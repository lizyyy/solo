package utils

import (
	"github.com/google/uuid"
)

func NewUUID() string {
	return uuid.New().String()
}

func NewTraceID() string {
	return "trace-" + uuid.New().String()
}

func NewSpanID() string {
	return uuid.New().String()[:16]
}

func GenerateOrderID() string {
	return "ORD-" + uuid.New().String()
}

func GeneratePaymentID() string {
	return "PAY-" + uuid.New().String()
}

func GenerateOperationID() string {
	return "OP-" + uuid.New().String()
}
