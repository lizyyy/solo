package handlers

import (
	"encoding/json"
	"museum-exhibit-condition-api/database"
	"net/http"
	"strconv"
	"time"
)

func (h *Handler) ConfirmLiabilityHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	var req struct {
		VersionID   int64   `json:"version_id"`
		LiableParty string  `json:"liable_party"`
		Reason      string  `json:"reason"`
		Confidence  float64 `json:"confidence"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	record, err := h.liabilitySvc.ConfirmLiability(id, req.VersionID, req.LiableParty, req.Reason, req.Confidence, operator)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "liability confirmed", "r": record})
}

func (h *Handler) ReviewHandler(w http.ResponseWriter, r *http.Request) {
	conclusionID, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	var req struct {
		Approved bool   `json:"approved"`
		Remark   string `json:"remark"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	err := h.liabilitySvc.ReviewConclusion(conclusionID, req.Approved, req.Remark, operator)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "reviewed"})
}

func (h *Handler) PhotosHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("versionId"), 10, 64)
	if r.Method == "POST" {
		var req struct {
			PhotoURL    string `json:"photo_url"`
			PhotoHash   string `json:"photo_hash"`
			Description string `json:"description"`
			Source      string `json:"source"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		var recordID int64
		database.DB.QueryRow("SELECT record_id FROM condition_versions WHERE id = ?", id).Scan(&recordID)
		res, err := database.DB.Exec(
			"INSERT INTO photo_evidences (record_id, version_id, photo_url, photo_hash, description, source, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			recordID, id, req.PhotoURL, req.PhotoHash, req.Description, req.Source, h.getOperator(r), time.Now())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		pid, _ := res.LastInsertId()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{"m": "photo uploaded", "photo_id": pid})
		return
	}
	rows, _ := database.DB.Query("SELECT id, version_id, photo_url, photo_hash, description, source, uploaded_by, created_at FROM photo_evidences WHERE version_id = ? ORDER BY created_at DESC", id)
	var photos []map[string]interface{}
	for rows.Next() {
		var p struct {
			ID          int64
			VersionID   int64
			PhotoURL    string
			PhotoHash   string
			Description string
			Source      string
			UploadedBy  string
			CreatedAt   time.Time
		}
		rows.Scan(&p.ID, &p.VersionID, &p.PhotoURL, &p.PhotoHash, &p.Description, &p.Source, &p.UploadedBy, &p.CreatedAt)
		photos = append(photos, map[string]interface{}{"id": p.ID, "url": p.PhotoURL, "hash": p.PhotoHash, "source": p.Source, "by": p.UploadedBy})
	}
	rows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"photos": photos})
}

func (h *Handler) ExportJSONHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	h.reportSvc.ExportJSON(w, id)
}

func (h *Handler) ExportCSVHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	h.reportSvc.ExportCSV(w, id)
}

func (h *Handler) StatisticsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := h.reportSvc.GetStatistics()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"stats": stats})
}
