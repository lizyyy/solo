package engine

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/zy1214/pefa/pkg/evidence"
)

type AnalysisEngine struct {
	timelineEngine *TimelineEngine
}

func NewAnalysisEngine() *AnalysisEngine {
	return &AnalysisEngine{
		timelineEngine: NewTimelineEngine(),
	}
}

func (e *AnalysisEngine) Analyze(
	sessionID string,
	evidences []evidence.Evidence,
) (*evidence.AnalysisResult, error) {
	alignment := e.timelineEngine.Align(evidences)

	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	for _, ev := range evidences {
		switch typedEv := ev.(type) {
		case *evidence.TopEvidence:
			bn, recs := e.analyzeTop(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)

		case *evidence.VmstatEvidence:
			bn, recs := e.analyzeVmstat(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)

		case *evidence.IostatEvidence:
			bn, recs := e.analyzeIostat(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)

		case *evidence.SsEvidence:
			bn, recs := e.analyzeSs(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)

		case *evidence.StraceEvidence:
			bn, recs := e.analyzeStrace(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)

		case *evidence.PerfScriptEvidence:
			bn, recs := e.analyzePerfScript(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)

		case *evidence.FoldedStackEvidence:
			bn, recs := e.analyzeFoldedStack(typedEv)
			bottlenecks = append(bottlenecks, bn...)
			recommendations = append(recommendations, recs...)
		}
	}

	bottlenecks = e.correlateBottlenecks(bottlenecks, evidences)

	recommendations = e.deduplicateRecommendations(recommendations)

	summary := e.generateSummary(*alignment, bottlenecks, recommendations)

	return &evidence.AnalysisResult{
		SessionID:       sessionID,
		Timestamp:       time.Now(),
		Alignment:       *alignment,
		Bottlenecks:     bottlenecks,
		Recommendations: recommendations,
		Summary:         summary,
	}, nil
}

func (e *AnalysisEngine) analyzeTop(ev *evidence.TopEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Samples) == 0 {
		return bottlenecks, recommendations
	}

	firstSample := ev.Samples[0]

	if firstSample.LoadAvg[0] > firstSample.LoadAvg[2]*2 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:  evidence.CategoryCPU,
			Severity:  evidence.SeverityMajor,
			Timestamp: firstSample.Timestamp,
			Description: fmt.Sprintf("Load average spiking: %.2f (1min) vs %.2f (15min)",
				firstSample.LoadAvg[0], firstSample.LoadAvg[2]),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeTop},
			SupportingData: map[string]interface{}{
				"load_avg_1":  firstSample.LoadAvg[0],
				"load_avg_5":  firstSample.LoadAvg[1],
				"load_avg_15": firstSample.LoadAvg[2],
			},
		})
	}

	var highCPUProcesses []evidence.ProcessSample
	for _, p := range firstSample.Processes {
		if p.CPUPercent > 80 {
			highCPUProcesses = append(highCPUProcesses, p)
		}
	}

	if len(highCPUProcesses) > 0 {
		procNames := make([]string, 0, len(highCPUProcesses))
		for _, p := range highCPUProcesses {
			procNames = append(procNames, fmt.Sprintf("%s(PID:%d)", p.Command, p.PID))
		}

		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryCPU,
			Severity:        evidence.SeverityMajor,
			Timestamp:       firstSample.Timestamp,
			Description:     fmt.Sprintf("High CPU usage from processes: %s", strings.Join(procNames, ", ")),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeTop},
		})

		recommendations = append(recommendations, evidence.Recommendation{
			Priority:    evidence.PriorityHigh,
			Title:       "Investigate high CPU processes",
			Description: "Multiple processes are consuming significant CPU resources",
			ActionSteps: []string{
				"Use perf to profile the hot processes",
				"Check for infinite loops or inefficient algorithms",
				"Review recent code changes",
			},
			EvidenceType: evidence.TypeTop,
		})
	}

	if firstSample.CPUSample.IOWait > 20 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryIO,
			Severity:        evidence.SeverityMajor,
			Timestamp:       firstSample.Timestamp,
			Description:     fmt.Sprintf("High I/O wait: %.1f%%", firstSample.CPUSample.IOWait),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeTop},
		})
	}

	if firstSample.FreeMem < firstSample.TotalMem/10 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryMemory,
			Severity:        evidence.SeverityMajor,
			Timestamp:       firstSample.Timestamp,
			Description:     "Low free memory available",
			EvidenceSources: []evidence.EvidenceType{evidence.TypeTop},
			SupportingData: map[string]interface{}{
				"total_mem": firstSample.TotalMem,
				"free_mem":  firstSample.FreeMem,
				"used_mem":  firstSample.UsedMem,
			},
		})
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) analyzeVmstat(ev *evidence.VmstatEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Samples) == 0 {
		return bottlenecks, recommendations
	}

	highWaitSamples := 0
	for _, sample := range ev.Samples {
		if sample.Wa > 30 {
			highWaitSamples++
		}
	}

	if highWaitSamples > len(ev.Samples)/2 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:  evidence.CategoryIO,
			Severity:  evidence.SeverityMajor,
			Timestamp: ev.Samples[0].Timestamp,
			Description: fmt.Sprintf("Persistent I/O wait detected (%.1f%% avg across %d samples)",
				e.calculateAvgWa(ev.Samples), len(ev.Samples)),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeVmstat},
		})

		recommendations = append(recommendations, evidence.Recommendation{
			Priority:    evidence.PriorityHigh,
			Title:       "I/O subsystem bottleneck detected",
			Description: "High I/O wait indicates storage or network I/O issues",
			ActionSteps: []string{
				"Check iostat for device-level I/O statistics",
				"Review disk utilization and latency",
				"Check for slow network operations",
				"Consider SSD upgrade or storage optimization",
			},
			EvidenceType: evidence.TypeVmstat,
		})
	}

	for _, sample := range ev.Samples {
		if sample.Si > 0 || sample.So > 0 {
			bottlenecks = append(bottlenecks, evidence.Bottleneck{
				Category:        evidence.CategoryMemory,
				Severity:        evidence.SeverityMajor,
				Timestamp:       sample.Timestamp,
				Description:     fmt.Sprintf("Swap activity detected: si=%d, so=%d", sample.Si, sample.So),
				EvidenceSources: []evidence.EvidenceType{evidence.TypeVmstat},
			})

			recommendations = append(recommendations, evidence.Recommendation{
				Priority:    evidence.PriorityHigh,
				Title:       "Swap thrashing detected",
				Description: "System is actively swapping to/from disk",
				ActionSteps: []string{
					"Identify memory-hungry processes",
					"Consider increasing physical RAM",
					"Adjust swappiness setting",
					"Check for memory leaks",
				},
				EvidenceType: evidence.TypeVmstat,
			})
			break
		}
	}

	avgCPU := e.calculateAvgCPU(ev.Samples)
	if avgCPU.Us > 80 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryCPU,
			Severity:        evidence.SeverityMajor,
			Timestamp:       ev.Samples[0].Timestamp,
			Description:     fmt.Sprintf("High user CPU usage: %.1f%% average", avgCPU.Us),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeVmstat},
		})
	}

	if avgCPU.Sy > 50 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryCPU,
			Severity:        evidence.SeverityMajor,
			Timestamp:       ev.Samples[0].Timestamp,
			Description:     fmt.Sprintf("High system CPU usage: %.1f%% average", avgCPU.Sy),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeVmstat},
		})

		recommendations = append(recommendations, evidence.Recommendation{
			Priority:    evidence.PriorityMedium,
			Title:       "High system call overhead",
			Description: "Significant CPU time spent in kernel mode",
			ActionSteps: []string{
				"Review strace for frequent system calls",
				"Check for excessive context switching",
				"Profile kernel functions with perf",
			},
			EvidenceType: evidence.TypeVmstat,
		})
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) analyzeIostat(ev *evidence.IostatEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Samples) == 0 {
		return bottlenecks, recommendations
	}

	for _, sample := range ev.Samples {
		for _, device := range sample.Devices {
			if device.Util > 90 {
				bottlenecks = append(bottlenecks, evidence.Bottleneck{
					Category:        evidence.CategoryIO,
					Severity:        evidence.SeverityBlocker,
					Timestamp:       sample.Timestamp,
					Duration:        time.Duration(len(ev.Samples)) * time.Second,
					Description:     fmt.Sprintf("Device %s is saturated (%.1f%% utilization)", device.Device, device.Util),
					EvidenceSources: []evidence.EvidenceType{evidence.TypeIostat},
					SupportingData: map[string]interface{}{
						"device":     device.Device,
						"util":       device.Util,
						"await":      device.Await,
						"svctm":      device.SVCTM,
						"read_iops":  device.ReadIOPS,
						"write_iops": device.WriteIOPS,
					},
				})

				recommendations = append(recommendations, evidence.Recommendation{
					Priority:    evidence.PriorityImmediate,
					Title:       fmt.Sprintf("Storage device %s saturated", device.Device),
					Description: fmt.Sprintf("Disk utilization is %.1f%%, causing I/O bottleneck", device.Util),
					ActionSteps: []string{
						"Check for large file operations",
						"Review database query patterns",
						"Consider RAID or faster storage",
						"Check for disk errors in dmesg",
					},
					EvidenceType: evidence.TypeIostat,
				})
			}

			if device.Await > 100 {
				bottlenecks = append(bottlenecks, evidence.Bottleneck{
					Category:        evidence.CategoryIO,
					Severity:        evidence.SeverityMajor,
					Timestamp:       sample.Timestamp,
					Description:     fmt.Sprintf("High I/O latency on %s: avg wait %.1fms", device.Device, device.Await),
					EvidenceSources: []evidence.EvidenceType{evidence.TypeIostat},
				})
			}
		}
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) analyzeSs(ev *evidence.SsEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Samples) == 0 {
		return bottlenecks, recommendations
	}

	firstSample := ev.Samples[0]

	if firstSample.TCPStates["TIME_WAIT"] > 1000 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryNetwork,
			Severity:        evidence.SeverityMinor,
			Timestamp:       firstSample.Timestamp,
			Description:     fmt.Sprintf("High TIME_WAIT connections: %d", firstSample.TCPStates["TIME_WAIT"]),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeSs},
		})

		recommendations = append(recommendations, evidence.Recommendation{
			Priority:    evidence.PriorityMedium,
			Title:       "High TIME_WAIT connections",
			Description: "Connection pool may not be properly reused",
			ActionSteps: []string{
				"Enable TCP keepalives",
				"Adjust tcp_fin_timeout",
				"Review client connection pooling",
			},
			EvidenceType: evidence.TypeSs,
		})
	}

	if firstSample.TCPStates["ESTABLISHED"] > 5000 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryNetwork,
			Severity:        evidence.SeverityMajor,
			Timestamp:       firstSample.Timestamp,
			Description:     fmt.Sprintf("High number of established connections: %d", firstSample.TCPStates["ESTABLISHED"]),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeSs},
		})
	}

	var blockedConns []evidence.NetworkConnection
	for _, conn := range firstSample.Connections {
		if conn.State == "SYN_SENT" || conn.State == "SYN_RECV" {
			blockedConns = append(blockedConns, conn)
		}
	}

	if len(blockedConns) > 0 {
		bottlenecks = append(bottlenecks, evidence.Bottleneck{
			Category:        evidence.CategoryNetwork,
			Severity:        evidence.SeverityMajor,
			Timestamp:       firstSample.Timestamp,
			Description:     fmt.Sprintf("%d connections in SYN state - possible port exhaustion or firewall issue", len(blockedConns)),
			EvidenceSources: []evidence.EvidenceType{evidence.TypeSs},
		})

		recommendations = append(recommendations, evidence.Recommendation{
			Priority:    evidence.PriorityHigh,
			Title:       "Connections stuck in SYN state",
			Description: "Possible network or firewall issues",
			ActionSteps: []string{
				"Check firewall rules",
				"Verify SYN cookies are enabled",
				"Review port range and ephemeral port exhaustion",
				"Check for network congestion",
			},
			EvidenceType: evidence.TypeSs,
		})
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) analyzeStrace(ev *evidence.StraceEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Events) == 0 {
		return bottlenecks, recommendations
	}

	if len(ev.BlockedCalls) > 0 {
		for _, call := range ev.BlockedCalls {
			if call.Duration > 1*time.Second {
				bottlenecks = append(bottlenecks, evidence.Bottleneck{
					Category:        evidence.CategorySyscall,
					Severity:        evidence.SeverityMajor,
					Timestamp:       call.Timestamp,
					Duration:        call.Duration,
					Description:     fmt.Sprintf("Slow syscall: %s took %v (PID: %d)", call.Syscall, call.Duration, call.PID),
					EvidenceSources: []evidence.EvidenceType{evidence.TypeStrace},
					SupportingData: map[string]interface{}{
						"pid":        call.PID,
						"syscall":    call.Syscall,
						"duration":   call.Duration.String(),
						"arguments":  call.Arguments,
						"return_val": call.ReturnValue,
					},
				})
			}
		}
	}

	for syscall, stats := range ev.SyscallStats {
		if stats.Errors > 0 {
			errorRate := float64(stats.Errors) / float64(stats.Count) * 100
			if errorRate > 5 {
				bottlenecks = append(bottlenecks, evidence.Bottleneck{
					Category:        evidence.CategorySyscall,
					Severity:        evidence.SeverityMajor,
					Description:     fmt.Sprintf("High error rate for %s: %.1f%% (%d/%d errors)", syscall, errorRate, stats.Errors, stats.Count),
					EvidenceSources: []evidence.EvidenceType{evidence.TypeStrace},
				})
			}
		}
	}

	if len(ev.SyscallStats) > 0 {
		var topCalls []struct {
			name  string
			stats struct {
				Count     int
				TotalTime time.Duration
				AvgTime   time.Duration
				Errors    int
			}
		}

		for name, stats := range ev.SyscallStats {
			topCalls = append(topCalls, struct {
				name  string
				stats struct {
					Count     int
					TotalTime time.Duration
					AvgTime   time.Duration
					Errors    int
				}
			}{name: name, stats: stats})
		}

		sort.Slice(topCalls, func(i, j int) bool {
			return topCalls[i].stats.TotalTime > topCalls[j].stats.TotalTime
		})

		if len(topCalls) > 0 {
			topCall := topCalls[0]
			if topCall.stats.TotalTime > 1*time.Second {
				recommendations = append(recommendations, evidence.Recommendation{
					Priority:    evidence.PriorityMedium,
					Title:       fmt.Sprintf("Optimize %s syscalls", topCall.name),
					Description: fmt.Sprintf("%s consumed %v across %d calls", topCall.name, topCall.stats.TotalTime, topCall.stats.Count),
					ActionSteps: []string{
						"Batch similar syscalls",
						"Consider using more efficient alternatives",
						"Review error handling patterns",
					},
					EvidenceType: evidence.TypeStrace,
				})
			}
		}
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) analyzePerfScript(ev *evidence.PerfScriptEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Stacks) == 0 {
		return bottlenecks, recommendations
	}

	if len(ev.HotFunctions) > 0 {
		var hotFuncs []struct {
			name  string
			count int
			pct   float64
		}

		for name, fn := range ev.HotFunctions {
			hotFuncs = append(hotFuncs, struct {
				name  string
				count int
				pct   float64
			}{name: name, count: fn.SampleCount, pct: fn.Percent})
		}

		sort.Slice(hotFuncs, func(i, j int) bool {
			return hotFuncs[i].pct > hotFuncs[j].pct
		})

		if len(hotFuncs) > 0 && hotFuncs[0].pct > 30 {
			topFunc := hotFuncs[0]
			bottlenecks = append(bottlenecks, evidence.Bottleneck{
				Category:        evidence.CategoryCPU,
				Severity:        evidence.SeverityMajor,
				Description:     fmt.Sprintf("Hot function: %s (%.1f%% of samples)", topFunc.name, topFunc.pct),
				EvidenceSources: []evidence.EvidenceType{evidence.TypePerfScript},
				SupportingData: map[string]interface{}{
					"function":   topFunc.name,
					"percentage": topFunc.pct,
					"samples":    topFunc.count,
				},
			})

			recommendations = append(recommendations, evidence.Recommendation{
				Priority:    evidence.PriorityHigh,
				Title:       fmt.Sprintf("Optimize hot function: %s", topFunc.name),
				Description: fmt.Sprintf("This function consumes %.1f%% of CPU time", topFunc.pct),
				ActionSteps: []string{
					"Review algorithm complexity",
					"Check for unnecessary computations",
					"Consider caching frequent results",
					"Profile with perf record for more detail",
				},
				EvidenceType: evidence.TypePerfScript,
			})
		}
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) analyzeFoldedStack(ev *evidence.FoldedStackEvidence) ([]evidence.Bottleneck, []evidence.Recommendation) {
	var bottlenecks []evidence.Bottleneck
	var recommendations []evidence.Recommendation

	if len(ev.Stacks) == 0 {
		return bottlenecks, recommendations
	}

	if len(ev.HotSymbols) > 0 {
		var hotSyms []struct {
			name  string
			count int
		}

		for name, count := range ev.HotSymbols {
			hotSyms = append(hotSyms, struct {
				name  string
				count int
			}{name: name, count: count})
		}

		sort.Slice(hotSyms, func(i, j int) bool {
			return hotSyms[i].count > hotSyms[j].count
		})

		if len(hotSyms) > 0 {
			topSym := hotSyms[0]
			percent := float64(topSym.count) / float64(ev.TotalSamples) * 100

			if percent > 30 {
				bottlenecks = append(bottlenecks, evidence.Bottleneck{
					Category:        evidence.CategoryCPU,
					Severity:        evidence.SeverityMajor,
					Description:     fmt.Sprintf("Hot symbol: %s (%d samples, %.1f%%)", topSym.name, topSym.count, percent),
					EvidenceSources: []evidence.EvidenceType{evidence.TypeFoldedStack},
				})

				recommendations = append(recommendations, evidence.Recommendation{
					Priority:    evidence.PriorityHigh,
					Title:       fmt.Sprintf("Analyze hot path: %s", topSym.name),
					Description: fmt.Sprintf("This symbol appears in %.1f%% of stack samples", percent),
					ActionSteps: []string{
						"Generate flamegraph for visualization",
						"Review callers of this function",
						"Check for optimization opportunities",
					},
					EvidenceType: evidence.TypeFoldedStack,
				})
			}
		}
	}

	return bottlenecks, recommendations
}

func (e *AnalysisEngine) correlateBottlenecks(
	bottlenecks []evidence.Bottleneck,
	evidences []evidence.Evidence,
) []evidence.Bottleneck {
	if len(bottlenecks) == 0 {
		return bottlenecks
	}

	ioBottlenecks := make(map[int]bool)
	for i, bn := range bottlenecks {
		if bn.Category == evidence.CategoryIO && bn.Severity == evidence.SeverityBlocker {
			ioBottlenecks[i] = true
		}
	}

	for i, bn := range bottlenecks {
		if bn.Category == evidence.CategoryCPU &&
			len(ioBottlenecks) > 0 {
			for ioIdx := range ioBottlenecks {
				ioBn := bottlenecks[ioIdx]
				if !bn.Timestamp.IsZero() && !ioBn.Timestamp.IsZero() {
					diff := bn.Timestamp.Sub(ioBn.Timestamp)
					if diff < 5*time.Second && diff > -5*time.Second {
						bottlenecks[i].Description += " (likely I/O-induced)"
						bottlenecks[i].EvidenceSources = append(
							bottlenecks[i].EvidenceSources,
							evidence.TypeIostat,
						)
					}
				}
			}
		}
	}

	return bottlenecks
}

func (e *AnalysisEngine) deduplicateRecommendations(
	recommendations []evidence.Recommendation,
) []evidence.Recommendation {
	if len(recommendations) == 0 {
		return recommendations
	}

	seen := make(map[string]bool)
	var unique []evidence.Recommendation

	for _, rec := range recommendations {
		key := rec.Title
		if !seen[key] {
			seen[key] = true
			unique = append(unique, rec)
		}
	}

	return unique
}

func (e *AnalysisEngine) generateSummary(
	alignment evidence.AlignmentResult,
	bottlenecks []evidence.Bottleneck,
	recommendations []evidence.Recommendation,
) string {
	var summary strings.Builder

	summary.WriteString("## Performance Analysis Summary\n\n")

	if alignment.IsAligned {
		summary.WriteString("✓ All evidence timelines are aligned\n")
	} else {
		summary.WriteString("⚠ Timeline alignment issues detected:\n")
		for _, gap := range alignment.Gaps {
			summary.WriteString(fmt.Sprintf("  - %s: %s\n", gap.EvidenceType, gap.Reason))
		}
	}

	summary.WriteString(fmt.Sprintf("\n### Analysis Period: %v\n\n", alignment.TotalDuration))

	if len(bottlenecks) > 0 {
		summary.WriteString(fmt.Sprintf("### Found %d Bottlenecks:\n\n", len(bottlenecks)))

		severityCount := make(map[evidence.BottleneckSeverity]int)
		categoryCount := make(map[evidence.BottleneckCategory]int)

		for _, bn := range bottlenecks {
			severityCount[bn.Severity]++
			categoryCount[bn.Category]++
		}

		if severityCount[evidence.SeverityBlocker] > 0 {
			summary.WriteString(fmt.Sprintf("🔴 Blocker: %d\n", severityCount[evidence.SeverityBlocker]))
		}
		if severityCount[evidence.SeverityMajor] > 0 {
			summary.WriteString(fmt.Sprintf("🟠 Major: %d\n", severityCount[evidence.SeverityMajor]))
		}
		if severityCount[evidence.SeverityMinor] > 0 {
			summary.WriteString(fmt.Sprintf("🟡 Minor: %d\n", severityCount[evidence.SeverityMinor]))
		}

		summary.WriteString("\nBy Category:\n")
		for cat, count := range categoryCount {
			summary.WriteString(fmt.Sprintf("  - %s: %d\n", cat, count))
		}
	} else {
		summary.WriteString("### No significant bottlenecks detected\n")
	}

	if len(recommendations) > 0 {
		summary.WriteString(fmt.Sprintf("\n### %d Recommendations:\n\n", len(recommendations)))
		for _, rec := range recommendations {
			priorityIcon := "🔵"
			if rec.Priority == evidence.PriorityImmediate {
				priorityIcon = "🔴"
			} else if rec.Priority == evidence.PriorityHigh {
				priorityIcon = "🟠"
			}
			summary.WriteString(fmt.Sprintf("%s [%s] %s\n", priorityIcon, rec.Priority, rec.Title))
		}
	}

	return summary.String()
}

func (e *AnalysisEngine) calculateAvgWa(samples []evidence.VmstatSample) float64 {
	if len(samples) == 0 {
		return 0
	}
	var sum float64
	for _, s := range samples {
		sum += s.Wa
	}
	return sum / float64(len(samples))
}

func (e *AnalysisEngine) calculateAvgCPU(samples []evidence.VmstatSample) evidence.VmstatSample {
	if len(samples) == 0 {
		return evidence.VmstatSample{}
	}
	var us, sy, id, wa, st float64
	for _, s := range samples {
		us += s.Us
		sy += s.Sy
		id += s.Id
		wa += s.Wa
		st += s.St
	}
	n := float64(len(samples))
	return evidence.VmstatSample{
		Us: us / n,
		Sy: sy / n,
		Id: id / n,
		Wa: wa / n,
		St: st / n,
	}
}
