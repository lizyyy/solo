package models

import (
	"testing"
)

func TestNewHchan(t *testing.T) {
	ch := NewHchan("test-ch", 5, 8)

	if ch.ID != "test-ch" {
		t.Errorf("Expected channel ID 'test-ch', got '%s'", ch.ID)
	}
	if ch.BufferSize != 5 {
		t.Errorf("Expected buffer size 5, got %d", ch.BufferSize)
	}
	if ch.State != ChannelStateActive {
		t.Errorf("Expected state active, got %s", ch.State)
	}
	if !ch.IsBuffered() {
		t.Error("Expected buffered channel")
	}
}

func TestNewNilHchan(t *testing.T) {
	ch := NewNilHchan("nil-ch")

	if ch.ID != "nil-ch" {
		t.Errorf("Expected channel ID 'nil-ch', got '%s'", ch.ID)
	}
	if ch.State != ChannelStateNil {
		t.Errorf("Expected state nil, got %s", ch.State)
	}
}

func TestUnbufferedChannel(t *testing.T) {
	ch := NewHchan("unbuf-ch", 0, 8)

	if !ch.IsUnbuffered() {
		t.Error("Expected unbuffered channel")
	}
	if ch.IsBuffered() {
		t.Error("Expected non-buffered channel")
	}
}

func TestChannelBufferOperations(t *testing.T) {
	ch := NewHchan("buf-ch", 2, 8)

	if err := ch.PushToBuffer(1); err != nil {
		t.Errorf("Failed to push to buffer: %v", err)
	}
	if ch.BufferLength() != 1 {
		t.Errorf("Expected buffer length 1, got %d", ch.BufferLength())
	}

	if err := ch.PushToBuffer(2); err != nil {
		t.Errorf("Failed to push to buffer: %v", err)
	}
	if ch.BufferLength() != 2 {
		t.Errorf("Expected buffer length 2, got %d", ch.BufferLength())
	}
	if !ch.IsBufferFull() {
		t.Error("Expected buffer to be full")
	}

	if err := ch.PushToBuffer(3); err == nil {
		t.Error("Expected error when pushing to full buffer")
	}

	val, err := ch.PopFromBuffer()
	if err != nil {
		t.Errorf("Failed to pop from buffer: %v", err)
	}
	if val != 1 {
		t.Errorf("Expected value 1, got %v", val)
	}
	if ch.BufferLength() != 1 {
		t.Errorf("Expected buffer length 1, got %d", ch.BufferLength())
	}
}

func TestChannelSendqOperations(t *testing.T) {
	ch := NewHchan("test-ch", 0, 8)

	g1 := NewGoroutine("g1", "sender-1")
	g2 := NewGoroutine("g2", "sender-2")

	if ch.HasWaitingSenders() {
		t.Error("Expected no waiting senders")
	}

	ch.EnqueueSender(g1)
	if ch.SendqLength() != 1 {
		t.Errorf("Expected sendq length 1, got %d", ch.SendqLength())
	}
	if !ch.HasWaitingSenders() {
		t.Error("Expected waiting senders")
	}

	ch.EnqueueSender(g2)
	if ch.SendqLength() != 2 {
		t.Errorf("Expected sendq length 2, got %d", ch.SendqLength())
	}

	dequeued := ch.DequeueSender()
	if dequeued != g1 {
		t.Error("Expected FIFO order for sendq")
	}
	if ch.SendqLength() != 1 {
		t.Errorf("Expected sendq length 1, got %d", ch.SendqLength())
	}

	dequeued = ch.DequeueSender()
	if dequeued != g2 {
		t.Error("Expected second sender")
	}

	dequeued = ch.DequeueSender()
	if dequeued != nil {
		t.Error("Expected nil from empty queue")
	}
}

func TestChannelRecvqOperations(t *testing.T) {
	ch := NewHchan("test-ch", 0, 8)

	g1 := NewGoroutine("g1", "receiver-1")
	g2 := NewGoroutine("g2", "receiver-2")

	if ch.HasWaitingReceivers() {
		t.Error("Expected no waiting receivers")
	}

	ch.EnqueueReceiver(g1)
	if ch.RecvqLength() != 1 {
		t.Errorf("Expected recvq length 1, got %d", ch.RecvqLength())
	}
	if !ch.HasWaitingReceivers() {
		t.Error("Expected waiting receivers")
	}

	ch.EnqueueReceiver(g2)
	if ch.RecvqLength() != 2 {
		t.Errorf("Expected recvq length 2, got %d", ch.RecvqLength())
	}

	dequeued := ch.DequeueReceiver()
	if dequeued != g1 {
		t.Error("Expected FIFO order for recvq")
	}
	if ch.RecvqLength() != 1 {
		t.Errorf("Expected recvq length 1, got %d", ch.RecvqLength())
	}
}

func TestChannelClose(t *testing.T) {
	ch := NewHchan("test-ch", 2, 8)
	g := NewGoroutine("g1", "sender")
	g2 := NewGoroutine("g2", "receiver")

	ch.EnqueueSender(g)
	ch.EnqueueReceiver(g2)

	if err := ch.Close("g1"); err != nil {
		t.Errorf("Failed to close channel: %v", err)
	}

	if ch.State != ChannelStateClosed {
		t.Error("Expected channel state closed")
	}
	if ch.SendqLength() != 0 {
		t.Errorf("Expected sendq to be empty after close, got %d", ch.SendqLength())
	}
	if ch.RecvqLength() != 0 {
		t.Errorf("Expected recvq to be empty after close, got %d", ch.RecvqLength())
	}

	if err := ch.Close("g1"); err == nil {
		t.Error("Expected error when closing already closed channel")
	}
}

func TestNilChannelOperations(t *testing.T) {
	ch := NewNilHchan("nil-ch")

	if err := ch.PushToBuffer(1); err == nil {
		t.Error("Expected error when pushing to nil channel")
	}

	if _, err := ch.PopFromBuffer(); err == nil {
		t.Error("Expected error when popping from nil channel")
	}

	if err := ch.Close("g1"); err == nil {
		t.Error("Expected error when closing nil channel")
	}
}

func TestClosedChannelSend(t *testing.T) {
	ch := NewHchan("test-ch", 2, 8)
	ch.Close("g1")

	if err := ch.PushToBuffer(1); err == nil {
		t.Error("Expected error when sending on closed channel")
	}
}

func TestClosedChannelRecv(t *testing.T) {
	ch := NewHchan("test-ch", 2, 8)
	ch.PushToBuffer(1)
	ch.PushToBuffer(2)
	ch.Close("g1")

	val, err := ch.PopFromBuffer()
	if err != nil {
		t.Errorf("Failed to pop from closed channel with data: %v", err)
	}
	if val != 1 {
		t.Errorf("Expected value 1, got %v", val)
	}

	val, err = ch.PopFromBuffer()
	if err != nil {
		t.Errorf("Failed to pop from closed channel with data: %v", err)
	}
	if val != 2 {
		t.Errorf("Expected value 2, got %v", val)
	}

	val, err = ch.PopFromBuffer()
	if err != nil {
		t.Errorf("Expected no error when popping from empty closed channel: %v", err)
	}
	if val != nil {
		t.Errorf("Expected nil value from empty closed channel, got %v", val)
	}
}

func TestGoroutineBlockUnblock(t *testing.T) {
	g := NewGoroutine("g1", "test-goroutine")

	if g.State != GoroutineStateRunning {
		t.Error("Expected goroutine state running")
	}

	g.Block("ch1")
	if g.State != GoroutineStateBlocked {
		t.Error("Expected goroutine state blocked")
	}
	if g.WaitingOn != "ch1" {
		t.Errorf("Expected waiting on ch1, got %s", g.WaitingOn)
	}

	g.Unblock()
	if g.State != GoroutineStateRunning {
		t.Error("Expected goroutine state running after unblock")
	}
	if g.WaitingOn != "" {
		t.Error("Expected waitingOn to be empty after unblock")
	}
}

func TestChannelSnapshot(t *testing.T) {
	ch := NewHchan("snapshot-ch", 3, 8)
	g1 := NewGoroutine("g1", "sender")
	g2 := NewGoroutine("g2", "receiver")

	ch.PushToBuffer(1)
	ch.PushToBuffer(2)
	ch.EnqueueSender(g1)
	ch.EnqueueReceiver(g2)

	snapshot := ch.Snapshot()

	if snapshot.ChannelID != "snapshot-ch" {
		t.Errorf("Expected channel ID 'snapshot-ch', got '%s'", snapshot.ChannelID)
	}
	if snapshot.State != "active" {
		t.Errorf("Expected state 'active', got '%s'", snapshot.State)
	}
	if snapshot.BufferLength != 2 {
		t.Errorf("Expected buffer length 2, got %d", snapshot.BufferLength)
	}
	if snapshot.SendqLength != 1 {
		t.Errorf("Expected sendq length 1, got %d", snapshot.SendqLength)
	}
	if snapshot.RecvqLength != 1 {
		t.Errorf("Expected recvq length 1, got %d", snapshot.RecvqLength)
	}
}
