package models

import (
	"encoding/json"
	"fmt"
	"time"
)

type EventType string

const (
	EventTypeChannelCreate EventType = "channel_create"
	EventTypeSend          EventType = "send"
	EventTypeRecv          EventType = "recv"
	EventTypeClose         EventType = "close"
	EventTypeSelect        EventType = "select"
	EventTypeTimeout       EventType = "timeout"
	EventTypeGoroutineStart EventType = "goroutine_start"
	EventTypeGoroutineEnd  EventType = "goroutine_end"
	EventTypeDeadlock      EventType = "deadlock"
	EventTypeBlock         EventType = "block"
	EventTypeUnblock       EventType = "unblock"
)

type Event struct {
	ID        string          `json:"id"`
	Type      EventType       `json:"type"`
	Timestamp time.Time       `json:"timestamp"`
	ChannelID string          `json:"channel_id,omitempty"`
	Goroutine string          `json:"goroutine,omitempty"`
	Value     interface{}     `json:"value,omitempty"`
	Metadata  EventMetadata   `json:"metadata,omitempty"`
	Raw       json.RawMessage `json:"-"`
}

type EventMetadata struct {
	BufferSize   int                    `json:"buffer_size,omitempty"`
	IsBuffered   bool                   `json:"is_buffered,omitempty"`
	SelectCases  []SelectCase           `json:"select_cases,omitempty"`
	SelectedCase int                    `json:"selected_case,omitempty"`
	Timeout      time.Duration          `json:"timeout,omitempty"`
	DefaultCase  bool                   `json:"default_case,omitempty"`
	BlockReason  string                 `json:"block_reason,omitempty"`
	Extra        map[string]interface{} `json:"extra,omitempty"`
}

type SelectCase struct {
	Index       int         `json:"index"`
	Type        string      `json:"type"`
	ChannelID   string      `json:"channel_id,omitempty"`
	Value       interface{} `json:"value,omitempty"`
	IsDefault   bool        `json:"is_default,omitempty"`
	Description string      `json:"description,omitempty"`
}

func NewEvent(eventType EventType) *Event {
	return &Event{
		ID:        generateEventID(),
		Type:      eventType,
		Timestamp: time.Now(),
		Metadata:  EventMetadata{},
	}
}

func generateEventID() string {
	return fmt.Sprintf("evt_%d", time.Now().UnixNano())
}

func (e *Event) WithChannel(channelID string) *Event {
	e.ChannelID = channelID
	return e
}

func (e *Event) WithGoroutine(goroutine string) *Event {
	e.Goroutine = goroutine
	return e
}

func (e *Event) WithValue(value interface{}) *Event {
	e.Value = value
	return e
}

func (e *Event) WithMetadata(meta EventMetadata) *Event {
	e.Metadata = meta
	return e
}

func (e *Event) ToJSON() (string, error) {
	data, err := json.MarshalIndent(e, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (e *Event) FromJSON(data []byte) error {
	return json.Unmarshal(data, e)
}

type EventSequence struct {
	Events     []*Event
	CurrentIdx int
}

func NewEventSequence() *EventSequence {
	return &EventSequence{
		Events:     make([]*Event, 0),
		CurrentIdx: -1,
	}
}

func (es *EventSequence) Add(event *Event) {
	es.Events = append(es.Events, event)
}

func (es *EventSequence) Next() (*Event, bool) {
	if es.CurrentIdx >= len(es.Events)-1 {
		return nil, false
	}
	es.CurrentIdx++
	return es.Events[es.CurrentIdx], true
}

func (es *EventSequence) Prev() (*Event, bool) {
	if es.CurrentIdx <= 0 {
		return nil, false
	}
	es.CurrentIdx--
	return es.Events[es.CurrentIdx], true
}

func (es *EventSequence) Reset() {
	es.CurrentIdx = -1
}

func (es *EventSequence) Length() int {
	return len(es.Events)
}

func (es *EventSequence) Current() *Event {
	if es.CurrentIdx < 0 || es.CurrentIdx >= len(es.Events) {
		return nil
	}
	return es.Events[es.CurrentIdx]
}

type Timeline struct {
	StartAt    time.Time
	EndAt      time.Time
	Events     []*Event
	Snapshots  []*ChannelSnapshot
	Channels   map[string]*Hchan
	Goroutines map[string]*Goroutine
}

func NewTimeline() *Timeline {
	return &Timeline{
		Events:     make([]*Event, 0),
		Snapshots:  make([]*ChannelSnapshot, 0),
		Channels:   make(map[string]*Hchan),
		Goroutines: make(map[string]*Goroutine),
	}
}

func (t *Timeline) AddEvent(event *Event) {
	t.Events = append(t.Events, event)
	if t.StartAt.IsZero() || event.Timestamp.Before(t.StartAt) {
		t.StartAt = event.Timestamp
	}
	if t.EndAt.IsZero() || event.Timestamp.After(t.EndAt) {
		t.EndAt = event.Timestamp
	}
}

func (t *Timeline) AddSnapshot(snapshot *ChannelSnapshot) {
	t.Snapshots = append(t.Snapshots, snapshot)
}

func (t *Timeline) GetChannel(id string) *Hchan {
	return t.Channels[id]
}

func (t *Timeline) AddChannel(ch *Hchan) {
	t.Channels[ch.ID] = ch
}

func (t *Timeline) GetGoroutine(id string) *Goroutine {
	return t.Goroutines[id]
}

func (t *Timeline) AddGoroutine(g *Goroutine) {
	t.Goroutines[g.ID] = g
}

func (t *Timeline) Duration() time.Duration {
	if t.StartAt.IsZero() || t.EndAt.IsZero() {
		return 0
	}
	return t.EndAt.Sub(t.StartAt)
}
