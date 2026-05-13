package utils

import (
	"crypto/rand"
	"fmt"
	"time"
)

func GenerateUUID() string {
	b := make([]byte, 16)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func GenerateCredential() string {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return fmt.Sprintf("cred-%d", time.Now().UnixNano())
	}
	return fmt.Sprintf("cred-%x", b)
}
