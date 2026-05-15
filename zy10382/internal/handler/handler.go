package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type ErrorResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}

func JSONResponse(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(Response{
		Code:    code,
		Message: "success",
		Data:    data,
	})
}

func JSONError(w http.ResponseWriter, code int, message string, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	errMsg := ""
	if err != nil {
		errMsg = err.Error()
	}
	json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
		Error:   errMsg,
	})
}

func GetPagination(r *http.Request) (page, pageSize int) {
	pageStr := r.URL.Query().Get("page")
	pageSizeStr := r.URL.Query().Get("page_size")

	page = 1
	pageSize = 10

	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 {
		pageSize = ps
	}
	return
}

func GetTimeRange(r *http.Request) (startTime, endTime time.Time, err error) {
	startStr := r.URL.Query().Get("start_time")
	endStr := r.URL.Query().Get("end_time")

	now := time.Now()
	endTime = now
	startTime = now.AddDate(0, 0, -7)

	if startStr != "" {
		if startTime, err = time.Parse(time.RFC3339, startStr); err != nil {
			if startTime, err = time.Parse("2006-01-02", startStr); err != nil {
				return
			}
		}
	}

	if endStr != "" {
		if endTime, err = time.Parse(time.RFC3339, endStr); err != nil {
			if endTime, err = time.Parse("2006-01-02", endStr); err != nil {
				return
			}
		}
	}

	return startTime, endTime, nil
}

func GetIDFromURL(path, prefix string) string {
	return strings.TrimPrefix(path, prefix)
}
