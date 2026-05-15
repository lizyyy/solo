package service

import (
	"longpoll-session-api/internal/errors"
	"longpoll-session-api/internal/model"
	"longpoll-session-api/internal/store"
	"time"
)

type messageService struct {
	store store.Store
}

func NewMessageService(s store.Store) MessageService {
	return &messageService{store: s}
}

func (m *messageService) PushMessage(req *model.PushMessageRequest) (*model.PushMessageResponse, error) {
	session, err := m.store.Session().GetByID(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get session")
	}
	if session == nil {
		return nil, errors.ErrSessionNotFound
	}

	if session.Status != model.SessionStatusActive {
		return nil, errors.ErrSessionNotActive
	}

	messageID, err := generateID()
	if err != nil {
		return nil, errors.Wrap(err, "failed to generate message ID")
	}

	cursor, err := m.store.Message().GetNextCursor(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get next cursor")
	}

	maxDelivery := req.MaxDelivery
	if maxDelivery <= 0 {
		maxDelivery = 3
	}

	message := &model.Message{
		ID:            messageID,
		SessionID:     req.SessionID,
		Cursor:        cursor,
		Payload:       req.Payload,
		Status:        model.MessageStatusPending,
		Priority:      req.Priority,
		Type:          req.Type,
		CreatedAt:     time.Now(),
		DeliveryCount: 0,
		MaxDelivery:   maxDelivery,
	}

	if err := m.store.Message().Create(message); err != nil {
		return nil, errors.Wrap(err, "failed to create message")
	}

	session.Cursor = cursor
	session.UpdatedAt = time.Now()
	if err := m.store.Session().Update(session); err != nil {
		return nil, errors.Wrap(err, "failed to update session cursor")
	}

	return &model.PushMessageResponse{
		MessageID: messageID,
		Cursor:    cursor,
	}, nil
}

func (m *messageService) PollMessages(req *model.PollRequest) (*model.PollResponse, error) {
	session, err := m.store.Session().GetByID(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get session")
	}
	if session == nil {
		return nil, errors.ErrSessionNotFound
	}

	if session.Status != model.SessionStatusActive {
		return nil, errors.ErrSessionNotActive
	}

	batchSize := req.BatchSize
	if batchSize <= 0 {
		batchSize = 100
	}

	waitTimeout := time.Duration(req.WaitTimeout) * time.Second
	if waitTimeout <= 0 {
		waitTimeout = 30 * time.Second
	}

	for {
		messages, err := m.store.Message().GetBySessionID(req.SessionID, req.LastCursor, batchSize)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get messages")
		}

		if len(messages) > 0 {
			now := time.Now()
			for _, msg := range messages {
				if msg.Status == model.MessageStatusPending {
					msg.Status = model.MessageStatusDelivered
					msg.DeliveryCount++
					msg.DeliveredAt = &now
					m.store.Message().Update(msg)
				}
			}

			hasMore := false
			if len(messages) == batchSize {
				hasMore = true
			}

			lastCursor := req.LastCursor
			if len(messages) > 0 {
				lastCursor = messages[len(messages)-1].Cursor
			}

			session.LastActiveAt = now
			m.store.Session().Update(session)

			return &model.PollResponse{
				Messages: messages,
				Cursor:   lastCursor,
				HasMore:  hasMore,
			}, nil
		}

		waitCh := m.store.Message().WaitForMessage(req.SessionID, waitTimeout)
		hasNewMessage := <-waitCh

		if !hasNewMessage {
			return &model.PollResponse{
				Messages: []*model.Message{},
				Cursor:   req.LastCursor,
				HasMore:  false,
			}, nil
		}
	}
}

func (m *messageService) AckMessages(req *model.AckRequest) (*model.AckResponse, error) {
	session, err := m.store.Session().GetByID(req.SessionID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get session")
	}
	if session == nil {
		return nil, errors.ErrSessionNotFound
	}

	if session.Status != model.SessionStatusActive {
		return nil, errors.ErrSessionNotActive
	}

	now := time.Now()
	count := 0
	maxCursor := session.LastAckCursor

	for _, cursor := range req.Cursors {
		exists, err := m.store.Receipt().ExistsByCursor(req.SessionID, cursor)
		if err != nil {
			return nil, errors.Wrap(err, "failed to check receipt existence")
		}
		if exists {
			continue
		}

		msg, err := m.store.Message().GetByCursor(req.SessionID, cursor)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get message by cursor")
		}
		if msg == nil || msg.Status == model.MessageStatusAcked {
			continue
		}

		msg.Status = model.MessageStatusAcked
		msg.AckedAt = &now
		if err := m.store.Message().Update(msg); err != nil {
			return nil, errors.Wrap(err, "failed to update message status")
		}

		receiptID, _ := generateID()
		receipt := &model.DeliveryReceipt{
			ID:         receiptID,
			SessionID:  req.SessionID,
			MessageID:  msg.ID,
			Cursor:     cursor,
			ReceivedAt: now,
		}
		if err := m.store.Receipt().Create(receipt); err != nil {
			return nil, errors.Wrap(err, "failed to create delivery receipt")
		}

		count++
		if cursor > maxCursor {
			maxCursor = cursor
		}
	}

	session.LastAckCursor = maxCursor
	session.UpdatedAt = now
	m.store.Session().Update(session)

	return &model.AckResponse{
		AckedCount: count,
		NewCursor:  maxCursor,
	}, nil
}

func (m *messageService) QueryMessages(req *model.MessageQueryRequest) (*model.MessageQueryResponse, error) {
	return m.store.Message().Query(req)
}
