package service

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"time"

	"quality-control-system/internal/model"
	"quality-control-system/internal/repository"
)

type WasteService struct {
	wasteRepo *repository.WasteRepository
	ruleRepo  *repository.RuleRepository
}

func NewWasteService() *WasteService {
	return &WasteService{
		wasteRepo: repository.NewWasteRepository(),
		ruleRepo:  repository.NewRuleRepository(),
	}
}

func (s *WasteService) CreateRecord(record *model.WasteRecord, idempotentKey string) (*model.WasteRecord, error) {
	if idempotentKey == "" {
		idempotentKey = s.generateIdempotentKey(record)
	}

	existing, err := s.wasteRepo.GetByIdempotentKey(idempotentKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	record.WasteNo = s.generateWasteNo(record.StoreID)
	record.IdempotentKey = idempotentKey

	err = s.wasteRepo.Create(record)
	if err != nil {
		return nil, err
	}

	return record, nil
}

func (s *WasteService) GetRecord(wasteNo string) (*model.WasteRecord, error) {
	return s.wasteRepo.GetByNo(wasteNo)
}

func (s *WasteService) ListRecords(storeID string, page, pageSize int) ([]*model.WasteRecord, int, error) {
	return s.wasteRepo.ListByStore(storeID, page, pageSize)
}

func (s *WasteService) GetWasteByBatch(dishBatch string) ([]*model.WasteRecord, error) {
	return s.wasteRepo.GetByBatch(dishBatch)
}

func (s *WasteService) generateWasteNo(storeID string) string {
	now := time.Now()
	return fmt.Sprintf("WST%s%s%06d",
		storeID,
		now.Format("20060102"),
		now.Unix()%1000000,
	)
}

func (s *WasteService) generateIdempotentKey(record *model.WasteRecord) string {
	data := fmt.Sprintf("%s|%s|%s",
		record.StoreID,
		record.DishBatch,
		record.WasteTime.Format("20060102150405"),
	)
	hash := md5.Sum([]byte(data))
	return hex.EncodeToString(hash[:])
}
