package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

func GenerateRequestHash(data interface{}) string {
	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return hex.EncodeToString(hash[:])
}
