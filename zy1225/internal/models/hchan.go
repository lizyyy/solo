package models

import (
	"fmt"
	"time"
)

type ChannelState int

const (
	ChannelStateActive ChannelState = iota
	ChannelStateClosed
	ChannelStateNil
)

func (s ChannelState) String() string {
	switch s {
	case ChannelStateActive:
		return "active"
	case ChannelStateClosed:
		return "closed"
	case ChannelStateNil:
		return "nil"
	default:
		return "unknown"
	}
}

type Hchan struct {
	ID           string
	ElementSize  int
	BufferSize   int
	State        ChannelState
	Buffer       []interface{}
	Sendq        []*Goroutine
	Recvq        []*Goroutine
	ClosedBy     string
	ClosedAt     time.Time
	CreatedAt    time.Time
	LastActivity time.Time
}

func NewHchan(id string, bufferSize int, elementSize int) *Hchan {
	now := time.Now()
	return &Hchan{
		ID:           id,
		ElementSize:  elementSize,
		BufferSize:   bufferSize,
		State:        ChannelStateActive,
		Buffer:       make([]interface{}, 0, bufferSize),
		Sendq:        make([]*Goroutine, 0),
		Recvq:        make([]*Goroutine, 0),
		CreatedAt:    now,
		LastActivity: now,
	}
}

func NewNilHchan(id string) *Hchan {
	return &Hchan{
		ID:           id,
		ElementSize:  0,
		BufferSize:   0,
		State:        ChannelStateNil,
		Buffer:       nil,
		Sendq:        nil,
		Recvq:        nil,
		CreatedAt:    time.Now(),
		LastActivity: time.Now(),
	}
}

func (h *Hchan) IsBuffered() bool {
	return h.BufferSize > 0
}

func (h *Hchan) IsUnbuffered() bool {
	return h.BufferSize == 0
}

func (h *Hchan) BufferLength() int {
	return len(h.Buffer)
}

func (h *Hchan) BufferCapacity() int {
	return h.BufferSize
}

func (h *Hchan) IsBufferFull() bool {
	return len(h.Buffer) >= h.BufferSize
}

func (h *Hchan) IsBufferEmpty() bool {
	return len(h.Buffer) == 0
}

func (h *Hchan) SendqLength() int {
	return len(h.Sendq)
}

func (h *Hchan) RecvqLength() int {
	return len(h.Recvq)
}

func (h *Hchan) HasWaitingSenders() bool {
	return len(h.Sendq) > 0
}

func (h *Hchan) HasWaitingReceivers() bool {
	return len(h.Recvq) > 0
}

func (h *Hchan) EnqueueSender(g *Goroutine) {
	h.Sendq = append(h.Sendq, g)
	h.LastActivity = time.Now()
}

func (h *Hchan) DequeueSender() *Goroutine {
	if len(h.Sendq) == 0 {
		return nil
	}
	g := h.Sendq[0]
	h.Sendq = h.Sendq[1:]
	h.LastActivity = time.Now()
	return g
}

func (h *Hchan) EnqueueReceiver(g *Goroutine) {
	h.Recvq = append(h.Recvq, g)
	h.LastActivity = time.Now()
}

func (h *Hchan) DequeueReceiver() *Goroutine {
	if len(h.Recvq) == 0 {
		return nil
	}
	g := h.Recvq[0]
	h.Recvq = h.Recvq[1:]
	h.LastActivity = time.Now()
	return g
}

func (h *Hchan) PushToBuffer(value interface{}) error {
	if h.State == ChannelStateClosed {
		return fmt.Errorf("send on closed channel")
	}
	if h.State == ChannelStateNil {
		return fmt.Errorf("send on nil channel")
	}
	if h.IsBufferFull() {
		return fmt.Errorf("buffer is full")
	}
	h.Buffer = append(h.Buffer, value)
	h.LastActivity = time.Now()
	return nil
}

func (h *Hchan) PopFromBuffer() (interface{}, error) {
	if h.State == ChannelStateNil {
		return nil, fmt.Errorf("receive on nil channel")
	}
	if h.IsBufferEmpty() {
		if h.State == ChannelStateClosed {
			return nil, nil
		}
		return nil, fmt.Errorf("buffer is empty")
	}
	value := h.Buffer[0]
	h.Buffer = h.Buffer[1:]
	h.LastActivity = time.Now()
	return value, nil
}

func (h *Hchan) Close(by string) error {
	if h.State == ChannelStateClosed {
		return fmt.Errorf("close of closed channel")
	}
	if h.State == ChannelStateNil {
		return fmt.Errorf("close of nil channel")
	}
	h.State = ChannelStateClosed
	h.ClosedBy = by
	h.ClosedAt = time.Now()
	h.LastActivity = time.Now()
	return nil
}

func (h *Hchan) Snapshot() *ChannelSnapshot {
	bufferCopy := make([]interface{}, len(h.Buffer))
	copy(bufferCopy, h.Buffer)

	sendqCopy := make([]*GoroutineSnapshot, len(h.Sendq))
	for i, g := range h.Sendq {
		sendqCopy[i] = g.Snapshot()
	}

	recvqCopy := make([]*GoroutineSnapshot, len(h.Recvq))
	for i, g := range h.Recvq {
		recvqCopy[i] = g.Snapshot()
	}

	return &ChannelSnapshot{
		ChannelID:    h.ID,
		State:        h.State.String(),
		BufferSize:   h.BufferSize,
		BufferLength: len(h.Buffer),
		Buffer:       bufferCopy,
		Sendq:        sendqCopy,
		Recvq:        recvqCopy,
		SendqLength:  len(h.Sendq),
		RecvqLength:  len(h.Recvq),
		Timestamp:    time.Now(),
	}
}

type ChannelSnapshot struct {
	ChannelID    string
	State        string
	BufferSize   int
	BufferLength int
	Buffer       []interface{}
	Sendq        []*GoroutineSnapshot
	Recvq        []*GoroutineSnapshot
	SendqLength  int
	RecvqLength  int
	Timestamp    time.Time
}

type Goroutine struct {
	ID        string
	Name      string
	State     GoroutineState
	WaitingOn string
	Since     time.Time
	Stack     string
}

type GoroutineState int

const (
	GoroutineStateRunning GoroutineState = iota
	GoroutineStateWaiting
	GoroutineStateBlocked
	GoroutineStateFinished
)

func (s GoroutineState) String() string {
	switch s {
	case GoroutineStateRunning:
		return "running"
	case GoroutineStateWaiting:
		return "waiting"
	case GoroutineStateBlocked:
		return "blocked"
	case GoroutineStateFinished:
		return "finished"
	default:
		return "unknown"
	}
}

func NewGoroutine(id, name string) *Goroutine {
	return &Goroutine{
		ID:    id,
		Name:  name,
		State: GoroutineStateRunning,
		Since: time.Now(),
	}
}

func (g *Goroutine) Block(channelID string) {
	g.State = GoroutineStateBlocked
	g.WaitingOn = channelID
	g.Since = time.Now()
}

func (g *Goroutine) Unblock() {
	g.State = GoroutineStateRunning
	g.WaitingOn = ""
	g.Since = time.Now()
}

func (g *Goroutine) Snapshot() *GoroutineSnapshot {
	return &GoroutineSnapshot{
		ID:        g.ID,
		Name:      g.Name,
		State:     g.State.String(),
		WaitingOn: g.WaitingOn,
		Since:     g.Since,
	}
}

type GoroutineSnapshot struct {
	ID        string
	Name      string
	State     string
	WaitingOn string
	Since     time.Time
}
