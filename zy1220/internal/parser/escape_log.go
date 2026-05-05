package parser

import (
	"bufio"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	"escape-analyzer/pkg/types"
)

type EscapeLogParser struct{}

func NewEscapeLogParser() *EscapeLogParser {
	return &EscapeLogParser{}
}

func (p *EscapeLogParser) Parse(reader io.Reader) ([]types.EscapeEntry, error) {
	var entries []types.EscapeEntry
	scanner := bufio.NewScanner(reader)

	for scanner.Scan() {
		line := scanner.Text()
		if entry, ok := p.parseLine(line); ok {
			entries = append(entries, entry)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading escape log: %w", err)
	}

	return entries, nil
}

func (p *EscapeLogParser) parseLine(line string) (types.EscapeEntry, bool) {
	patterns := []struct {
		regex  *regexp.Regexp
		reason types.EscapeReason
	}{
		{
			regex:  regexp.MustCompile(`^(?P<file>[^:]+):(?P<line>\d+):\d+: (?P<var>[^:]+): escapes to heap$`),
			reason: types.EscapeReasonUnknown,
		},
		{
			regex:  regexp.MustCompile(`^(?P<file>[^:]+):(?P<line>\d+):\d+: moved to heap: (?P<var>.+)$`),
			reason: types.EscapeReasonUnknown,
		},
		{
			regex:  regexp.MustCompile(`^(?P<file>[^:]+):(?P<line>\d+):\d+: leaking param: (?P<var>.+)$`),
			reason: types.EscapeReasonPointerReturn,
		},
		{
			regex:  regexp.MustCompile(`^(?P<file>[^:]+):(?P<line>\d+):\d+: (?P<var>.+) escapes to heap$`),
			reason: types.EscapeReasonUnknown,
		},
	}

	for _, pattern := range patterns {
		match := pattern.regex.FindStringSubmatch(line)
		if match == nil {
			continue
		}

		entry := types.EscapeEntry{
			RawLogEntry: line,
			Reason:      pattern.reason,
			Message:     line,
		}

		for i, name := range pattern.regex.SubexpNames() {
			switch name {
			case "file":
				entry.SourceFile = match[i]
			case "line":
				if lineNum, err := strconv.Atoi(match[i]); err == nil {
					entry.LineNumber = lineNum
				}
			case "var":
				entry.Variable = match[i]
			}
		}

		entry.Reason = p.determineReason(line, entry.Variable)

		return entry, true
	}

	return types.EscapeEntry{}, false
}

func (p *EscapeLogParser) determineReason(line, variable string) types.EscapeReason {
	lowerLine := strings.ToLower(line)

	switch {
	case strings.Contains(lowerLine, "interface") ||
		strings.Contains(lowerLine, "runtime.conv") ||
		strings.Contains(line, "does not escape") == false &&
			(strings.Contains(line, "interface") || strings.Contains(variable, "interface")):
		return types.EscapeReasonInterfaceBox

	case strings.Contains(lowerLine, "closure") ||
		strings.Contains(lowerLine, "capture"):
		return types.EscapeReasonClosureCapture

	case strings.Contains(lowerLine, "leaking param") ||
		strings.Contains(lowerLine, "return"):
		return types.EscapeReasonPointerReturn

	case strings.Contains(lowerLine, "slice") && strings.Contains(lowerLine, "grow"):
		return types.EscapeReasonSliceGrow

	case strings.Contains(lowerLine, "map"):
		return types.EscapeReasonMapGrow

	case strings.Contains(lowerLine, "goroutine") ||
		strings.Contains(lowerLine, "go "):
		return types.EscapeReasonGoroutine

	default:
		return types.EscapeReasonUnknown
	}
}

func (p *EscapeLogParser) ParseBenchmark(reader io.Reader) ([]types.BenchmarkData, error) {
	var benchmarks []types.BenchmarkData
	scanner := bufio.NewScanner(reader)

	benchmarkRegex := regexp.MustCompile(
		`^Benchmark(?P<name>\w+)-?\d*\s+(?P<iterations>\d+)\s+(?P<ns_per_op>[\d.]+)\s+ns/op(?:\s+(?P<mb_per_sec>[\d.]+)\s+MB/s)?(?:\s+(?P<bytes_per_op>\d+)\s+B/op)?(?:\s+(?P<allocs_per_op>\d+)\s+allocs/op)?$`,
	)

	for scanner.Scan() {
		line := scanner.Text()
		match := benchmarkRegex.FindStringSubmatch(line)
		if match == nil {
			continue
		}

		benchmark := types.BenchmarkData{}
		for i, name := range benchmarkRegex.SubexpNames() {
			switch name {
			case "name":
				benchmark.Name = match[i]
			case "iterations":
				if val, err := strconv.Atoi(match[i]); err == nil {
					benchmark.Iterations = val
				}
			case "ns_per_op":
				if val, err := strconv.ParseFloat(match[i], 64); err == nil {
					benchmark.NsPerOp = int64(val)
				}
			case "mb_per_sec":
				if match[i] != "" {
					if val, err := strconv.ParseFloat(match[i], 64); err == nil {
						benchmark.MBPerSec = val
					}
				}
			case "bytes_per_op":
				if val, err := strconv.ParseInt(match[i], 10, 64); err == nil {
					benchmark.BytesPerOp = val
				}
			case "allocs_per_op":
				if val, err := strconv.ParseInt(match[i], 10, 64); err == nil {
					benchmark.AllocsPerOp = val
				}
			}
		}
		benchmarks = append(benchmarks, benchmark)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading benchmark log: %w", err)
	}

	return benchmarks, nil
}
