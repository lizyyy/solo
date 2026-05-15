package service

import (
	"auth-simulator-api/internal/model"
	"auth-simulator-api/internal/storage"
	"auth-simulator-api/pkg/utils"
	"errors"
	"fmt"
	"time"
)

type SimulationService struct {
	storage *storage.MemoryStorage
}

func NewSimulationService(storage *storage.MemoryStorage) *SimulationService {
	return &SimulationService{storage: storage}
}

func slicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func (s *SimulationService) CreateSimulation(req *model.CreateSimulationRequest) (*model.SimulationResult, error) {
	if existingID, exists := s.storage.CheckIdempotency(req.IdempotencyKey); exists {
		sim, _ := s.storage.GetSimulation(existingID)
		if sim.PartnerID != req.PartnerID || !slicesEqual(sim.RequestedScopes, req.RequestedScopes) {
			return nil, errors.New(model.ErrCodeIdempotencyConflict)
		}
		return sim, nil
	}

	if _, exists := s.storage.GetPartner(req.PartnerID); !exists {
		return nil, errors.New(model.ErrCodePartnerNotFound)
	}

	for _, scopeCode := range req.RequestedScopes {
		if _, exists := s.storage.GetScope(scopeCode); !exists {
			return nil, fmt.Errorf("%s:%s", model.ErrCodeScopeNotFound, scopeCode)
		}
	}

	now := utils.Now()
	sim := &model.SimulationResult{
		ID:              utils.GenerateID(),
		IdempotencyKey:  req.IdempotencyKey,
		PartnerID:       req.PartnerID,
		RequestedScopes: req.RequestedScopes,
		Status:          model.StatusCreated,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	s.storage.SaveIdempotency(req.IdempotencyKey, sim.ID)
	if err := s.storage.CreateSimulation(sim); err != nil {
		return nil, err
	}

	return sim, nil
}

func (s *SimulationService) ValidateSimulation(simID string) (*model.SimulationResult, error) {
	sim, exists := s.storage.GetSimulation(simID)
	if !exists {
		return nil, errors.New(model.ErrCodeSimulationNotFound)
	}

	if sim.Status != model.StatusCreated && sim.Status != model.StatusFailed {
		return nil, fmt.Errorf("%s: 只能对 CREATED 或 FAILED 状态的模拟进行校验", model.ErrCodeInvalidStatus)
	}

	sim.Status = model.StatusValidating
	s.storage.UpdateSimulation(sim)

	resolvedScopes, err := s.resolveScopes(sim.RequestedScopes)
	if err != nil {
		sim.Status = model.StatusFailed
		sim.ErrorCode = model.ErrCodeScopeNotFound
		sim.ErrorMessage = model.GetErrorMessage(model.ErrCodeScopeNotFound)
		sim.ErrorDetail = err.Error()
		s.storage.UpdateSimulation(sim)
		return sim, nil
	}
	sim.ResolvedScopes = resolvedScopes

	resourceSamples := s.generateResourceSamples(resolvedScopes)
	sim.ResourceSamples = resourceSamples

	riskAlerts := s.analyzeRisks(sim)
	sim.RiskAlerts = riskAlerts

	for _, alert := range riskAlerts {
		if alert.Level == model.RiskLevelHigh {
			sim.Status = model.StatusFailed
			sim.ErrorCode = model.ErrCodeRiskBlocked
			sim.ErrorMessage = model.GetErrorMessage(model.ErrCodeRiskBlocked)
			sim.ErrorDetail = fmt.Sprintf("高风险拦截: %s", alert.Message)
			s.storage.UpdateSimulation(sim)
			return sim, nil
		}
	}

	sim.Status = model.StatusSuccess
	s.storage.UpdateSimulation(sim)

	return sim, nil
}

func (s *SimulationService) resolveScopes(requestedScopes []string) ([]model.PermissionScope, error) {
	var resolved []model.PermissionScope
	for _, code := range requestedScopes {
		scope, exists := s.storage.GetScope(code)
		if !exists {
			return nil, fmt.Errorf("scope %s not found", code)
		}
		resolved = append(resolved, *scope)
	}
	return resolved, nil
}

func (s *SimulationService) generateResourceSamples(scopes []model.PermissionScope) []model.ResourceSample {
	var samples []model.ResourceSample
	for _, scope := range scopes {
		for i, resource := range scope.Resources {
			sample := model.ResourceSample{
				ID:          utils.GenerateID(),
				ScopeCode:   scope.Code,
				ResourceURI: resource,
				Method:      "GET",
				Description: fmt.Sprintf("%s 资源示例", scope.Name),
				SampleData: map[string]interface{}{
					"code":    0,
					"message": "success",
					"data": map[string]interface{}{
						"sample_id":   i + 1,
						"scope":       scope.Code,
						"description": scope.Description,
					},
				},
			}
			samples = append(samples, sample)
		}
	}
	return samples
}

func (s *SimulationService) analyzeRisks(sim *model.SimulationResult) []model.RiskAlert {
	var alerts []model.RiskAlert

	if len(sim.RequestedScopes) > 3 {
		alerts = append(alerts, model.RiskAlert{
			ID:         utils.GenerateID(),
			Level:      model.RiskLevelMedium,
			Code:       "TOO_MANY_SCOPES",
			Message:    "请求权限范围过多",
			Detail:     fmt.Sprintf("请求了 %d 个权限范围，建议分批申请", len(sim.RequestedScopes)),
			Suggestion: "评估是否确实需要所有权限，考虑分批申请",
		})
	}

	for _, scope := range sim.RequestedScopes {
		if scope == "user:write" || scope == "order:write" {
			alerts = append(alerts, model.RiskAlert{
				ID:         utils.GenerateID(),
				Level:      model.RiskLevelLow,
				Code:       "WRITE_SCOPE_REQUESTED",
				Message:    "包含写入权限",
				Detail:     fmt.Sprintf("请求了写入权限: %s", scope),
				Suggestion: "确保写入权限的使用符合最小权限原则",
			})
		}
	}

	return alerts
}

func (s *SimulationService) ActivateSimulation(simID string, clientIP string) (*model.SimulationResult, error) {
	sim, exists := s.storage.GetSimulation(simID)
	if !exists {
		return nil, errors.New(model.ErrCodeSimulationNotFound)
	}

	if sim.Status != model.StatusSuccess {
		return nil, fmt.Errorf("%s: 只能对 SUCCESS 状态的模拟进行开通", model.ErrCodeInvalidStatus)
	}

	credential := &model.ActivationCredential{
		ID:           utils.GenerateID(),
		SimulationID: sim.ID,
		Token:        utils.GenerateToken(),
		ExpiredAt:    utils.Now().Add(24 * time.Hour),
		ActivatedAt:  utils.Now(),
		ActivationIP: clientIP,
	}

	sim.Credential = credential
	sim.Status = model.StatusActivated
	s.storage.UpdateSimulation(sim)

	return sim, nil
}

func (s *SimulationService) GetSimulation(simID string) (*model.SimulationResult, bool) {
	return s.storage.GetSimulation(simID)
}

func (s *SimulationService) QueryHistory(req model.QueryHistoryRequest) (*model.HistoryResponse, error) {
	return s.storage.QueryHistory(req)
}

func (s *SimulationService) ExportSimulation(simID string) (interface{}, error) {
	sim, exists := s.storage.GetSimulation(simID)
	if !exists {
		return nil, errors.New(model.ErrCodeSimulationNotFound)
	}

	exportData := map[string]interface{}{
		"simulation_id":    sim.ID,
		"idempotency_key":  sim.IdempotencyKey,
		"partner_id":       sim.PartnerID,
		"status":           sim.Status,
		"requested_scopes": sim.RequestedScopes,
		"resolved_scopes":  sim.ResolvedScopes,
		"resource_samples": sim.ResourceSamples,
		"risk_alerts":      sim.RiskAlerts,
		"created_at":       sim.CreatedAt.Format(time.RFC3339),
		"updated_at":       sim.UpdatedAt.Format(time.RFC3339),
		"exported_at":      utils.Now().Format(time.RFC3339),
	}

	if sim.Status == model.StatusFailed {
		exportData["error_code"] = sim.ErrorCode
		exportData["error_message"] = sim.ErrorMessage
		exportData["error_detail"] = sim.ErrorDetail
	}

	if sim.Status == model.StatusActivated && sim.Credential != nil {
		exportData["credential"] = map[string]interface{}{
			"token":      sim.Credential.Token,
			"expired_at": sim.Credential.ExpiredAt.Format(time.RFC3339),
		}
	}

	return exportData, nil
}
