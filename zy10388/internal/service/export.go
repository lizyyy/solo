package service

import (
	"longpoll-session-api/internal/errors"
	"longpoll-session-api/internal/model"
	"longpoll-session-api/internal/store"
	"time"
)

type exportService struct {
	store store.Store
}

func NewExportService(s store.Store) ExportService {
	return &exportService{store: s}
}

func (e *exportService) Export(req *model.ExportRequest) (*model.ExportResponse, error) {
	if req.SessionID == "" {
		return nil, errors.New("session_id is required")
	}

	session, err := e.store.Session().GetByID(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get session")
	}
	if session == nil {
		return nil, errors.ErrSessionNotFound
	}

	msgReq := &model.MessageQueryRequest{
		SessionID:  req.SessionID,
		CursorStart: req.CursorStart,
		CursorEnd:   req.CursorEnd,
	}

	if !req.IncludeAcked {
		msgReq.Status = model.MessageStatusPending
	}

	msgResp, err := e.store.Message().Query(msgReq)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query messages")
	}

	receipts, err := e.store.Receipt().GetBySessionID(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get receipts")
	}

	return &model.ExportResponse{
		Session:      session,
		Messages:     msgResp.Messages,
		Receipts:     receipts,
		ExportedAt:   time.Now(),
		MessageCount: len(msgResp.Messages),
	}, nil
}
