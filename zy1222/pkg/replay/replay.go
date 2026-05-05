package replay

import (
	"bufio"
	"encoding/json"
	"fmt"
	"mapdebug/pkg/mapmodel"
	"mapdebug/pkg/types"
	"math/rand"
	"os"
	"time"
)

type Replayer struct {
	simulator *mapmodel.MapSimulator
	steps     []types.StepResult
	seed      int64
}

func NewReplayer(seed int64, initialB uint8) *Replayer {
	return &Replayer{
		simulator: mapmodel.NewMapSimulator(seed, initialB),
		steps:     make([]types.StepResult, 0),
		seed:      seed,
	}
}

func (r *Replayer) LoadOperations(filepath string) ([]types.Operation, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to open ops file: %w", err)
	}
	defer file.Close()

	var ops []types.Operation
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var op types.Operation
		if err := json.Unmarshal(line, &op); err != nil {
			return nil, fmt.Errorf("line %d: failed to parse operation: %w", lineNum, err)
		}
		op.Raw = json.RawMessage(line)
		ops = append(ops, op)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading ops file: %w", err)
	}

	return ops, nil
}

func (r *Replayer) ExecuteOperation(op types.Operation) types.StepResult {
	stepIdx := len(r.steps)
	var wasExpanding bool = r.simulator.IsExpanding()
	var expandPhase string = "none"
	var expandTriggered bool = false

	var metrics types.LookupMetrics

	switch op.Type {
	case types.OpPut:
		metrics = r.simulator.Put(op.Key, op.Value)
	case types.OpGet:
		_, _, metrics = r.simulator.Get(op.Key)
	case types.OpDelete:
		_, metrics = r.simulator.Delete(op.Key)
	case types.OpRange:
		order := r.simulator.Range(nil)
		metrics = types.LookupMetrics{
			TotalOps:  len(order),
			Found:     len(order) > 0,
			CostScore: float64(len(order)),
		}
	case types.OpLen:
		metrics = types.LookupMetrics{
			TotalOps:  1,
			Found:     true,
			CostScore: 1.0,
		}
	}

	if !wasExpanding && r.simulator.IsExpanding() {
		expandTriggered = true
		expandPhase = "started"
	} else if wasExpanding && !r.simulator.IsExpanding() {
		expandPhase = "completed"
	} else if r.simulator.IsExpanding() {
		expandPhase = "in_progress"
	}

	snapshot := r.simulator.GetSnapshot()
	distribution := r.simulator.GetBucketDistribution()
	risks := r.simulator.CheckRisks(metrics, op.Key)

	if op.Type == types.OpRange {
		risks = append(risks, types.RiskAlert{
			Level:       types.RiskInfo,
			Category:    types.RiskIterationOrder,
			Message:     "Map iteration order is non-deterministic and varies with seed",
			Suggestion:  "Never rely on map iteration order being consistent",
			AffectedKey: "",
		})
	}

	result := types.StepResult{
		StepIndex:       stepIdx,
		Op:              op,
		MapState:        snapshot,
		LookupCost:      metrics,
		RiskAlerts:      risks,
		BucketDist:      distribution,
		ExpandTriggered: expandTriggered,
		ExpandPhase:     expandPhase,
	}

	r.steps = append(r.steps, result)
	return result
}

func (r *Replayer) ExecuteAll(ops []types.Operation) []types.StepResult {
	for _, op := range ops {
		r.ExecuteOperation(op)
	}
	return r.steps
}

func (r *Replayer) Steps() []types.StepResult {
	return r.steps
}

func (r *Replayer) Simulator() *mapmodel.MapSimulator {
	return r.simulator
}

func (r *Replayer) Seed() int64 {
	return r.seed
}

func (r *Replayer) GetFinalSnapshot() types.MapSnapshot {
	return r.simulator.GetSnapshot()
}

func (r *Replayer) GetExpandEvents() []int {
	var events []int
	for i, step := range r.steps {
		if step.ExpandTriggered || step.ExpandPhase == "completed" {
			events = append(events, i)
		}
	}
	return events
}

func (r *Replayer) GetAllRisks() []types.RiskAlert {
	var allRisks []types.RiskAlert
	for _, step := range r.steps {
		allRisks = append(allRisks, step.RiskAlerts...)
	}
	return allRisks
}

func (r *Replayer) GetRiskSummary() map[types.RiskCategory]int {
	summary := make(map[types.RiskCategory]int)
	for _, risk := range r.GetAllRisks() {
		summary[risk.Category]++
	}
	return summary
}

func (r *Replayer) GetPerformanceStats() PerformanceStats {
	var stats PerformanceStats
	var totalCost float64
	var maxCost float64
	var totalOverflow int
	var maxOverflow int

	for _, step := range r.steps {
		totalCost += step.LookupCost.CostScore
		if step.LookupCost.CostScore > maxCost {
			maxCost = step.LookupCost.CostScore
		}
		if step.LookupCost.OverflowWalk > maxOverflow {
			maxOverflow = step.LookupCost.OverflowWalk
		}
		totalOverflow += step.LookupCost.OverflowWalk
	}

	stepCount := len(r.steps)
	if stepCount > 0 {
		stats.AvgCost = totalCost / float64(stepCount)
		stats.AvgOverflow = float64(totalOverflow) / float64(stepCount)
	}
	stats.MaxCost = maxCost
	stats.MaxOverflow = maxOverflow
	stats.TotalSteps = stepCount
	stats.ExpandEvents = len(r.GetExpandEvents())
	stats.RiskCount = len(r.GetAllRisks())

	return stats
}

type PerformanceStats struct {
	AvgCost      float64
	MaxCost      float64
	AvgOverflow  float64
	MaxOverflow  int
	TotalSteps   int
	ExpandEvents int
	RiskCount    int
}

func (s *PerformanceStats) String() string {
	return fmt.Sprintf(
		"Steps: %d, AvgCost: %.2f, MaxCost: %.2f, ExpandEvents: %d, Risks: %d",
		s.TotalSteps, s.AvgCost, s.MaxCost, s.ExpandEvents, s.RiskCount,
	)
}

func GenerateBadOps(seed int64, count int) []types.Operation {
	rng := rand.New(rand.NewSource(seed))
	var ops []types.Operation

	for i := 0; i < count; i++ {
		var op types.Operation
		
		switch rng.Intn(4) {
		case 0:
			key := generateCollidingKey(rng, i)
			op = types.Operation{
				Type:  types.OpPut,
				Key:   key,
				Value: fmt.Sprintf("value_%d", i),
			}
		case 1:
			key := fmt.Sprintf("normal_key_%d", rng.Intn(count/2))
			op = types.Operation{
				Type:  types.OpPut,
				Key:   key,
				Value: fmt.Sprintf("value_%d", i),
			}
		case 2:
			key := fmt.Sprintf("lookup_key_%d", rng.Intn(count))
			op = types.Operation{
				Type: types.OpGet,
				Key:  key,
			}
		case 3:
			op = types.Operation{
				Type: types.OpRange,
			}
		}
		
		op.Timestamp = time.Now()
		ops = append(ops, op)
	}

	return ops
}

func generateCollidingKey(rng *rand.Rand, idx int) string {
	return fmt.Sprintf("collide_%08d_%d", idx, rng.Intn(1000))
}
