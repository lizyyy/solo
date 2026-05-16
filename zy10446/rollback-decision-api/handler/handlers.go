package handler

import (
	"encoding/json"
	"net/http"
	"rollback-decision-api/models"
	"rollback-decision-api/service"
	"rollback-decision-api/storage"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type CreateBatchRequest struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	CreatedBy   string `json:"created_by"`
}

type AddMetricsRequest struct {
	CoreMetrics      []CoreMetricInput      `json:"core_metrics"`
	AuxiliaryMetrics []AuxiliaryMetricInput `json:"auxiliary_metrics"`
}

type CoreMetricInput struct {
	Name       string             `json:"name"`
	MetricType models.MetricType  `json:"metric_type"`
	Value      float64            `json:"value"`
	Baseline   float64            `json:"baseline"`
	RawData    string             `json:"raw_data"`
}

type AuxiliaryMetricInput struct {
	Name        string  `json:"name"`
	Value       float64 `json:"value"`
	Description string  `json:"description"`
}

type AddRulesRequest struct {
	Rules []RuleInput `json:"rules"`
}

type RuleInput struct {
	MetricName  string                  `json:"metric_name"`
	MetricType  models.MetricType       `json:"metric_type"`
	Operator    models.ThresholdOperator `json:"operator"`
	Threshold   float64                 `json:"threshold"`
	Severity    string                  `json:"severity"`
	Description string                  `json:"description"`
}

type EvaluateRequest struct {
	RawInput string `json:"raw_input"`
}

type ManualOverrideRequest struct {
	Status   string `json:"status"`
	Reason   string `json:"reason"`
	Operator string `json:"operator"`
}

func CreateBatch(w http.ResponseWriter, r *http.Request) {
	var req CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	batch := &models.ReleaseBatch{
		ID:          uuid.New().String(),
		Name:        req.Name,
		Version:     req.Version,
		Description: req.Description,
		Status:      models.StatusPending,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		CreatedBy:   req.CreatedBy,
	}

	db := storage.GetDB()
	if err := db.Create(batch).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(batch)
}

func GetBatch(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var batch models.ReleaseBatch
	db := storage.GetDB()
	if err := db.First(&batch, "id = ?", batchID).Error; err != nil {
		http.Error(w, "Batch not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(batch)
}

func ListBatches(w http.ResponseWriter, r *http.Request) {
	var batches []models.ReleaseBatch
	db := storage.GetDB()
	db.Order("created_at desc").Find(&batches)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(batches)
}

func AddMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var req AddMetricsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	for _, m := range req.CoreMetrics {
		metric := models.CoreMetric{
			ID:          uuid.New().String(),
			BatchID:     batchID,
			Name:        m.Name,
			MetricType:  m.MetricType,
			Value:       m.Value,
			Baseline:    m.Baseline,
			CollectedAt: time.Now(),
			RawData:     m.RawData,
		}
		db.Create(&metric)
	}

	for _, m := range req.AuxiliaryMetrics {
		metric := models.AuxiliaryMetric{
			ID:          uuid.New().String(),
			BatchID:     batchID,
			Name:        m.Name,
			Value:       m.Value,
			Description: m.Description,
			CollectedAt: time.Now(),
		}
		db.Create(&metric)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func GetMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var coreMetrics []models.CoreMetric
	var auxMetrics []models.AuxiliaryMetric

	db := storage.GetDB()
	db.Where("batch_id = ?", batchID).Find(&coreMetrics)
	db.Where("batch_id = ?", batchID).Find(&auxMetrics)

	result := map[string]interface{}{
		"core_metrics":       coreMetrics,
		"auxiliary_metrics":  auxMetrics,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func AddRules(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var req AddRulesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	db := storage.GetDB()

	for _, r := range req.Rules {
		rule := models.ThresholdRule{
			ID:          uuid.New().String(),
			BatchID:     batchID,
			MetricName:  r.MetricName,
			MetricType:  r.MetricType,
			Operator:    r.Operator,
			Threshold:   r.Threshold,
			Severity:    r.Severity,
			Description: r.Description,
			CreatedAt:   time.Now(),
		}
		db.Create(&rule)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func GetRules(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var rules []models.ThresholdRule
	db := storage.GetDB()
	db.Where("batch_id = ?", batchID).Find(&rules)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rules)
}

func EvaluateBatch(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var req EvaluateRequest
	json.NewDecoder(r.Body).Decode(&req)

	decision, err := service.EvaluateBatch(batchID, req.RawInput)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(decision)
}

func GetDecisions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var decisions []models.DecisionRecord
	db := storage.GetDB()
	db.Where("batch_id = ?", batchID).Order("decided_at desc").Find(&decisions)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(decisions)
}

func ManualOverride(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	var req ManualOverrideRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	decision, err := service.ManualOverride(batchID, models.ReleaseStatus(req.Status), req.Reason, req.Operator)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(decision)
}

func ExportSummary(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]
	exportedBy := r.URL.Query().Get("exported_by")
	if exportedBy == "" {
		exportedBy = "anonymous"
	}

	summary, err := service.ExportSummary(batchID, exportedBy)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	format := r.URL.Query().Get("format")
	if format == "text" {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(summary.SummaryText))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func GetAggregatedMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["id"]

	metrics, err := service.AggregateMetrics(batchID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}
