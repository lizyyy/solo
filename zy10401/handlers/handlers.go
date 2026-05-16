package handlers

import (
	"contract-drift-api/models"
	"contract-drift-api/store"
	"contract-drift-api/utils"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

type ContractHandler struct {
	db *store.DB
}

func NewContractHandler(db *store.DB) *ContractHandler {
	return &ContractHandler{db: db}
}

func (h *ContractHandler) CreateContract(w http.ResponseWriter, r *http.Request) {
	var contract models.Contract
	if err := json.NewDecoder(r.Body).Decode(&contract); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.db.CreateContract(&contract); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "contract with same name and version already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(contract)
}

func (h *ContractHandler) GetContract(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	contract, err := h.db.GetContract(id)
	if err != nil {
		http.Error(w, "contract not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contract)
}

func (h *ContractHandler) ListContracts(w http.ResponseWriter, r *http.Request) {
	contracts, err := h.db.ListContracts()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(contracts)
}

type SampleHandler struct {
	db       *store.DB
	detector *utils.DriftDetector
}

func NewSampleHandler(db *store.DB) *SampleHandler {
	return &SampleHandler{db: db, detector: utils.NewDriftDetector()}
}

func (h *SampleHandler) ImportSample(w http.ResponseWriter, r *http.Request) {
	var sample models.Sample
	if err := json.NewDecoder(r.Body).Decode(&sample); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if sample.ContractID == 0 {
		http.Error(w, "contract_id is required", http.StatusBadRequest)
		return
	}

	if err := h.db.ImportSample(&sample); err != nil {
		if err.Error() == "duplicate sample" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":      sample.ID,
				"message": "duplicate sample, returning existing record",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(sample)
}

func (h *SampleHandler) GetSample(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	sample, err := h.db.GetSample(id)
	if err != nil {
		http.Error(w, "sample not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sample)
}

func (h *SampleHandler) ListSamples(w http.ResponseWriter, r *http.Request) {
	contractID, _ := strconv.ParseInt(r.URL.Query().Get("contract_id"), 10, 64)

	samples, err := h.db.ListSamples(contractID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(samples)
}

func (h *SampleHandler) AnalyzeSample(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	sample, err := h.db.GetSample(id)
	if err != nil {
		http.Error(w, "sample not found", http.StatusNotFound)
		return
	}

	contract, err := h.db.GetContract(sample.ContractID)
	if err != nil {
		http.Error(w, "contract not found", http.StatusNotFound)
		return
	}

	result, err := h.detector.AnalyzeSample(sample, contract)
	if err != nil {
		h.recordException("analyze_sample", nil, err.Error(), "failed to analyze sample drift")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for i := range result.DriftRecords {
		if err := h.db.CreateDriftRecord(&result.DriftRecords[i]); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	status := "compliant"
	if result.HasDrift {
		status = "drifted"
	}
	if err := h.db.UpdateSampleStatus(id, status); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *SampleHandler) recordException(operation string, input interface{}, errMsg, conclusion string) {
	rawInput, _ := json.Marshal(input)
	exception := &models.ExceptionRecord{
		Operation:    operation,
		RawInput:     rawInput,
		ErrorMessage: errMsg,
		Conclusion:   conclusion,
	}
	h.db.CreateExceptionRecord(exception)
}

type DriftHandler struct {
	db *store.DB
}

func NewDriftHandler(db *store.DB) *DriftHandler {
	return &DriftHandler{db: db}
}

func (h *DriftHandler) GetDrift(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	drift, err := h.db.GetDriftRecord(id)
	if err != nil {
		http.Error(w, "drift record not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drift)
}

func (h *DriftHandler) ListDrifts(w http.ResponseWriter, r *http.Request) {
	contractID, _ := strconv.ParseInt(r.URL.Query().Get("contract_id"), 10, 64)
	status := r.URL.Query().Get("status")

	drifts, err := h.db.ListDriftRecords(contractID, status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drifts)
}

func (h *DriftHandler) ConfirmDrift(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	var req struct {
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.db.ResolveDriftRecord(id, req.Comment); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "confirmed"})
}

func (h *DriftHandler) ResolveDrift(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	var req struct {
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.db.ResolveDriftRecord(id, req.Comment); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "resolved"})
}

type ConsumerHandler struct {
	db *store.DB
}

func NewConsumerHandler(db *store.DB) *ConsumerHandler {
	return &ConsumerHandler{db: db}
}

func (h *ConsumerHandler) RegisterConsumer(w http.ResponseWriter, r *http.Request) {
	var consumer models.Consumer
	if err := json.NewDecoder(r.Body).Decode(&consumer); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.db.RegisterConsumer(&consumer); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "consumer with same name and version already exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(consumer)
}

func (h *ConsumerHandler) ListConsumers(w http.ResponseWriter, r *http.Request) {
	consumers, err := h.db.ListConsumers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(consumers)
}

func (h *ConsumerHandler) ConfirmSample(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	consumerID, _ := strconv.ParseInt(vars["id"], 10, 64)

	var req struct {
		SampleID int64  `json:"sample_id"`
		Status   string `json:"status"`
		Comment  string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Status == "" {
		req.Status = "confirmed"
	}

	if err := h.db.ConfirmSample(req.SampleID, consumerID, req.Status, req.Comment); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "sample already confirmed by this consumer", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "confirmed"})
}

type ReportHandler struct {
	db *store.DB
}

func NewReportHandler(db *store.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

func (h *ReportHandler) ExportDriftReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	contractID, _ := strconv.ParseInt(vars["contract_id"], 10, 64)

	contract, err := h.db.GetContract(contractID)
	if err != nil {
		http.Error(w, "contract not found", http.StatusNotFound)
		return
	}

	samples, err := h.db.ListSamples(contractID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	drifts, err := h.db.ListDriftRecords(contractID, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	report := utils.GenerateDriftReport(contract, samples, drifts)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

func (h *ReportHandler) ExportFullReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	contractID, _ := strconv.ParseInt(vars["contract_id"], 10, 64)

	contract, err := h.db.GetContract(contractID)
	if err != nil {
		http.Error(w, "contract not found", http.StatusNotFound)
		return
	}

	samples, err := h.db.ListSamples(contractID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	drifts, err := h.db.ListDriftRecords(contractID, "")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	fields, err := h.db.GetFieldExplanations(contractID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	fullReport := map[string]interface{}{
		"contract":   contract,
		"samples":    samples,
		"drifts":     drifts,
		"fields":     fields,
		"driftStats": utils.GenerateDriftReport(contract, samples, drifts),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(fullReport)
}

type ExceptionHandler struct {
	db *store.DB
}

func NewExceptionHandler(db *store.DB) *ExceptionHandler {
	return &ExceptionHandler{db: db}
}

func (h *ExceptionHandler) GetException(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	exception, err := h.db.GetExceptionRecord(id)
	if err != nil {
		http.Error(w, "exception record not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(exception)
}

func (h *ExceptionHandler) ListExceptions(w http.ResponseWriter, r *http.Request) {
	exceptions, err := h.db.ListExceptionRecords()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(exceptions)
}

func (h *ExceptionHandler) FixException(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseInt(vars["id"], 10, 64)

	var req struct {
		FixedBy string `json:"fixed_by"`
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.db.FixExceptionRecord(id, req.FixedBy, req.Comment); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "fixed"})
}
