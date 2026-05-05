package mapmodel

import (
	"testing"
)

func TestNewMapSimulator(t *testing.T) {
	sim := NewMapSimulator(42, 0)
	if sim == nil {
		t.Fatal("NewMapSimulator returned nil")
	}
	if sim.Seed() != 42 {
		t.Errorf("Expected seed 42, got %d", sim.Seed())
	}
}

func TestPutAndGet(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	metrics := sim.Put("key1", "value1")
	if metrics.Found {
		t.Error("Expected Found=false for new key")
	}

	value, found, metrics := sim.Get("key1")
	if !found {
		t.Error("Expected to find key1")
	}
	if value != "value1" {
		t.Errorf("Expected value1, got %v", value)
	}
}

func TestUpdate(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	sim.Put("key1", "value1")
	metrics := sim.Put("key1", "value2")
	if !metrics.Found {
		t.Error("Expected Found=true for update")
	}

	value, found, _ := sim.Get("key1")
	if !found {
		t.Error("Expected to find key1")
	}
	if value != "value2" {
		t.Errorf("Expected value2, got %v", value)
	}
}

func TestDelete(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	sim.Put("key1", "value1")
	found, _ := sim.Delete("key1")
	if !found {
		t.Error("Expected Found=true for delete")
	}

	_, found, _ = sim.Get("key1")
	if found {
		t.Error("Expected key1 to be deleted")
	}
}

func TestLen(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	if sim.Len() != 0 {
		t.Errorf("Expected 0, got %d", sim.Len())
	}

	sim.Put("key1", "value1")
	sim.Put("key2", "value2")

	if sim.Len() != 2 {
		t.Errorf("Expected 2, got %d", sim.Len())
	}

	sim.Delete("key1")
	if sim.Len() != 1 {
		t.Errorf("Expected 1, got %d", sim.Len())
	}
}

func TestRange(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	keys := []string{"a", "b", "c", "d", "e"}
	for _, k := range keys {
		sim.Put(k, k)
	}

	order1 := sim.Range(nil)
	if len(order1) != 5 {
		t.Errorf("Expected 5 keys, got %d", len(order1))
	}

	order2 := sim.Range(nil)
	if len(order2) != 5 {
		t.Errorf("Expected 5 keys, got %d", len(order2))
	}
}

func TestSnapshot(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	snap := sim.GetSnapshot()
	if snap.Count != 0 {
		t.Errorf("Expected Count=0, got %d", snap.Count)
	}
	if snap.B != 0 {
		t.Errorf("Expected B=0, got %d", snap.B)
	}
	if snap.BucketCount != 1 {
		t.Errorf("Expected BucketCount=1, got %d", snap.BucketCount)
	}

	for i := 0; i < 10; i++ {
		sim.Put(string(rune('a'+i)), i)
	}

	snap = sim.GetSnapshot()
	if snap.Count != 10 {
		t.Errorf("Expected Count=10, got %d", snap.Count)
	}
	if snap.LoadFactor <= 0 {
		t.Errorf("Expected positive LoadFactor, got %f", snap.LoadFactor)
	}
}

func TestBucketDistribution(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	dist := sim.GetBucketDistribution()
	if dist.TotalBuckets != 1 {
		t.Errorf("Expected TotalBuckets=1, got %d", dist.TotalBuckets)
	}
	if dist.EmptyBuckets != 1 {
		t.Errorf("Expected EmptyBuckets=1, got %d", dist.EmptyBuckets)
	}

	sim.Put("key1", "value1")
	dist = sim.GetBucketDistribution()
	if dist.UsedBuckets != 1 {
		t.Errorf("Expected UsedBuckets=1, got %d", dist.UsedBuckets)
	}
}

func TestExpansion(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	initialB := sim.GetSnapshot().B
	if initialB != 0 {
		t.Errorf("Expected initial B=0, got %d", initialB)
	}

	for i := 0; i < 20; i++ {
		sim.Put(string(rune('a'+i)), i)
	}

	snap := sim.GetSnapshot()
	if snap.B <= initialB {
		t.Error("Expected B to increase after expansion")
	}
	if snap.BucketCount <= 1<<initialB {
		t.Error("Expected BucketCount to increase after expansion")
	}
}

func TestCheckRisks(t *testing.T) {
	sim := NewMapSimulator(42, 0)

	metrics := sim.Put("key1", "value1")
	risks := sim.CheckRisks(metrics, "key1")

	if len(risks) > 0 {
		t.Logf("Risks: %v", risks)
	}
}

func TestConcurrentRisk(t *testing.T) {
	sim := NewMapSimulator(42, 0)
	sim.SetConcurrent(true)

	metrics := sim.Put("key1", "value1")
	risks := sim.CheckRisks(metrics, "key1")

	foundConcurrent := false
	for _, risk := range risks {
		if risk.Category == "concurrent_write" {
			foundConcurrent = true
			break
		}
	}

	if !foundConcurrent {
		t.Error("Expected concurrent_write risk when SetConcurrent(true)")
	}
}

func TestHashConsistency(t *testing.T) {
	sim1 := NewMapSimulator(42, 0)
	sim2 := NewMapSimulator(42, 0)

	key := "test_key"
	hash1 := sim1.Hash(key)
	hash2 := sim2.Hash(key)

	if hash1 != hash2 {
		t.Error("Expected same hash for same seed")
	}

	sim3 := NewMapSimulator(99, 0)
	hash3 := sim3.Hash(key)

	if hash1 == hash3 {
		t.Error("Expected different hash for different seed")
	}
}

func TestTopHashAndLowHash(t *testing.T) {
	sim := NewMapSimulator(42, 0)
	hash := sim.Hash("test_key")

	tophash := hash.TopHash()
	if tophash == 0 {
		t.Error("Expected non-zero tophash")
	}

	lowHash := hash.LowHash(3)
	if lowHash > 7 {
		t.Errorf("Expected lowHash < 8 for B=3, got %d", lowHash)
	}
}
