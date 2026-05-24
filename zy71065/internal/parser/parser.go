package parser

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"proto-enum-lint/pkg/types"
)

type Parser struct {
	files []string
}

func NewParser(files []string) *Parser {
	return &Parser{files: files}
}

func (p *Parser) Parse() ([]types.ProtoFile, error) {
	var protoFiles []types.ProtoFile
	for _, file := range p.files {
		pf, err := p.parseFile(file)
		if err != nil {
			return nil, fmt.Errorf("parse file %s: %w", file, err)
		}
		protoFiles = append(protoFiles, pf)
	}
	return protoFiles, nil
}

func (p *Parser) parseFile(filePath string) (types.ProtoFile, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return types.ProtoFile{}, err
	}
	defer file.Close()

	pf := types.ProtoFile{
		FilePath: filePath,
	}

	scanner := bufio.NewScanner(file)
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	if err := scanner.Err(); err != nil {
		return types.ProtoFile{}, err
	}

	var packageName string
	var syntax string
	var messageNest []string
	var enums []types.Enum
	var currentEnum *types.Enum
	var inEnum bool
	var enumBraceCount int
	var inMessage bool
	var messageBraceCount int

	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		line = removeComments(line)

		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "syntax") {
			syntax = extractSyntax(line)
			continue
		}

		if strings.HasPrefix(line, "package") {
			packageName = extractPackage(line)
			continue
		}

		if strings.HasPrefix(line, "message") {
			msgName := extractMessageName(line)
			messageNest = append(messageNest, msgName)
			inMessage = true
			messageBraceCount += countOpenBraces(line)
			continue
		}

		if inMessage {
			messageBraceCount += countOpenBraces(line)
			messageBraceCount -= countCloseBraces(line)
			if messageBraceCount <= 0 {
				inMessage = false
				if len(messageNest) > 0 {
					messageNest = messageNest[:len(messageNest)-1]
				}
			}
		}

		if strings.HasPrefix(line, "enum") && !inEnum {
			enumName := extractEnumName(line)
			fullName := buildFullEnumName(packageName, messageNest, enumName)
			currentEnum = &types.Enum{
				Name:        enumName,
				FullName:    fullName,
				FilePath:    filePath,
				PackageName: packageName,
				MessageNest: append([]string{}, messageNest...),
			}
			inEnum = true
			enumBraceCount = countOpenBraces(line)
			continue
		}

		if inEnum {
			enumBraceCount += countOpenBraces(line)
			enumBraceCount -= countCloseBraces(line)

			if strings.HasPrefix(line, "reserved") {
				reservedList := parseReserved(line)
				currentEnum.Reserved = append(currentEnum.Reserved, reservedList...)
				continue
			}

			if isEnumValueLine(line) {
				ev := parseEnumValue(line)
				currentEnum.Values = append(currentEnum.Values, ev)
				continue
			}

			if enumBraceCount <= 0 {
				inEnum = false
				enums = append(enums, *currentEnum)
				currentEnum = nil
			}
		}
	}

	pf.PackageName = packageName
	pf.Syntax = syntax
	pf.Enums = enums

	return pf, nil
}

func removeComments(line string) string {
	if idx := strings.Index(line, "//"); idx != -1 {
		line = line[:idx]
	}
	return strings.TrimSpace(line)
}

func extractSyntax(line string) string {
	re := regexp.MustCompile(`syntax\s*=\s*"([^"]+)"`)
	matches := re.FindStringSubmatch(line)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

func extractPackage(line string) string {
	re := regexp.MustCompile(`package\s+([^;]+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

func extractMessageName(line string) string {
	re := regexp.MustCompile(`message\s+(\w+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

func extractEnumName(line string) string {
	re := regexp.MustCompile(`enum\s+(\w+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

func buildFullEnumName(pkg string, nest []string, name string) string {
	parts := []string{}
	if pkg != "" {
		parts = append(parts, pkg)
	}
	parts = append(parts, nest...)
	parts = append(parts, name)
	return strings.Join(parts, ".")
}

func countOpenBraces(line string) int {
	return strings.Count(line, "{")
}

func countCloseBraces(line string) int {
	return strings.Count(line, "}")
}

func isEnumValueLine(line string) bool {
	re := regexp.MustCompile(`^\w+\s*=\s*-?\d+`)
	return re.MatchString(line)
}

func parseEnumValue(line string) types.EnumValue {
	re := regexp.MustCompile(`^(\w+)\s*=\s*(-?\d+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) < 3 {
		return types.EnumValue{}
	}

	name := matches[1]
	num, _ := strconv.ParseInt(matches[2], 10, 32)

	isAlias := strings.Contains(line, "[(allow_alias)") || strings.Contains(line, "allow_alias")

	return types.EnumValue{
		Name:    name,
		Number:  int32(num),
		IsAlias: isAlias,
	}
}

func parseReserved(line string) []types.Reserved {
	var result []types.Reserved

	re := regexp.MustCompile(`reserved\s+(.+?);`)
	matches := re.FindStringSubmatch(line)
	if len(matches) < 2 {
		return result
	}

	content := matches[1]
	parts := strings.Split(content, ",")

	for _, part := range parts {
		part = strings.TrimSpace(part)

		if strings.HasPrefix(part, `"`) && strings.HasSuffix(part, `"`) {
			name := strings.Trim(part, `"`)
			result = append(result, types.Reserved{
				Name:     name,
				IsByName: true,
			})
			continue
		}

		if strings.Contains(part, "to") {
			rangeParts := strings.Split(part, "to")
			if len(rangeParts) == 2 {
				start, _ := strconv.ParseInt(strings.TrimSpace(rangeParts[0]), 10, 32)
				endStr := strings.TrimSpace(rangeParts[1])
				var end int64
				if endStr == "max" {
					end = int64(^uint32(0) >> 1)
				} else {
					end, _ = strconv.ParseInt(endStr, 10, 32)
				}
				result = append(result, types.Reserved{
					Start:   int32(start),
					End:     int32(end),
					IsRange: true,
				})
			}
			continue
		}

		if strings.Contains(part, "-") {
			rangeParts := strings.Split(part, "-")
			if len(rangeParts) == 2 {
				start, _ := strconv.ParseInt(strings.TrimSpace(rangeParts[0]), 10, 32)
				end, _ := strconv.ParseInt(strings.TrimSpace(rangeParts[1]), 10, 32)
				result = append(result, types.Reserved{
					Start:   int32(start),
					End:     int32(end),
					IsRange: true,
				})
			}
			continue
		}

		num, err := strconv.ParseInt(part, 10, 32)
		if err == nil {
			result = append(result, types.Reserved{
				Value:   int32(num),
				IsRange: false,
			})
		}
	}

	return result
}
