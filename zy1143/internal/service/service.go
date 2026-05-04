package service

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"localmq/internal/models"
	"localmq/internal/storage"
)

type MessageService struct {
	store *storage.SQLiteStore
}

func NewMessageService(store *storage.SQLiteStore) *MessageService {
	return &MessageService{store: store}
}

func (s *MessageService) CreateQueue(req *models.CreateQueueRequest) (*models.Queue, error) {
	if req.Name == "" {
		return nil, fmt.Errorf("queue name is required")
	}

	existing, err := s.store.GetQueueByName(req.Name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("queue already exists")
	}

	q := &models.Queue{
		Name:                     req.Name,
		Description:              req.Description,
		RetryStrategy:            "fixed",
		RetryDelaySeconds:        10,
		MaxDelaySeconds:          300,
		VisibilityTimeoutSeconds: 60,
	}

	if req.RetryStrategy == "fixed" || req.RetryStrategy == "exponential" {
		q.RetryStrategy = req.RetryStrategy
	}
	if req.RetryDelaySeconds > 0 {
		q.RetryDelaySeconds = req.RetryDelaySeconds
	}
	if req.MaxDelaySeconds > 0 {
		q.MaxDelaySeconds = req.MaxDelaySeconds
	}
	if req.VisibilityTimeoutSeconds > 0 {
		q.VisibilityTimeoutSeconds = req.VisibilityTimeoutSeconds
	}

	if err := s.store.CreateQueue(q); err != nil {
		return nil, err
	}

	return q, nil
}

func (s *MessageService) GetQueue(name string) (*models.Queue, error) {
	return s.store.GetQueueByName(name)
}

func (s *MessageService) ListQueues() ([]*models.Queue, error) {
	return s.store.ListQueues()
}

func (s *MessageService) Enqueue(req *models.EnqueueRequest) (*models.Message, error) {
	if req.QueueName == "" {
		return nil, fmt.Errorf("queue name is required")
	}
	if req.Body == "" {
		return nil, fmt.Errorf("message body is required")
	}

	queue, err := s.store.GetOrCreateQueue(req.QueueName)
	if err != nil {
		return nil, err
	}

	msg := &models.Message{
		QueueID:      queue.ID,
		QueueName:    req.QueueName,
		Body:         req.Body,
		Priority:     req.Priority,
		DelaySeconds: req.DelaySeconds,
		MaxAttempts:  req.MaxAttempts,
		Attempts:     0,
		Metadata:     req.Metadata,
	}

	if msg.MaxAttempts == 0 {
		msg.MaxAttempts = 3
	}

	if req.IdempotencyKey != nil && *req.IdempotencyKey != "" {
		msg.IdempotencyKey = sql.NullString{String: *req.IdempotencyKey, Valid: true}
	}

	if len(msg.Metadata) == 0 {
		msg.Metadata = []byte("{}")
	}

	if err := s.store.EnqueueMessage(msg); err != nil {
		if strings.Contains(err.Error(), "idempotency key already exists") {
			return nil, fmt.Errorf("idempotency key already exists")
		}
		return nil, err
	}

	return msg, nil
}

func (s *MessageService) Reserve(req *models.ReserveRequest) ([]*models.MessageResponse, error) {
	if req.QueueName == "" {
		return nil, fmt.Errorf("queue name is required")
	}
	if req.WorkerID == "" {
		return nil, fmt.Errorf("worker_id is required")
	}

	queue, err := s.store.GetQueueByName(req.QueueName)
	if err != nil {
		return nil, err
	}
	if queue == nil {
		return []*models.MessageResponse{}, nil
	}

	limit := req.Limit
	if limit <= 0 {
		limit = 1
	}

	msgs, err := s.store.ReserveMessages(req.QueueName, req.WorkerID, limit, queue.VisibilityTimeoutSeconds)
	if err != nil {
		return nil, err
	}

	responses := make([]*models.MessageResponse, len(msgs))
	for i, msg := range msgs {
		responses[i] = s.toMessageResponse(msg)
	}

	return responses, nil
}

func (s *MessageService) Ack(req *models.AckRequest) error {
	if req.MessageID <= 0 {
		return fmt.Errorf("message_id is required")
	}
	if req.WorkerID == "" {
		return fmt.Errorf("worker_id is required")
	}

	return s.store.AckMessage(req.MessageID, req.WorkerID)
}

func (s *MessageService) Nack(req *models.NackRequest) error {
	if req.MessageID <= 0 {
		return fmt.Errorf("message_id is required")
	}
	if req.WorkerID == "" {
		return fmt.Errorf("worker_id is required")
	}

	msg, err := s.store.GetMessageByID(req.MessageID)
	if err != nil {
		return err
	}
	if msg == nil {
		return fmt.Errorf("message not found")
	}

	queue, err := s.store.GetQueueByName(msg.QueueName)
	if err != nil {
		return err
	}
	if queue == nil {
		return fmt.Errorf("queue not found")
	}

	return s.store.NackMessage(req.MessageID, req.WorkerID, req.ErrorReason, queue)
}

func (s *MessageService) ExtendLease(req *models.ExtendLeaseRequest) error {
	if req.MessageID <= 0 {
		return fmt.Errorf("message_id is required")
	}
	if req.WorkerID == "" {
		return fmt.Errorf("worker_id is required")
	}
	if req.Seconds <= 0 {
		return fmt.Errorf("seconds must be greater than 0")
	}

	return s.store.ExtendLease(req.MessageID, req.WorkerID, req.Seconds)
}

func (s *MessageService) GetStats(queueName string) (*models.QueueStats, error) {
	if queueName == "" {
		return nil, fmt.Errorf("queue name is required")
	}
	return s.store.GetQueueStats(queueName)
}

func (s *MessageService) Peek(queueName string, status string, limit int) ([]*models.MessageResponse, error) {
	if queueName == "" {
		return nil, fmt.Errorf("queue name is required")
	}

	var msgStatus models.MessageStatus
	if status != "" {
		msgStatus = models.MessageStatus(status)
	}

	msgs, err := s.store.PeekMessages(queueName, msgStatus, limit)
	if err != nil {
		return nil, err
	}

	responses := make([]*models.MessageResponse, len(msgs))
	for i, msg := range msgs {
		responses[i] = s.toMessageResponse(msg)
	}

	return responses, nil
}

func (s *MessageService) GetMessage(messageID int64) (*models.MessageResponse, error) {
	msg, err := s.store.GetMessageByID(messageID)
	if err != nil {
		return nil, err
	}
	if msg == nil {
		return nil, fmt.Errorf("message not found")
	}

	return s.toMessageResponse(msg), nil
}

func (s *MessageService) GetAuditLogs(messageID int64) ([]*models.AuditLog, error) {
	return s.store.GetAuditLogs(messageID)
}

func (s *MessageService) ReplayDeadLetter(req *models.ReplayDeadLetterRequest) (int64, error) {
	if req.QueueName == "" {
		return 0, fmt.Errorf("queue name is required")
	}

	return s.store.ReplayDeadLetter(req.QueueName, req.DeadReasons, req.MessageIDs, req.NewDelaySeconds)
}

func (s *MessageService) ExportJSON(queueName string) ([]byte, error) {
	msgs, err := s.store.PeekMessages(queueName, "", 0)
	if err != nil {
		return nil, err
	}

	responses := make([]*models.MessageResponse, len(msgs))
	for i, msg := range msgs {
		responses[i] = s.toMessageResponse(msg)
	}

	return json.MarshalIndent(responses, "", "  ")
}

func (s *MessageService) ExportCSV(queueName string) ([]byte, error) {
	msgs, err := s.store.PeekMessages(queueName, "", 0)
	if err != nil {
		return nil, err
	}

	var builder strings.Builder
	writer := csv.NewWriter(&builder)

	headers := []string{"ID", "QueueName", "Body", "Priority", "Attempts", "MaxAttempts", "Status", "CreatedAt", "VisibleAt", "DeadReason", "LastError"}
	writer.Write(headers)

	for _, msg := range msgs {
		deadReason := ""
		if msg.DeadReason.Valid {
			deadReason = msg.DeadReason.String
		}
		lastError := ""
		if msg.LastError.Valid {
			lastError = msg.LastError.String
		}

		row := []string{
			fmt.Sprintf("%d", msg.ID),
			msg.QueueName,
			msg.Body,
			fmt.Sprintf("%d", msg.Priority),
			fmt.Sprintf("%d", msg.Attempts),
			fmt.Sprintf("%d", msg.MaxAttempts),
			string(msg.Status),
			msg.CreatedAt.Format(time.RFC3339),
			msg.VisibleAt.Format(time.RFC3339),
			deadReason,
			lastError,
		}
		writer.Write(row)
	}

	writer.Flush()
	return []byte(builder.String()), nil
}

func (s *MessageService) ExportMarkdown(queueName string) (string, error) {
	stats, err := s.store.GetQueueStats(queueName)
	if err != nil {
		return "", err
	}

	msgs, err := s.store.PeekMessages(queueName, "", 0)
	if err != nil {
		return "", err
	}

	var builder strings.Builder
	builder.WriteString(fmt.Sprintf("# Queue: %s\n\n", queueName))
	builder.WriteString("## Statistics\n\n")
	builder.WriteString("| Metric | Count |\n")
	builder.WriteString("|--------|-------|\n")
	builder.WriteString(fmt.Sprintf("| Total | %d |\n", stats.Total))
	builder.WriteString(fmt.Sprintf("| Ready | %d |\n", stats.Ready))
	builder.WriteString(fmt.Sprintf("| Reserved | %d |\n", stats.Reserved))
	builder.WriteString(fmt.Sprintf("| Succeeded | %d |\n", stats.Succeeded))
	builder.WriteString(fmt.Sprintf("| Dead | %d |\n", stats.Dead))
	builder.WriteString("\n")

	builder.WriteString("## Messages\n\n")
	builder.WriteString("| ID | Status | Attempts | Created At | Visible At |\n")
	builder.WriteString("|----|--------|----------|------------|------------|\n")

	for _, msg := range msgs {
		builder.WriteString(fmt.Sprintf("| %d | %s | %d/%d | %s | %s |\n",
			msg.ID, msg.Status, msg.Attempts, msg.MaxAttempts,
			msg.CreatedAt.Format(time.RFC3339),
			msg.VisibleAt.Format(time.RFC3339)))
	}

	return builder.String(), nil
}

func (s *MessageService) UpdateExpiredMessages() error {
	return s.store.UpdateExpiredMessages()
}

func (s *MessageService) UpdatePendingMessages() error {
	return s.store.UpdatePendingMessages()
}

func (s *MessageService) toMessageResponse(msg *models.Message) *models.MessageResponse {
	resp := &models.MessageResponse{
		ID:           msg.ID,
		QueueName:    msg.QueueName,
		Body:         msg.Body,
		Priority:     msg.Priority,
		Attempts:     msg.Attempts,
		MaxAttempts:  msg.MaxAttempts,
		Status:       msg.Status,
		VisibleAt:    msg.VisibleAt,
		CreatedAt:    msg.CreatedAt,
		Metadata:     msg.Metadata,
	}

	if msg.IdempotencyKey.Valid {
		resp.IdempotencyKey = &msg.IdempotencyKey.String
	}
	if msg.ReservedBy.Valid {
		resp.ReservedBy = &msg.ReservedBy.String
	}
	if msg.ReservedAt.Valid {
		resp.ReservedAt = &msg.ReservedAt.Time
	}
	if msg.DeadReason.Valid {
		resp.DeadReason = &msg.DeadReason.String
	}
	if msg.LastError.Valid {
		resp.LastError = &msg.LastError.String
	}

	return resp
}
