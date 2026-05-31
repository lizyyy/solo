package engine_test

import (
	"food_truck_challenge/engine"
	"food_truck_challenge/model"
	"testing"
)

func TestIngestIdempotent(t *testing.T) {
	e := engine.New()

	rec1, created1, err := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, map[string]int{"score": 100})
	if err != nil {
		t.Fatalf("first ingest failed: %v", err)
	}
	if !created1 {
		t.Fatal("first ingest should create new record")
	}

	rec2, created2, err := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, map[string]int{"score": 100})
	if err != nil {
		t.Fatalf("second ingest failed: %v", err)
	}
	if created2 {
		t.Fatal("second ingest with same data should NOT create new record")
	}
	if rec2.ID != rec1.ID {
		t.Fatalf("idempotent ingest should return same record ID: got %s, want %s", rec2.ID, rec1.ID)
	}

	all := e.AllRecords()
	if len(all) != 1 {
		t.Fatalf("should have exactly 1 record after idempotent ingest, got %d", len(all))
	}
}

func TestIngestDifferentDataCreatesNewRecord(t *testing.T) {
	e := engine.New()

	_, created1, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)
	_, created2, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-B", model.SourceActivityReview, nil)

	if !created1 || !created2 {
		t.Fatal("different data should create separate records")
	}

	all := e.AllRecords()
	if len(all) != 2 {
		t.Fatalf("should have 2 records, got %d", len(all))
	}
}

func TestAuditTrailOnIngest(t *testing.T) {
	e := engine.New()

	rec, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourcePlayerFeedback, nil)

	trail, err := e.GetAuditTrail(rec.ID)
	if err != nil {
		t.Fatalf("get audit trail failed: %v", err)
	}
	if len(trail) != 1 {
		t.Fatalf("should have 1 audit entry after ingest, got %d", len(trail))
	}
	if trail[0].NewStatus != model.StatusPending {
		t.Fatalf("initial audit should show status pending, got %s", trail[0].NewStatus)
	}
	if trail[0].Reason != "initial_ingest" {
		t.Fatalf("initial audit reason should be initial_ingest, got %s", trail[0].Reason)
	}
	if trail[0].ChangedBy != string(model.SourcePlayerFeedback) {
		t.Fatalf("changed_by should be source, got %s", trail[0].ChangedBy)
	}
}

func TestStatusTransitionAddsAudit(t *testing.T) {
	e := engine.New()

	rec, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)

	_, err := e.TransitionStatus(rec.ID, "admin-zhang", "reward_verified", "奖励已核实发放", model.StatusConfirmed)
	if err != nil {
		t.Fatalf("transition failed: %v", err)
	}

	trail, _ := e.GetAuditTrail(rec.ID)
	if len(trail) != 2 {
		t.Fatalf("should have 2 audit entries, got %d", len(trail))
	}

	last := trail[1]
	if last.OldStatus != model.StatusPending {
		t.Fatalf("old status should be pending, got %s", last.OldStatus)
	}
	if last.NewStatus != model.StatusConfirmed {
		t.Fatalf("new status should be confirmed, got %s", last.NewStatus)
	}
	if last.ChangedBy != "admin-zhang" {
		t.Fatalf("changed_by should be admin-zhang, got %s", last.ChangedBy)
	}
}

func TestSameStatusTransitionNoOp(t *testing.T) {
	e := engine.New()

	rec, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)

	_, err := e.TransitionStatus(rec.ID, "admin", "no_op", "", model.StatusPending)
	if err != nil {
		t.Fatalf("same-status transition should not error: %v", err)
	}

	trail, _ := e.GetAuditTrail(rec.ID)
	if len(trail) != 1 {
		t.Fatal("same-status transition should not add audit entry")
	}
}

func TestDisputeAndResolve(t *testing.T) {
	e := engine.New()

	rec, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)

	disputed, err := e.MarkDisputed(rec.ID, "gm-li", model.RewardMissing, "玩家反馈奖励未到账")
	if err != nil {
		t.Fatalf("mark disputed failed: %v", err)
	}
	if disputed.Status != model.StatusDisputed {
		t.Fatalf("status should be disputed, got %s", disputed.Status)
	}
	if disputed.DisputeReason == nil || *disputed.DisputeReason != model.RewardMissing {
		t.Fatal("dispute reason should be set")
	}

	resolved, err := e.Resolve(rec.ID, "gm-wang", "经核实，奖励已于昨日补发")
	if err != nil {
		t.Fatalf("resolve failed: %v", err)
	}
	if resolved.Status != model.StatusResolved {
		t.Fatalf("status should be resolved, got %s", resolved.Status)
	}
	if resolved.ReviewNote != "经核实，奖励已于昨日补发" {
		t.Fatalf("review note mismatch: %s", resolved.ReviewNote)
	}

	trail, _ := e.GetAuditTrail(rec.ID)
	if len(trail) != 3 {
		t.Fatalf("should have 3 audit entries (ingest+dispute+resolve), got %d", len(trail))
	}
}

func TestListByStatus(t *testing.T) {
	e := engine.New()

	rec1, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)
	rec2, _, _ := e.Ingest("batch-002", "餐车连锁挑战-Day2", "player-B", model.SourcePlayerFeedback, nil)

	e.MarkDisputed(rec1.ID, "gm", model.DisconnProgressLost, "断线导致进度丢失")

	pending := e.ListByStatus(model.StatusPending)
	disputed := e.ListByStatus(model.StatusDisputed)

	if len(pending) != 1 || pending[0].ID != rec2.ID {
		t.Fatalf("should have 1 pending record (rec2), got %d", len(pending))
	}
	if len(disputed) != 1 || disputed[0].ID != rec1.ID {
		t.Fatalf("should have 1 disputed record (rec1), got %d", len(disputed))
	}
}

func TestListByBatch(t *testing.T) {
	e := engine.New()

	e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)
	e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-B", model.SourceActivityReview, nil)
	e.Ingest("batch-002", "餐车连锁挑战-Day2", "player-C", model.SourceActivityReview, nil)

	batch1 := e.ListByBatch("batch-001")
	batch2 := e.ListByBatch("batch-002")

	if len(batch1) != 2 {
		t.Fatalf("batch-001 should have 2 records, got %d", len(batch1))
	}
	if len(batch2) != 1 {
		t.Fatalf("batch-002 should have 1 record, got %d", len(batch2))
	}
}
