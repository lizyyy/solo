package parser

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type Parser struct {
	protoFiles []*ProtoFile
	verbose    bool
}

func NewParser(verbose bool) *Parser {
	return &Parser{
		protoFiles: make([]*ProtoFile, 0),
		verbose:    verbose,
	}
}

func (p *Parser) ParsePath(path string) ([]*ProtoFile, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("failed to stat path: %w", err)
	}

	if info.IsDir() {
		return p.parseDirectory(path)
	}

	protoFile, err := p.parseFile(path)
	if err != nil {
		return nil, err
	}
	return []*ProtoFile{protoFile}, nil
}

func (p *Parser) parseDirectory(dir string) ([]*ProtoFile, error) {
	var result []*ProtoFile

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".proto") {
			protoFile, err := p.parseFile(path)
			if err != nil {
				return err
			}
			result = append(result, protoFile)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	return result, nil
}

func (p *Parser) parseFile(filePath string) (*ProtoFile, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	protoFile := &ProtoFile{
		FilePath: filePath,
		Errors:   make([]ParseError, 0),
	}

	scanner := bufio.NewScanner(file)
	lineNum := 0

	var currentMessage *Message
	var currentEnum *Enum
	var currentService *Service

	inComment := false

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		trimmedLine := strings.TrimSpace(line)

		if strings.Contains(trimmedLine, "/*") {
			inComment = true
		}
		if strings.Contains(trimmedLine, "*/") {
			inComment = false
			continue
		}
		if inComment || strings.HasPrefix(trimmedLine, "//") || trimmedLine == "" {
			continue
		}

		if err := p.parseLine(protoFile, line, trimmedLine, lineNum, &currentMessage, &currentEnum, &currentService); err != nil {
			protoFile.Errors = append(protoFile.Errors, ParseError{
				FilePath: filePath,
				Line:     lineNum,
				Message:  err.Error(),
				RawLine:  line,
			})
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	p.analyzeRisks(protoFile)

	return protoFile, nil
}

func (p *Parser) parseLine(protoFile *ProtoFile, line, trimmedLine string, lineNum int,
	currentMessage **Message, currentEnum **Enum, currentService **Service) error {

	syntaxRegex := regexp.MustCompile(`^syntax\s*=\s*"([^"]+)"\s*;`)
	if match := syntaxRegex.FindStringSubmatch(trimmedLine); match != nil {
		protoFile.Syntax = match[1]
		return nil
	}

	packageRegex := regexp.MustCompile(`^package\s+([^;]+)\s*;`)
	if match := packageRegex.FindStringSubmatch(trimmedLine); match != nil {
		protoFile.PackageName = strings.TrimSpace(match[1])
		return nil
	}

	importRegex := regexp.MustCompile(`^import\s+"([^"]+)"\s*;`)
	if match := importRegex.FindStringSubmatch(trimmedLine); match != nil {
		protoFile.Imports = append(protoFile.Imports, match[1])
		return nil
	}

	messageRegex := regexp.MustCompile(`^message\s+(\w+)\s*\{`)
	if match := messageRegex.FindStringSubmatch(trimmedLine); match != nil {
		*currentMessage = &Message{
			Name:   match[1],
			Line:   lineNum,
			Fields: make([]Field, 0),
		}
		return nil
	}

	enumRegex := regexp.MustCompile(`^enum\s+(\w+)\s*\{`)
	if match := enumRegex.FindStringSubmatch(trimmedLine); match != nil {
		*currentEnum = &Enum{
			Name:   match[1],
			Line:   lineNum,
			Values: make([]EnumValue, 0),
		}
		return nil
	}

	serviceRegex := regexp.MustCompile(`^service\s+(\w+)\s*\{`)
	if match := serviceRegex.FindStringSubmatch(trimmedLine); match != nil {
		*currentService = &Service{
			Name:    match[1],
			Line:    lineNum,
			Methods: make([]Method, 0),
		}
		return nil
	}

	if trimmedLine == "}" {
		if *currentMessage != nil {
			protoFile.Messages = append(protoFile.Messages, **currentMessage)
			*currentMessage = nil
		}
		if *currentEnum != nil {
			protoFile.Enums = append(protoFile.Enums, **currentEnum)
			*currentEnum = nil
		}
		if *currentService != nil {
			protoFile.Services = append(protoFile.Services, **currentService)
			*currentService = nil
		}
		return nil
	}

	if *currentMessage != nil {
		if err := p.parseMessageField(*currentMessage, trimmedLine, lineNum); err != nil {
			return err
		}
		return nil
	}

	if *currentEnum != nil {
		if err := p.parseEnumValue(*currentEnum, trimmedLine, lineNum); err != nil {
			return err
		}
		return nil
	}

	if *currentService != nil {
		if err := p.parseServiceMethod(*currentService, trimmedLine, lineNum); err != nil {
			return err
		}
		return nil
	}

	if trimmedLine != "" {
		return fmt.Errorf("unrecognized syntax")
	}

	return nil
}

func (p *Parser) parseEnumValue(enum *Enum, trimmedLine string, lineNum int) error {
	enumValueRegex := regexp.MustCompile(`^\s*(\w+)\s*=\s*(-?\d+)\s*;`)
	if match := enumValueRegex.FindStringSubmatch(trimmedLine); match != nil {
		num, _ := strconv.Atoi(match[2])
		enum.Values = append(enum.Values, EnumValue{
			Name:   match[1],
			Line:   lineNum,
			Number: num,
		})
		return nil
	}
	return nil
}

func (p *Parser) parseMessageField(message *Message, trimmedLine string, lineNum int) error {
	if strings.Contains(trimmedLine, "reserved") || strings.Contains(trimmedLine, "option") {
		return nil
	}

	fieldRegex := regexp.MustCompile(`^\s*(repeated|optional|required)?\s*(\w+)\s+(\w+)\s*=\s*(\d+)\s*(?:\[([^\]]+)\])?\s*;`)
	if match := fieldRegex.FindStringSubmatch(trimmedLine); match != nil {
		label := match[1]
		fieldType := match[2]
		name := match[3]
		num, _ := strconv.Atoi(match[4])
		optionsStr := match[5]

		var options []string
		if optionsStr != "" {
			options = strings.Split(optionsStr, ",")
			for i, opt := range options {
				options[i] = strings.TrimSpace(opt)
			}
		}

		field := Field{
			Name:       name,
			Line:       lineNum,
			Type:       fieldType,
			Number:     num,
			Label:      label,
			IsExplicit: false,
			Options:    options,
		}

		if defaultValue, ok := Proto3Defaults[fieldType]; ok {
			field.DefaultValue = defaultValue
		} else {
			field.DefaultValue = nil
		}

		for _, opt := range options {
			if strings.HasPrefix(opt, "default") {
				field.IsExplicit = true
			}
		}

		message.Fields = append(message.Fields, field)

		return nil
	}

	return nil
}

func (p *Parser) parseServiceMethod(service *Service, trimmedLine string, lineNum int) error {
	rpcRegex := regexp.MustCompile(`^\s*rpc\s+(\w+)\s*\(\s*(stream)?\s*(\w+)\s*\)\s*returns\s*\(\s*(stream)?\s*(\w+)\s*\)`)
	if match := rpcRegex.FindStringSubmatch(trimmedLine); match != nil {
		service.Methods = append(service.Methods, Method{
			Name:         match[1],
			Line:         lineNum,
			InputType:    match[3],
			OutputType:   match[5],
			ClientStream: match[2] == "stream",
			ServerStream: match[4] == "stream",
		})
	}
	return nil
}

func (p *Parser) analyzeRisks(protoFile *ProtoFile) {
	for mi, msg := range protoFile.Messages {
		for fi, field := range msg.Fields {
			riskLevel, riskReason := p.analyzeFieldRisk(field, protoFile)
			protoFile.Messages[mi].Fields[fi].RiskLevel = string(riskLevel)
			protoFile.Messages[mi].Fields[fi].RiskReason = riskReason
		}
	}
}

func (p *Parser) analyzeFieldRisk(field Field, protoFile *ProtoFile) (RiskLevel, string) {
	isProto3 := protoFile.Syntax == "proto3"

	if !isProto3 {
		return RiskLow, "Proto2 has explicit default value semantics"
	}

	if field.Label == "repeated" {
		return RiskLow, "Repeated fields default to empty list"
	}

	if field.IsExplicit {
		return RiskLow, "Explicit default value specified"
	}

	switch field.Type {
	case "string":
		return RiskHigh, "Empty string '' is ambiguous - could be unset or intentionally empty"
	case "bool":
		return RiskMedium, "False could mean unset or intentionally false"
	case "int32", "int64", "uint32", "uint64", "sint32", "sint64", "fixed32", "fixed64", "sfixed32", "sfixed64":
		return RiskHigh, "Zero value is ambiguous - could mean unset or intentionally zero"
	case "float", "double":
		return RiskHigh, "Zero value is ambiguous - could mean unset or intentionally zero"
	case "bytes":
		return RiskMedium, "Empty bytes could mean unset or intentionally empty"
	default:
		for _, enum := range protoFile.Enums {
			if enum.Name == field.Type {
				if len(enum.Values) > 0 {
					return RiskHigh, fmt.Sprintf("Enum default is first value '%s' - could be ambiguous", enum.Values[0].Name)
				}
			}
		}
		return RiskLow, "Message type defaults to nil"
	}
}
