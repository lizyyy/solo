package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gcinsight/models"
)

type GCTraceParser struct {
}

type ParseError struct {
	LineNumber int
	Line       string
	Message    string
	Cause      error
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("line %d: %s: %s", e.LineNumber, e.Message, e.Line)
}

func (e *ParseError) LineNum() int {
	return e.LineNumber
}

func (e *ParseError) LineContent() string {
	return e.Line
}

func (e *ParseError) ErrorMessage() string {
	return e.Message
}

func NewGCTraceParser() *GCTraceParser {
	return &GCTraceParser{}
}

func (p *GCTraceParser) ParseFile(filePath string) ([]models.GCTraceEntry, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	return p.Parse(file)
}

func (p *GCTraceParser) Parse(reader io.Reader) ([]models.GCTraceEntry, error) {
	scanner := bufio.NewScanner(reader)
	var entries []models.GCTraceEntry
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		if line == "" {
			continue
		}

		entry, err := p.parseLine(line, lineNum)
		if err != nil {
			return nil, err
		}

		if entry != nil {
			entries = append(entries, *entry)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return entries, nil
}

func (p *GCTraceParser) parseLine(line string, lineNum int) (*models.GCTraceEntry, error) {
	if strings.HasPrefix(line, "gc ") {
		return p.parseGCLine(line, lineNum)
	}

	if strings.HasPrefix(line, "scvg:") {
		return p.parseScavengeLine(line, lineNum)
	}

	return nil, nil
}

func (p *GCTraceParser) parseGCLine(line string, lineNum int) (*models.GCTraceEntry, error) {
	gcLinePattern := regexp.MustCompile(
		`gc (\d+) @([\d.]+)s ([\d.]+)%: ([\d.]+)\+([\d.]+)\+([\d.]+) ms clock, ` +
			`([\d.]+)\+([\d.]+)/([\d.]+)/([\d.]+)\+([\d.]+) ms cpu, ` +
			`(\d+)->(\d+)->(\d+) MB, (\d+) MB goal, (\d+) P(?:, assisted: (\d+) goroutines, ([\d.]+) MB)?`,
	)

	matches := gcLinePattern.FindStringSubmatch(line)
	if matches == nil {
		return nil, &ParseError{
			LineNumber: lineNum,
			Line:       line,
			Message:    "unrecognized GC line format",
		}
	}

	gcNumber, _ := strconv.Atoi(matches[1])
	startTimestamp, _ := strconv.ParseFloat(matches[2], 64)
	cpuPercent, _ := strconv.ParseFloat(matches[3], 64)

	markStartWall, _ := strconv.ParseFloat(matches[4], 64)
	markWall, _ := strconv.ParseFloat(matches[5], 64)
	markEndWall, _ := strconv.ParseFloat(matches[6], 64)

	markAssistCPU, _ := strconv.ParseFloat(matches[7], 64)
	markBackgroundCPU, _ := strconv.ParseFloat(matches[8], 64)
	markIdleCPU, _ := strconv.ParseFloat(matches[9], 64)
	scavengeCPU, _ := strconv.ParseFloat(matches[10], 64)
	markTermCPU, _ := strconv.ParseFloat(matches[11], 64)

	heapBefore, _ := strconv.ParseUint(matches[12], 10, 64)
	heapMarked, _ := strconv.ParseUint(matches[13], 10, 64)
	heapAfter, _ := strconv.ParseUint(matches[14], 10, 64)
	heapGoal, _ := strconv.ParseUint(matches[15], 10, 64)
	numProcessors, _ := strconv.Atoi(matches[16])

	_ = markStartWall
	_ = markEndWall
	_ = markAssistCPU
	_ = markBackgroundCPU
	_ = markIdleCPU
	_ = scavengeCPU
	_ = markTermCPU
	_ = numProcessors
	_ = heapAfter

	totalWallTime := markStartWall + markWall + markEndWall
	totalCPUTime := markAssistCPU + markBackgroundCPU + markIdleCPU + scavengeCPU + markTermCPU

	cpuFraction := 0.0
	if totalWallTime > 0 {
		cpuFraction = totalCPUTime / (totalWallTime * float64(numProcessors))
	}

	_ = cpuPercent

	assistedG := 0
	assistedBytes := uint64(0)
	if len(matches) > 17 && matches[17] != "" {
		assistedG, _ = strconv.Atoi(matches[17])
		if matches[18] != "" {
			assistedMB, _ := strconv.ParseFloat(matches[18], 64)
			assistedBytes = uint64(assistedMB * 1024 * 1024)
		}
	}

	entry := &models.GCTraceEntry{
		Timestamp:      time.Now().Add(-time.Duration(startTimestamp * float64(time.Second))),
		GCNumber:       gcNumber,
		Phase:          "mark",
		StartTimestamp: startTimestamp,
		PauseDuration:  time.Duration(totalWallTime * float64(time.Millisecond)),
		HeapInUse:      heapBefore * 1024 * 1024,
		HeapGoal:       heapGoal * 1024 * 1024,
		HeapMarked:     heapMarked * 1024 * 1024,
		AssistedBytes:  assistedBytes,
		AssistedG:      assistedG,
		CPUFraction:    cpuFraction,
		GOGC:           100,
	}

	return entry, nil
}

func (p *GCTraceParser) parseScavengeLine(line string, lineNum int) (*models.GCTraceEntry, error) {
	return nil, nil
}

func ValidateGCTraceFormat(line string) error {
	if strings.HasPrefix(line, "gc ") {
		return nil
	}
	if strings.HasPrefix(line, "scvg:") {
		return nil
	}
	if line == "" {
		return nil
	}
	return fmt.Errorf("unrecognized format: expected line starting with 'gc ' or 'scvg:'")
}
