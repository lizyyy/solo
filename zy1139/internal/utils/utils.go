package utils

import (
	"fmt"
	"math"
	"time"
)

func RoundFloat(val float64, places int) float64 {
	shift := math.Pow(10, float64(places))
	return math.Round(val*shift) / shift
}

func FormatDurationMs(ms float64) string {
	if ms < 1 {
		return fmt.Sprintf("%.2fµs", ms*1000)
	}
	if ms < 1000 {
		return fmt.Sprintf("%.2fms", ms)
	}
	return fmt.Sprintf("%.2fs", ms/1000)
}

func FormatRPS(rps float64) string {
	if rps >= 1000000 {
		return fmt.Sprintf("%.2fM", rps/1000000)
	}
	if rps >= 1000 {
		return fmt.Sprintf("%.2fK", rps/1000)
	}
	return fmt.Sprintf("%.0f", rps)
}

func FormatPercent(pct float64) string {
	return fmt.Sprintf("%.2f%%", pct*100)
}

func TimestampToTime(ts int64) time.Time {
	return time.Unix(ts, 0)
}

func FormatTime(t time.Time) string {
	return t.Format("2006-01-02 15:04:05")
}

func MaxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func MinInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func MaxFloat64(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func MinFloat64(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func ClampInt(val, min, max int) int {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

func ClampFloat64(val, min, max float64) float64 {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

func ContainsString(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func UniqueStrings(slice []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(slice))
	for _, s := range slice {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}
