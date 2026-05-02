package parser

import (
	"encoding/csv"
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"

	"github.com/zy8078/netpol-precheck/pkg/model"
)

func ParseTrafficIntentsCSV(filePath string) ([]model.TrafficIntent, error) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV file: %v", err)
	}

	return ParseTrafficIntentsContent(string(content))
}

func ParseTrafficIntentsContent(content string) ([]model.TrafficIntent, error) {
	var intents []model.TrafficIntent

	reader := csv.NewReader(strings.NewReader(content))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %v", err)
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("CSV file must have header and at least one data row")
	}

	header := records[0]
	headerMap := make(map[string]int)
	for i, col := range header {
		headerMap[strings.ToLower(strings.TrimSpace(col))] = i
	}

	for i, record := range records[1:] {
		intent, err := parseIntentRecord(record, headerMap, i+2)
		if err != nil {
			return nil, err
		}
		if intent != nil {
			intents = append(intents, *intent)
		}
	}

	return intents, nil
}

func parseIntentRecord(record []string, headerMap map[string]int, lineNum int) (*model.TrafficIntent, error) {
	getValue := func(name string) string {
		if idx, ok := headerMap[name]; ok && idx < len(record) {
			return strings.TrimSpace(record[idx])
		}
		return ""
	}

	srcNs := getValue("sourcenamespace")
	if srcNs == "" {
		srcNs = getValue("src_ns")
	}
	if srcNs == "" {
		srcNs = "default"
	}

	dstNs := getValue("destinationnamespace")
	if dstNs == "" {
		dstNs = getValue("dst_ns")
	}
	if dstNs == "" {
		dstNs = "default"
	}

	portStr := getValue("port")
	if portStr == "" {
		return nil, fmt.Errorf("line %d: port is required", lineNum)
	}
	port, err := strconv.ParseInt(portStr, 10, 32)
	if err != nil {
		return nil, fmt.Errorf("line %d: invalid port '%s': %v", lineNum, portStr, err)
	}

	srcLabelsStr := getValue("sourcelabels")
	srcLabels := parseLabels(srcLabelsStr)

	dstLabelsStr := getValue("destinationlabels")
	dstLabels := parseLabels(dstLabelsStr)

	protocol := getValue("protocol")
	if protocol == "" {
		protocol = "TCP"
	}

	return &model.TrafficIntent{
		SourceNamespace:      srcNs,
		SourceLabels:         srcLabels,
		DestinationNamespace: dstNs,
		DestinationLabels:    dstLabels,
		DestinationService:   getValue("destinationservice"),
		Port:                 int32(port),
		Protocol:             strings.ToUpper(protocol),
		Description:          getValue("description"),
	}, nil
}

func parseLabels(labelsStr string) map[string]string {
	labels := make(map[string]string)
	if labelsStr == "" {
		return labels
	}

	pairs := strings.Split(labelsStr, ",")
	for _, pair := range pairs {
		kv := strings.SplitN(strings.TrimSpace(pair), "=", 2)
		if len(kv) == 2 {
			k := strings.TrimSpace(kv[0])
			v := strings.TrimSpace(kv[1])
			if k != "" {
				labels[k] = v
			}
		}
	}

	return labels
}
