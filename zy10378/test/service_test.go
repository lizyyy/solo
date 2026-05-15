package test

import (
	"callback-whitelist-api/internal/model"
	"callback-whitelist-api/internal/service"
	"callback-whitelist-api/internal/storage"
	"testing"
)

func TestIdempotency(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-001",
	})

	req1 := &model.CreateRuleRequest{
		PartyID:     party.ID,
		Name:        "Test Rule",
		Description: "First request",
	}
	rule1, err := svc.CreateRule(req1)
	if err != nil {
		t.Fatalf("Failed to create rule: %v", err)
	}

	req2 := &model.CreateRuleRequest{
		PartyID:     party.ID,
		Name:        "Test Rule",
		Description: "Second request (same key)",
	}
	rule2, err := svc.CreateRule(req2)
	if err != nil {
		t.Fatalf("Failed to create rule: %v", err)
	}

	if rule1.ID != rule2.ID {
		t.Errorf("Expected same rule ID, got %s and %s", rule1.ID, rule2.ID)
	}
	t.Log("Idempotency test passed: duplicate request returns same rule")
}

func TestInvalidStatusTransition(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-002",
	})

	rule, _ := svc.CreateRule(&model.CreateRuleRequest{
		PartyID: party.ID,
		Name:    "Status Test Rule",
	})

	req := &model.UpdateRuleStatusRequest{
		Status:  model.RuleStatusActive,
		Comment: "Direct from draft to active",
	}
	_, err := svc.UpdateRuleStatus(rule.ID, req)
	if err == nil {
		t.Error("Expected error for invalid status transition, got nil")
	} else {
		t.Logf("Invalid status transition correctly rejected: %v", err)
	}

	req2 := &model.UpdateRuleStatusRequest{
		Status:  model.RuleStatusTesting,
		Comment: "Draft -> Testing",
	}
	_, err = svc.UpdateRuleStatus(rule.ID, req2)
	if err != nil {
		t.Errorf("Expected valid transition to testing, got error: %v", err)
	} else {
		t.Log("Valid status transition (draft -> testing) succeeded")
	}
}

func TestCallbackVerification(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-003",
	})

	rule, _ := svc.CreateRule(&model.CreateRuleRequest{
		PartyID:     party.ID,
		Name:        "Verification Test Rule",
		SourceRules: []string{"192.168.1.0/24", "10.0.0.1"},
		PathRules:   []string{"/webhook/.*", "/callback"},
		MethodRules: []string{"POST", "PUT"},
		HeaderRules: []string{"X-Signature"},
	})

	req := &model.VerifyCallbackRequest{
		RuleID:       rule.ID,
		PartyID:      party.ID,
		SourceIP:     "192.168.1.100",
		RequestPath:  "/webhook/test",
		RequestMethod: "POST",
		Headers:      map[string]string{"X-Signature": "valid"},
		IsDryRun:     true,
	}
	result, err := svc.VerifyCallback(req)
	if err != nil {
		t.Errorf("Expected verification to pass in dry run, got error: %v", err)
	} else {
		t.Logf("Dry run verification passed: %+v", result)
	}

	req2 := &model.VerifyCallbackRequest{
		RuleID:       rule.ID,
		PartyID:      party.ID,
		SourceIP:     "192.168.1.100",
		RequestPath:  "/webhook/test",
		RequestMethod: "POST",
		Headers:      map[string]string{"X-Signature": "valid"},
		IsDryRun:     false,
	}
	_, err = svc.VerifyCallback(req2)
	if err != service.ErrRuleNotActive {
		t.Errorf("Expected ErrRuleNotActive for non-active rule, got: %v", err)
	} else {
		t.Log("Non-active rule correctly rejected in real mode")
	}
}

func TestSourceVerification(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-004",
	})

	rule, _ := svc.CreateRule(&model.CreateRuleRequest{
		PartyID:     party.ID,
		Name:        "Source Test Rule",
		SourceRules: []string{"192.168.1.0/24"},
	})

	svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status: model.RuleStatusTesting,
	})
	svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status: model.RuleStatusActive,
	})

	req := &model.VerifyCallbackRequest{
		RuleID:       rule.ID,
		PartyID:      party.ID,
		SourceIP:     "10.0.0.1",
		RequestPath:  "/test",
		RequestMethod: "POST",
		IsDryRun:     false,
	}
	_, err := svc.VerifyCallback(req)
	if err != service.ErrSourceDenied {
		t.Errorf("Expected ErrSourceDenied, got: %v", err)
	} else {
		t.Log("Invalid source IP correctly rejected")
	}

	req.SourceIP = "192.168.1.50"
	_, err = svc.VerifyCallback(req)
	if err != nil {
		t.Errorf("Expected valid source IP to pass, got error: %v", err)
	} else {
		t.Log("Valid source IP passed verification")
	}
}

func TestDuplicateVerificationRequest(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-005",
	})

	rule, _ := svc.CreateRule(&model.CreateRuleRequest{
		PartyID: party.ID,
		Name:    "Duplicate Test Rule",
	})

	svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status: model.RuleStatusTesting,
	})
	svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status: model.RuleStatusActive,
	})

	req := &model.VerifyCallbackRequest{
		RuleID:       rule.ID,
		PartyID:      party.ID,
		SourceIP:     "192.168.1.100",
		RequestPath:  "/test",
		RequestMethod: "POST",
		IsDryRun:     false,
	}
	result1, err := svc.VerifyCallback(req)
	if err != nil {
		t.Fatalf("First request failed: %v", err)
	}

	result2, err := svc.VerifyCallback(req)
	if err != nil {
		t.Fatalf("Second request failed: %v", err)
	}

	if result1.ID != result2.ID {
		t.Errorf("Expected same request ID for duplicate request, got %s and %s", result1.ID, result2.ID)
	}
	t.Log("Duplicate verification request correctly returns same result")
}

func TestRejectionIdempotency(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-006",
	})

	rule, _ := svc.CreateRule(&model.CreateRuleRequest{
		PartyID:     party.ID,
		Name:        "Rejection Idempotency Rule",
		SourceRules: []string{"192.168.1.0/24"},
	})

	svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status: model.RuleStatusTesting,
	})
	svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status: model.RuleStatusActive,
	})

	beforeCount := len(svc.GetRejections(map[string]interface{}{}))

	req := &model.VerifyCallbackRequest{
		RuleID:       rule.ID,
		PartyID:      party.ID,
		SourceIP:     "10.0.0.1",
		RequestPath:  "/test",
		RequestMethod: "POST",
		IsDryRun:     false,
	}
	_, err := svc.VerifyCallback(req)
	if err != service.ErrSourceDenied {
		t.Errorf("Expected ErrSourceDenied, got: %v", err)
	}

	afterFirstCount := len(svc.GetRejections(map[string]interface{}{}))
	if afterFirstCount != beforeCount+1 {
		t.Errorf("Expected 1 new rejection record, got %d new", afterFirstCount-beforeCount)
	}

	_, err = svc.VerifyCallback(req)
	if err != service.ErrSourceDenied {
		t.Errorf("Expected same ErrSourceDenied for duplicate request, got: %v", err)
	}

	afterSecondCount := len(svc.GetRejections(map[string]interface{}{}))
	if afterSecondCount != afterFirstCount {
		t.Errorf("Expected no new rejection record for duplicate request, got %d new", afterSecondCount-afterFirstCount)
	} else {
		t.Log("Rejection idempotency test passed: duplicate request does not create new rejection record")
	}
}

func TestRuleVersionIncrement(t *testing.T) {
	store := storage.NewStorage()
	svc := service.NewService(store)

	party, _ := svc.CreateParty(&model.CreatePartyRequest{
		Name:  "Test Party",
		AppID: "test-007",
	})

	rule, _ := svc.CreateRule(&model.CreateRuleRequest{
		PartyID: party.ID,
		Name:    "Version Test Rule",
	})

	if rule.Version != 1 {
		t.Errorf("Expected initial version 1, got %d", rule.Version)
	}

	rule, _ = svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status:  model.RuleStatusTesting,
		Comment: "To testing",
	})

	if rule.Version != 2 {
		t.Errorf("Expected version 2 after first status change, got %d", rule.Version)
	}

	rule, _ = svc.UpdateRuleStatus(rule.ID, &model.UpdateRuleStatusRequest{
		Status:  model.RuleStatusActive,
		Comment: "To active",
	})

	if rule.Version != 3 {
		t.Errorf("Expected version 3 after second status change, got %d", rule.Version)
	}

	versions := svc.GetRuleVersions(rule.ID)
	if len(versions) != 3 {
		t.Errorf("Expected 3 version records, got %d", len(versions))
	} else {
		t.Logf("Rule version increment test passed, %d versions recorded", len(versions))
	}
}
