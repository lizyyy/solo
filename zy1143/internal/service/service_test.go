package service

import (
	"database/sql"
	"os"
	"testing"

	"localmq/internal/models"
	"localmq/internal/storage"
)

func setupTestDB(t *testing.T) (*storage.SQLiteStore, func()) {
	dbPath := "./test_localmq.db"

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create test store: %v", err)
	}

	cleanup := func() {
		store.Close()
		os.Remove(dbPath)
	}

	return store, cleanup
}

func TestEnqueueAndReserve(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-queue"
	body := "test message"

	msg, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName:   queueName,
		Body:        body,
		MaxAttempts: 3,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}
	if msg.ID == 0 {
		t.Error("Message ID should not be 0")
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  "worker-1",
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) != 1 {
		t.Fatalf("Expected 1 message, got %d", len(msgs))
	}
	if msgs[0].Body != body {
		t.Errorf("Expected body '%s', got '%s'", body, msgs[0].Body)
	}
	if msgs[0].Status != models.StatusReserved {
		t.Errorf("Expected status reserved, got %s", msgs[0].Status)
	}
}

func TestAck(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-ack"
	workerID := "worker-1"

	msg, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "message to ack",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) == 0 {
		t.Fatal("No message reserved")
	}

	err = svc.Ack(&models.AckRequest{
		MessageID: msgs[0].ID,
		WorkerID:  workerID,
	})
	if err != nil {
		t.Fatalf("Ack failed: %v", err)
	}

	msgResp, err := svc.GetMessage(msgs[0].ID)
	if err != nil {
		t.Fatalf("GetMessage failed: %v", err)
	}
	if msgResp.Status != models.StatusSucceeded {
		t.Errorf("Expected status succeeded, got %s", msgResp.Status)
	}
}

func TestNack(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-nack"
	workerID := "worker-1"

	msg, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName:   queueName,
		Body:        "message to nack",
		MaxAttempts: 2,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) == 0 {
		t.Fatal("No message reserved")
	}

	errorReason := "test error"
	err = svc.Nack(&models.NackRequest{
		MessageID:   msgs[0].ID,
		WorkerID:    workerID,
		ErrorReason: &errorReason,
	})
	if err != nil {
		t.Fatalf("Nack failed: %v", err)
	}

	msgResp, err := svc.GetMessage(msgs[0].ID)
	if err != nil {
		t.Fatalf("GetMessage failed: %v", err)
	}
	if msgResp.Attempts != 1 {
		t.Errorf("Expected 1 attempt, got %d", msgResp.Attempts)
	}
	if msgResp.Status != models.StatusReady && msgResp.Status != models.StatusPending {
		t.Errorf("Expected status ready or pending, got %s", msgResp.Status)
	}
}

func TestIdempotencyKey(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-idempotent"
	idempKey := "unique-key-123"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName:      queueName,
		Body:           "first message",
		IdempotencyKey: &idempKey,
	})
	if err != nil {
		t.Fatalf("First enqueue failed: %v", err)
	}

	_, err = svc.Enqueue(&models.EnqueueRequest{
		QueueName:      queueName,
		Body:           "second message with same key",
		IdempotencyKey: &idempKey,
	})
	if err == nil {
		t.Error("Second enqueue with same idempotency key should have failed")
	}
}

func TestDeadLetter(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-dead"
	workerID := "worker-1"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName:   queueName,
		Body:        "message that will die",
		MaxAttempts: 1,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) == 0 {
		t.Fatal("No message reserved")
	}

	errorReason := "fatal error"
	err = svc.Nack(&models.NackRequest{
		MessageID:   msgs[0].ID,
		WorkerID:    workerID,
		ErrorReason: &errorReason,
	})
	if err != nil {
		t.Fatalf("Nack failed: %v", err)
	}

	msgResp, err := svc.GetMessage(msgs[0].ID)
	if err != nil {
		t.Fatalf("GetMessage failed: %v", err)
	}
	if msgResp.Status != models.StatusDead {
		t.Errorf("Expected status dead, got %s", msgResp.Status)
	}
	if *msgResp.DeadReason != "max_attempts_exceeded" {
		t.Errorf("Expected dead reason 'max_attempts_exceeded', got %s", *msgResp.DeadReason)
	}
}

func TestReplayDeadLetter(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-replay"
	workerID := "worker-1"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName:   queueName,
		Body:        "message to replay",
		MaxAttempts: 1,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}

	errorReason := "fatal error"
	err = svc.Nack(&models.NackRequest{
		MessageID:   msgs[0].ID,
		WorkerID:    workerID,
		ErrorReason: &errorReason,
	})
	if err != nil {
		t.Fatalf("Nack failed: %v", err)
	}

	count, err := svc.ReplayDeadLetter(&models.ReplayDeadLetterRequest{
		QueueName: queueName,
	})
	if err != nil {
		t.Fatalf("ReplayDeadLetter failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 message replayed, got %d", count)
	}

	msgResp, err := svc.GetMessage(msgs[0].ID)
	if err != nil {
		t.Fatalf("GetMessage failed: %v", err)
	}
	if msgResp.Status != models.StatusReady {
		t.Errorf("Expected status ready, got %s", msgResp.Status)
	}
	if msgResp.Attempts != 0 {
		t.Errorf("Expected 0 attempts after replay, got %d", msgResp.Attempts)
	}
}

func TestStats(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-stats"

	for i := 0; i < 5; i++ {
		_, err := svc.Enqueue(&models.EnqueueRequest{
			QueueName: queueName,
			Body:      "test message",
		})
		if err != nil {
			t.Fatalf("Enqueue failed: %v", err)
		}
	}

	stats, err := svc.GetStats(queueName)
	if err != nil {
		t.Fatalf("GetStats failed: %v", err)
	}
	if stats.Total != 5 {
		t.Errorf("Expected total 5, got %d", stats.Total)
	}
	if stats.Ready != 5 {
		t.Errorf("Expected ready 5, got %d", stats.Ready)
	}
}

func TestPeek(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-peek"

	for i := 0; i < 3; i++ {
		_, err := svc.Enqueue(&models.EnqueueRequest{
			QueueName: queueName,
			Body:      "test message",
			Priority:  i,
		})
		if err != nil {
			t.Fatalf("Enqueue failed: %v", err)
		}
	}

	msgs, err := svc.Peek(queueName, "", 0)
	if err != nil {
		t.Fatalf("Peek failed: %v", err)
	}
	if len(msgs) != 3 {
		t.Errorf("Expected 3 messages, got %d", len(msgs))
	}

	if msgs[0].Priority < msgs[1].Priority || msgs[1].Priority < msgs[2].Priority {
		t.Error("Messages should be ordered by priority descending")
	}
}

func TestExtendLease(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-extend"
	workerID := "worker-1"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "message to extend",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) == 0 {
		t.Fatal("No message reserved")
	}

	originalVisibleAt := msgs[0].VisibleAt

	err = svc.ExtendLease(&models.ExtendLeaseRequest{
		MessageID: msgs[0].ID,
		WorkerID:  workerID,
		Seconds:   120,
	})
	if err != nil {
		t.Fatalf("ExtendLease failed: %v", err)
	}

	msgResp, err := svc.GetMessage(msgs[0].ID)
	if err != nil {
		t.Fatalf("GetMessage failed: %v", err)
	}
	if !msgResp.VisibleAt.After(originalVisibleAt) {
		t.Error("VisibleAt should be extended")
	}
}

func TestAuditLogs(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-audit"
	workerID := "worker-1"

	msg, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "message with audit",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}

	err = svc.Ack(&models.AckRequest{
		MessageID: msgs[0].ID,
		WorkerID:  workerID,
	})
	if err != nil {
		t.Fatalf("Ack failed: %v", err)
	}

	logs, err := svc.GetAuditLogs(msg.ID)
	if err != nil {
		t.Fatalf("GetAuditLogs failed: %v", err)
	}
	if len(logs) < 2 {
		t.Errorf("Expected at least 2 audit logs, got %d", len(logs))
	}

	actions := make(map[string]bool)
	for _, log := range logs {
		actions[log.Action] = true
	}
	if !actions["enqueue"] {
		t.Error("Missing 'enqueue' action in audit logs")
	}
	if !actions["reserve"] {
		t.Error("Missing 'reserve' action in audit logs")
	}
	if !actions["ack"] {
		t.Error("Missing 'ack' action in audit logs")
	}
}

func TestDuplicateAck(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-dup-ack"
	workerID := "worker-1"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "message",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}

	err = svc.Ack(&models.AckRequest{
		MessageID: msgs[0].ID,
		WorkerID:  workerID,
	})
	if err != nil {
		t.Fatalf("First ack failed: %v", err)
	}

	err = svc.Ack(&models.AckRequest{
		MessageID: msgs[0].ID,
		WorkerID:  workerID,
	})
	if err == nil {
		t.Error("Second ack should have failed")
	}
}

func TestWrongWorkerAck(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-wrong-worker"
	workerID1 := "worker-1"
	workerID2 := "worker-2"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "message",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  workerID1,
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}

	err = svc.Ack(&models.AckRequest{
		MessageID: msgs[0].ID,
		WorkerID:  workerID2,
	})
	if err == nil {
		t.Error("Ack by wrong worker should have failed")
	}
}

func TestDelayMessage(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-delay"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName:    queueName,
		Body:         "delayed message",
		DelaySeconds: 60,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  "worker-1",
		Limit:     1,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) != 0 {
		t.Error("Delayed message should not be reservable immediately")
	}

	stats, err := svc.GetStats(queueName)
	if err != nil {
		t.Fatalf("GetStats failed: %v", err)
	}
	if stats.Pending != 1 {
		t.Errorf("Expected 1 pending message, got %d", stats.Pending)
	}
}

func TestPriority(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-priority"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "low priority",
		Priority:  1,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	_, err = svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "high priority",
		Priority:  10,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	_, err = svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "medium priority",
		Priority:  5,
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	msgs, err := svc.Reserve(&models.ReserveRequest{
		QueueName: queueName,
		WorkerID:  "worker-1",
		Limit:     3,
	})
	if err != nil {
		t.Fatalf("Reserve failed: %v", err)
	}
	if len(msgs) != 3 {
		t.Fatalf("Expected 3 messages, got %d", len(msgs))
	}

	if msgs[0].Priority != 10 || msgs[1].Priority != 5 || msgs[2].Priority != 1 {
		t.Errorf("Messages should be ordered by priority descending: %d, %d, %d", msgs[0].Priority, msgs[1].Priority, msgs[2].Priority)
	}
}

func TestExport(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queueName := "test-export"

	_, err := svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "export test 1",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	_, err = svc.Enqueue(&models.EnqueueRequest{
		QueueName: queueName,
		Body:      "export test 2",
	})
	if err != nil {
		t.Fatalf("Enqueue failed: %v", err)
	}

	jsonData, err := svc.ExportJSON(queueName)
	if err != nil {
		t.Fatalf("ExportJSON failed: %v", err)
	}
	if len(jsonData) == 0 {
		t.Error("JSON export should not be empty")
	}

	csvData, err := svc.ExportCSV(queueName)
	if err != nil {
		t.Fatalf("ExportCSV failed: %v", err)
	}
	if len(csvData) == 0 {
		t.Error("CSV export should not be empty")
	}

	mdData, err := svc.ExportMarkdown(queueName)
	if err != nil {
		t.Fatalf("ExportMarkdown failed: %v", err)
	}
	if len(mdData) == 0 {
		t.Error("Markdown export should not be empty")
	}
}

func TestQueueManagement(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	queue, err := svc.CreateQueue(&models.CreateQueueRequest{
		Name:                    "managed-queue",
		Description:             "A managed queue",
		RetryStrategy:           "exponential",
		RetryDelaySeconds:       5,
		MaxDelaySeconds:         60,
		VisibilityTimeoutSeconds: 30,
	})
	if err != nil {
		t.Fatalf("CreateQueue failed: %v", err)
	}

	if queue.RetryStrategy != "exponential" {
		t.Errorf("Expected retry strategy exponential, got %s", queue.RetryStrategy)
	}

	queues, err := svc.ListQueues()
	if err != nil {
		t.Fatalf("ListQueues failed: %v", err)
	}
	if len(queues) == 0 {
		t.Error("ListQueues should return at least one queue")
	}

	q, err := svc.GetQueue("managed-queue")
	if err != nil {
		t.Fatalf("GetQueue failed: %v", err)
	}
	if q == nil {
		t.Error("GetQueue should return the queue")
	}

	_, err = svc.CreateQueue(&models.CreateQueueRequest{
		Name: "managed-queue",
	})
	if err == nil {
		t.Error("CreateQueue with duplicate name should fail")
	}
}

func TestGetNonExistentMessage(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	_, err := svc.GetMessage(999999)
	if err == nil {
		t.Error("GetMessage with non-existent ID should fail")
	}
}

func TestMessageNotFoundAck(t *testing.T) {
	store, cleanup := setupTestDB(t)
	defer cleanup()

	svc := NewMessageService(store)

	err := svc.Ack(&models.AckRequest{
		MessageID: 999999,
		WorkerID:  "worker-1",
	})
	if err == nil {
		t.Error("Ack with non-existent ID should fail")
	}
}
