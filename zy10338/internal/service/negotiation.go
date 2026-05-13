package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"client-capability-negotiation/internal/model"
	"client-capability-negotiation/internal/storage"
	"github.com/patrickmn/go-cache"
)

var (
	ErrDeclarationExists    = errors.New("negotiation already exists for this declaration")
	ErrInvalidStatus        = errors.New("invalid status for this operation")
	ErrNoMatchingCapability = errors.New("no matching capabilities found")
	ErrVersionMismatch      = errors.New("version mismatch")
)

type NegotiationService struct {
	storage *storage.Storage
	cache   *cache.Cache
}

func NewNegotiationService(storage *storage.Storage) *NegotiationService {
	return &NegotiationService{
		storage: storage,
		cache:   cache.New(5*time.Minute, 10*time.Minute),
	}
}

func (s *NegotiationService) CreateClient(clientID, clientName, clientType, createdBy, description string) (*model.ClientIdentity, error) {
	existing, _ := s.storage.GetClient(clientID)
	if existing != nil {
		return existing, nil
	}

	client := model.NewClientIdentity(clientID, clientName, clientType, createdBy)
	client.Description = description
	if err := s.storage.CreateClient(client); err != nil {
		return nil, err
	}
	return client, nil
}

func (s *NegotiationService) GetClient(clientID string) (*model.ClientIdentity, error) {
	return s.storage.GetClient(clientID)
}

func (s *NegotiationService) ListClients() ([]model.ClientIdentity, error) {
	return s.storage.ListClients()
}

func (s *NegotiationService) CreateDeclaration(req *model.CreateDeclarationRequest) (*model.CapabilityDeclaration, error) {
	if _, err := s.storage.GetClient(req.ClientID); err != nil {
		if errors.Is(err, storage.ErrNotFound) {
			return nil, fmt.Errorf("client %s not found", req.ClientID)
		}
		return nil, err
	}

	declaration := model.NewCapabilityDeclaration(req)
	if err := s.storage.CreateDeclaration(declaration); err != nil {
		return nil, err
	}

	return declaration, nil
}

func (s *NegotiationService) GetDeclaration(id string) (*model.CapabilityDeclaration, error) {
	return s.storage.GetDeclaration(id)
}

func (s *NegotiationService) GetDeclarationsByClient(clientID string) ([]model.CapabilityDeclaration, error) {
	return s.storage.GetDeclarationsByClient(clientID)
}

func (s *NegotiationService) Negotiate(req *model.NegotiateRequest) (*model.NegotiationResult, error) {
	start := time.Now()

	declaration, err := s.storage.GetDeclaration(req.DeclarationID)
	if err != nil {
		return nil, err
	}

	existingResult, err := s.storage.GetNegotiationResultByDeclaration(req.DeclarationID)
	if err == nil && existingResult != nil {
		s.recordHit(existingResult.ID, existingResult.ClientID, "negotiate", true, time.Since(start).Milliseconds())
		return existingResult, ErrDeclarationExists
	}

	result := model.NewNegotiationResult(declaration, req.NegotiatedBy)

	negotiatedVersion, selectedCaps, err := s.negotiateVersionAndCapabilities(declaration, req.TargetVersion)
	if err != nil {
		if len(declaration.FallbackOpts) > 0 {
			result.Status = model.StatusFallback
			fallback := s.selectFallback(declaration.FallbackOpts)
			result.SelectedFallback = fallback
			result.ErrorMessage = fmt.Sprintf("Negotiation failed, using fallback: %s", fallback.Name)
		} else {
			result.Status = model.StatusFailed
			result.ErrorMessage = err.Error()
		}
	} else {
		result.Status = model.StatusSuccess
		result.NegotiatedVersion = negotiatedVersion
		result.SelectedCapabilities = selectedCaps
		now := time.Now()
		result.CompletedAt = &now
	}

	if err := s.storage.CreateNegotiationResult(result); err != nil {
		return nil, err
	}

	transition := model.NewStatusTransition(
		result.ID,
		model.StatusPending,
		result.Status,
		req.NegotiatedBy,
		"Initial negotiation completed",
	)
	if err := s.storage.CreateStatusTransition(transition); err != nil {
		return nil, err
	}

	s.cacheResult(result)
	s.recordHit(result.ID, result.ClientID, "negotiate", false, time.Since(start).Milliseconds())

	return result, nil
}

func (s *NegotiationService) negotiateVersionAndCapabilities(declaration *model.CapabilityDeclaration, targetVersion string) (string, []model.Capability, error) {
	selectedVersion := declaration.APIVersion
	if targetVersion != "" {
		if !s.isVersionCompatible(declaration.APIVersion, targetVersion) {
			return "", nil, fmt.Errorf("%w: declared %s vs target %s", ErrVersionMismatch, declaration.APIVersion, targetVersion)
		}
		selectedVersion = targetVersion
	}

	var supportedCaps []model.Capability
	for _, cap := range declaration.Capabilities {
		if cap.Supported {
			supportedCaps = append(supportedCaps, cap)
		}
	}

	if len(supportedCaps) == 0 {
		return "", nil, ErrNoMatchingCapability
	}

	return selectedVersion, supportedCaps, nil
}

func (s *NegotiationService) isVersionCompatible(declared, target string) bool {
	if declared == target {
		return true
	}
	
	declaredParts := strings.Split(declared, ".")
	targetParts := strings.Split(target, ".")
	
	if len(declaredParts) >= 2 && len(targetParts) >= 2 {
		return declaredParts[0] == targetParts[0]
	}
	
	return false
}

func (s *NegotiationService) selectFallback(options []model.FallbackOption) *model.FallbackOption {
	if len(options) == 0 {
		return nil
	}

	sort.Slice(options, func(i, j int) bool {
		return options[i].Priority < options[j].Priority
	})

	return &options[0]
}

func (s *NegotiationService) UpdateStatus(req *model.StatusUpdateRequest) (*model.NegotiationResult, error) {
	result, err := s.storage.GetNegotiationResult(req.ResultID)
	if err != nil {
		return nil, err
	}

	if !s.isValidStatusTransition(result.Status, req.TargetStatus) {
		return nil, fmt.Errorf("%w: cannot transition from %s to %s", ErrInvalidStatus, result.Status, req.TargetStatus)
	}

	oldStatus := result.Status
	result.Status = req.TargetStatus
	result.ErrorMessage = req.ErrorMessage

	if req.TargetStatus == model.StatusSuccess || req.TargetStatus == model.StatusFailed || req.TargetStatus == model.StatusFallback {
		now := time.Now()
		result.CompletedAt = &now
	}

	if err := s.storage.UpdateNegotiationResult(result); err != nil {
		return nil, err
	}

	transition := model.NewStatusTransition(
		result.ID,
		oldStatus,
		req.TargetStatus,
		req.UpdatedBy,
		req.Reason,
	)
	if err := s.storage.CreateStatusTransition(transition); err != nil {
		return nil, err
	}

	s.cacheResult(result)

	return result, nil
}

func (s *NegotiationService) isValidStatusTransition(from, to model.NegotiationStatus) bool {
	validTransitions := map[model.NegotiationStatus][]model.NegotiationStatus{
		model.StatusPending: {
			model.StatusSuccess,
			model.StatusFailed,
			model.StatusFallback,
			model.StatusCancelled,
		},
		model.StatusSuccess: {
			model.StatusCancelled,
			model.StatusFailed,
		},
		model.StatusFailed: {
			model.StatusPending,
			model.StatusFallback,
		},
		model.StatusFallback: {
			model.StatusSuccess,
			model.StatusCancelled,
		},
		model.StatusCancelled: {
			model.StatusPending,
		},
	}

	validTos, ok := validTransitions[from]
	if !ok {
		return false
	}

	for _, validTo := range validTos {
		if validTo == to {
			return true
		}
	}

	return false
}

func (s *NegotiationService) GetNegotiationResult(id string) (*model.NegotiationResult, error) {
	start := time.Now()

	if cached, found := s.cache.Get(fmt.Sprintf("result:%s", id)); found {
		if result, ok := cached.(*model.NegotiationResult); ok {
			s.recordHit(result.ID, result.ClientID, "get_result", true, time.Since(start).Milliseconds())
			return result, nil
		}
	}

	result, err := s.storage.GetNegotiationResult(id)
	if err != nil {
		return nil, err
	}

	s.cacheResult(result)
	s.recordHit(result.ID, result.ClientID, "get_result", false, time.Since(start).Milliseconds())

	return result, nil
}

func (s *NegotiationService) ListNegotiationResults(clientID string, status *model.NegotiationStatus, limit int) ([]model.NegotiationResult, error) {
	return s.storage.ListNegotiationResults(clientID, status, limit)
}

func (s *NegotiationService) GetStatusTransitions(resultID string) ([]model.StatusTransition, error) {
	return s.storage.GetStatusTransitions(resultID)
}

func (s *NegotiationService) GetHitLogs(resultID string, limit int) ([]model.HitLog, error) {
	return s.storage.GetHitLogs(resultID, limit)
}

func (s *NegotiationService) GetHitLogsByClient(clientID string, limit int) ([]model.HitLog, error) {
	return s.storage.GetHitLogsByClient(clientID, limit)
}

func (s *NegotiationService) cacheResult(result *model.NegotiationResult) {
	s.cache.Set(fmt.Sprintf("result:%s", result.ID), result, cache.DefaultExpiration)
	s.cache.Set(fmt.Sprintf("result:declaration:%s", result.DeclarationID), result, cache.DefaultExpiration)
}

func (s *NegotiationService) recordHit(resultID, clientID, source string, cacheHit bool, responseTimeMs int64) {
	hitLog := model.NewHitLog(resultID, clientID, source, cacheHit, responseTimeMs)
	s.storage.CreateHitLog(hitLog)
}

func (s *NegotiationService) VerifyNegotiation(clientID, declarationID string) (*model.NegotiationResult, error) {
	start := time.Now()

	if cached, found := s.cache.Get(fmt.Sprintf("result:declaration:%s", declarationID)); found {
		if result, ok := cached.(*model.NegotiationResult); ok {
			if result.ClientID == clientID {
				s.recordHit(result.ID, clientID, "verify", true, time.Since(start).Milliseconds())
				return result, nil
			}
		}
	}

	result, err := s.storage.GetNegotiationResultByDeclaration(declarationID)
	if err != nil {
		return nil, err
	}

	if result.ClientID != clientID {
		return nil, fmt.Errorf("client mismatch")
	}

	s.cacheResult(result)
	s.recordHit(result.ID, clientID, "verify", false, time.Since(start).Milliseconds())

	return result, nil
}
