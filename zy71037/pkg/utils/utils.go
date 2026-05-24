package utils

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"night-market-api/internal/models"
)

func GenerateID() string {
	return uuid.New().String()
}

func JSONResponse(success bool, message string, data interface{}, errors interface{}) models.ApiResponse {
	return models.ApiResponse{
		Success: success,
		Message: message,
		Data:    data,
		Errors:  errors,
	}
}

func ToJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func GetCurrentTimePtr() *time.Time {
	now := time.Now()
	return &now
}
