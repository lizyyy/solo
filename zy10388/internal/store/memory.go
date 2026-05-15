package store

import (
	"longpoll-session-api/internal/model"
	"sort"
	"sync"
	"time"
)

type MemoryStore struct {
	sessions      map[string]*model.Session
	sessionsByKey map[string]string
	messages      map[string][]*model.Message
	messageByID   map[string]*model.Message
	receipts      map[string][]*model.DeliveryReceipt
	cursors       map[string]int64
	mu            sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		sessions:      make(map[string]*model.Session),
		sessionsByKey: make(map[string]string),
		messages:      make(map[string][]*model.Message),
		messageByID:   make(map[string]*model.Message),
		receipts:      make(map[string][]*model.DeliveryReceipt),
		cursors:       make(map[string]int64),
	}
}

func (m *MemoryStore) Session() SessionStore {
	return &memorySessionStore{store: m}
}

func (m *MemoryStore) Message() MessageStore {
	return &memoryMessageStore{store: m}
}

func (m *MemoryStore) Receipt() ReceiptStore {
	return &memoryReceiptStore{store: m}
}

func (m *MemoryStore) Close() error {
	return nil
}

type memorySessionStore struct {
	store *MemoryStore
}

func (s *memorySessionStore) Create(session *model.Session) error {
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	s.store.sessions[session.ID] = session
	return nil
}

func (s *memorySessionStore) GetByID(id string) (*model.Session, error) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	session, ok := s.store.sessions[id]
	if !ok {
		return nil, nil
	}
	return session, nil
}

func (s *memorySessionStore) GetByClientID(clientID string) ([]*model.Session, error) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	var result []*model.Session
	for _, session := range s.store.sessions {
		if session.ClientID == clientID {
			result = append(result, session)
		}
	}
	return result, nil
}

func (s *memorySessionStore) Update(session *model.Session) error {
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	s.store.sessions[session.ID] = session
	return nil
}

func (s *memorySessionStore) Delete(id string) error {
	s.store.mu.Lock()
	defer s.store.mu.Unlock()
	delete(s.store.sessions, id)
	return nil
}

func (s *memorySessionStore) Query(req *model.SessionQueryRequest) (*model.SessionQueryResponse, error) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()

	var result []*model.Session
	for _, session := range s.store.sessions {
		if req.SessionID != "" && session.ID != req.SessionID {
			continue
		}
		if req.ClientID != "" && session.ClientID != req.ClientID {
			continue
		}
		if req.UserID != "" && session.UserID != req.UserID {
			continue
		}
		if req.Status != "" && session.Status != req.Status {
			continue
		}
		if req.CursorStart > 0 && session.Cursor < req.CursorStart {
			continue
		}
		if req.CursorEnd > 0 && session.Cursor > req.CursorEnd {
			continue
		}
		if req.TimeStart != nil && session.CreatedAt.Before(*req.TimeStart) {
			continue
		}
		if req.TimeEnd != nil && session.CreatedAt.After(*req.TimeEnd) {
			continue
		}
		result = append(result, session)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt.After(result[j].CreatedAt)
	})

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= len(result) {
		return &model.SessionQueryResponse{
			Sessions: []*model.Session{},
			Total:    int64(len(result)),
			Page:     page,
			PageSize: pageSize,
		}, nil
	}
	if end > len(result) {
		end = len(result)
	}

	return &model.SessionQueryResponse{
		Sessions: result[start:end],
		Total:    int64(len(result)),
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *memorySessionStore) GetByIdempotencyKey(key string) (*model.Session, error) {
	s.store.mu.RLock()
	defer s.store.mu.RUnlock()
	sessionID, ok := s.store.sessionsByKey[key]
	if !ok {
		return nil, nil
	}
	return s.store.sessions[sessionID], nil
}

type memoryMessageStore struct {
	store *MemoryStore
}

func (m *memoryMessageStore) Create(message *model.Message) error {
	m.store.mu.Lock()
	defer m.store.mu.Unlock()
	m.store.messages[message.SessionID] = append(m.store.messages[message.SessionID], message)
	m.store.messageByID[message.ID] = message
	if message.Cursor > m.store.cursors[message.SessionID] {
		m.store.cursors[message.SessionID] = message.Cursor
	}
	return nil
}

func (m *memoryMessageStore) GetByID(id string) (*model.Message, error) {
	m.store.mu.RLock()
	defer m.store.mu.RUnlock()
	return m.store.messageByID[id], nil
}

func (m *memoryMessageStore) GetBySessionID(sessionID string, fromCursor int64, limit int) ([]*model.Message, error) {
	m.store.mu.RLock()
	defer m.store.mu.RUnlock()
	msgs := m.store.messages[sessionID]
	var result []*model.Message
	for _, msg := range msgs {
		if msg.Cursor > fromCursor {
			result = append(result, msg)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *memoryMessageStore) GetPendingBySessionID(sessionID string, limit int) ([]*model.Message, error) {
	m.store.mu.RLock()
	defer m.store.mu.RUnlock()
	msgs := m.store.messages[sessionID]
	var result []*model.Message
	for _, msg := range msgs {
		if msg.Status == model.MessageStatusPending {
			result = append(result, msg)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (m *memoryMessageStore) Update(message *model.Message) error {
	m.store.mu.Lock()
	defer m.store.mu.Unlock()
	m.store.messageByID[message.ID] = message
	msgs := m.store.messages[message.SessionID]
	for i, msg := range msgs {
		if msg.ID == message.ID {
			msgs[i] = message
			break
		}
	}
	return nil
}

func (m *memoryMessageStore) UpdateStatusByCursor(sessionID string, cursors []int64, status model.MessageStatus) (int, error) {
	m.store.mu.Lock()
	defer m.store.mu.Unlock()
	count := 0
	cursorMap := make(map[int64]bool)
	for _, c := range cursors {
		cursorMap[c] = true
	}
	for _, msg := range m.store.messages[sessionID] {
		if cursorMap[msg.Cursor] {
			msg.Status = status
			if status == model.MessageStatusAcked {
				now := time.Now()
				msg.AckedAt = &now
			}
			count++
		}
	}
	return count, nil
}

func (m *memoryMessageStore) Query(req *model.MessageQueryRequest) (*model.MessageQueryResponse, error) {
	m.store.mu.RLock()
	defer m.store.mu.RUnlock()

	var result []*model.Message
	for _, msgs := range m.store.messages {
		for _, msg := range msgs {
			if req.SessionID != "" && msg.SessionID != req.SessionID {
				continue
			}
			if req.Status != "" && msg.Status != req.Status {
				continue
			}
			if req.CursorStart > 0 && msg.Cursor < req.CursorStart {
				continue
			}
			if req.CursorEnd > 0 && msg.Cursor > req.CursorEnd {
				continue
			}
			if req.CreatedStart != nil && msg.CreatedAt.Before(*req.CreatedStart) {
				continue
			}
			if req.CreatedEnd != nil && msg.CreatedAt.After(*req.CreatedEnd) {
				continue
			}
			result = append(result, msg)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Cursor < result[j].Cursor
	})

	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 50
	}

	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= len(result) {
		return &model.MessageQueryResponse{
			Messages: []*model.Message{},
			Total:    int64(len(result)),
			Page:     page,
			PageSize: pageSize,
		}, nil
	}
	if end > len(result) {
		end = len(result)
	}

	return &model.MessageQueryResponse{
		Messages: result[start:end],
		Total:    int64(len(result)),
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (m *memoryMessageStore) GetNextCursor(sessionID string) (int64, error) {
	m.store.mu.RLock()
	defer m.store.mu.RUnlock()
	return m.store.cursors[sessionID] + 1, nil
}

type memoryReceiptStore struct {
	store *MemoryStore
}

func (r *memoryReceiptStore) Create(receipt *model.DeliveryReceipt) error {
	r.store.mu.Lock()
	defer r.store.mu.Unlock()
	r.store.receipts[receipt.SessionID] = append(r.store.receipts[receipt.SessionID], receipt)
	return nil
}

func (r *memoryReceiptStore) GetBySessionID(sessionID string) ([]*model.DeliveryReceipt, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()
	return r.store.receipts[sessionID], nil
}

func (r *memoryReceiptStore) GetByCursor(sessionID string, cursor int64) (*model.DeliveryReceipt, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()
	for _, receipt := range r.store.receipts[sessionID] {
		if receipt.Cursor == cursor {
			return receipt, nil
		}
	}
	return nil, nil
}

func (r *memoryReceiptStore) ExistsByCursor(sessionID string, cursor int64) (bool, error) {
	r.store.mu.RLock()
	defer r.store.mu.RUnlock()
	for _, receipt := range r.store.receipts[sessionID] {
		if receipt.Cursor == cursor {
			return true, nil
		}
	}
	return false, nil
}
