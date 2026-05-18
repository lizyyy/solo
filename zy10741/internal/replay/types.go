package replay

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type ErrorType string

const (
	ErrorTypePartialSuccess ErrorType = "partial_success"
	ErrorTypePrimaryKey     ErrorType = "primary_key_conflict"
	ErrorTypeOrderDependency ErrorType = "order_dependency"
	ErrorTypeUnknown        ErrorType = "unknown"
)

type LogEntry struct {
	ID         string    `json:"id"`
	FileName   string    `json:"file_name"`
	LineNumber int       `json:"line_number"`
	Content    string    `json:"content"`
	ErrorType  ErrorType `json:"error_type"`
	PrimaryKey string    `json:"primary_key,omitempty"`
	RetryCount int       `json:"retry_count"`
	Processed  bool      `json:"processed"`
	Success    bool      `json:"success"`
}

type BatchPlan struct {
	BatchID       string     `json:"batch_id"`
	InputHash     string     `json:"input_hash"`
	CreatedAt     time.Time  `json:"created_at"`
	Status        string     `json:"status"`
	TotalEntries  int        `json:"total_entries"`
	Processed     int        `json:"processed"`
	SuccessCount  int        `json:"success_count"`
	FailedCount   int        `json:"failed_count"`
	Entries       []LogEntry `json:"entries"`
	PartialSuccess []LogEntry `json:"partial_success_entries"`
	PrimaryKeyConflict []LogEntry `json:"primary_key_conflict_entries"`
	OrderDependency []LogEntry `json:"order_dependency_entries"`
	ReplayOrder   []string   `json:"replay_order"`
	mu            sync.Mutex `json:"-"`
}

type StateManager struct {
	stateDir string
}

func NewStateManager(stateDir string) *StateManager {
	os.MkdirAll(stateDir, 0755)
	return &StateManager{stateDir: stateDir}
}

func (sm *StateManager) ComputeInputHash(inputFiles []string) string {
	h := sha256.New()
	sort.Strings(inputFiles)
	for _, f := range inputFiles {
		h.Write([]byte(f))
		content, _ := os.ReadFile(f)
		h.Write(content)
	}
	return hex.EncodeToString(h.Sum(nil))
}

func (sm *StateManager) GetExistingPlan(inputHash string) (*BatchPlan, error) {
	stateFile := filepath.Join(sm.stateDir, inputHash+".json")
	data, err := os.ReadFile(stateFile)
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var plan BatchPlan
	err = json.Unmarshal(data, &plan)
	return &plan, err
}

func (sm *StateManager) SavePlan(plan *BatchPlan) error {
	plan.mu.Lock()
	defer plan.mu.Unlock()
	stateFile := filepath.Join(sm.stateDir, plan.InputHash+".json")
	data, err := json.MarshalIndent(plan, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(stateFile, data, 0644)
}

func NewBatchPlan(inputHash string, entries []LogEntry) *BatchPlan {
	return &BatchPlan{
		BatchID:       generateBatchID(),
		InputHash:     inputHash,
		CreatedAt:     time.Now(),
		Status:        "pending",
		TotalEntries:  len(entries),
		Entries:       entries,
		PartialSuccess: make([]LogEntry, 0),
		PrimaryKeyConflict: make([]LogEntry, 0),
		OrderDependency: make([]LogEntry, 0),
		ReplayOrder:   make([]string, 0),
	}
}

func generateBatchID() string {
	now := time.Now()
	return fmt.Sprintf("REPLAY-%s-%04d%02d%02d-%06d",
		"SYNC",
		now.Year(), now.Month(), now.Day(),
		now.Unix()%1000000)
}

func (bp *BatchPlan) AddToReplayOrder(entryID string) {
	bp.mu.Lock()
	defer bp.mu.Unlock()
	for _, id := range bp.ReplayOrder {
		if id == entryID {
			return
		}
	}
	bp.ReplayOrder = append(bp.ReplayOrder, entryID)
}

func (bp *BatchPlan) ClassifyEntry(entry LogEntry) {
	bp.mu.Lock()
	defer bp.mu.Unlock()
	switch entry.ErrorType {
	case ErrorTypePartialSuccess:
		bp.PartialSuccess = append(bp.PartialSuccess, entry)
	case ErrorTypePrimaryKey:
		bp.PrimaryKeyConflict = append(bp.PrimaryKeyConflict, entry)
	case ErrorTypeOrderDependency:
		bp.OrderDependency = append(bp.OrderDependency, entry)
	}
}
