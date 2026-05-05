package engine

import (
	"sort"
	"time"

	"github.com/zy1214/pefa/pkg/evidence"
)

type TimelineEngine struct {
	tolerance time.Duration
}

func NewTimelineEngine() *TimelineEngine {
	return &TimelineEngine{
		tolerance: 5 * time.Second,
	}
}

func (e *TimelineEngine) WithTolerance(t time.Duration) *TimelineEngine {
	e.tolerance = t
	return e
}

func (e *TimelineEngine) Align(evidences []evidence.Evidence) *evidence.AlignmentResult {
	if len(evidences) == 0 {
		return &evidence.AlignmentResult{
			IsAligned:         false,
			TotalDuration:     0,
			SampleRateWarning: true,
		}
	}

	ranges := make(map[evidence.EvidenceType]struct {
		Start time.Time
		End   time.Time
	})

	var allStart, allEnd time.Time
	hasTime := false

	for _, ev := range evidences {
		start := ev.GetStartTime()
		end := ev.GetEndTime()

		ranges[ev.Type()] = struct {
			Start time.Time
			End   time.Time
		}{Start: start, End: end}

		if !start.IsZero() {
			if !hasTime || start.Before(allStart) {
				allStart = start
			}
			hasTime = true
		}
		if !end.IsZero() {
			if !hasTime || end.After(allEnd) {
				allEnd = end
			}
			hasTime = true
		}
	}

	var commonStart, commonEnd time.Time
	isAligned := true
	var gaps []evidence.TimelineGap
	var overlaps []evidence.TimelineGap

	if hasTime {
		commonStart = allStart
		commonEnd = allEnd

		for _, ev := range evidences {
			evStart := ev.GetStartTime()
			evEnd := ev.GetEndTime()

			if evStart.IsZero() || evEnd.IsZero() {
				isAligned = false
				gaps = append(gaps, evidence.TimelineGap{
					EvidenceType: ev.Type(),
					Reason:       "No timestamp information available",
					Severity:     evidence.SeverityHigh,
				})
				continue
			}

			if evStart.After(commonStart.Add(e.tolerance)) {
				duration := evStart.Sub(commonStart)
				gaps = append(gaps, evidence.TimelineGap{
					EvidenceType: ev.Type(),
					StartTime:    commonStart,
					EndTime:      evStart,
					Duration:     duration,
					Reason:       "Evidence starts after common start time",
					Severity:     calculateGapSeverity(duration),
				})
				isAligned = false
			}

			if evEnd.Before(commonEnd.Add(-e.tolerance)) {
				duration := commonEnd.Sub(evEnd)
				gaps = append(gaps, evidence.TimelineGap{
					EvidenceType: ev.Type(),
					StartTime:    evEnd,
					EndTime:      commonEnd,
					Duration:     duration,
					Reason:       "Evidence ends before common end time",
					Severity:     calculateGapSeverity(duration),
				})
				isAligned = false
			}
		}

		overlaps = e.detectOverlaps(evidences)
	}

	sampleRateWarning := e.checkSampleRateConsistency(evidences)

	return &evidence.AlignmentResult{
		IsAligned:         isAligned,
		CommonStartTime:   commonStart,
		CommonEndTime:     commonEnd,
		EvidenceRanges:    ranges,
		Gaps:              gaps,
		Overlapping:       overlaps,
		TotalDuration:     commonEnd.Sub(commonStart),
		SampleRateWarning: sampleRateWarning,
	}
}

func (e *TimelineEngine) detectOverlaps(evidences []evidence.Evidence) []evidence.TimelineGap {
	var overlaps []evidence.TimelineGap

	for i := 0; i < len(evidences); i++ {
		for j := i + 1; j < len(evidences); j++ {
			ev1 := evidences[i]
			ev2 := evidences[j]

			if ev1.GetStartTime().IsZero() || ev1.GetEndTime().IsZero() ||
				ev2.GetStartTime().IsZero() || ev2.GetEndTime().IsZero() {
				continue
			}

			overlapStart := maxTime(ev1.GetStartTime(), ev2.GetStartTime())
			overlapEnd := minTime(ev1.GetEndTime(), ev2.GetEndTime())

			if overlapStart.Before(overlapEnd) {
				duration := overlapEnd.Sub(overlapStart)
				if duration > e.tolerance {
					overlaps = append(overlaps, evidence.TimelineGap{
						EvidenceType: ev1.Type(),
						StartTime:    overlapStart,
						EndTime:      overlapEnd,
						Duration:     duration,
						Reason:       "Time range overlap with " + string(ev2.Type()),
						Severity:     evidence.SeverityLow,
					})
				}
			}
		}
	}

	return overlaps
}

func (e *TimelineEngine) checkSampleRateConsistency(evidences []evidence.Evidence) bool {
	if len(evidences) < 2 {
		return false
	}

	type rateInfo struct {
		evType evidence.EvidenceType
		rate   time.Duration
	}

	var rates []rateInfo

	for _, ev := range evidences {
		if ev.GetStartTime().IsZero() || ev.GetEndTime().IsZero() || ev.GetSampleCount() < 2 {
			continue
		}

		duration := ev.GetEndTime().Sub(ev.GetStartTime())
		rate := duration / time.Duration(ev.GetSampleCount())
		rates = append(rates, rateInfo{
			evType: ev.Type(),
			rate:   rate,
		})
	}

	if len(rates) < 2 {
		return false
	}

	sort.Slice(rates, func(i, j int) bool {
		return rates[i].rate < rates[j].rate
	})

	fastest := rates[0].rate
	slowest := rates[len(rates)-1].rate

	ratio := float64(slowest) / float64(fastest)
	return ratio > 10
}

func calculateGapSeverity(duration time.Duration) evidence.GapSeverity {
	switch {
	case duration > 5*time.Minute:
		return evidence.SeverityCritical
	case duration > 1*time.Minute:
		return evidence.SeverityHigh
	case duration > 10*time.Second:
		return evidence.SeverityMedium
	default:
		return evidence.SeverityLow
	}
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func (e *TimelineEngine) GetMissingEvidenceTypes(
	evidences []evidence.Evidence,
) []evidence.EvidenceType {
	available := make(map[evidence.EvidenceType]bool)
	for _, ev := range evidences {
		available[ev.Type()] = true
	}

	allTypes := []evidence.EvidenceType{
		evidence.TypeTop,
		evidence.TypeVmstat,
		evidence.TypeIostat,
		evidence.TypeSs,
		evidence.TypeStrace,
		evidence.TypePerfScript,
		evidence.TypeFoldedStack,
	}

	var missing []evidence.EvidenceType
	for _, t := range allTypes {
		if !available[t] {
			missing = append(missing, t)
		}
	}

	return missing
}
