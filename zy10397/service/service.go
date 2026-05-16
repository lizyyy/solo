package service

import (
	"errors"
	"fmt"
	"presigned-link-governance/model"
	"presigned-link-governance/repository"
	"time"
)

var (
	ErrLinkNotFound     = errors.New("link not found")
	ErrLinkExpired      = errors.New("link expired")
	ErrLinkRevoked      = errors.New("link revoked")
	ErrLinkExhausted    = errors.New("link access exhausted")
	ErrFileNotFound     = errors.New("file not found")
	ErrIssuerNotFound   = errors.New("issuer not found")
	ErrInvalidMaxAccess = errors.New("max access must be greater than 0")
)

type LinkService struct {
	linkRepo   *repository.LinkRepository
	fileRepo   *repository.FileRepository
	issuerRepo *repository.IssuerRepository
	logRepo    *repository.AccessLogRepository
}

func NewLinkService() *LinkService {
	return &LinkService{
		linkRepo:   repository.NewLinkRepository(),
		fileRepo:   repository.NewFileRepository(),
		issuerRepo: repository.NewIssuerRepository(),
		logRepo:    repository.NewAccessLogRepository(),
	}
}

type CreateLinkRequest struct {
	IdempotencyKey string `json:"idempotency_key"`
	FileID         string `json:"file_id" binding:"required"`
	IssuerID       string `json:"issuer_id" binding:"required"`
	ExpireHours    int    `json:"expire_hours" binding:"required,min=1"`
	MaxAccess      int    `json:"max_access" binding:"required,min=1"`
}

func (s *LinkService) CreateLink(req CreateLinkRequest) (*model.PresignedLink, error) {
	if req.IdempotencyKey != "" {
		existing, err := s.linkRepo.GetByIdempotencyKey(req.IdempotencyKey)
		if err == nil && existing != nil {
			return existing, nil
		}
	}

	if _, err := s.fileRepo.GetByID(req.FileID); err != nil {
		return nil, ErrFileNotFound
	}

	if _, err := s.issuerRepo.GetByID(req.IssuerID); err != nil {
		return nil, ErrIssuerNotFound
	}

	if req.MaxAccess <= 0 {
		return nil, ErrInvalidMaxAccess
	}

	link := &model.PresignedLink{
		IdempotencyKey: req.IdempotencyKey,
		FileID:         req.FileID,
		IssuerID:       req.IssuerID,
		ExpiresAt:      time.Now().Add(time.Duration(req.ExpireHours) * time.Hour),
		MaxAccess:      req.MaxAccess,
		AccessCount:    0,
		Status:         model.LinkStatusActive,
	}

	if err := s.linkRepo.Create(link); err != nil {
		return nil, err
	}

	return s.linkRepo.GetByID(link.ID)
}

type ValidateResult struct {
	Valid      bool   `json:"valid"`
	Status     string `json:"status"`
	FailReason string `json:"fail_reason,omitempty"`
	FileID     string `json:"file_id,omitempty"`
	FileName   string `json:"file_name,omitempty"`
}

func (s *LinkService) ValidateLink(token, clientIP, userAgent string) (*ValidateResult, error) {
	link, err := s.linkRepo.GetByToken(token)
	if err != nil {
		s.logAccess("", token, clientIP, userAgent, false, "link not found")
		return &ValidateResult{Valid: false, Status: "not_found", FailReason: "link not found"}, ErrLinkNotFound
	}

	result := &ValidateResult{}
	success := true
	failReason := ""

	if link.Status == model.LinkStatusRevoked {
		result.Valid = false
		result.Status = model.LinkStatusRevoked
		result.FailReason = fmt.Sprintf("link revoked: %s", link.RevokeReason)
		success = false
		failReason = result.FailReason
	} else if link.Status == model.LinkStatusExhausted {
		result.Valid = false
		result.Status = model.LinkStatusExhausted
		result.FailReason = "access count exhausted"
		success = false
		failReason = result.FailReason
	} else if time.Now().After(link.ExpiresAt) {
		result.Valid = false
		result.Status = model.LinkStatusExpired
		result.FailReason = "link expired"
		success = false
		failReason = result.FailReason
		if link.Status == model.LinkStatusActive {
			link.Status = model.LinkStatusExpired
			s.linkRepo.Update(link)
		}
	} else if link.AccessCount >= link.MaxAccess {
		result.Valid = false
		result.Status = model.LinkStatusExhausted
		result.FailReason = "access count exhausted"
		success = false
		failReason = result.FailReason
		link.Status = model.LinkStatusExhausted
		s.linkRepo.Update(link)
	} else {
		result.Valid = true
		result.Status = model.LinkStatusActive
		result.FileID = link.FileID
		result.FileName = link.File.Name
		link.AccessCount++
		if link.AccessCount >= link.MaxAccess {
			link.Status = model.LinkStatusExhausted
		}
		s.linkRepo.Update(link)
	}

	s.logAccess(link.ID, token, clientIP, userAgent, success, failReason)
	return result, nil
}

func (s *LinkService) logAccess(linkID, token, clientIP, userAgent string, success bool, failReason string) {
	log := &model.AccessLog{
		LinkID:     linkID,
		LinkToken:  token,
		AccessTime: time.Now(),
		ClientIP:   clientIP,
		UserAgent:  userAgent,
		Success:    success,
		FailReason: failReason,
	}
	s.logRepo.Create(log)
}

type RevokeRequest struct {
	LinkID    string `json:"link_id"`
	Reason    string `json:"reason" binding:"required"`
	RevokedBy string `json:"revoked_by"`
}

func (s *LinkService) RevokeLink(req RevokeRequest) (*model.PresignedLink, error) {
	link, err := s.linkRepo.GetByID(req.LinkID)
	if err != nil {
		return nil, ErrLinkNotFound
	}

	now := time.Now()
	link.Status = model.LinkStatusRevoked
	link.RevokeReason = req.Reason
	link.RevokedAt = &now
	link.RevokedBy = req.RevokedBy

	if err := s.linkRepo.Update(link); err != nil {
		return nil, err
	}

	return link, nil
}

func (s *LinkService) GetLink(id string) (*model.PresignedLink, error) {
	return s.linkRepo.GetByID(id)
}

func (s *LinkService) ListLinks() ([]model.PresignedLink, error) {
	return s.linkRepo.ListAll()
}

func (s *LinkService) GetAccessLogs(linkID string, limit int) ([]model.AccessLog, error) {
	if limit <= 0 {
		limit = 100
	}
	return s.logRepo.GetByLinkID(linkID, limit)
}

func (s *LinkService) ListAccessLogs(limit, offset int) ([]model.AccessLog, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	logs, err := s.logRepo.List(limit, offset)
	if err != nil {
		return nil, 0, err
	}
	count, err := s.logRepo.Count()
	return logs, count, err
}

func (s *LinkService) CleanupExpired() (int, error) {
	now := time.Now()
	expiredLinks, err := s.linkRepo.ListExpired(now)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, link := range expiredLinks {
		link.Status = model.LinkStatusExpired
		if err := s.linkRepo.Update(&link); err == nil {
			count++
		}
	}

	return count, nil
}
