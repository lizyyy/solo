package service

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/internal/repository"
	"errors"
)

type EnvironmentService struct {
	envRepo   *repository.EnvironmentRepository
	proxyRepo *repository.ProxySettingRepository
}

func NewEnvironmentService() *EnvironmentService {
	return &EnvironmentService{
		envRepo:   repository.NewEnvironmentRepository(),
		proxyRepo: repository.NewProxySettingRepository(),
	}
}

type CreateEnvRequest struct {
	CustomerID  string `json:"customer_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Region      string `json:"region"`
}

func (s *EnvironmentService) CreateEnvironment(req CreateEnvRequest) (*models.CustomerEnvironment, error) {
	if req.CustomerID == "" {
		return nil, errors.New("customer_id is required")
	}
	if req.Name == "" {
		return nil, errors.New("name is required")
	}

	env := &models.CustomerEnvironment{
		CustomerID:  req.CustomerID,
		Name:        req.Name,
		Description: req.Description,
		Region:      req.Region,
	}

	return s.envRepo.Create(env)
}

func (s *EnvironmentService) GetEnvironment(id string) (*models.CustomerEnvironment, error) {
	return s.envRepo.GetByID(id)
}

func (s *EnvironmentService) ListEnvironments(page, pageSize int) ([]models.CustomerEnvironment, int64, error) {
	return s.envRepo.List(page, pageSize)
}

func (s *EnvironmentService) ListByCustomer(customerID string, page, pageSize int) ([]models.CustomerEnvironment, int64, error) {
	return s.envRepo.GetByCustomerID(customerID, page, pageSize)
}

func (s *EnvironmentService) UpdateEnvironment(id, description, region string) (*models.CustomerEnvironment, error) {
	env, err := s.envRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if description != "" {
		env.Description = description
	}
	if region != "" {
		env.Region = region
	}

	if err := s.envRepo.Update(env); err != nil {
		return nil, err
	}
	return env, nil
}

func (s *EnvironmentService) DeleteEnvironment(id string) error {
	return s.envRepo.Delete(id)
}

func (s *EnvironmentService) AddProxySetting(envID string, proxy *models.ProxySetting) (*models.ProxySetting, error) {
	_, err := s.envRepo.GetByID(envID)
	if err != nil {
		return nil, errors.New("environment not found")
	}

	proxy.EnvID = envID
	return s.proxyRepo.Create(proxy)
}

func (s *EnvironmentService) GetProxySettings(envID string) ([]models.ProxySetting, error) {
	return s.proxyRepo.GetByEnvID(envID)
}

func (s *EnvironmentService) DeleteProxySetting(id string) error {
	return s.proxyRepo.Delete(id)
}
