package model

import (
	"time"
)

type ChannelType string

const (
	ChannelTypeSendOnly      ChannelType = "send_only"
	ChannelTypeRecvOnly      ChannelType = "recv_only"
	ChannelTypeBidirectional ChannelType = "bidirectional"
)

type ChannelState string

const (
	ChannelStateActive   ChannelState = "active"
	ChannelStateClosed   ChannelState = "closed"
	ChannelStateBlocked  ChannelState = "blocked"
	ChannelStateDraining ChannelState = "draining"
)

type GoroutineState string

const (
	GoroutineStateNew       GoroutineState = "new"
	GoroutineStateRunning   GoroutineState = "running"
	GoroutineStateBlocked   GoroutineState = "blocked"
	GoroutineStateWaiting   GoroutineState = "waiting"
	GoroutineStateCompleted GoroutineState = "completed"
	GoroutineStatePanicked  GoroutineState = "panicked"
)

type OperationType string

const (
	OperationSend    OperationType = "send"
	OperationRecv    OperationType = "recv"
	OperationClose   OperationType = "close"
	OperationSelect  OperationType = "select"
	OperationRange   OperationType = "range"
	OperationTimeout OperationType = "timeout"
)

type Message struct {
	ID        string
	Payload   interface{}
	Producer  string
	Timestamp time.Time
	Attempt   int
}

func NewMessage(id string, payload interface{}, producer string) *Message {
	return &Message{
		ID:        id,
		Payload:   payload,
		Producer:  producer,
		Timestamp: time.Now(),
		Attempt:   1,
	}
}

type ChannelInfo struct {
	ID          string
	Name        string
	Type        ChannelType
	State       ChannelState
	Capacity    int
	Length      int
	Buffer      []interface{}
	CreatedAt   time.Time
	LastOpAt    time.Time
	ClosedAt    time.Time
	SendCount   int64
	RecvCount   int64
	BlockedSends int
	BlockedRecvs int
}

func (c *ChannelInfo) UpdateLength(l int) {
	c.Length = l
	c.LastOpAt = time.Now()
}

func (c *ChannelInfo) RecordSend() {
	c.SendCount++
	c.LastOpAt = time.Now()
}

func (c *ChannelInfo) RecordRecv() {
	c.RecvCount++
	c.LastOpAt = time.Now()
}

func (c *ChannelInfo) Close() {
	c.State = ChannelStateClosed
	c.ClosedAt = time.Now()
}

type GoroutineInfo struct {
	ID            string
	Name          string
	Role          string
	State         GoroutineState
	CreatedAt     time.Time
	StartedAt     time.Time
	CompletedAt   time.Time
	LastHeartbeat time.Time
	CurrentOp     *OperationInfo
	WaitChannels  []string
	HoldChannels  []string
	Stack         string
	ErrorMessage  string
}

func NewGoroutineInfo(name, role string) *GoroutineInfo {
	return &GoroutineInfo{
		ID:            generateID(),
		Name:          name,
		Role:          role,
		State:         GoroutineStateNew,
		CreatedAt:     time.Now(),
		LastHeartbeat: time.Now(),
		WaitChannels:  make([]string, 0),
		HoldChannels:  make([]string, 0),
	}
}

func (g *GoroutineInfo) UpdateState(state GoroutineState) {
	g.State = state
	g.LastHeartbeat = time.Now()

	if state == GoroutineStateRunning && g.StartedAt.IsZero() {
		g.StartedAt = time.Now()
	}

	if state == GoroutineStateCompleted {
		g.CompletedAt = time.Now()
	}
}

func (g *GoroutineInfo) RecordOp(op *OperationInfo) {
	g.CurrentOp = op
	g.LastHeartbeat = time.Now()
}

func (g *GoroutineInfo) AddWaitChannel(chID string) {
	for _, id := range g.WaitChannels {
		if id == chID {
			return
		}
	}
	g.WaitChannels = append(g.WaitChannels, chID)
}

func (g *GoroutineInfo) RemoveWaitChannel(chID string) {
	for i, id := range g.WaitChannels {
		if id == chID {
			g.WaitChannels = append(g.WaitChannels[:i], g.WaitChannels[i+1:]...)
			return
		}
	}
}

func (g *GoroutineInfo) AddHoldChannel(chID string) {
	for _, id := range g.HoldChannels {
		if id == chID {
			return
		}
	}
	g.HoldChannels = append(g.HoldChannels, chID)
}

func (g *GoroutineInfo) RemoveHoldChannel(chID string) {
	for i, id := range g.HoldChannels {
		if id == chID {
			g.HoldChannels = append(g.HoldChannels[:i], g.HoldChannels[i+1:]...)
			return
		}
	}
}

type OperationInfo struct {
	ID          string
	Type        OperationType
	ChannelID   string
	GoroutineID string
	StartedAt   time.Time
	CompletedAt time.Time
	Blocked     bool
	BlockedAt   time.Time
	Timeout     time.Duration
	Result      string
	ErrorMessage string
}

func NewOperationInfo(opType OperationType, chID, gID string, timeout time.Duration) *OperationInfo {
	return &OperationInfo{
		ID:          generateID(),
		Type:        opType,
		ChannelID:   chID,
		GoroutineID: gID,
		StartedAt:   time.Now(),
		Timeout:     timeout,
		Blocked:     false,
	}
}

func (o *OperationInfo) MarkBlocked() {
	o.Blocked = true
	o.BlockedAt = time.Now()
}

func (o *OperationInfo) Complete(result string) {
	o.CompletedAt = time.Now()
	o.Result = result
	o.Blocked = false
}

func (o *OperationInfo) Fail(err string) {
	o.CompletedAt = time.Now()
	o.ErrorMessage = err
	o.Blocked = false
}

func (o *OperationInfo) Duration() time.Duration {
	if o.CompletedAt.IsZero() {
		return time.Since(o.StartedAt)
	}
	return o.CompletedAt.Sub(o.StartedAt)
}

func (o *OperationInfo) IsTimeout() bool {
	if o.Timeout <= 0 {
		return false
	}
	return o.Duration() > o.Timeout
}

type DeadlockInfo struct {
	ID             string
	DetectedAt     time.Time
	Goroutines     []*GoroutineInfo
	Channels       []*ChannelInfo
	WaitGraph      map[string][]string
	Reason         string
	Severity       string
	Resolved       bool
	ResolvedAt     time.Time
	ResolutionType string
}

func NewDeadlockInfo(goroutines []*GoroutineInfo, channels []*ChannelInfo, reason string) *DeadlockInfo {
	info := &DeadlockInfo{
		ID:         generateID(),
		DetectedAt: time.Now(),
		Goroutines: goroutines,
		Channels:   channels,
		Reason:     reason,
		Severity:   "critical",
		Resolved:   false,
	}

	info.buildWaitGraph()
	return info
}

func (d *DeadlockInfo) buildWaitGraph() {
	d.WaitGraph = make(map[string][]string)

	for _, g := range d.Goroutines {
		d.WaitGraph[g.ID] = g.WaitChannels
	}
}

func (d *DeadlockInfo) MarkResolved(resolutionType string) {
	d.Resolved = true
	d.ResolvedAt = time.Now()
	d.ResolutionType = resolutionType
}

type LogEntry struct {
	ID        string
	Timestamp time.Time
	Level     string
	Component string
	Message   string
	Data      map[string]interface{}
}

type LogSummary struct {
	TotalEntries   int64
	ErrorCount     int64
	WarningCount   int64
	InfoCount      int64
	DebugCount     int64
	StartTime      time.Time
	EndTime        time.Time
}

type SystemInfo struct {
	GoVersion string
	Platform  string
	NumCPU    int
	NumGoroutine int
}

type Report struct {
	GeneratedAt        time.Time
	SystemInfo         SystemInfo
	DeadlockDetections []*DeadlockInfo
	LogSummary         *LogSummary
	ReplayCapable      bool
	Recommendations    []string
}
