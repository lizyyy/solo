package mapmodel

import (
	"hash/fnv"
	"mapdebug/pkg/types"
	"math/rand"
	"time"
)

type MapSimulator struct {
	hmap       *types.HMap
	seed       int64
	rng        *rand.Rand
	hash0      uint32
	concurrent bool
}

func NewMapSimulator(seed int64, initialB uint8) *MapSimulator {
	if initialB == 0 {
		initialB = 0
	}
	if seed == 0 {
		seed = time.Now().UnixNano()
	}
	rng := rand.New(rand.NewSource(seed))
	hash0 := uint32(rng.Uint32())

	m := &MapSimulator{
		hmap: &types.HMap{
			B:         initialB,
			Hash0:     hash0,
			Buckets:   make([]*types.Bucket, 1<<initialB),
			OldBuckets: nil,
		},
		seed:  seed,
		rng:   rng,
		hash0: hash0,
	}

	for i := range m.hmap.Buckets {
		m.hmap.Buckets[i] = &types.Bucket{
			ID:      i,
			IsOld:   false,
			TopHash: types.TopHash{},
			Keys:    make([]types.KeyValue, types.BucketSize),
			Next:    nil,
		}
	}

	return m
}

func (m *MapSimulator) Hash(key string) types.Hash {
	h := fnv.New64a()
	h.Write([]byte(key))
	h.Write([]byte{byte(m.hash0), byte(m.hash0 >> 8), byte(m.hash0 >> 16), byte(m.hash0 >> 24)})
	return types.Hash(h.Sum64())
}

func (m *MapSimulator) Get(key string) (interface{}, bool, types.LookupMetrics) {
	metrics := types.LookupMetrics{}
	hash := m.Hash(key)
	tophash := hash.TopHash()

	if m.hmap.IsExpanding() {
		m.growWork()
	}

	metrics.TotalOps++
	metrics.TopHashCompare++

	bucketIdx := hash.LowHash(m.hmap.B)
	var bucket *types.Bucket

	if m.hmap.IsExpanding() {
		oldBucketIdx := hash.LowHash(m.hmap.B - 1)
		oldBucket := m.hmap.OldBuckets[oldBucketIdx]
		if oldBucket != nil {
			bucket = oldBucket
		}
	}

	if bucket == nil {
		bucket = m.hmap.Buckets[bucketIdx]
	}

	metrics.BucketProbe++

	chainWalk := 0
	current := bucket
	for current != nil {
		for i := 0; i < types.BucketSize; i++ {
			metrics.TopHashCompare++
			if current.TopHash[i] == tophash {
				metrics.KeyCompare++
				if i < len(current.Keys) && current.Keys[i].Key == key {
					metrics.Found = true
					metrics.CostScore = float64(metrics.TotalOps) + float64(chainWalk)*0.5
					return current.Keys[i].Value, true, metrics
				}
			}
		}
		current = current.Next
		if current != nil {
			metrics.OverflowWalk++
			chainWalk++
		}
	}

	metrics.CostScore = float64(metrics.TotalOps) + float64(chainWalk)*0.5
	return nil, false, metrics
}

func (m *MapSimulator) Put(key string, value interface{}) types.LookupMetrics {
	metrics := types.LookupMetrics{}
	hash := m.Hash(key)
	tophash := hash.TopHash()

	if m.hmap.IsExpanding() {
		m.growWork()
	}

	metrics.TotalOps++
	metrics.TopHashCompare++

	if m.hmap.NeedsExpand() && !m.hmap.IsExpanding() {
		m.startGrow()
	}

	bucketIdx := hash.LowHash(m.hmap.B)
	bucket := m.hmap.Buckets[bucketIdx]

	metrics.BucketProbe++

	chainWalk := 0
	current := bucket
	for current != nil {
		for i := 0; i < types.BucketSize; i++ {
			metrics.TopHashCompare++
			if current.TopHash[i] == tophash {
				metrics.KeyCompare++
				if i < len(current.Keys) && current.Keys[i].Key == key {
					current.Keys[i].Value = value
					metrics.Found = true
					metrics.CostScore = float64(metrics.TotalOps) + float64(chainWalk)*0.5
					return metrics
				}
			}
		}
		if current.HasEmptySlot() {
			break
		}
		current = current.Next
		if current != nil {
			metrics.OverflowWalk++
			chainWalk++
		}
	}

	if current == nil || !current.HasEmptySlot() {
		newOverflow := &types.Bucket{
			ID:      int(m.rng.Uint32()),
			IsOld:   false,
			TopHash: types.TopHash{},
			Keys:    make([]types.KeyValue, types.BucketSize),
			Next:    nil,
		}
		if current == nil {
			m.hmap.Buckets[bucketIdx] = newOverflow
			current = newOverflow
		} else {
			current.Next = newOverflow
			current = newOverflow
		}
		metrics.OverflowWalk++
	}

	slotIdx := -1
	for i := 0; i < types.BucketSize; i++ {
		if current.TopHash[i] == 0 || current.TopHash[i] == 1 {
			slotIdx = i
			break
		}
	}

	if slotIdx >= 0 {
		current.TopHash[slotIdx] = tophash
		current.Keys[slotIdx] = types.KeyValue{
			Key:   key,
			Value: value,
			Hash:  hash,
			Index: slotIdx,
		}
		m.hmap.Count++
	}

	metrics.CostScore = float64(metrics.TotalOps) + float64(chainWalk)*0.5
	return metrics
}

func (m *MapSimulator) Delete(key string) (bool, types.LookupMetrics) {
	metrics := types.LookupMetrics{}
	hash := m.Hash(key)
	tophash := hash.TopHash()

	if m.hmap.IsExpanding() {
		m.growWork()
	}

	metrics.TotalOps++
	metrics.TopHashCompare++

	bucketIdx := hash.LowHash(m.hmap.B)
	var bucket *types.Bucket

	if m.hmap.IsExpanding() {
		oldBucketIdx := hash.LowHash(m.hmap.B - 1)
		oldBucket := m.hmap.OldBuckets[oldBucketIdx]
		if oldBucket != nil {
			bucket = oldBucket
		}
	}

	if bucket == nil {
		bucket = m.hmap.Buckets[bucketIdx]
	}

	metrics.BucketProbe++

	chainWalk := 0
	current := bucket
	for current != nil {
		for i := 0; i < types.BucketSize; i++ {
			metrics.TopHashCompare++
			if current.TopHash[i] == tophash {
				metrics.KeyCompare++
				if i < len(current.Keys) && current.Keys[i].Key == key {
					current.TopHash[i] = 1
					current.Keys[i] = types.KeyValue{}
					m.hmap.Count--
					metrics.Found = true
					metrics.CostScore = float64(metrics.TotalOps) + float64(chainWalk)*0.5
					return true, metrics
				}
			}
		}
		current = current.Next
		if current != nil {
			metrics.OverflowWalk++
			chainWalk++
		}
	}

	metrics.CostScore = float64(metrics.TotalOps) + float64(chainWalk)*0.5
	return false, metrics
}

func (m *MapSimulator) Range(callback func(key string, value interface{}) bool) []string {
	order := make([]string, 0, m.hmap.Count)
	
	startBucket := m.rng.Intn(m.hmap.BucketCount())
	
	for i := 0; i < m.hmap.BucketCount(); i++ {
		bucketIdx := (startBucket + i) % m.hmap.BucketCount()
		bucket := m.hmap.Buckets[bucketIdx]
		
		current := bucket
		for current != nil {
			for j := 0; j < types.BucketSize; j++ {
				if current.TopHash[j] != 0 && current.TopHash[j] != 1 {
					if j < len(current.Keys) && current.Keys[j].Key != nil {
						key, ok := current.Keys[j].Key.(string)
						if ok {
							order = append(order, key)
							if callback != nil && !callback(key, current.Keys[j].Value) {
								return order
							}
						}
					}
				}
			}
			current = current.Next
		}
	}
	
	return order
}

func (m *MapSimulator) Len() int {
	return m.hmap.Count
}

func (m *MapSimulator) startGrow() {
	oldB := m.hmap.B
	newB := oldB + 1
	
	m.hmap.OldBuckets = m.hmap.Buckets
	m.hmap.B = newB
	m.hmap.Buckets = make([]*types.Bucket, 1<<newB)
	m.hmap.EvacCount = 0
	m.hmap.EvacDone = 0
	
	for i := range m.hmap.Buckets {
		m.hmap.Buckets[i] = &types.Bucket{
			ID:      i,
			IsOld:   false,
			TopHash: types.TopHash{},
			Keys:    make([]types.KeyValue, types.BucketSize),
			Next:    nil,
		}
	}
	
	for i := range m.hmap.OldBuckets {
		if m.hmap.OldBuckets[i] != nil {
			m.hmap.OldBuckets[i].IsOld = true
		}
	}
}

func (m *MapSimulator) growWork() {
	if !m.hmap.IsExpanding() {
		return
	}
	
	work := 0
	maxWork := 4
	
	oldCount := m.hmap.OldBucketCount()
	for m.hmap.EvacDone < uintptr(oldCount) && work < maxWork {
		oldBucketIdx := int(m.hmap.EvacDone)
		oldBucket := m.hmap.OldBuckets[oldBucketIdx]
		
		if oldBucket != nil {
			m.evacuateBucket(oldBucketIdx, oldBucket)
		}
		
		m.hmap.EvacDone++
		work++
	}
	
	if m.hmap.EvacDone >= uintptr(oldCount) {
		m.hmap.OldBuckets = nil
	}
}

func (m *MapSimulator) evacuateBucket(oldBucketIdx int, oldBucket *types.Bucket) {
	current := oldBucket
	for current != nil {
		for i := 0; i < types.BucketSize; i++ {
			if current.TopHash[i] != 0 && current.TopHash[i] != 1 {
				if i < len(current.Keys) && current.Keys[i].Key != nil {
					kv := current.Keys[i]
					_, ok := kv.Key.(string)
					if ok {
						newBucketIdx := kv.Hash.LowHash(m.hmap.B)
						newBucket := m.hmap.Buckets[newBucketIdx]
						
						slotFound := false
						chainCurrent := newBucket
						for chainCurrent != nil {
							for j := 0; j < types.BucketSize; j++ {
								if chainCurrent.TopHash[j] == 0 || chainCurrent.TopHash[j] == 1 {
									chainCurrent.TopHash[j] = current.TopHash[i]
									chainCurrent.Keys[j] = kv
									slotFound = true
									break
								}
							}
							if slotFound {
								break
							}
							if chainCurrent.Next == nil {
								newOverflow := &types.Bucket{
									ID:      int(m.rng.Uint32()),
									IsOld:   false,
									TopHash: types.TopHash{},
									Keys:    make([]types.KeyValue, types.BucketSize),
									Next:    nil,
								}
								chainCurrent.Next = newOverflow
								chainCurrent = newOverflow
							} else {
								chainCurrent = chainCurrent.Next
							}
						}
					}
				}
			}
		}
		current = current.Next
	}
}

func (m *MapSimulator) GetSnapshot() types.MapSnapshot {
	overflowCount := 0
	maxChain := 0
	totalChainLen := 0
	bucketCount := 0
	
	for _, b := range m.hmap.Buckets {
		if b != nil {
			bucketCount++
			chain := b.ChainLength()
			if chain > maxChain {
				maxChain = chain
			}
			if chain > 1 {
				overflowCount += chain - 1
			}
			totalChainLen += chain
		}
	}
	
	avgChain := 0.0
	if bucketCount > 0 {
		avgChain = float64(totalChainLen) / float64(bucketCount)
	}
	
	return types.MapSnapshot{
		Count:          m.hmap.Count,
		B:              int(m.hmap.B),
		BucketCount:    m.hmap.BucketCount(),
		OldBucketCount: m.hmap.OldBucketCount(),
		LoadFactor:     m.hmap.LoadFactor(),
		OverflowCount:  overflowCount,
		AvgChainLength: avgChain,
		MaxChainLength: maxChain,
		EvacProgress:   m.hmap.EvacuationProgress(),
		Timestamp:      time.Now(),
	}
}

func (m *MapSimulator) GetBucketDistribution() types.BucketDistribution {
	bucketsByCount := make(map[int]int)
	overflowByDepth := make(map[int]int)
	overflowCount := 0
	usedBuckets := 0
	
	for _, b := range m.hmap.Buckets {
		if b == nil {
			continue
		}
		
		itemCount := 0
		chainDepth := 0
		current := b
		
		for current != nil {
			for i := 0; i < types.BucketSize; i++ {
				if current.TopHash[i] != 0 && current.TopHash[i] != 1 {
					itemCount++
				}
			}
			if current.Next != nil {
				chainDepth++
				overflowCount++
			}
			current = current.Next
		}
		
		if itemCount > 0 {
			usedBuckets++
		}
		bucketsByCount[itemCount]++
		
		if chainDepth > 0 {
			overflowByDepth[chainDepth]++
		}
	}
	
	totalBuckets := m.hmap.BucketCount()
	emptyBuckets := totalBuckets - usedBuckets
	
	return types.BucketDistribution{
		TotalBuckets:    totalBuckets,
		UsedBuckets:     usedBuckets,
		EmptyBuckets:    emptyBuckets,
		BucketsByCount:  bucketsByCount,
		OverflowBuckets: overflowCount,
		OverflowByDepth: overflowByDepth,
	}
}

func (m *MapSimulator) CheckRisks(metrics types.LookupMetrics, key string) []types.RiskAlert {
	var risks []types.RiskAlert
	
	if metrics.OverflowWalk > 3 {
		risks = append(risks, types.RiskAlert{
			Level:       types.RiskWarning,
			Category:    types.RiskLongChain,
			Message:     "Long overflow chain detected, lookup performance degraded",
			Suggestion:  "Consider using a better hash function or different key structure",
			AffectedKey: key,
		})
	}
	
	if metrics.CostScore > 10 {
		risks = append(risks, types.RiskAlert{
			Level:       types.RiskWarning,
			Category:    types.RiskHashCollision,
			Message:     "High lookup cost due to hash collisions",
			Suggestion:  "Check for key patterns causing collisions",
			AffectedKey: key,
		})
	}
	
	if m.concurrent {
		risks = append(risks, types.RiskAlert{
			Level:       types.RiskError,
			Category:    types.RiskConcurrentWrite,
			Message:     "Concurrent map access detected - Go maps are not thread-safe",
			Suggestion:  "Use sync.Map or protect access with mutex",
			AffectedKey: key,
		})
	}
	
	snapshot := m.GetSnapshot()
	if snapshot.LoadFactor > types.MaxAvgLoadFactor {
		risks = append(risks, types.RiskAlert{
			Level:       types.RiskWarning,
			Category:    types.RiskLoadFactor,
			Message:     "High load factor may cause performance issues",
			Suggestion:  "Consider pre-allocating map with larger initial capacity",
			AffectedKey: "",
		})
	}
	
	if m.hmap.IsExpanding() {
		progress := m.hmap.EvacuationProgress()
		if progress < 0.3 && m.hmap.Count > 100 {
			risks = append(risks, types.RiskAlert{
				Level:       types.RiskInfo,
				Category:    types.RiskExpandStall,
				Message:     "Map is in incremental expansion phase",
				Suggestion:  "Continue operations to complete evacuation",
				AffectedKey: "",
			})
		}
	}
	
	return risks
}

func (m *MapSimulator) Seed() int64 {
	return m.seed
}

func (m *MapSimulator) IsExpanding() bool {
	return m.hmap.IsExpanding()
}

func (m *MapSimulator) SetConcurrent(value bool) {
	m.concurrent = value
}
