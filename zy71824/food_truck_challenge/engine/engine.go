package engine

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"food_truck_challenge/model"
	"sort"
	"sync"
	"time"
)

type Engine struct {
	mu      sync.RWMutex
	records map[string]*model.EventRecord
	audits  map[string][]model.AuditEntry
}

func New() *Engine {
	return &Engine{
		records: make(map[string]*model.EventRecord),
		audits:  make(map[string][]model.AuditEntry),
	}
}

func computeFingerprint(batchID, playerID, challengeName string, rawData interface{}) string {
	h := sha256.New()
	h.Write([]byte(batchID))
	h.Write([]byte(playerID))
	h.Write([]byte(challengeName))
	if rawData != nil {
		b, _ := json.Marshal(rawData)
		h.Write(b)
	}
	return fmt.Sprintf("%x", h.Sum(nil))[:16]
}

func generateID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func (e *Engine) Ingest(batchID, challengeName, playerID string, source model.RecordSource, rawData interface{}) (*model.EventRecord, bool, error) {
	fp := computeFingerprint(batchID, playerID, challengeName, rawData)

	e.mu.Lock()
	defer e.mu.Unlock()

	for _, rec := range e.records {
		if rec.Fingerprint == fp {
			return rec, false, nil
		}
	}

	now := time.Now()
	rec := &model.EventRecord{
		ID:            generateID("rec"),
		BatchID:       batchID,
		ChallengeName: challengeName,
		PlayerID:      playerID,
		Source:        source,
		Status:        model.StatusPending,
		RawData:       rawData,
		CreatedAt:     now,
		UpdatedAt:     now,
		Fingerprint:   fp,
	}
	e.records[rec.ID] = rec

	entry := model.AuditEntry{
		ID:        generateID("aud"),
		RecordID:  rec.ID,
		OldStatus: "",
		NewStatus: model.StatusPending,
		ChangedBy: string(source),
		Reason:    "initial_ingest",
		Detail:    fmt.Sprintf("batch=%s source=%s", batchID, source),
		ChangedAt: now,
	}
	e.audits[rec.ID] = append(e.audits[rec.ID], entry)

	return rec, true, nil
}

func (e *Engine) TransitionStatus(recordID, changedBy, reason, detail string, newStatus model.RecordStatus) (*model.EventRecord, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	rec, ok := e.records[recordID]
	if !ok {
		return nil, fmt.Errorf("record %s not found", recordID)
	}

	if rec.Status == newStatus {
		return rec, nil
	}

	oldStatus := rec.Status
	rec.Status = newStatus
	rec.UpdatedAt = time.Now()

	entry := model.AuditEntry{
		ID:        generateID("aud"),
		RecordID:  recordID,
		OldStatus: oldStatus,
		NewStatus: newStatus,
		ChangedBy: changedBy,
		Reason:    reason,
		Detail:    detail,
		ChangedAt: time.Now(),
	}
	e.audits[recordID] = append(e.audits[recordID], entry)

	return rec, nil
}

func (e *Engine) MarkDisputed(recordID, changedBy string, reason model.DisputeReason, detail string) (*model.EventRecord, error) {
	rec, err := e.TransitionStatus(recordID, changedBy, "dispute_raised", detail, model.StatusDisputed)
	if err != nil {
		return nil, err
	}
	rec.DisputeReason = &reason
	return rec, nil
}

func (e *Engine) MarkReviewNeeded(recordID, changedBy string, reason model.DisputeReason, detail string) (*model.EventRecord, error) {
	rec, err := e.TransitionStatus(recordID, changedBy, "review_needed", detail, model.StatusReviewNeeded)
	if err != nil {
		return nil, err
	}
	rec.DisputeReason = &reason
	return rec, nil
}

func (e *Engine) Resolve(recordID, changedBy, note string) (*model.EventRecord, error) {
	rec, err := e.TransitionStatus(recordID, changedBy, "resolved", note, model.StatusResolved)
	if err != nil {
		return nil, err
	}
	rec.ReviewNote = note
	return rec, nil
}

func (e *Engine) GetRecord(recordID string) (*model.EventRecord, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	rec, ok := e.records[recordID]
	if !ok {
		return nil, fmt.Errorf("record %s not found", recordID)
	}
	return rec, nil
}

func (e *Engine) GetAuditTrail(recordID string) ([]model.AuditEntry, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if _, ok := e.records[recordID]; !ok {
		return nil, fmt.Errorf("record %s not found", recordID)
	}
	trail := e.audits[recordID]
	sorted := make([]model.AuditEntry, len(trail))
	copy(sorted, trail)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].ChangedAt.Before(sorted[j].ChangedAt)
	})
	return sorted, nil
}

func (e *Engine) ListByStatus(status model.RecordStatus) []*model.EventRecord {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var result []*model.EventRecord
	for _, rec := range e.records {
		if rec.Status == status {
			result = append(result, rec)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].UpdatedAt.Before(result[j].UpdatedAt)
	})
	return result
}

func (e *Engine) ListByBatch(batchID string) []*model.EventRecord {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var result []*model.EventRecord
	for _, rec := range e.records {
		if rec.BatchID == batchID {
			result = append(result, rec)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.Before(result[j].CreatedAt)
	})
	return result
}

func (e *Engine) AllRecords() []*model.EventRecord {
	e.mu.RLock()
	defer e.mu.RUnlock()

	result := make([]*model.EventRecord, 0, len(e.records))
	for _, rec := range e.records {
		result = append(result, rec)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.Before(result[j].CreatedAt)
	})
	return result
}
