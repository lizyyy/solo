package unit_test

import (
	"context"
	"testing"
	"time"

	"mq-deadletter-review/pkg/utils"
)

func TestGenerateID(t *testing.T) {
	id1 := utils.GenerateID()
	id2 := utils.GenerateID()

	if id1 == id2 {
		t.Error("Generated IDs should be unique")
	}

	if len(id1) == 0 {
		t.Error("Generated ID should not be empty")
	}
}

func TestGenerateShortID(t *testing.T) {
	id := utils.GenerateShortID()
	if len(id) != 16 {
		t.Errorf("ShortID should be 16 chars, got %d", len(id))
	}
}

func TestGenerateTrackingID(t *testing.T) {
	id := utils.GenerateTrackingID()
	if len(id) == 0 {
		t.Error("Tracking ID should not be empty")
	}

	if len(id) < 10 {
		t.Error("Tracking ID too short")
	}
}

func TestGenerateRequestID(t *testing.T) {
	id := utils.GenerateRequestID()
	if len(id) == 0 {
		t.Error("Request ID should not be empty")
	}
}

func TestGenerateRandomHex(t *testing.T) {
	lengths := []int{8, 16, 32, 64}
	for _, length := range lengths {
		id := utils.GenerateRandomHex(length)
		if len(id) != length {
			t.Errorf("RandomHex length should be %d, got %d", length, len(id))
		}
	}
}

func TestLocalLocker(t *testing.T) {
	locker := utils.NewLocalLocker()
	ctx := context.Background()

	success, err := locker.TryLock(ctx, "test-key", 5*time.Second)
	if err != nil {
		t.Errorf("TryLock should not error: %v", err)
	}
	if !success {
		t.Error("First TryLock should succeed")
	}

	success, err = locker.TryLock(ctx, "test-key", 5*time.Second)
	if err != nil {
		t.Errorf("Second TryLock should not error: %v", err)
	}
	if success {
		t.Error("Second TryLock should fail")
	}

	err = locker.Unlock(ctx, "test-key")
	if err != nil {
		t.Errorf("Unlock should not error: %v", err)
	}

	success, err = locker.TryLock(ctx, "test-key", 5*time.Second)
	if err != nil {
		t.Errorf("Third TryLock should not error: %v", err)
	}
	if !success {
		t.Error("Third TryLock should succeed after unlock")
	}
}

func TestLocalLocker_Lock(t *testing.T) {
	locker := utils.NewLocalLocker()
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	locker.TryLock(ctx, "test-lock", 5*time.Second)

	err := locker.Lock(ctx, "test-lock", 5*time.Second)
	if err == nil {
		t.Error("Lock should timeout")
	}
}

func TestJSONUtils(t *testing.T) {
	type TestStruct struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	original := TestStruct{Name: "test", Value: 42}

	jsonStr, err := utils.Marshal(original)
	if err != nil {
		t.Errorf("Marshal should not error: %v", err)
	}

	if len(jsonStr) == 0 {
		t.Error("Marshaled string should not be empty")
	}

	var decoded TestStruct
	err = utils.Unmarshal(jsonStr, &decoded)
	if err != nil {
		t.Errorf("Unmarshal should not error: %v", err)
	}

	if decoded.Name != original.Name {
		t.Errorf("Name mismatch: got %s, want %s", decoded.Name, original.Name)
	}

	if decoded.Value != original.Value {
		t.Errorf("Value mismatch: got %d, want %d", decoded.Value, original.Value)
	}

	mustStr := utils.MustMarshal(original)
	if len(mustStr) == 0 {
		t.Error("MustMarshal should return non-empty string")
	}

	mustIndentStr := utils.MustMarshalIndent(original)
	if len(mustIndentStr) == 0 {
		t.Error("MustMarshalIndent should return non-empty string")
	}
}
