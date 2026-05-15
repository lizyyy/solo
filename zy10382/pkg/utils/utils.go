package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func GenerateID() string {
	return uuid.New().String()
}

func GenerateIdempotencyKey(data interface{}) string {
	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}

func GenerateIdempotencyKeyWithTime(data interface{}) string {
	jsonData, _ := json.Marshal(data)
	timeStr := time.Now().Format("20060102")
	hash := sha256.Sum256(append(jsonData, []byte(timeStr)...))
	return hex.EncodeToString(hash[:])
}

func FormatTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

func NowPtr() *time.Time {
	t := time.Now()
	return &t
}

func PrettyPrint(v interface{}) {
	b, _ := json.MarshalIndent(v, "", "  ")
	fmt.Println(string(b))
}

func Contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
