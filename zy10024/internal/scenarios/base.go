package scenarios

import (
	"sync"
	"time"

	"chaos-simulator/pkg/models"
)

type BaseScenario struct {
	name       string
	scenarioType models.ScenarioType
	mu         sync.RWMutex
	status     models.ScenarioStatus
	events     []models.Event
	stopCh     chan struct{}
}

func NewBaseScenario(name string, scenarioType models.ScenarioType) *BaseScenario {
	return &BaseScenario{
		name:       name,
		scenarioType: scenarioType,
		status:     models.StatusReady,
		events:     make([]models.Event, 0),
		stopCh:     make(chan struct{}),
	}
}

func (b *BaseScenario) Name() string {
	return b.name
}

func (b *BaseScenario) Type() models.ScenarioType {
	return b.scenarioType
}

func (b *BaseScenario) Status() models.ScenarioStatus {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.status
}

func (b *BaseScenario) SetStatus(status models.ScenarioStatus) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.status = status
}

func (b *BaseScenario) AddEvent(event models.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events = append(b.events, event)
}

func (b *BaseScenario) GetEvents() []models.Event {
	b.mu.RLock()
	defer b.mu.RUnlock()
	result := make([]models.Event, len(b.events))
	copy(result, b.events)
	return result
}

func (b *BaseScenario) StopChannel() chan struct{} {
	return b.stopCh
}

func (b *BaseScenario) ResetStopChannel() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.stopCh = make(chan struct{})
}

func (b *BaseScenario) ClearEvents() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.events = make([]models.Event, 0)
}

func generateEventID() string {
	return time.Now().Format("20060102150405.000000")
}

func newEvent(scenario string, level models.EventLevel, message string, data map[string]interface{}) models.Event {
	return models.Event{
		ID:        generateEventID(),
		Timestamp: time.Now(),
		Scenario:  scenario,
		Level:     level,
		Message:   message,
		Data:      data,
	}
}
