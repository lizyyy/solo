package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func GenerateID() string {
	return uuid.New().String()
}

func GenerateShortID() string {
	uuidVal := uuid.New()
	return fmt.Sprintf("%x", uuidVal)[:16]
}

func GenerateTrackingID() string {
	return fmt.Sprintf("TRK-%s-%d", GenerateShortID(), time.Now().UnixNano())
}

func GenerateRequestID() string {
	return fmt.Sprintf("REQ-%s-%d", GenerateShortID(), time.Now().UnixNano())
}

func GenerateRandomHex(length int) string {
	bytes := make([]byte, length/2)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
