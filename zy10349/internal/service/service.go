package service

import (
	"fmt"
	"read-write-split-api/internal/model"
	"read-write-split-api/internal/storage"
	"read-write-split-api/pkg/utils"
	"strings"
	"time"
)

type SplitService struct {
	storage *storage.SQLiteStorage
}

func NewSplitService(storage *storage.SQLiteStorage) *SplitService {
	return &SplitService{storage: storage}
}

func (s *SplitService) CreateStrategy(req *model.CreateStrategyRequest) (*model.Strategy, error) {
	existing, err := s.storage.GetStrategyByUniqueKey(req.Path, req.Method, utils.MapToJSON(req.QueryParams))
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, fmt.Errorf("strategy already exists")
	}

	strategy := &model.Strategy{
		ID:            utils.GenerateID(),
		Path:          req.Path,
		Method:        req.Method,
		QueryParams:   req.QueryParams,
		OperationType: req.OperationType,
		DBRole:        req.DBRole,
		Description:   req.Description,
		Status:        model.StrategyStatusEnabled,
		Priority:      req.Priority,
		CreatedAt:     utils.Now(),
		UpdatedAt:     utils.Now(),
	}

	if err := s.storage.CreateStrategy(strategy); err != nil {
		return nil, err
	}

	return strategy, nil
}

func (s *SplitService) GetStrategy(id string) (*model.Strategy, error) {
	return s.storage.GetStrategyByID(id)
}

func (s *SplitService) ListStrategies() ([]*model.Strategy, error) {
	return s.storage.ListStrategies()
}

func (s *SplitService) UpdateStrategyStatus(id string, status model.StrategyStatus) error {
	return s.storage.UpdateStrategyStatus(id, status)
}

func (s *SplitService) MatchStrategy(path, method string, queryParams map[string]string) (*model.Strategy, bool) {
	strategies, err := s.storage.ListStrategies()
	if err != nil {
		return nil, false
	}

	for _, strategy := range strategies {
		if strategy.Status != model.StrategyStatusEnabled {
			continue
		}

		if !strings.EqualFold(strategy.Method, method) {
			continue
		}

		if !strings.HasPrefix(path, strategy.Path) {
			continue
		}

		paramsMatch := true
		for k, v := range strategy.QueryParams {
			if queryParams[k] != v {
				paramsMatch = false
				break
			}
		}

		if paramsMatch {
			return strategy, true
		}
	}

	return nil, false
}

func (s *SplitService) ProcessRequest(req *model.ProcessRequest) (*model.ProcessResponse, error) {
	if req.RequestID != "" {
		existing, err := s.storage.GetHitRecordByRequestID(req.RequestID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			isSameRequest := existing.Path == req.Path &&
				existing.Method == req.Method &&
				model.QueryParamsEqual(existing.QueryParams, req.QueryParams)

			if isSameRequest {
				return &model.ProcessResponse{
					RequestID:      existing.RequestID,
					HitRecordID:    existing.ID,
					Matched:        existing.StrategyID != "",
					StrategyID:     existing.StrategyID,
					OperationType:  existing.MatchedOperation,
					DBRole:         existing.DBRoleUsed,
					Status:         existing.Status,
					NeedCorrection: existing.Status == model.HitStatusPending,
					Message:        "duplicate request, returned existing result",
				}, nil
			}
			return nil, fmt.Errorf("request_id already exists with different request content")
		}
	}

	if req.RequestID == "" {
		req.RequestID = utils.GenerateRequestID()
	}

	strategy, matched := s.MatchStrategy(req.Path, req.Method, req.QueryParams)

	matchedOp := model.OperationTypeRead
	dbRole := "reader"

	if matched {
		matchedOp = strategy.OperationType
		dbRole = strategy.DBRole
	} else {
		if strings.EqualFold(req.Method, "GET") || strings.EqualFold(req.Method, "HEAD") || strings.EqualFold(req.Method, "OPTIONS") {
			matchedOp = model.OperationTypeRead
			dbRole = "reader"
		} else {
			matchedOp = model.OperationTypeWrite
			dbRole = "writer"
		}
	}

	record := &model.HitRecord{
		ID:               utils.GenerateID(),
		RequestID:        req.RequestID,
		Path:             req.Path,
		Method:           req.Method,
		QueryParams:      req.QueryParams,
		MatchedOperation: matchedOp,
		ActualOperation:  matchedOp,
		DBRoleUsed:       dbRole,
		Status:           model.HitStatusPending,
		CorrectionAction: model.CorrectionActionNone,
		CreatedAt:        utils.Now(),
	}

	if matched {
		record.StrategyID = strategy.ID
	}

	if err := s.storage.CreateHitRecord(record); err != nil {
		return nil, err
	}

	needCorrection := !matched || (matched && strategy.OperationType != matchedOp)
	message := "request processed successfully"
	if !matched {
		message = "no strategy matched, used default rules"
	}

	return &model.ProcessResponse{
		RequestID:      record.RequestID,
		HitRecordID:    record.ID,
		Matched:        matched,
		StrategyID:     record.StrategyID,
		OperationType:  record.MatchedOperation,
		DBRole:         record.DBRoleUsed,
		Status:         record.Status,
		NeedCorrection: needCorrection,
		Message:        message,
	}, nil
}

func (s *SplitService) GetHitRecord(id string) (*model.HitRecord, error) {
	return s.storage.GetHitRecordByID(id)
}

func (s *SplitService) QueryHitRecords(req *model.QueryHitRecordsRequest) ([]*model.HitRecord, int64, error) {
	return s.storage.QueryHitRecords(req)
}

func (s *SplitService) AdvanceStatus(id string, req *model.AdvanceStatusRequest) error {
	record, err := s.storage.GetHitRecordByID(id)
	if err != nil {
		return err
	}
	if record == nil {
		return fmt.Errorf("hit record not found")
	}

	if !model.IsValidHitStatus(req.Status) {
		return fmt.Errorf("invalid target status: %s", req.Status)
	}

	if !model.IsValidStatusTransition(record.Status, req.Status) {
		return fmt.Errorf("invalid status transition: cannot transition from %s to %s", record.Status, req.Status)
	}

	return s.storage.UpdateHitRecordStatus(id, req.Status, req.UserID, req.Note)
}

func (s *SplitService) ApplyCorrection(id string, req *model.CorrectionRequest) error {
	record, err := s.storage.GetHitRecordByID(id)
	if err != nil {
		return err
	}
	if record == nil {
		return fmt.Errorf("hit record not found")
	}

	if !model.IsValidCorrectionAction(req.Action) {
		return fmt.Errorf("invalid correction action: %s", req.Action)
	}

	if record.Status == model.HitStatusRevoked {
		return fmt.Errorf("cannot apply correction to revoked record")
	}

	return s.storage.UpdateHitRecordCorrection(id, req.Action, req.Note, req.UserID)
}

func (s *SplitService) RevokeHitRecord(id string, userID string) error {
	record, err := s.storage.GetHitRecordByID(id)
	if err != nil {
		return err
	}
	if record == nil {
		return fmt.Errorf("hit record not found")
	}

	if record.Status == model.HitStatusRevoked {
		return fmt.Errorf("record is already revoked")
	}

	return s.storage.RevokeHitRecord(id, userID)
}

func (s *SplitService) GetReport(startTime, endTime time.Time) (*model.SplitReport, error) {
	if startTime.IsZero() {
		startTime = time.Now().AddDate(0, 0, -7)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	return s.storage.GetStatistics(startTime, endTime)
}

func (s *SplitService) ExportHitRecords(startTime, endTime time.Time) ([]*model.HitRecord, error) {
	req := &model.QueryHitRecordsRequest{
		StartTime: &startTime,
		EndTime:   &endTime,
		Page:      1,
		PageSize:  10000,
	}

	records, _, err := s.storage.QueryHitRecords(req)
	return records, err
}
