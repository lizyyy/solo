package payload

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"

	"github.com/yourname/pcheck/pkg/types"
)

func LoadPayloadsFromJSONL(filePath string) (*types.PayloadCollection, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	collection := &types.PayloadCollection{
		Payloads: []types.Payload{},
	}

	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		var parsedData map[string]interface{}
		if err := json.Unmarshal([]byte(line), &parsedData); err != nil {
			return nil, fmt.Errorf("line %d: invalid JSON: %w", lineNum, err)
		}

		payload := types.Payload{
			ID:         fmt.Sprintf("payload_%d", lineNum),
			Source:     filePath,
			RawData:    []byte(line),
			ParsedData: parsedData,
			Timestamp:  extractTimestamp(parsedData),
		}

		collection.Payloads = append(collection.Payloads, payload)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	collection.TotalCount = len(collection.Payloads)
	return collection, nil
}

func LoadClientVersionsFromCSV(filePath string) ([]types.ClientVersion, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, err
	}

	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.ToLower(h)] = i
	}

	var versions []types.ClientVersion

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		version := types.ClientVersion{
			Supported:  true,
			Deprecated: false,
		}

		if idx, ok := headerMap["version"]; ok && idx < len(record) {
			version.Version = record[idx]
		}
		if idx, ok := headerMap["min_schema"]; ok && idx < len(record) {
			version.MinSchema = record[idx]
		}
		if idx, ok := headerMap["max_schema"]; ok && idx < len(record) {
			version.MaxSchema = record[idx]
		}
		if idx, ok := headerMap["supported"]; ok && idx < len(record) {
			version.Supported = strings.ToLower(record[idx]) != "false"
		}
		if idx, ok := headerMap["deprecated"]; ok && idx < len(record) {
			version.Deprecated = strings.ToLower(record[idx]) == "true"
		}
		if idx, ok := headerMap["description"]; ok && idx < len(record) {
			version.Description = record[idx]
		}

		versions = append(versions, version)
	}

	return versions, nil
}

func LoadRulesFromYAML(filePath string) (*types.Rules, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var rules types.Rules
	if err := yaml.Unmarshal(data, &rules); err != nil {
		return nil, err
	}

	setDefaultRules(&rules)
	return &rules, nil
}

func setDefaultRules(rules *types.Rules) {
	if rules.PerformanceChecks.SampleSize == 0 {
		rules.PerformanceChecks.SampleSize = 100
	}
	if rules.PerformanceChecks.Iterations == 0 {
		rules.PerformanceChecks.Iterations = 10
	}
}

func extractTimestamp(data map[string]interface{}) int64 {
	if ts, ok := data["timestamp"].(float64); ok {
		return int64(ts)
	}
	if ts, ok := data["timestamp"].(string); ok {
		if parsed, err := strconv.ParseInt(ts, 10, 64); err == nil {
			return parsed
		}
	}
	if ts, ok := data["ts"].(float64); ok {
		return int64(ts)
	}
	if ts, ok := data["time"].(float64); ok {
		return int64(ts)
	}
	return 0
}

func SamplePayloads(collection *types.PayloadCollection, sampleSize int) *types.PayloadCollection {
	if sampleSize >= collection.TotalCount || sampleSize <= 0 {
		return collection
	}

	sampled := &types.PayloadCollection{
		Payloads: []types.Payload{},
	}

	step := collection.TotalCount / sampleSize
	for i := 0; i < sampleSize && i*step < collection.TotalCount; i++ {
		sampled.Payloads = append(sampled.Payloads, collection.Payloads[i*step])
	}
	sampled.TotalCount = len(sampled.Payloads)

	return sampled
}
