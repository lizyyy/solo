package service

import (
	"longpoll-session-api/internal/model"
	"longpoll-session-api/internal/store"
)

type SessionService interface {
	CreateSession(req *model.CreateSessionRequest) (*model.CreateSessionResponse, error)
	GetSession(sessionID string) (*model.Session, error)
	QuerySessions(req *model.SessionQueryRequest) (*model.SessionQueryResponse, error)
	AdvanceSession(req *model.AdvanceRequest) (*model.AdvanceResponse, error)
	RevokeSession(req *model.RevokeSessionRequest) (*model.RevokeSessionResponse, error)
	ReconnectSession(sessionID string, clientID string) (*model.Session, error)
}

type MessageService interface {
	PushMessage(req *model.PushMessageRequest) (*model.PushMessageResponse, error)
	PollMessages(req *model.PollRequest) (*model.PollResponse, error)
	AckMessages(req *model.AckRequest) (*model.AckResponse, error)
	QueryMessages(req *model.MessageQueryRequest) (*model.MessageQueryResponse, error)
}

type ExportService interface {
	Export(req *model.ExportRequest) (*model.ExportResponse, error)
}

type Service struct {
	Session SessionService
	Message MessageService
	Export  ExportService
}

func NewService(store store.Store) *Service {
	return &Service{
		Session: NewSessionService(store),
		Message: NewMessageService(store),
		Export:  NewExportService(store),
	}
}
