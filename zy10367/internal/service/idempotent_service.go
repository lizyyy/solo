package service

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/repository"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

type IdempotentService interface {
	CheckAndMark(requestType string, requestData interface{}) (*model.IdempotentRequest, bool, error)
	SaveResponse(requestKey string, responseData interface{}) error
}

type idempotentService struct {
	repo repository.IdempotentRepository
}

func NewIdempotentService() IdempotentService {
	return &idempotentService{
		repo: repository.NewIdempotentRepository(),
	}
}

func (s *idempotentService) generateRequestKey(requestType string, requestData interface{}) (string, error) {
	dataBytes, err := json.Marshal(requestData)
	if err != nil {
		return "", err
	}

	hash := sha256.New()
	hash.Write([]byte(requestType))
	hash.Write(dataBytes)
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func (s *idempotentService) CheckAndMark(requestType string, requestData interface{}) (*model.IdempotentRequest, bool, error) {
	requestKey, err := s.generateRequestKey(requestType, requestData)
	if err != nil {
		return nil, false, err
	}

	existing, err := s.repo.GetByRequestKey(requestKey)
	if err != nil {
		return nil, false, err
	}

	if existing != nil {
		return existing, true, nil
	}

	record := &model.IdempotentRequest{
		RequestKey:  requestKey,
		RequestType: requestType,
		RequestData: fmt.Sprintf("%v", requestData),
	}

	created, err := s.repo.TryCreate(record)
	if err != nil {
		return nil, false, err
	}

	if !created {
		existing, err = s.repo.GetByRequestKey(requestKey)
		if err != nil {
			return nil, false, err
		}
		return existing, true, nil
	}

	return record, false, nil
}

func (s *idempotentService) SaveResponse(requestKey string, responseData interface{}) error {
	existing, err := s.repo.GetByRequestKey(requestKey)
	if err != nil {
		return err
	}

	if existing == nil {
		return nil
	}

	responseBytes, _ := json.Marshal(responseData)
	existing.ResponseData = string(responseBytes)
	return s.repo.Create(existing)
}
