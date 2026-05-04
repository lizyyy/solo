package schema

import (
	"bufio"
	"os"
	"regexp"
	"strings"
)

type ProtoSchema struct {
	Package  string
	Messages []ProtoMessage
	Enums    []ProtoEnum
}

type ProtoMessage struct {
	Name   string
	Fields []ProtoField
}

type ProtoField struct {
	Name      string
	Number    int
	Type      string
	Label     string
	IsRepeated bool
}

type ProtoEnum struct {
	Name   string
	Values []ProtoEnumValue
}

type ProtoEnumValue struct {
	Name   string
	Number int
}

var (
	messageRegex = regexp.MustCompile(`^\s*message\s+(\w+)\s*\{`)
	enumRegex    = regexp.MustCompile(`^\s*enum\s+(\w+)\s*\{`)
	fieldRegex   = regexp.MustCompile(`^\s*(repeated|optional|required)?\s*(\w+)\s+(\w+)\s*=\s*(\d+)\s*;`)
	enumValueRegex = regexp.MustCompile(`^\s*(\w+)\s*=\s*(-?\d+)\s*;`)
	packageRegex = regexp.MustCompile(`^\s*package\s+([\w.]+)\s*;`)
)

func ParseProtoFile(filePath string) (*ProtoSchema, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	return ParseProtoData(data)
}

func ParseProtoData(data []byte) (*ProtoSchema, error) {
	schema := &ProtoSchema{}
	scanner := bufio.NewScanner(strings.NewReader(string(data)))

	var currentMessage *ProtoMessage
	var currentEnum *ProtoEnum
	inMessage := false
	inEnum := false
	braceCount := 0

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		if line == "" || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "/*") {
			continue
		}

		if matches := packageRegex.FindStringSubmatch(line); matches != nil {
			schema.Package = matches[1]
			continue
		}

		if matches := messageRegex.FindStringSubmatch(line); matches != nil {
			currentMessage = &ProtoMessage{Name: matches[1]}
			inMessage = true
			braceCount = 1
			continue
		}

		if matches := enumRegex.FindStringSubmatch(line); matches != nil {
			currentEnum = &ProtoEnum{Name: matches[1]}
			inEnum = true
			braceCount = 1
			continue
		}

		if strings.Contains(line, "{") {
			braceCount++
		}
		if strings.Contains(line, "}") {
			braceCount--
			if braceCount == 0 {
				if inMessage && currentMessage != nil {
					schema.Messages = append(schema.Messages, *currentMessage)
					inMessage = false
					currentMessage = nil
				}
				if inEnum && currentEnum != nil {
					schema.Enums = append(schema.Enums, *currentEnum)
					inEnum = false
					currentEnum = nil
				}
			}
			continue
		}

		if inMessage && currentMessage != nil {
			if matches := fieldRegex.FindStringSubmatch(line); matches != nil {
				label := matches[1]
				fieldType := matches[2]
				fieldName := matches[3]
				fieldNum := atoi(matches[4])

				field := ProtoField{
					Name:       fieldName,
					Number:     fieldNum,
					Type:       fieldType,
					Label:      label,
					IsRepeated: label == "repeated",
				}
				currentMessage.Fields = append(currentMessage.Fields, field)
			}
		}

		if inEnum && currentEnum != nil {
			if matches := enumValueRegex.FindStringSubmatch(line); matches != nil {
				valueName := matches[1]
				valueNum := atoi(matches[2])
				currentEnum.Values = append(currentEnum.Values, ProtoEnumValue{
					Name:   valueName,
					Number: valueNum,
				})
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return schema, nil
}

func atoi(s string) int {
	num := 0
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			num = num*10 + int(s[i]-'0')
		}
	}
	return num
}
