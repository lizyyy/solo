package service

import (
	"crypto/rand"
	"encoding/hex"
	"longpoll-session-api/internal/errors"
	"longpoll-session-api/internal/model"
	"longpoll-session-api/internal/store"
	"time"
)

type sessionService struct {
	store store.Store
}

func NewSessionService(s store.Store) SessionService {
	return &sessionService{store: s}
}

func (s *sessionService) CreateSession(req *model.CreateSessionRequest) (*model.CreateSessionResponse, error) {
	if req.IdempotencyKey != "" {
		existing, err := s.store.Session().GetByIdempotencyKey(req.IdempotencyKey)
		if err != nil {
			return nil, errors.Wrap(err, "failed to check idempotency key")
		}
		if existing != nil {
			return &model.CreateSessionResponse{
				SessionID: existing.ID,
				Session:   existing,
				Created:   false,
			}, nil
		}
	}

	sessionID, err := generateID()
	if err != nil {
		return nil, errors.Wrap(err, "failed to generate session ID")
	}

	ttl := req.TTLSeconds
	if ttl <= 0 {
		ttl = 3600
	}

	maxReconnect := req.MaxReconnect
	if maxReconnect <= 0 {
		maxReconnect = 5
	}

	now := time.Now()
	session := &model.Session{
		ID:             sessionID,
		ClientID:       req.ClientID,
		UserID:         req.UserID,
		Status:         model.SessionStatusActive,
		Cursor:         0,
		LastAckCursor:  0,
		ReconnectCount: 0,
		MaxReconnect:   maxReconnect,
		CreatedAt:      now,
		UpdatedAt:      now,
		LastActiveAt:   now,
		ExpiresAt:      now.Add(time.Duration(ttl) * time.Second),
		Metadata:       req.Metadata,
	}

	if err := s.store.Session().Create(session, req.IdempotencyKey); err != nil {
		return nil, errors.Wrap(err, "failed to create session")
	}

	return &model.CreateSessionResponse{
		SessionID: sessionID,
		Session:   session,
		Created:   true,
	}, nil
}

func (s *sessionService) GetSession(sessionID string) (*model.Session, error) {
	session, err := s.store.Session().GetByID(sessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get session")
	}
	if session == nil {
		return nil, errors.ErrSessionNotFound
	}
	return session, nil
}

func (s *sessionService) QuerySessions(req *model.SessionQueryRequest) (*model.SessionQueryResponse, error) {
	return s.store.Session().Query(req)
}

func (s *sessionService) AdvanceSession(req *model.AdvanceRequest) (*model.AdvanceResponse, error) {
	session, err := s.GetSession(req.SessionID)
	if err != nil {
		return nil, err
	}

	if session.Status == model.SessionStatusClosed ||
		session.Status == model.SessionStatusRevoked ||
		session.Status == model.SessionStatusExpired {
		return nil, errors.ErrSessionNotActive
	}

	if req.NewStatus != "" {
		session.Status = req.NewStatus
	}

	if req.ExtendTTL > 0 {
		session.ExpiresAt = session.ExpiresAt.Add(time.Duration(req.ExtendTTL) * time.Second)
	}

	session.UpdatedAt = time.Now()
	session.LastActiveAt = time.Now()

	if err := s.store.Session().Update(session); err != nil {
		return nil, errors.Wrap(err, "failed to update session")
	}

	return &model.AdvanceResponse{Session: session}, nil
}

func (s *sessionService) RevokeSession(req *model.RevokeSessionRequest) (*model.RevokeSessionResponse, error) {
	session, err := s.GetSession(req.SessionID)
	if err != nil {
		return nil, err
	}

	session.Status = model.SessionStatusRevoked
	session.UpdatedAt = time.Now()

	if err := s.store.Session().Update(session); err != nil {
		return nil, errors.Wrap(err, "failed to revoke session")
	}

	return &model.RevokeSessionResponse{
		SessionID: req.SessionID,
		Success:   true,
	}, nil
}

func (s *sessionService) ReconnectSession(sessionID string, clientID string) (*model.Session, error) {
	session, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	if session.ClientID != clientID {
		return nil, errors.ErrClientMismatch
	}

	if session.ReconnectCount >= session.MaxReconnect {
		session.Status = model.SessionStatusExpired
		session.UpdatedAt = time.Now()
		s.store.Session().Update(session)
		return nil, errors.ErrMaxReconnectExceeded
	}

	session.ReconnectCount++
	session.Status = model.SessionStatusActive
	session.UpdatedAt = time.Now()
	session.LastActiveAt = time.Now()
	session.LastDisconnect = nil

	if err := s.store.Session().Update(session); err != nil {
		return nil, errors.Wrap(err, "failed to update session on reconnect")
	}

	return session, nil
}

func generateID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
