package review_test

import (
	"food_truck_challenge/engine"
	"food_truck_challenge/model"
	"food_truck_challenge/review"
	"testing"
)

func TestAutoDetectDisconnectReview(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec, created, err := svc.IngestWithReview("batch-001", "断线进度恢复挑战", "player-A", model.SourcePlayerFeedback, nil)
	if err != nil {
		t.Fatalf("ingest failed: %v", err)
	}
	if !created {
		t.Fatal("should create new record")
	}
	if rec.Status != model.StatusReviewNeeded {
		t.Fatalf("disconnect challenge should auto-flag as review_needed, got %s", rec.Status)
	}
	if rec.DisputeReason == nil || *rec.DisputeReason != model.DisconnProgressLost {
		t.Fatal("dispute reason should be disconnect_progress_lost")
	}
}

func TestNormalChallengeNotAutoFlagged(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec, created, _ := svc.IngestWithReview("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)
	if !created {
		t.Fatal("should create new record")
	}
	if rec.Status != model.StatusPending {
		t.Fatalf("normal challenge should stay pending, got %s", rec.Status)
	}
}

func TestFlagDisputeAndResolve(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec, _, _ := svc.IngestWithReview("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)

	disputed, err := svc.FlagDispute(rec.ID, "gm-li", model.RewardMissing, "玩家A反馈奖励未到账")
	if err != nil {
		t.Fatalf("flag dispute failed: %v", err)
	}
	if disputed.Status != model.StatusDisputed {
		t.Fatalf("should be disputed, got %s", disputed.Status)
	}

	resolved, err := svc.ResolveDispute(rec.ID, "gm-wang", "奖励已补发，确认到账")
	if err != nil {
		t.Fatalf("resolve failed: %v", err)
	}
	if resolved.Status != model.StatusResolved {
		t.Fatalf("should be resolved, got %s", resolved.Status)
	}
}

func TestResolveNonDisputeFails(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec, _, _ := svc.IngestWithReview("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)

	_, err := svc.ResolveDispute(rec.ID, "gm-wang", "不应该能直接resolve pending记录")
	if err == nil {
		t.Fatal("resolving a pending record should fail")
	}
}

func TestGetReviewSummary(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec, _, _ := svc.IngestWithReview("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)
	svc.FlagDispute(rec.ID, "gm-li", model.RewardMissing, "奖励漏发")

	summary, err := svc.GetReviewSummary(rec.ID)
	if err != nil {
		t.Fatalf("get review summary failed: %v", err)
	}

	if summary["record_id"] != rec.ID {
		t.Fatalf("summary record_id mismatch")
	}
	if summary["current_status"] != model.StatusDisputed {
		t.Fatalf("summary should show disputed status, got %v", summary["current_status"])
	}
	whyPending, ok := summary["why_pending"].(string)
	if !ok || whyPending == "" {
		t.Fatal("why_pending should be populated for disputed records")
	}
}

func TestListPendingReview(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec1, _, _ := svc.IngestWithReview("batch-001", "断线恢复挑战", "player-A", model.SourcePlayerFeedback, nil)
	rec2, _, _ := svc.IngestWithReview("batch-002", "餐车连锁挑战-Day1", "player-B", model.SourceActivityReview, nil)
	svc.FlagDispute(rec2.ID, "gm", model.DataMismatch, "数据不一致")

	pending := svc.ListPendingReview()
	if len(pending) != 2 {
		t.Fatalf("should have 2 records pending review (1 auto review_needed + 1 disputed), got %d", len(pending))
	}

	ids := map[string]bool{}
	for _, p := range pending {
		ids[p.ID] = true
	}
	if !ids[rec1.ID] || !ids[rec2.ID] {
		t.Fatal("both rec1 and rec2 should be in pending review list")
	}
}

func TestIdempotentIngestViaReviewService(t *testing.T) {
	e := engine.New()
	svc := review.NewReviewService(e)

	rec1, created1, _ := svc.IngestWithReview("batch-001", "断线恢复挑战", "player-A", model.SourcePlayerFeedback, nil)
	rec2, created2, _ := svc.IngestWithReview("batch-001", "断线恢复挑战", "player-A", model.SourcePlayerFeedback, nil)

	if !created1 {
		t.Fatal("first call should create record")
	}
	if created2 {
		t.Fatal("second call with same data should be idempotent")
	}
	if rec1.ID != rec2.ID {
		t.Fatal("idempotent ingest should return same record")
	}
	if rec2.Status != model.StatusReviewNeeded {
		t.Fatalf("idempotent second call should not change status, got %s", rec2.Status)
	}

	trail, _ := e.GetAuditTrail(rec1.ID)
	auditCount := 0
	for _, a := range trail {
		if a.Reason == "initial_ingest" {
			auditCount++
		}
	}
	if auditCount != 1 {
		t.Fatalf("should have exactly 1 initial_ingest audit, got %d", auditCount)
	}
}
