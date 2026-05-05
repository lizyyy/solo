package types

import (
	"encoding/json"
	"fmt"
	"time"
)

const (
	BucketSize       = 8
	MaxAvgLoadFactor = 6.5
	MinLoadFactor    = 4.0
	MinBucketCount   = 1
)

type Hash uint64

type TopHash [8]uint8

type Key interface{}
type Value interface{}

type KeyValue struct {
	Key   Key
	Value Value
	Hash  Hash
	Index int
}

type Bucket struct {
	ID         int
	IsOld      bool
	TopHash    TopHash
	Keys       []KeyValue
	Next       *Bucket
	OverflowID int
}

type HMap struct {
	Count     int
	Flags     uint8
	B         uint8
	NoHash    uint8
	Hash0     uint32
	Buckets   []*Bucket
	OldBuckets []*Bucket
	EvacCount uintptr
	EvacDone  uintptr
}

type Operation struct {
	Type      OpType          `json:"type"`
	Key       string          `json:"key"`
	Value     string          `json:"value,omitempty"`
	Seed      int64           `json:"seed,omitempty"`
	Timestamp time.Time       `json:"timestamp,omitempty"`
	Raw       json.RawMessage `json:"-"`
}

type OpType string

const (
	OpPut    OpType = "put"
	OpGet    OpType = "get"
	OpDelete OpType = "delete"
	OpRange  OpType = "range"
	OpLen    OpType = "len"
)

type StepResult struct {
	StepIndex       int
	Op              Operation
	MapState        MapSnapshot
	LookupCost      LookupMetrics
	RiskAlerts      []RiskAlert
	BucketDist      BucketDistribution
	ExpandTriggered bool
	ExpandPhase     string
}

type MapSnapshot struct {
	Count           int
	B               int
	BucketCount     int
	OldBucketCount  int
	LoadFactor      float64
	OverflowCount   int
	AvgChainLength  float64
	MaxChainLength  int
	EvacProgress    float64
	Timestamp       time.Time
}

type LookupMetrics struct {
	HashTime        int64
	TopHashCompare  int
	KeyCompare      int
	BucketProbe     int
	OverflowWalk    int
	TotalOps        int
	Found           bool
	CostScore       float64
}

type RiskAlert struct {
	Level       RiskLevel
	Category    RiskCategory
	Message     string
	Suggestion  string
	AffectedKey string
}

type RiskLevel string
type RiskCategory string

const (
	RiskInfo    RiskLevel = "info"
	RiskWarning RiskLevel = "warning"
	RiskError   RiskLevel = "error"
)

const (
	RiskHashCollision   RiskCategory = "hash_collision"
	RiskLongChain       RiskCategory = "long_chain"
	RiskLoadFactor      RiskCategory = "load_factor"
	RiskConcurrentWrite RiskCategory = "concurrent_write"
	RiskDeleteTombstone RiskCategory = "delete_tombstone"
	RiskIterationOrder  RiskCategory = "iteration_order"
	RiskExpandStall     RiskCategory = "expand_stall"
)

type BucketDistribution struct {
	TotalBuckets      int
	UsedBuckets       int
	EmptyBuckets      int
	BucketsByCount    map[int]int
	OverflowBuckets   int
	OverflowByDepth   map[int]int
}

type Session struct {
	ID        string
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
	Seed      int64
	CaseID    string
	OpCount   int
	StepCount int
}

type CaseConfig struct {
	ID          string            `yaml:"id"`
	Name        string            `yaml:"name"`
	Description string            `yaml:"description"`
	Seed        int64             `yaml:"seed"`
	MapType     string            `yaml:"map_type"`
	InitialSize int               `yaml:"initial_size"`
	Settings    map[string]string `yaml:"settings"`
	Tags        []string          `yaml:"tags"`
}

func (h Hash) TopHash() uint8 {
	return uint8((h >> 56) & 0xff)
}

func (h Hash) LowHash(b uint8) uint64 {
	mask := uint64((1 << b) - 1)
	return uint64(h) & mask
}

func (b *Bucket) HasEmptySlot() bool {
	for i := 0; i < BucketSize; i++ {
		if b.TopHash[i] == 0 || b.TopHash[i] == 1 {
			return true
		}
	}
	return false
}

func (b *Bucket) FindSlot(tophash uint8, key Key) (int, bool) {
	for i := 0; i < BucketSize; i++ {
		if b.TopHash[i] == tophash {
			if i < len(b.Keys) && b.Keys[i].Key == key {
				return i, true
			}
		}
	}
	return -1, false
}

func (b *Bucket) ChainLength() int {
	length := 1
	current := b.Next
	for current != nil {
		length++
		current = current.Next
	}
	return length
}

func (m *HMap) BucketCount() int {
	return 1 << m.B
}

func (m *HMap) OldBucketCount() int {
	if m.OldBuckets == nil {
		return 0
	}
	return 1 << (m.B - 1)
}

func (m *HMap) LoadFactor() float64 {
	if m.BucketCount() == 0 {
		return 0
	}
	return float64(m.Count) / float64(m.BucketCount())
}

func (m *HMap) IsExpanding() bool {
	return m.OldBuckets != nil
}

func (m *HMap) NeedsExpand() bool {
	return m.LoadFactor() > MaxAvgLoadFactor || m.HasTooManyOverflow()
}

func (m *HMap) HasTooManyOverflow() bool {
	overflowCount := 0
	for _, b := range m.Buckets {
		if b != nil {
			chain := b.ChainLength()
			if chain > 1 {
				overflowCount += chain - 1
			}
		}
	}
	return overflowCount >= m.BucketCount() && m.Count > 4*m.BucketCount()
}

func (m *HMap) EvacuationProgress() float64 {
	if !m.IsExpanding() {
		return 1.0
	}
	oldCount := m.OldBucketCount()
	if oldCount == 0 {
		return 1.0
	}
	evacuated := int(m.EvacDone)
	return float64(evacuated) / float64(oldCount)
}

func (d *BucketDistribution) String() string {
	return fmt.Sprintf("Buckets: %d/%d used, Overflow: %d chains",
		d.UsedBuckets, d.TotalBuckets, d.OverflowBuckets)
}

func (s *MapSnapshot) String() string {
	return fmt.Sprintf("Count=%d, B=%d, LoadFactor=%.2f, Overflow=%d, Evac=%.1f%%",
		s.Count, s.B, s.LoadFactor, s.OverflowCount, s.EvacProgress*100)
}

func (a *RiskAlert) String() string {
	return fmt.Sprintf("[%s] %s: %s", a.Level, a.Category, a.Message)
}
