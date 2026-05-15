package service

import (
	"callback-whitelist-api/internal/model"
	"callback-whitelist-api/internal/storage"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
)

var (
	ErrRuleNotActive = errors.New("rule is not active")
	ErrSourceDenied  = errors.New("source address not allowed")
	ErrPathDenied    = errors.New("request path not allowed")
	ErrMethodDenied  = errors.New("request method not allowed")
	ErrHeaderDenied  = errors.New("required header missing or invalid")
)

type Service struct {
	store *storage.Storage
}

func NewService(store *storage.Storage) *Service {
	return &Service{store: store}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Service) CreateParty(req *model.CreatePartyRequest) (*model.CallbackParty, error) {
	party := &model.CallbackParty{
		ID:       generateID(),
		Name:     req.Name,
		AppID:    req.AppID,
		Secret:   generateID(),
		IsActive: true,
	}
	if err := s.store.CreateParty(party); err != nil {
		return nil, err
	}
	return party, nil
}

func (s *Service) GetParty(id string) (*model.CallbackParty, error) {
	return s.store.GetParty(id)
}

func (s *Service) AddSourceAddress(req *model.AddSourceAddressRequest) (*model.SourceAddress, error) {
	if _, err := s.store.GetParty(req.PartyID); err != nil {
		return nil, err
	}
	addr := &model.SourceAddress{
		ID:          generateID(),
		PartyID:     req.PartyID,
		AddressType: req.AddressType,
		Value:       req.Value,
	}
	if err := s.store.AddSourceAddress(addr); err != nil {
		return nil, err
	}
	return addr, nil
}

func (s *Service) CreateRule(req *model.CreateRuleRequest) (*model.WhitelistRule, error) {
	if _, err := s.store.GetParty(req.PartyID); err != nil {
		return nil, err
	}
	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = model.GenerateIdempotencyKey(req.PartyID, req.Name)
	}
	if id, exists := s.store.CheckRuleIdempotency(idempotencyKey); exists {
		return s.store.GetRule(id)
	}
	rule := &model.WhitelistRule{
		ID:           generateID(),
		PartyID:      req.PartyID,
		Name:         req.Name,
		Description:  req.Description,
		SourceRules:  req.SourceRules,
		PathRules:    req.PathRules,
		MethodRules:  req.MethodRules,
		HeaderRules:  req.HeaderRules,
		IdempotencyKey: idempotencyKey,
	}
	if err := s.store.CreateRule(rule, idempotencyKey); err != nil {
		return nil, err
	}
	rv := &model.RuleVersion{
		ID:        generateID(),
		RuleID:    rule.ID,
		Version:   1,
		ChangeLog: "Initial creation",
		Status:    model.RuleStatusDraft,
		CreatedBy: "system",
	}
	s.store.CreateRuleVersion(rv)
	return rule, nil
}

func (s *Service) GetRule(id string) (*model.WhitelistRule, error) {
	return s.store.GetRule(id)
}

func (s *Service) GetRulesByParty(partyID string) []*model.WhitelistRule {
	return s.store.GetRulesByParty(partyID)
}

func (s *Service) UpdateRuleStatus(id string, req *model.UpdateRuleStatusRequest) (*model.WhitelistRule, error) {
	rule, err := s.store.GetRule(id)
	if err != nil {
		return nil, err
	}
	if err := s.store.UpdateRuleStatus(id, req.Status); err != nil {
		return nil, err
	}
	rv := &model.RuleVersion{
		ID:        generateID(),
		RuleID:    rule.ID,
		Version:   rule.Version + 1,
		PreviousID: rule.ID,
		ChangeLog: fmt.Sprintf("Status changed from %s to %s: %s", rule.Status, req.Status, req.Comment),
		Status:    req.Status,
		CreatedBy: "system",
	}
	s.store.CreateRuleVersion(rv)
	return s.store.GetRule(id)
}

func (s *Service) GetRuleVersions(ruleID string) []*model.RuleVersion {
	return s.store.GetRuleVersions(ruleID)
}

func (s *Service) VerifyCallback(req *model.VerifyCallbackRequest) (*model.VerificationRequest, error) {
	rule, err := s.store.GetRule(req.RuleID)
	if err != nil {
		return nil, err
	}
	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		dryRunFlag := "false"
		if req.IsDryRun {
			dryRunFlag = "true"
		}
		idempotencyKey = model.GenerateIdempotencyKey(req.PartyID, req.RuleID, req.SourceIP, req.RequestPath, req.RequestMethod, dryRunFlag)
	}
	if id, exists := s.store.CheckRequestIdempotency(idempotencyKey); exists {
		return s.store.GetRequest(id)
	}
	if !req.IsDryRun && rule.Status != model.RuleStatusActive {
		return nil, ErrRuleNotActive
	}
	if err := s.verifySourceIP(rule, req.SourceIP); err != nil {
		s.createRejection(req, rule, "SOURCE_DENIED", err.Error())
		return nil, err
	}
	if err := s.verifyPath(rule, req.RequestPath); err != nil {
		s.createRejection(req, rule, "PATH_DENIED", err.Error())
		return nil, err
	}
	if err := s.verifyMethod(rule, req.RequestMethod); err != nil {
		s.createRejection(req, rule, "METHOD_DENIED", err.Error())
		return nil, err
	}
	if err := s.verifyHeaders(rule, req.Headers); err != nil {
		s.createRejection(req, rule, "HEADER_DENIED", err.Error())
		return nil, err
	}
	vreq := &model.VerificationRequest{
		ID:             generateID(),
		RuleID:         req.RuleID,
		RuleVersion:    rule.Version,
		PartyID:        req.PartyID,
		SourceIP:       req.SourceIP,
		RequestPath:    req.RequestPath,
		RequestMethod:  req.RequestMethod,
		Headers:        req.Headers,
		IsDryRun:       req.IsDryRun,
		IsApproved:     true,
		IdempotencyKey: idempotencyKey,
	}
	if err := s.store.CreateRequest(vreq, idempotencyKey); err != nil {
		return nil, err
	}
	return vreq, nil
}

func (s *Service) verifySourceIP(rule *model.WhitelistRule, sourceIP string) error {
	if len(rule.SourceRules) == 0 {
		return nil
	}
	ip := net.ParseIP(sourceIP)
	if ip == nil {
		return ErrSourceDenied
	}
	for _, rule := range rule.SourceRules {
		if strings.Contains(rule, "/") {
			_, ipNet, err := net.ParseCIDR(rule)
			if err == nil && ipNet.Contains(ip) {
				return nil
			}
		} else if rule == sourceIP {
			return nil
		}
	}
	return ErrSourceDenied
}

func (s *Service) verifyPath(rule *model.WhitelistRule, path string) error {
	if len(rule.PathRules) == 0 {
		return nil
	}
	for _, pattern := range rule.PathRules {
		matched, _ := regexp.MatchString(pattern, path)
		if matched {
			return nil
		}
	}
	return ErrPathDenied
}

func (s *Service) verifyMethod(rule *model.WhitelistRule, method string) error {
	if len(rule.MethodRules) == 0 {
		return nil
	}
	for _, m := range rule.MethodRules {
		if strings.EqualFold(m, method) {
			return nil
		}
	}
	return ErrMethodDenied
}

func (s *Service) verifyHeaders(rule *model.WhitelistRule, headers map[string]string) error {
	if len(rule.HeaderRules) == 0 {
		return nil
	}
	for _, required := range rule.HeaderRules {
		if _, exists := headers[required]; !exists {
			return fmt.Errorf("%w: missing header %s", ErrHeaderDenied, required)
		}
	}
	return nil
}

func (s *Service) createRejection(req *model.VerifyCallbackRequest, rule *model.WhitelistRule, code, reason string) {
	rec := &model.RejectionRecord{
		ID:          generateID(),
		RequestID:   generateID(),
		RuleID:      req.RuleID,
		PartyID:     req.PartyID,
		ReasonCode:  code,
		Reason:      reason,
		SourceIP:    req.SourceIP,
		RequestPath: req.RequestPath,
	}
	s.store.CreateRejection(rec)
}

func (s *Service) GetRejections(filter map[string]interface{}) []*model.RejectionRecord {
	return s.store.GetRejections(filter)
}
