package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"time"

	"gcinsight/models"
)

type AllocEventParser struct {
}

type RawAllocEvent struct {
	Timestamp string      `json:"timestamp"`
	Type      string      `json:"type"`
	Size      interface{} `json:"size"`
	Address   interface{} `json:"address"`
	Stack     string      `json:"stack"`
	Goroutine interface{} `json:"goroutine"`
}

func NewAllocEventParser() *AllocEventParser {
	return &AllocEventParser{}
}

func (p *AllocEventParser) ParseFile(filePath string) ([]models.AllocEvent, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	return p.Parse(file)
}

func (p *AllocEventParser) Parse(reader io.Reader) ([]models.AllocEvent, error) {
	scanner := bufio.NewScanner(reader)
	var events []models.AllocEvent
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		if line == "" {
			continue
		}

		event, err := p.parseLine(line, lineNum)
		if err != nil {
			return nil, err
		}

		events = append(events, *event)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return events, nil
}

func (p *AllocEventParser) parseLine(line string, lineNum int) (*models.AllocEvent, error) {
	var raw RawAllocEvent
	if err := json.Unmarshal([]byte(line), &raw); err != nil {
		return nil, &ParseError{
			LineNumber: lineNum,
			Line:       line,
			Message:    "invalid JSON format",
			Cause:      err,
		}
	}

	event := &models.AllocEvent{}

	var err error
	event.Timestamp, err = p.parseTimestamp(raw.Timestamp)
	if err != nil {
		return nil, &ParseError{
			LineNumber: lineNum,
			Line:       line,
			Message:    "invalid timestamp format",
			Cause:      err,
		}
	}

	event.Type = raw.Type
	event.Size, err = p.parseUint64(raw.Size)
	if err != nil {
		return nil, &ParseError{
			LineNumber: lineNum,
			Line:       line,
			Message:    "invalid size value",
			Cause:      err,
		}
	}

	event.Address, _ = p.parseUint64(raw.Address)
	event.Stack = raw.Stack
	event.Goroutine, _ = p.parseInt64(raw.Goroutine)

	return event, nil
}

func (p *AllocEventParser) parseTimestamp(ts string) (time.Time, error) {
	if ts == "" {
		return time.Time{}, fmt.Errorf("empty timestamp")
	}

	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		return t, nil
	}

	if t, err := time.Parse("2006-01-02 15:04:05.999999999", ts); err == nil {
		return t, nil
	}

	if t, err := time.Parse("2006-01-02T15:04:05.999999999", ts); err == nil {
		return t, nil
	}

	if unix, err := strconv.ParseInt(ts, 10, 64); err == nil {
		if unix > 1000000000000000 {
			return time.Unix(0, unix), nil
		}
		if unix > 1000000000000 {
			return time.Unix(0, unix*1000000), nil
		}
		if unix > 1000000000 {
			return time.Unix(unix, 0), nil
		}
	}

	if unixFloat, err := strconv.ParseFloat(ts, 64); err == nil {
		sec := int64(unixFloat)
		nsec := int64((unixFloat - float64(sec)) * 1e9)
		return time.Unix(sec, nsec), nil
	}

	return time.Time{}, fmt.Errorf("unrecognized timestamp format: %s", ts)
}

func (p *AllocEventParser) parseUint64(val interface{}) (uint64, error) {
	if val == nil {
		return 0, nil
	}

	switch v := val.(type) {
	case float64:
		return uint64(v), nil
	case int64:
		return uint64(v), nil
	case int:
		return uint64(v), nil
	case string:
		if u, err := strconv.ParseUint(v, 10, 64); err == nil {
			return u, nil
		}
		if u, err := strconv.ParseUint(v, 16, 64); err == nil {
			return u, nil
		}
		return 0, fmt.Errorf("cannot parse string as uint64: %s", v)
	default:
		return 0, fmt.Errorf("unsupported type for uint64: %T", val)
	}
}

func (p *AllocEventParser) parseInt64(val interface{}) (int64, error) {
	if val == nil {
		return 0, nil
	}

	switch v := val.(type) {
	case float64:
		return int64(v), nil
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case string:
		if i, err := strconv.ParseInt(v, 10, 64); err == nil {
			return i, nil
		}
		return 0, fmt.Errorf("cannot parse string as int64: %s", v)
	default:
		return 0, fmt.Errorf("unsupported type for int64: %T", val)
	}
}
