package utils

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

func GenerateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func GetCurrentTime() time.Time {
	return time.Now().UTC()
}
