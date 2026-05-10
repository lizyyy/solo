package util

import (
	"crypto/rand"
	"encoding/hex"
	"time"
)

func GenerateID(prefix string) string {
	b := make([]byte, 16)
	rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func TimePtr(t time.Time) *time.Time {
	return &t
}

func Now() time.Time {
	return time.Now().UTC()
}

func CalculateDaysLeft(validTo time.Time) int {
	now := Now()
	if validTo.Before(now) {
		return 0
	}
	return int(validTo.Sub(now).Hours() / 24)
}

func CalculateRetryDelay(retryCount int, baseDelay time.Duration) time.Duration {
	return baseDelay * time.Duration(1<<retryCount)
}

func IsExpiring(validTo time.Time, threshold time.Duration) bool {
	now := Now()
	return validTo.Sub(now) < threshold
}

func IsExpired(validTo time.Time) bool {
	return validTo.Before(Now())
}

func IsWithinTimeout(startTime time.Time, timeout time.Duration) bool {
	return Now().Sub(startTime) < timeout
}

func MinTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func MaxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}
