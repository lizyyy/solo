package parser

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"

	"gcinsight/models"
)

type HeapSampleParser struct {
}

func NewHeapSampleParser() *HeapSampleParser {
	return &HeapSampleParser{}
}

func (p *HeapSampleParser) ParseFile(filePath string) ([]models.HeapSample, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	return p.Parse(file)
}

func (p *HeapSampleParser) Parse(reader io.Reader) ([]models.HeapSample, error) {
	csvReader := csv.NewReader(reader)
	csvReader.TrimLeadingSpace = true

	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("empty CSV file")
	}

	headerMap := p.buildHeaderMap(records[0])
	if err := validateHeader(headerMap); err != nil {
		return nil, err
	}

	var samples []models.HeapSample
	for i := 1; i < len(records); i++ {
		sample, err := p.parseRecord(records[i], headerMap, i+1)
		if err != nil {
			return nil, err
		}
		samples = append(samples, *sample)
	}

	return samples, nil
}

func (p *HeapSampleParser) buildHeaderMap(header []string) map[string]int {
	headerMap := make(map[string]int)
	for i, col := range header {
		headerMap[col] = i
	}
	return headerMap
}

func validateHeader(headerMap map[string]int) error {
	requiredFields := []string{
		"timestamp",
		"heap_alloc",
		"heap_sys",
		"heap_inuse",
		"heap_idle",
		"heap_objects",
	}

	for _, field := range requiredFields {
		if _, exists := headerMap[field]; !exists {
			return fmt.Errorf("missing required field in header: %s", field)
		}
	}

	return nil
}

func (p *HeapSampleParser) parseRecord(record []string, headerMap map[string]int, lineNum int) (*models.HeapSample, error) {
	sample := &models.HeapSample{}

	var err error

	if idx, ok := headerMap["timestamp"]; ok {
		sample.Timestamp, err = p.parseTimestamp(record[idx])
		if err != nil {
			return nil, &ParseError{
				LineNumber: lineNum,
				Line:       record[idx],
				Message:    "invalid timestamp format",
				Cause:      err,
			}
		}
	}

	if idx, ok := headerMap["heap_alloc"]; ok {
		sample.HeapAlloc, err = strconv.ParseUint(record[idx], 10, 64)
		if err != nil {
			return nil, &ParseError{
				LineNumber: lineNum,
				Line:       record[idx],
				Message:    "invalid heap_alloc value",
				Cause:      err,
			}
		}
	}

	if idx, ok := headerMap["heap_sys"]; ok {
		sample.HeapSys, err = strconv.ParseUint(record[idx], 10, 64)
		if err != nil {
			return nil, &ParseError{
				LineNumber: lineNum,
				Line:       record[idx],
				Message:    "invalid heap_sys value",
				Cause:      err,
			}
		}
	}

	if idx, ok := headerMap["heap_inuse"]; ok {
		sample.HeapInUse, err = strconv.ParseUint(record[idx], 10, 64)
		if err != nil {
			return nil, &ParseError{
				LineNumber: lineNum,
				Line:       record[idx],
				Message:    "invalid heap_inuse value",
				Cause:      err,
			}
		}
	}

	if idx, ok := headerMap["heap_idle"]; ok {
		sample.HeapIdle, err = strconv.ParseUint(record[idx], 10, 64)
		if err != nil {
			return nil, &ParseError{
				LineNumber: lineNum,
				Line:       record[idx],
				Message:    "invalid heap_idle value",
				Cause:      err,
			}
		}
	}

	if idx, ok := headerMap["heap_released"]; ok {
		sample.HeapReleased, _ = strconv.ParseUint(record[idx], 10, 64)
	}

	if idx, ok := headerMap["heap_objects"]; ok {
		sample.HeapObjects, err = strconv.ParseUint(record[idx], 10, 64)
		if err != nil {
			return nil, &ParseError{
				LineNumber: lineNum,
				Line:       record[idx],
				Message:    "invalid heap_objects value",
				Cause:      err,
			}
		}
	}

	if idx, ok := headerMap["mallocs"]; ok {
		sample.Mallocs, _ = strconv.ParseUint(record[idx], 10, 64)
	}

	if idx, ok := headerMap["frees"]; ok {
		sample.Frees, _ = strconv.ParseUint(record[idx], 10, 64)
	}

	if idx, ok := headerMap["next_gc"]; ok {
		sample.NextGC, _ = strconv.ParseUint(record[idx], 10, 64)
	}

	if idx, ok := headerMap["last_gc"]; ok {
		sample.LastGC, _ = strconv.ParseUint(record[idx], 10, 64)
	}

	if idx, ok := headerMap["num_gc"]; ok {
		numGC, _ := strconv.ParseUint(record[idx], 10, 32)
		sample.NumGC = uint32(numGC)
	}

	if idx, ok := headerMap["num_forced_gc"]; ok {
		numForcedGC, _ := strconv.ParseUint(record[idx], 10, 32)
		sample.NumForcedGC = uint32(numForcedGC)
	}

	if idx, ok := headerMap["gc_cpu_fraction"]; ok {
		sample.GCCPUFraction, _ = strconv.ParseFloat(record[idx], 64)
	}

	return sample, nil
}

func (p *HeapSampleParser) parseTimestamp(ts string) (time.Time, error) {
	if ts == "" {
		return time.Time{}, fmt.Errorf("empty timestamp")
	}

	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		return t, nil
	}

	if t, err := time.Parse("2006-01-02 15:04:05", ts); err == nil {
		return t, nil
	}

	if t, err := time.Parse("2006-01-02T15:04:05", ts); err == nil {
		return t, nil
	}

	if unix, err := strconv.ParseInt(ts, 10, 64); err == nil {
		return time.Unix(unix, 0), nil
	}

	if unixMilli, err := strconv.ParseInt(ts, 10, 64); err == nil {
		if unixMilli > 1000000000000 {
			return time.Unix(0, unixMilli*1000000), nil
		}
	}

	if unixFloat, err := strconv.ParseFloat(ts, 64); err == nil {
		sec := int64(unixFloat)
		nsec := int64((unixFloat - float64(sec)) * 1e9)
		return time.Unix(sec, nsec), nil
	}

	return time.Time{}, fmt.Errorf("unrecognized timestamp format: %s", ts)
}
