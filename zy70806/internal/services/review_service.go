package services

import (
	"time"

	"customs-reconciliation/internal/models"
	"customs-reconciliation/internal/repository"

	"github.com/shopspring/decimal"
)

type ReviewService struct {
	itemRepo        *repository.ReconciliationItemRepository
	reviewRecordRepo *repository.ReviewRecordRepository
	batchRepo       *repository.ReconciliationBatchRepository
	discrepancyRepo *repository.DiscrepancyRepository
}

func NewReviewService() *ReviewService {
	return &ReviewService{
		itemRepo:         repository.NewReconciliationItemRepository(),
		reviewRecordRepo: repository.NewReviewRecordRepository(),
		batchRepo:        repository.NewReconciliationBatchRepository(),
		discrepancyRepo:  repository.NewDiscrepancyRepository(),
	}
}

type ReviewRequest struct {
	ItemID          string          `json:"item_id"`
	Reviewer        string          `json:"reviewer"`
	NewTaxRate      decimal.Decimal `json:"new_tax_rate"`
	NewTaxAmount    decimal.Decimal `json:"new_tax_amount"`
	Notes           string          `json:"notes"`
	ResolveDiscrepancies bool       `json:"resolve_discrepancies"`
}

type ReviewResult struct {
	ItemID          string          `json:"item_id"`
	OldTaxRate      decimal.Decimal `json:"old_tax_rate"`
	NewTaxRate      decimal.Decimal `json:"new_tax_rate"`
	OldTaxAmount    decimal.Decimal `json:"old_tax_amount"`
	NewTaxAmount    decimal.Decimal `json:"new_tax_amount"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

func (s *ReviewService) ReviewItem(req *ReviewRequest) (*ReviewResult, error) {
	item, err := s.itemRepo.GetByID(req.ItemID)
	if err != nil {
		return nil, err
	}

	oldTaxRate := item.ApplicableTaxRate
	oldTaxAmount := item.FinalTaxAmount

	if req.NewTaxRate.GreaterThan(decimal.Zero) {
		item.ApplicableTaxRate = req.NewTaxRate
		expectedTax := item.DeclaredAmountCNY.Mul(req.NewTaxRate)
		item.ExpectedTaxAmount = expectedTax
		item.TaxDifference = expectedTax.Sub(item.DeclaredTaxAmount)
	}

	if req.NewTaxAmount.GreaterThanOrEqual(decimal.Zero) {
		item.FinalTaxAmount = req.NewTaxAmount
	}

	item.IsReviewed = true
	item.Status = models.ItemStatusReviewed
	now := time.Now()
	item.ReviewedAt = &now
	item.ReviewedBy = req.Reviewer
	item.ReviewNotes = req.Notes

	if err := s.itemRepo.Update(item); err != nil {
		return nil, err
	}

	reviewRecord := &models.ReviewRecord{
		ReconciliationItemID: req.ItemID,
		BatchID:             item.BatchID,
		OrderNo:             item.OrderNo,
		Reviewer:            req.Reviewer,
		ReviewAction:        "manual_adjustment",
		OldTaxAmount:        oldTaxAmount,
		NewTaxAmount:        item.FinalTaxAmount,
		OldTaxRate:          oldTaxRate,
		NewTaxRate:          item.ApplicableTaxRate,
		Notes:               req.Notes,
	}
	if err := s.reviewRecordRepo.Create(reviewRecord); err != nil {
		return nil, err
	}

	if req.ResolveDiscrepancies {
		if err := s.discrepancyRepo.BatchResolveByItemID(req.ItemID); err != nil {
			return nil, err
		}
	}

	if err := s.itemRepo.UpdateBatchSummary(item.BatchID); err != nil {
		return nil, err
	}

	return &ReviewResult{
		ItemID:       req.ItemID,
		OldTaxRate:   oldTaxRate,
		NewTaxRate:   item.ApplicableTaxRate,
		OldTaxAmount: oldTaxAmount,
		NewTaxAmount: item.FinalTaxAmount,
		UpdatedAt:    now,
	}, nil
}

func (s *ReviewService) GetItemReviewHistory(itemID string) ([]*models.ReviewRecord, error) {
	return s.reviewRecordRepo.GetByItemID(itemID)
}

func (s *ReviewService) CompleteBatchReview(batchID, reviewer string) error {
	batch, err := s.batchRepo.GetByID(batchID)
	if err != nil {
		return err
	}

	now := time.Now()
	batch.Status = models.BatchStatusCompleted
	batch.CompletedAt = &now

	return s.batchRepo.Update(batch)
}

func (s *ReviewService) GetItemFullTrace(itemID string) (map[string]interface{}, error) {
	item, err := s.itemRepo.GetByID(itemID)
	if err != nil {
		return nil, err
	}

	discrepancies, err := s.discrepancyRepo.GetByItemID(itemID)
	if err != nil {
		return nil, err
	}

	reviewHistory, err := s.reviewRecordRepo.GetByItemID(itemID)
	if err != nil {
		return nil, err
	}

	trace := map[string]interface{}{
		"item":           item,
		"discrepancies":  discrepancies,
		"review_history": reviewHistory,
	}

	return trace, nil
}
