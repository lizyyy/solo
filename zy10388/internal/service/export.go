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
		SessionID:   req.SessionID,
		CursorStart: req.CursorStart,
		CursorEnd:   req.CursorEnd,
	}

	msgResp, err := e.store.Message().Query(msgReq)
	if err != nil {
		return nil, errors.Wrap(err, "failed to query messages")
	}

	var filteredMessages []*model.Message
	for _, msg := range msgResp.Messages {
		if req.IncludeAcked {
			filteredMessages = append(filteredMessages, msg)
		} else {
			if msg.Status == model.MessageStatusPending || msg.Status == model.MessageStatusDelivered {
				filteredMessages = append(filteredMessages, msg)
			}
		}
	}

	receipts, err := e.store.Receipt().GetBySessionID(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get receipts")
	}

	return &model.ExportResponse{
		Session:      session,
		Messages:     filteredMessages,
		Receipts:     receipts,
		ExportedAt:   time.Now(),
		MessageCount: len(filteredMessages),
	}, nil
}
