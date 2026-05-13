package utils

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"
)

func GenerateID() string {
	timestamp := time.Now().UnixNano()
	random := rand.Int63()
	hash := md5.Sum([]byte(fmt.Sprintf("%d%d", timestamp, random)))
	return hex.EncodeToString(hash[:])[:16]
}

func GenerateRequestID() string {
	return fmt.Sprintf("req_%s", GenerateID())
}

func MapToJSON(m map[string]string) string {
	if len(m) == 0 {
		return "{}"
	}
	data, _ := json.Marshal(m)
	return string(data)
}

func JSONToMap(s string) map[string]string {
	m := make(map[string]string)
	if s == "" || s == "{}" {
		return m
	}
	json.Unmarshal([]byte(s), &m)
	return m
}

func Now() time.Time {
	return time.Now().Truncate(time.Second)
}

func PtrTime(t time.Time) *time.Time {
	return &t
}
