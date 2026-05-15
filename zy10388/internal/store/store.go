package store

import (
	"longpoll-session-api/internal/model"
	"time"
)

type SessionStore interface {
	Create(session *model.Session, idempotencyKey string) error
	GetByID(id string) (*model.Session, error)
	GetByClientID(clientID string) ([]*model.Session, error)
	Update(session *model.Session) error
	Delete(id string) error
	Query(req *model.SessionQueryRequest) (*model.SessionQueryResponse, error)
	GetByIdempotencyKey(key string) (*model.Session, error)
}

type MessageStore interface {
	Create(message *model.Message) error
	GetByID(id string) (*model.Message, error)
	GetBySessionID(sessionID string, fromCursor int64, limit int) ([]*model.Message, error)
	GetPendingBySessionID(sessionID string, limit int) ([]*model.Message, error)
	Update(message *model.Message) error
	UpdateStatusByCursor(sessionID string, cursors []int64, status model.MessageStatus) (int, error)
	Query(req *model.MessageQueryRequest) (*model.MessageQueryResponse, error)
	GetNextCursor(sessionID string) (int64, error)
	WaitForMessage(sessionID string, timeout time.Duration) (hasNewMessage <-chan bool)
}

type ReceiptStore interface {
	Create(receipt *model.DeliveryReceipt) error
	GetBySessionID(sessionID string) ([]*model.DeliveryReceipt, error)
	GetByCursor(sessionID string, cursor int64) (*model.DeliveryReceipt, error)
	ExistsByCursor(sessionID string, cursor int64) (bool, error)
}

type Store interface {
	Session() SessionStore
	Message() MessageStore
	Receipt() ReceiptStore
	Close() error
}
