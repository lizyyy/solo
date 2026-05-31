package review

import (
	"fmt"
	"food_truck_challenge/engine"
	"food_truck_challenge/model"
	"strings"
)

type ReviewService struct {
	eng *engine.Engine
}

func NewReviewService(e *engine.Engine) *ReviewService {
	return &ReviewService{eng: e}
}

type ReviewContext struct {
	DisputeReason model.DisputeReason
	Detail        string
}

func autoDetectReviewContext(challengeName string, rawData interface{}) *ReviewContext {
	name := strings.ToLower(challengeName)
	if strings.Contains(name, "断线") || strings.Contains(name, "disconnect") {
		return &ReviewContext{
			DisputeReason: model.DisconnProgressLost,
			Detail:        "auto_detected: challenge name indicates disconnect issue",
		}
	}
	return nil
}

func (s *ReviewService) IngestWithReview(batchID, challengeName, playerID string, source model.RecordSource, rawData interface{}) (*model.EventRecord, bool, error) {
	rec, created, err := s.eng.Ingest(batchID, challengeName, playerID, source, rawData)
	if err != nil {
		return nil, false, err
	}

	if !created {
		return rec, false, nil
	}

	ctx := autoDetectReviewContext(challengeName, rawData)
	if ctx != nil {
		_, err = s.eng.MarkReviewNeeded(rec.ID, "review_auto", ctx.DisputeReason, ctx.Detail)
		if err != nil {
			return nil, false, fmt.Errorf("auto review mark failed: %w", err)
		}
		rec, _ = s.eng.GetRecord(rec.ID)
	}

	return rec, true, nil
}

func (s *ReviewService) FlagDispute(recordID, changedBy string, reason model.DisputeReason, detail string) (*model.EventRecord, error) {
	rec, err := s.eng.MarkDisputed(recordID, changedBy, reason, detail)
	if err != nil {
		return nil, err
	}
	return rec, nil
}

func (s *ReviewService) ResolveDispute(recordID, resolver, resolutionNote string) (*model.EventRecord, error) {
	rec, err := s.eng.GetRecord(recordID)
	if err != nil {
		return nil, err
	}
	if rec.Status != model.StatusDisputed && rec.Status != model.StatusReviewNeeded {
		return nil, fmt.Errorf("record %s is in status %s, not dispute/review_needed; cannot resolve", recordID, rec.Status)
	}
	resolved, err := s.eng.Resolve(recordID, resolver, resolutionNote)
	if err != nil {
		return nil, err
	}
	return resolved, nil
}

func (s *ReviewService) GetReviewSummary(recordID string) (map[string]interface{}, error) {
	rec, err := s.eng.GetRecord(recordID)
	if err != nil {
		return nil, err
	}
	trail, err := s.eng.GetAuditTrail(recordID)
	if err != nil {
		return nil, err
	}

	summary := map[string]interface{}{
		"record_id":      rec.ID,
		"challenge_name": rec.ChallengeName,
		"player_id":      rec.PlayerID,
		"source":         rec.Source,
		"current_status": rec.Status,
		"dispute_reason": rec.DisputeReason,
		"review_note":    rec.ReviewNote,
		"created_at":     rec.CreatedAt,
		"updated_at":     rec.UpdatedAt,
		"audit_count":    len(trail),
		"audit_trail":    trail,
		"why_pending":    s.explainWhyPending(rec, trail),
	}
	return summary, nil
}

func (s *ReviewService) explainWhyPending(rec *model.EventRecord, trail []model.AuditEntry) string {
	if rec.Status != model.StatusPending && rec.Status != model.StatusReviewNeeded && rec.Status != model.StatusDisputed {
		return ""
	}

	var reasons []string
	for _, entry := range trail {
		if entry.NewStatus == model.StatusPending && entry.Reason == "initial_ingest" {
			reasons = append(reasons, fmt.Sprintf("ingested from %s at %s", entry.ChangedBy, entry.ChangedAt.Format("2006-01-02 15:04:05")))
		}
		if entry.NewStatus == model.StatusReviewNeeded {
			reasons = append(reasons, fmt.Sprintf("flagged review_needed by %s: %s (%s)", entry.ChangedBy, entry.Detail, entry.ChangedAt.Format("2006-01-02 15:04:05")))
		}
		if entry.NewStatus == model.StatusDisputed {
			reasons = append(reasons, fmt.Sprintf("disputed by %s: %s (%s)", entry.ChangedBy, entry.Detail, entry.ChangedAt.Format("2006-01-02 15:04:05")))
		}
	}
	if len(reasons) == 0 {
		return "no specific reason recorded"
	}
	return strings.Join(reasons, "; ")
}

func (s *ReviewService) ListPendingReview() []*model.EventRecord {
	reviewNeeded := s.eng.ListByStatus(model.StatusReviewNeeded)
	disputed := s.eng.ListByStatus(model.StatusDisputed)
	return append(reviewNeeded, disputed...)
}
