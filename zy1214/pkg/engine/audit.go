package engine

import (
	"fmt"
	"time"

	"github.com/zy1214/pefa/pkg/evidence"
	"github.com/zy1214/pefa/pkg/parser"
)

type AuditEngine struct {
	timelineEngine *TimelineEngine
	parserRegistry *parser.ParserRegistry
}

func NewAuditEngine() *AuditEngine {
	return &AuditEngine{
		timelineEngine: NewTimelineEngine(),
		parserRegistry: parser.NewDefaultRegistry(),
	}
}

func (e *AuditEngine) Audit(
	sessionID string,
	evidences []evidence.Evidence,
) (*evidence.AuditResult, error) {
	var issues []evidence.AuditIssue
	var recommendations []evidence.Recommendation

	alignment := e.timelineEngine.Align(evidences)

	for _, gap := range alignment.Gaps {
		var severity evidence.IssueSeverity
		switch gap.Severity {
		case evidence.SeverityCritical:
			severity = evidence.IssueCritical
		case evidence.SeverityHigh:
			severity = evidence.IssueWarning
		default:
			severity = evidence.IssueInfo
		}

		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  gap.EvidenceType,
			Severity:      severity,
			Message:       gap.Reason,
			FixSuggestion: e.getFixSuggestion(gap.EvidenceType, gap.Reason),
		})
	}

	missingTypes := e.timelineEngine.GetMissingEvidenceTypes(evidences)
	for _, mt := range missingTypes {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  mt,
			Severity:      evidence.IssueInfo,
			Message:       "Evidence type not provided",
			FixSuggestion: e.getMissingTypeSuggestion(mt),
		})
	}

	for _, ev := range evidences {
		evIssues, evRecs := e.auditSingleEvidence(ev)
		issues = append(issues, evIssues...)
		recommendations = append(recommendations, evRecs...)
	}

	qualityScore := e.calculateQualityScore(evidences, issues, missingTypes)

	availableTypes := make([]evidence.EvidenceType, 0, len(evidences))
	for _, ev := range evidences {
		availableTypes = append(availableTypes, ev.Type())
	}

	for _, mt := range missingTypes {
		recommendations = append(recommendations, evidence.Recommendation{
			Priority:     e.getMissingTypePriority(mt),
			Title:        fmt.Sprintf("Collect %s data", mt),
			Description:  e.getMissingTypeDescription(mt),
			ActionSteps:  e.getCollectionCommand(mt),
			EvidenceType: mt,
		})
	}

	return &evidence.AuditResult{
		SessionID:       sessionID,
		Timestamp:       time.Now(),
		EvidenceTypes:   availableTypes,
		MissingTypes:    missingTypes,
		QualityScore:    qualityScore,
		Issues:          issues,
		Recommendations: recommendations,
	}, nil
}

func (e *AuditEngine) auditSingleEvidence(
	ev evidence.Evidence,
) ([]evidence.AuditIssue, []evidence.Recommendation) {
	var issues []evidence.AuditIssue
	var recommendations []evidence.Recommendation

	if ev.GetSampleCount() == 0 {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  ev.Type(),
			Severity:      evidence.IssueCritical,
			Message:       "No samples found in evidence",
			FixSuggestion: "Ensure the data collection command ran long enough and output is complete",
		})
		return issues, recommendations
	}

	if ev.GetSampleCount() < 5 {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  ev.Type(),
			Severity:      evidence.IssueWarning,
			Message:       fmt.Sprintf("Low sample count: %d samples", ev.GetSampleCount()),
			FixSuggestion: "Collect data for a longer duration or higher frequency",
		})
	}

	if ev.GetStartTime().IsZero() || ev.GetEndTime().IsZero() {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  ev.Type(),
			Severity:      evidence.IssueWarning,
			Message:       "Missing timestamp information",
			FixSuggestion: "Timestamps help correlate events across different evidence types",
		})
	}

	switch typedEv := ev.(type) {
	case *evidence.VmstatEvidence:
		issues, recommendations = e.auditVmstat(typedEv, issues, recommendations)
	case *evidence.IostatEvidence:
		issues, recommendations = e.auditIostat(typedEv, issues, recommendations)
	case *evidence.StraceEvidence:
		issues, recommendations = e.auditStrace(typedEv, issues, recommendations)
	case *evidence.PerfScriptEvidence:
		issues, recommendations = e.auditPerfScript(typedEv, issues, recommendations)
	case *evidence.FoldedStackEvidence:
		issues, recommendations = e.auditFoldedStack(typedEv, issues, recommendations)
	}

	return issues, recommendations
}

func (e *AuditEngine) auditVmstat(
	ev *evidence.VmstatEvidence,
	issues []evidence.AuditIssue,
	recommendations []evidence.Recommendation,
) ([]evidence.AuditIssue, []evidence.Recommendation) {
	if len(ev.Samples) < 10 {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  evidence.TypeVmstat,
			Severity:      evidence.IssueWarning,
			Message:       "Insufficient vmstat samples for trend analysis",
			FixSuggestion: "Run vmstat with a shorter interval (e.g., vmstat 1 30)",
		})
	}

	return issues, recommendations
}

func (e *AuditEngine) auditIostat(
	ev *evidence.IostatEvidence,
	issues []evidence.AuditIssue,
	recommendations []evidence.Recommendation,
) ([]evidence.AuditIssue, []evidence.Recommendation) {
	if len(ev.Samples) == 0 {
		return issues, recommendations
	}

	for _, sample := range ev.Samples {
		if len(sample.Devices) == 0 {
			issues = append(issues, evidence.AuditIssue{
				EvidenceType:  evidence.TypeIostat,
				Severity:      evidence.IssueWarning,
				Message:       "No device statistics found in iostat output",
				FixSuggestion: "Use iostat -x to get extended device statistics",
			})
			break
		}
	}

	return issues, recommendations
}

func (e *AuditEngine) auditStrace(
	ev *evidence.StraceEvidence,
	issues []evidence.AuditIssue,
	recommendations []evidence.Recommendation,
) ([]evidence.AuditIssue, []evidence.Recommendation) {
	if len(ev.Events) < 100 {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  evidence.TypeStrace,
			Severity:      evidence.IssueInfo,
			Message:       "Limited strace events captured",
			FixSuggestion: "Increase strace duration or use -f to trace child processes",
		})
	}

	for _, stats := range ev.SyscallStats {
		if stats.Errors > 0 {
			issues = append(issues, evidence.AuditIssue{
				EvidenceType:  evidence.TypeStrace,
				Severity:      evidence.IssueInfo,
				Message:       "System call errors detected - check strace output for details",
				FixSuggestion: "Review error codes and investigate failed syscalls",
			})
			break
		}
	}

	return issues, recommendations
}

func (e *AuditEngine) auditPerfScript(
	ev *evidence.PerfScriptEvidence,
	issues []evidence.AuditIssue,
	recommendations []evidence.Recommendation,
) ([]evidence.AuditIssue, []evidence.Recommendation) {
	if len(ev.Stacks) < 100 {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  evidence.TypePerfScript,
			Severity:      evidence.IssueWarning,
			Message:       "Limited perf samples for statistical significance",
			FixSuggestion: "Collect more samples with longer perf record duration",
		})
	}

	return issues, recommendations
}

func (e *AuditEngine) auditFoldedStack(
	ev *evidence.FoldedStackEvidence,
	issues []evidence.AuditIssue,
	recommendations []evidence.Recommendation,
) ([]evidence.AuditIssue, []evidence.Recommendation) {
	if ev.TotalSamples < 100 {
		issues = append(issues, evidence.AuditIssue{
			EvidenceType:  evidence.TypeFoldedStack,
			Severity:      evidence.IssueWarning,
			Message:       "Limited folded stack samples",
			FixSuggestion: "Use more samples for meaningful flamegraph analysis",
		})
	}

	return issues, recommendations
}

func (e *AuditEngine) calculateQualityScore(
	evidences []evidence.Evidence,
	issues []evidence.AuditIssue,
	missingTypes []evidence.EvidenceType,
) float64 {
	score := 100.0

	criticalTypes := map[evidence.EvidenceType]bool{
		evidence.TypeTop:    true,
		evidence.TypeVmstat: true,
		evidence.TypeIostat: true,
	}

	for _, mt := range missingTypes {
		if criticalTypes[mt] {
			score -= 15
		} else {
			score -= 5
		}
	}

	for _, issue := range issues {
		switch issue.Severity {
		case evidence.IssueCritical:
			score -= 20
		case evidence.IssueWarning:
			score -= 10
		case evidence.IssueInfo:
			score -= 2
		}
	}

	for _, ev := range evidences {
		if ev.GetSampleCount() >= 30 {
			score += 2
		}
		if !ev.GetStartTime().IsZero() && !ev.GetEndTime().IsZero() {
			score += 3
		}
	}

	if score < 0 {
		score = 0
	} else if score > 100 {
		score = 100
	}

	return score
}

func (e *AuditEngine) getFixSuggestion(et evidence.EvidenceType, reason string) string {
	switch {
	case reason == "No timestamp information available":
		return "Check if the evidence type supports timestamps, or collect data simultaneously with other tools"
	case reason == "Evidence starts after common start time":
		return "Start data collection earlier to align with other evidence"
	case reason == "Evidence ends before common end time":
		return "Continue data collection longer to align with other evidence"
	default:
		return "Review data collection methodology"
	}
}

func (e *AuditEngine) getMissingTypeSuggestion(et evidence.EvidenceType) string {
	switch et {
	case evidence.TypeTop:
		return "Collect top output with: top -b -n 10 > top.txt"
	case evidence.TypeVmstat:
		return "Collect vmstat with: vmstat 1 30 > vmstat.txt"
	case evidence.TypeIostat:
		return "Collect iostat with: iostat -x 1 10 > iostat.txt"
	case evidence.TypeSs:
		return "Collect network connections with: ss -tulnp > ss.txt"
	case evidence.TypeStrace:
		return "Collect strace with: strace -tt -T -p <pid> -o strace.txt 2>&1"
	case evidence.TypePerfScript:
		return "Collect perf with: perf record -F 99 -a -g -- sleep 10; perf script > perf.txt"
	case evidence.TypeFoldedStack:
		return "Generate folded stacks: perf script | stackcollapse-perf.pl > folded.txt"
	default:
		return "Collect additional evidence for comprehensive analysis"
	}
}

func (e *AuditEngine) getMissingTypePriority(et evidence.EvidenceType) evidence.RecommendationPriority {
	switch et {
	case evidence.TypeTop, evidence.TypeVmstat, evidence.TypeIostat:
		return evidence.PriorityHigh
	case evidence.TypeSs, evidence.TypeStrace:
		return evidence.PriorityMedium
	case evidence.TypePerfScript, evidence.TypeFoldedStack:
		return evidence.PriorityLow
	default:
		return evidence.PriorityMedium
	}
}

func (e *AuditEngine) getMissingTypeDescription(et evidence.EvidenceType) string {
	switch et {
	case evidence.TypeTop:
		return "Top provides process-level CPU and memory usage"
	case evidence.TypeVmstat:
		return "Vmstat shows system-wide CPU, memory, and I/O trends"
	case evidence.TypeIostat:
		return "Iostat provides device-level I/O statistics"
	case evidence.TypeSs:
		return "Ss shows network socket states and connections"
	case evidence.TypeStrace:
		return "Strace traces system calls and their latencies"
	case evidence.TypePerfScript:
		return "Perf script provides CPU profiling call stacks"
	case evidence.TypeFoldedStack:
		return "Folded stacks are used for flamegraph generation"
	default:
		return "Additional evidence enhances analysis depth"
	}
}

func (e *AuditEngine) getCollectionCommand(et evidence.EvidenceType) []string {
	switch et {
	case evidence.TypeTop:
		return []string{
			"Run top in batch mode: top -b -n 10 -d 1 > top.txt",
			"Add -c to see full command lines: top -b -c -n 10 > top.txt",
		}
	case evidence.TypeVmstat:
		return []string{
			"Collect 30 samples at 1-second intervals: vmstat 1 30 > vmstat.txt",
			"For more context, include timestamps in your collection",
		}
	case evidence.TypeIostat:
		return []string{
			"Use extended statistics: iostat -x 1 10 > iostat.txt",
			"Include CPU stats: iostat -x -c 1 10 > iostat.txt",
		}
	case evidence.TypeSs:
		return []string{
			"Show all TCP sockets: ss -tulnp > ss.txt",
			"Show established connections: ss -t -n state established > ss.txt",
			"Include process info: ss -tulnp -o > ss.txt",
		}
	case evidence.TypeStrace:
		return []string{
			"Trace a running process: strace -tt -T -p <PID> -o strace.txt",
			"Trace with timestamps and durations: strace -tt -T -f -p <PID> > strace.txt 2>&1",
			"Filter specific syscalls: strace -e trace=file,network -p <PID>",
		}
	case evidence.TypePerfScript:
		return []string{
			"Record CPU samples: perf record -F 99 -a -g -- sleep 10",
			"Generate script output: perf script > perf.txt",
			"For specific process: perf record -F 99 -p <PID> -g -- sleep 10",
		}
	case evidence.TypeFoldedStack:
		return []string{
			"Use FlameGraph tools: perf script | ./stackcollapse-perf.pl > folded.txt",
			"Install from: https://github.com/brendangregg/FlameGraph",
		}
	default:
		return []string{"Collect additional evidence for comprehensive analysis"}
	}
}
