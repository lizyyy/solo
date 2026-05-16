package handler

import (
	"browser-compat-exemption-api/models"
	"browser-compat-exemption-api/service"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

func CreateExemption(w http.ResponseWriter, r *http.Request) {
	rawInput, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var request models.CreateExemptionRequest
	if err := json.Unmarshal(rawInput, &request); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON format")
		return
	}

	if request.PagePath == "" {
		respondError(w, http.StatusBadRequest, "page_path is required")
		return
	}
	if request.Applicant == "" {
		respondError(w, http.StatusBadRequest, "applicant is required")
		return
	}
	if request.ApplicantEmail == "" {
		respondError(w, http.StatusBadRequest, "applicant_email is required")
		return
	}
	if request.Reason == "" {
		respondError(w, http.StatusBadRequest, "reason is required")
		return
	}
	if request.DurationDays <= 0 || request.DurationDays > 365 {
		respondError(w, http.StatusBadRequest, "duration_days must be between 1 and 365")
		return
	}

	result, err := service.CreateExemption(request, rawInput)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if result.Blocked {
		respondJSON(w, http.StatusForbidden, map[string]interface{}{
			"blocked": true,
			"reason":  result.BlockReason,
		})
		return
	}

	respondJSON(w, http.StatusCreated, result.Exemption)
}

func GetExemption(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/exemptions/")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid exemption ID")
		return
	}

	exemption, err := service.GetExemption(uint(id))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if exemption == nil {
		respondError(w, http.StatusNotFound, "exemption not found")
		return
	}

	respondJSON(w, http.StatusOK, exemption)
}

func QueryExemptions(w http.ResponseWriter, r *http.Request) {
	filter := models.QueryFilter{
		PagePath:  r.URL.Query().Get("page_path"),
		Browser:   r.URL.Query().Get("browser"),
		Status:    models.ExemptionStatus(r.URL.Query().Get("status")),
		Applicant: r.URL.Query().Get("applicant"),
	}

	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil {
			filter.Page = page
		}
	}
	if pageSizeStr := r.URL.Query().Get("page_size"); pageSizeStr != "" {
		if pageSize, err := strconv.Atoi(pageSizeStr); err == nil {
			filter.PageSize = pageSize
		}
	}

	isExpiredStr := r.URL.Query().Get("is_expired")
	if isExpiredStr != "" {
		isExpired := isExpiredStr == "true"
		filter.IsExpired = &isExpired
	}

	result, err := service.QueryExemptions(filter)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func UpdateStatus(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/exemptions/")
	idStr = strings.TrimSuffix(idStr, "/status")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid exemption ID")
		return
	}

	var request models.UpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON format")
		return
	}

	if request.Status == "" {
		respondError(w, http.StatusBadRequest, "status is required")
		return
	}

	if err := service.UpdateStatus(uint(id), request); err != nil {
		if err.Error() == "exemption not found" {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		if strings.Contains(err.Error(), "invalid status transition") {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "status updated successfully"})
}

func ManualCorrection(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/exemptions/")
	idStr = strings.TrimSuffix(idStr, "/correct")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid exemption ID")
		return
	}

	var request models.ManualCorrectionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON format")
		return
	}

	if err := service.ManualCorrection(uint(id), request); err != nil {
		if err.Error() == "exemption not found" {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "exemption corrected successfully"})
}

func HandleException(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/api/exemptions/")
	idStr = strings.TrimSuffix(idStr, "/exception")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid exemption ID")
		return
	}

	rawInput, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var body struct {
		ExceptionNote string `json:"exception_note"`
	}
	if err := json.Unmarshal(rawInput, &body); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON format")
		return
	}

	if err := service.HandleException(uint(id), body.ExceptionNote, rawInput); err != nil {
		if err.Error() == "exemption not found" {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "exception recorded successfully"})
}

func ExportExemptions(w http.ResponseWriter, r *http.Request) {
	data, err := service.ExportExemptions()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=exemptions.json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "browser-compat-exemption-api",
	})
}

func SetupRoutes() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", HealthCheck)
	mux.HandleFunc("/api/exemptions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			CreateExemption(w, r)
		} else if r.Method == http.MethodGet {
			QueryExemptions(w, r)
		} else {
			respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	mux.HandleFunc("/api/exemptions/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, "/status") && r.Method == http.MethodPut {
			UpdateStatus(w, r)
		} else if strings.HasSuffix(path, "/correct") && r.Method == http.MethodPut {
			ManualCorrection(w, r)
		} else if strings.HasSuffix(path, "/exception") && r.Method == http.MethodPost {
			HandleException(w, r)
		} else if r.Method == http.MethodGet {
			GetExemption(w, r)
		} else {
			respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	mux.HandleFunc("/api/export", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			ExportExemptions(w, r)
		} else {
			respondError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	return mux
}
