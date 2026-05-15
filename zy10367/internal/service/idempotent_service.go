package service

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/repository"
	"encoding/json"
	"time"
)

type IdempotentService interface {
	Check(requestID string, requestType string) (*model.IdempotentRequest, bool, error)
	MarkSuccess(requestID string, requestType string, requestData interface{}, responseData interface{}) error
}

type idempotentService struct {
	repo repository.IdempotentRepository
}

func NewIdempotentService() IdempotentService {
	return &idempotentService{
		repo: repository.NewIdempotentRepository(),
	}
}

func (s *idempotentService) Check(requestID string, requestType string) (*model.IdempotentRequest, bool, error) {
	existing, err := s.repo.GetByRequestID(requestID)
	if err != nil {
		return nil, false, err
	}

	if existing != nil {
		return existing, true, nil
	}

	return nil, false, nil
}

func (s *idempotentService) MarkSuccess(requestID string, requestType string, requestData interface{}, responseData interface{}) error {
	requestDataBytes, _ := json.Marshal(requestData)
	responseDataBytes, _ := json.Marshal(responseData)

	record := &model.IdempotentRequest{
		RequestID:    requestID,
		RequestType:  requestType,
		RequestData:  string(requestDataBytes),
		ResponseData: string(responseDataBytes),
		ProcessedAt:  time.Now().UTC(),
	}

	return s.repo.Create(record)
}
