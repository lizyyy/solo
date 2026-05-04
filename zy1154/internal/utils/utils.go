package utils

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

func GenerateID() string {
	timestamp := time.Now().UnixNano()
	randomBytes := make([]byte, 4)
	rand.Read(randomBytes)
	randomHex := hex.EncodeToString(randomBytes)
	return fmt.Sprintf("%d-%s", timestamp, randomHex)
}

func GenerateOrderID() string {
	return "ORD-" + GenerateID()
}

func GenerateSagaID() string {
	return "SAGA-" + GenerateID()
}

func GenerateEventID() string {
	return "EVT-" + GenerateID()
}

func GenerateTaskID() string {
	return "TASK-" + GenerateID()
}

func PointerToTime(t time.Time) *time.Time {
	return &t
}

func TimeOrNil(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}

func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func Min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func Max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
