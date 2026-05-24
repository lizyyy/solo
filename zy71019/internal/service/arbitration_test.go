package service

import (
	"os"
	"testing"
	"time"

	"damage-arbitration/internal/database"
	"damage-arbitration/internal/models"
)

func setupTestDB(t *testing.T) {
	dbPath := "./test.db"
	os.Remove(dbPath)
	if err := database.InitDB(dbPath); err != nil {
		t.Fatalf("Failed to init test DB: %v", err)
	}
}

func cleanupTestDB() {
	os.Remove("./test.db")
	database.CloseDB()
}

func TestDuplicateDamageDetection(t *testing.T) {
	setupTestDB(t)
	defer cleanupTestDB()

	service := NewArbitrationService()

	req1 := &models.CreateArbitrationRequest{
		OrderID:    "ORDER001",
		VehicleID:  "VEH001",
		UserID:     "USER001",
		PickupTime: time.Now().Add(-24 * time.Hour),
		ReturnTime: time.Now(),
		PickupPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/p1.jpg", PhotoTime: time.Now().Add(-24 * time.Hour)},
		},
		ReturnPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/r1.jpg", PhotoTime: time.Now()},
		},
		Damages: []models.DamageInfo{
			{DamageType: models.DamageTypeScratch, Location: "左前门", DeductAmount: 200},
		},
		OperatorID:   "OP001",
		OperatorName: "张三",
	}

	arb1, err := service.CreateArbitration(req1)
	if err != nil {
		t.Fatalf("Failed to create first arbitration: %v", err)
	}
	t.Logf("First arbitration status: %s", arb1.Status)

	if arb1.Status != models.StatusProcessing {
		t.Errorf("Expected first arbitration status to be 'processing', got '%s'", arb1.Status)
	}

	req2 := &models.CreateArbitrationRequest{
		OrderID:    "ORDER002",
		VehicleID:  "VEH001",
		UserID:     "USER002",
		PickupTime: time.Now().Add(24 * time.Hour),
		ReturnTime: time.Now().Add(48 * time.Hour),
		PickupPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/p2.jpg", PhotoTime: time.Now().Add(24 * time.Hour)},
		},
		ReturnPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/r2.jpg", PhotoTime: time.Now().Add(48 * time.Hour)},
		},
		Damages: []models.DamageInfo{
			{DamageType: models.DamageTypeScratch, Location: "左前门", DeductAmount: 200},
		},
		OperatorID:   "OP001",
		OperatorName: "张三",
	}

	arb2, err := service.CreateArbitration(req2)
	if err != nil {
		t.Fatalf("Failed to create second arbitration: %v", err)
	}
	t.Logf("Second arbitration status: %s", arb2.Status)

	if arb2.Status != models.StatusBlocked {
		t.Errorf("Expected second arbitration status to be 'blocked' (duplicate detected), got '%s'", arb2.Status)
	}

	t.Log("✓ Duplicate damage detection works correctly!")
}

func TestAppealConclusionWriteback(t *testing.T) {
	setupTestDB(t)
	defer cleanupTestDB()

	service := NewArbitrationService()

	req := &models.CreateArbitrationRequest{
		OrderID:    "ORDER003",
		VehicleID:  "VEH002",
		UserID:     "USER003",
		PickupTime: time.Now().Add(-24 * time.Hour),
		ReturnTime: time.Now(),
		PickupPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/p3.jpg", PhotoTime: time.Now().Add(-24 * time.Hour)},
		},
		ReturnPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/r3.jpg", PhotoTime: time.Now()},
		},
		Damages: []models.DamageInfo{
			{DamageType: models.DamageTypeDent, Location: "右后视镜", DeductAmount: 100},
		},
		OperatorID:   "OP001",
		OperatorName: "张三",
	}

	arb, err := service.CreateArbitration(req)
	if err != nil {
		t.Fatalf("Failed to create arbitration: %v", err)
	}

	appealReq := &models.SubmitAppealRequest{
		ArbitrationID: arb.ID,
		UserID:        "USER003",
		Content:       "该损伤取车时已有",
		EvidenceURLs:  []string{"http://test.com/evidence.jpg"},
	}
	if err := service.SubmitAppeal(appealReq); err != nil {
		t.Fatalf("Failed to submit appeal: %v", err)
	}

	handleReq := &models.HandleAppealRequest{
		ArbitrationID: arb.ID,
		HandlerID:     "OP002",
		HandlerName:   "李四",
		HandlerRemark: "申诉属实，予以退款",
		Approve:       true,
		RefundAmount:  100,
	}
	if err := service.HandleAppeal(handleReq); err != nil {
		t.Fatalf("Failed to handle appeal: %v", err)
	}

	detail, err := service.GetArbitrationDetail(arb.ID)
	if err != nil {
		t.Fatalf("Failed to get arbitration detail: %v", err)
	}

	if detail.Appeal == nil {
		t.Fatal("Appeal should not be nil")
	}

	if detail.Appeal.IsApproved == nil || !*detail.Appeal.IsApproved {
		t.Errorf("Expected appeal to be approved, got: %v", detail.Appeal.IsApproved)
	}

	if detail.Appeal.RefundAmount == nil || *detail.Appeal.RefundAmount != 100 {
		t.Errorf("Expected refund amount to be 100, got: %v", detail.Appeal.RefundAmount)
	}

	if detail.Arbitration.Status != models.StatusClosed {
		t.Errorf("Expected arbitration status to be 'closed' after appeal approval, got '%s'", detail.Arbitration.Status)
	}

	if detail.Conclusion == nil {
		t.Fatal("Conclusion should not be nil after appeal approval")
	}

	if detail.Conclusion.FinalResult != "申诉通过" {
		t.Errorf("Expected conclusion result to be '申诉通过', got '%s'", detail.Conclusion.FinalResult)
	}

	if detail.Conclusion.RefundAmount != 100 {
		t.Errorf("Expected conclusion refund amount to be 100, got: %v", detail.Conclusion.RefundAmount)
	}

	t.Log("✓ Appeal conclusion writeback works correctly!")
}

func TestAppealRejected(t *testing.T) {
	setupTestDB(t)
	defer cleanupTestDB()

	service := NewArbitrationService()

	req := &models.CreateArbitrationRequest{
		OrderID:    "ORDER004",
		VehicleID:  "VEH003",
		UserID:     "USER004",
		PickupTime: time.Now().Add(-24 * time.Hour),
		ReturnTime: time.Now(),
		PickupPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/p4.jpg", PhotoTime: time.Now().Add(-24 * time.Hour)},
		},
		ReturnPhotos: []models.PhotoInfo{
			{PhotoURL: "http://test.com/r4.jpg", PhotoTime: time.Now()},
		},
		Damages: []models.DamageInfo{
			{DamageType: models.DamageTypeCrack, Location: "前挡风玻璃", DeductAmount: 500},
		},
		OperatorID:   "OP001",
		OperatorName: "张三",
	}

	arb, err := service.CreateArbitration(req)
	if err != nil {
		t.Fatalf("Failed to create arbitration: %v", err)
	}

	appealReq := &models.SubmitAppealRequest{
		ArbitrationID: arb.ID,
		UserID:        "USER004",
		Content:       "不是我弄的",
	}
	if err := service.SubmitAppeal(appealReq); err != nil {
		t.Fatalf("Failed to submit appeal: %v", err)
	}

	handleReq := &models.HandleAppealRequest{
		ArbitrationID: arb.ID,
		HandlerID:     "OP002",
		HandlerName:   "李四",
		HandlerRemark: "证据不足，申诉驳回",
		Approve:       false,
		RefundAmount:  0,
	}
	if err := service.HandleAppeal(handleReq); err != nil {
		t.Fatalf("Failed to handle appeal: %v", err)
	}

	detail, err := service.GetArbitrationDetail(arb.ID)
	if err != nil {
		t.Fatalf("Failed to get arbitration detail: %v", err)
	}

	if detail.Appeal.IsApproved == nil || *detail.Appeal.IsApproved {
		t.Errorf("Expected appeal to be rejected, got: %v", detail.Appeal.IsApproved)
	}

	if detail.Arbitration.Status != models.StatusProcessing {
		t.Errorf("Expected arbitration status to be 'processing' after appeal rejection, got '%s'", detail.Arbitration.Status)
	}

	t.Log("✓ Appeal rejection works correctly!")
}
