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

func GenerateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func Now() time.Time {
	return time.Now().UTC()
}
