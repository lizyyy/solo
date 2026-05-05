package config

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Parser struct{}

func NewParser() *Parser {
	return &Parser{}
}

func (p *Parser) ParseDBProfile(path string) (*DBProfile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read db-profile.yaml: %w", err)
	}

	var profile DBProfile
	if err := yaml.Unmarshal(data, &profile); err != nil {
		return nil, fmt.Errorf("failed to parse db-profile.yaml: %w", err)
	}

	if err := p.validateDBProfile(&profile); err != nil {
		return nil, err
	}

	return &profile, nil
}

func (p *Parser) validateDBProfile(profile *DBProfile) error {
	if profile.ConnectionPool.MaxOpenConns < 0 {
		return fmt.Errorf("max_open_conns cannot be negative")
	}
	if profile.ConnectionPool.MaxIdleConns < 0 {
		return fmt.Errorf("max_idle_conns cannot be negative")
	}
	if profile.ConnectionPool.MaxIdleConns > profile.ConnectionPool.MaxOpenConns && profile.ConnectionPool.MaxOpenConns > 0 {
		return fmt.Errorf("max_idle_conns (%d) cannot exceed max_open_conns (%d)",
			profile.ConnectionPool.MaxIdleConns, profile.ConnectionPool.MaxOpenConns)
	}
	return nil
}

func (p *Parser) ParseSchema(path string) (map[string]*TableSchema, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read schema.sql: %w", err)
	}

	return p.parseSchemaSQL(string(data))
}

func (p *Parser) parseSchemaSQL(sql string) (map[string]*TableSchema, error) {
	tables := make(map[string]*TableSchema)

	createTableRegex := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:` + "`" + `)?(\w+)(?:` + "`" + `)?\s*\(`)
	statements := splitSQLStatements(sql)

	for _, stmt := range statements {
		matches := createTableRegex.FindStringSubmatch(stmt)
		if len(matches) > 1 {
			tableName := matches[1]
			table, err := p.parseCreateTable(stmt)
			if err != nil {
				return nil, fmt.Errorf("failed to parse table %s: %w", tableName, err)
			}
			tables[tableName] = table
		}
	}

	return tables, nil
}

func (p *Parser) parseCreateTable(stmt string) (*TableSchema, error) {
	table := &TableSchema{}

	nameRegex := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:` + "`" + `)?(\w+)(?:` + "`" + `)?`)
	matches := nameRegex.FindStringSubmatch(stmt)
	if len(matches) > 1 {
		table.Name = matches[1]
	}

	parenStart := strings.Index(stmt, "(")
	parenEnd := strings.LastIndex(stmt, ")")
	if parenStart == -1 || parenEnd == -1 || parenStart >= parenEnd {
		return table, nil
	}

	innerSQL := stmt[parenStart+1 : parenEnd]
	parts := splitSQLParts(innerSQL)

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		if strings.HasPrefix(strings.ToUpper(part), "PRIMARY KEY") {
			cols := p.parseIndexColumns(part)
			table.Indexes = append(table.Indexes, IndexSchema{
				Name:      "PRIMARY",
				Columns:   cols,
				IsUnique:  true,
				IsPrimary: true,
				Type:      "PRIMARY",
			})
			for _, colName := range cols {
				for i := range table.Columns {
					if table.Columns[i].Name == colName {
						table.Columns[i].IsPrimaryKey = true
					}
				}
			}
		} else if strings.HasPrefix(strings.ToUpper(part), "INDEX") || strings.HasPrefix(strings.ToUpper(part), "KEY") {
			idx := p.parseIndexDefinition(part)
			table.Indexes = append(table.Indexes, idx)
		} else if strings.HasPrefix(strings.ToUpper(part), "UNIQUE") {
			idx := p.parseIndexDefinition(part)
			idx.IsUnique = true
			table.Indexes = append(table.Indexes, idx)
		} else if strings.HasPrefix(strings.ToUpper(part), "CONSTRAINT") {
			constraint := p.parseConstraint(part)
			if constraint != nil {
				table.Constraints = append(table.Constraints, *constraint)
			}
		} else {
			col := p.parseColumnDefinition(part)
			if col != nil {
				table.Columns = append(table.Columns, *col)
			}
		}
	}

	return table, nil
}

func (p *Parser) parseColumnDefinition(part string) *ColumnSchema {
	parts := strings.Fields(part)
	if len(parts) < 2 {
		return nil
	}

	col := &ColumnSchema{
		Name: strings.Trim(parts[0], "`"),
	}

	typeParts := []string{parts[1]}
	for i := 2; i < len(parts); i++ {
		if strings.HasPrefix(strings.ToUpper(parts[i]), "NOT") ||
			strings.HasPrefix(strings.ToUpper(parts[i]), "NULL") ||
			strings.HasPrefix(strings.ToUpper(parts[i]), "DEFAULT") ||
			strings.HasPrefix(strings.ToUpper(parts[i]), "PRIMARY") ||
			strings.HasPrefix(strings.ToUpper(parts[i]), "AUTO_INCREMENT") ||
			strings.HasPrefix(strings.ToUpper(parts[i]), "COMMENT") {
			break
		}
		typeParts = append(typeParts, parts[i])
	}
	col.Type = strings.Join(typeParts, " ")

	rest := strings.ToUpper(part)
	col.Nullable = !strings.Contains(rest, "NOT NULL")
	col.IsAutoIncrement = strings.Contains(rest, "AUTO_INCREMENT")

	defaultMatch := regexp.MustCompile(`(?i)DEFAULT\s+(['"]?)([^'"\s,]+)(['"]?)`).FindStringSubmatch(part)
	if len(defaultMatch) > 2 {
		col.DefaultValue = defaultMatch[2]
	}

	commentMatch := regexp.MustCompile(`(?i)COMMENT\s+['"]([^'"]+)['"]`).FindStringSubmatch(part)
	if len(commentMatch) > 1 {
		col.Comment = commentMatch[1]
	}

	return col
}

func (p *Parser) parseIndexDefinition(part string) IndexSchema {
	idx := IndexSchema{}

	nameMatch := regexp.MustCompile(`(?i)(?:INDEX|KEY|UNIQUE)\s+(?:` + "`" + `)?(\w+)(?:` + "`" + `)?`).FindStringSubmatch(part)
	if len(nameMatch) > 1 {
		idx.Name = nameMatch[1]
	} else {
		idx.Name = generateIndexName()
	}

	idx.Columns = p.parseIndexColumns(part)

	return idx
}

func (p *Parser) parseIndexColumns(part string) []string {
	parenMatch := regexp.MustCompile(`\(([^)]+)\)`).FindStringSubmatch(part)
	if len(parenMatch) < 2 {
		return nil
	}

	colStr := parenMatch[1]
	cols := strings.Split(colStr, ",")
	result := make([]string, 0, len(cols))
	for _, col := range cols {
		col = strings.TrimSpace(col)
		col = strings.Trim(col, "`")
		col = strings.Fields(col)[0]
		if col != "" {
			result = append(result, col)
		}
	}
	return result
}

func (p *Parser) parseConstraint(part string) *ConstraintSchema {
	constraint := &ConstraintSchema{}

	nameMatch := regexp.MustCompile(`(?i)CONSTRAINT\s+(?:` + "`" + `)?(\w+)(?:` + "`" + `)?`).FindStringSubmatch(part)
	if len(nameMatch) > 1 {
		constraint.Name = nameMatch[1]
	}

	upperPart := strings.ToUpper(part)
	switch {
	case strings.Contains(upperPart, "FOREIGN KEY"):
		constraint.Type = "FOREIGN KEY"
		constraint.Columns = p.parseIndexColumns(part)

		refMatch := regexp.MustCompile(`(?i)REFERENCES\s+(?:` + "`" + `)?(\w+)(?:` + "`" + `)?\s*\(([^)]+)\)`).FindStringSubmatch(part)
		if len(refMatch) > 2 {
			constraint.References = &ForeignKeyReference{
				Table: refMatch[1],
			}
			refCols := strings.Split(refMatch[2], ",")
			for _, col := range refCols {
				col = strings.TrimSpace(col)
				col = strings.Trim(col, "`")
				constraint.References.Columns = append(constraint.References.Columns, col)
			}
		}
	case strings.Contains(upperPart, "PRIMARY KEY"):
		constraint.Type = "PRIMARY KEY"
		constraint.Columns = p.parseIndexColumns(part)
	case strings.Contains(upperPart, "UNIQUE"):
		constraint.Type = "UNIQUE"
		constraint.Columns = p.parseIndexColumns(part)
	case strings.Contains(upperPart, "CHECK"):
		constraint.Type = "CHECK"
	default:
		return nil
	}

	return constraint
}

func (p *Parser) ParseSlowLog(path string) ([]SlowLogEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read slow.log: %w", err)
	}
	defer file.Close()

	return p.parseSlowLogFile(file)
}

func (p *Parser) parseSlowLogFile(reader io.Reader) ([]SlowLogEntry, error) {
	var entries []SlowLogEntry
	var currentEntry *SlowLogEntry
	var sqlBuilder strings.Builder

	scanner := bufio.NewScanner(reader)

	timeRegex := regexp.MustCompile(`^#\s+Time:\s+(.+)$`)
	userHostRegex := regexp.MustCompile(`^#\s+User@Host:\s+([^\s]+)\s+@\s+([^\s]+)`)
	queryTimeRegex := regexp.MustCompile(`^#\s+Query_time:\s+([\d.]+)\s+Lock_time:\s+([\d.]+)\s+Rows_sent:\s+(\d+)\s+Rows_examined:\s+(\d+)`)
	extraRegex := regexp.MustCompile(`^#\s+Rows_affected:\s+(\d+)\s+Rows_sent:\s+(\d+)\s+Rows_examined:\s+(\d+)`)

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "# Time:") {
			if currentEntry != nil && sqlBuilder.Len() > 0 {
				currentEntry.SQL = strings.TrimSpace(sqlBuilder.String())
				entries = append(entries, *currentEntry)
			}

			currentEntry = &SlowLogEntry{}
			sqlBuilder.Reset()

			if matches := timeRegex.FindStringSubmatch(line); len(matches) > 1 {
				ts, err := parseSlowLogTime(matches[1])
				if err == nil {
					currentEntry.Timestamp = ts
				}
			}
		} else if strings.HasPrefix(line, "# User@Host:") {
			if currentEntry == nil {
				currentEntry = &SlowLogEntry{}
			}
			if matches := userHostRegex.FindStringSubmatch(line); len(matches) > 2 {
				currentEntry.User = matches[1]
				currentEntry.Host = matches[2]
			}
		} else if strings.HasPrefix(line, "# Query_time:") {
			if currentEntry == nil {
				currentEntry = &SlowLogEntry{}
			}
			if matches := queryTimeRegex.FindStringSubmatch(line); len(matches) > 4 {
				if qt, err := strconv.ParseFloat(matches[1], 64); err == nil {
					currentEntry.QueryTime = time.Duration(qt * float64(time.Second))
				}
				if lt, err := strconv.ParseFloat(matches[2], 64); err == nil {
					currentEntry.LockTime = time.Duration(lt * float64(time.Second))
				}
				currentEntry.RowsSent, _ = strconv.ParseInt(matches[3], 10, 64)
				currentEntry.RowsExamined, _ = strconv.ParseInt(matches[4], 10, 64)
			}
		} else if strings.HasPrefix(line, "# Rows_affected:") {
			if currentEntry == nil {
				currentEntry = &SlowLogEntry{}
			}
			if matches := extraRegex.FindStringSubmatch(line); len(matches) > 3 {
				currentEntry.RowsAffected, _ = strconv.ParseInt(matches[1], 10, 64)
			}
		} else if strings.HasPrefix(line, "#") {
			if currentEntry != nil {
				upperLine := strings.ToUpper(line)
				if strings.Contains(upperLine, "FULL_SCAN") {
					currentEntry.FullScan = true
				}
				if strings.Contains(upperLine, "FULL_JOIN") {
					currentEntry.FullJoin = true
				}
				if strings.Contains(upperLine, "FILESORT") {
					currentEntry.Filesort = true
				}
				if strings.Contains(upperLine, "TMP_TABLE") {
					currentEntry.TmpTable = true
				}
				if strings.Contains(upperLine, "TMP_DISK_TABLE") {
					currentEntry.TmpDiskTable = true
				}
			}
		} else if !strings.HasPrefix(line, "SET") && !strings.HasPrefix(line, "use ") && currentEntry != nil {
			if sqlBuilder.Len() > 0 {
				sqlBuilder.WriteString(" ")
			}
			sqlBuilder.WriteString(line)
		}
	}

	if currentEntry != nil && sqlBuilder.Len() > 0 {
		currentEntry.SQL = strings.TrimSpace(sqlBuilder.String())
		entries = append(entries, *currentEntry)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading slow log: %w", err)
	}

	return entries, nil
}

func (p *Parser) ParseWriteBatch(path string) ([]WriteBatchEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read write-batch.jsonl: %w", err)
	}
	defer file.Close()

	var entries []WriteBatchEntry
	scanner := bufio.NewScanner(file)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		var entry WriteBatchEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			return nil, fmt.Errorf("failed to parse line %d: %w", lineNum, err)
		}
		entries = append(entries, entry)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading write-batch.jsonl: %w", err)
	}

	return entries, nil
}

func splitSQLStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	inString := false
	stringChar := rune(0)
	parenDepth := 0

	for _, c := range sql {
		switch {
		case inString:
			current.WriteRune(c)
			if c == stringChar {
				inString = false
			}
		case c == '\'' || c == '"' || c == '`':
			current.WriteRune(c)
			inString = true
			stringChar = c
		case c == '(':
			current.WriteRune(c)
			parenDepth++
		case c == ')':
			current.WriteRune(c)
			parenDepth--
		case c == ';' && parenDepth == 0:
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			current.Reset()
		default:
			current.WriteRune(c)
		}
	}

	stmt := strings.TrimSpace(current.String())
	if stmt != "" {
		statements = append(statements, stmt)
	}

	return statements
}

func splitSQLParts(sql string) []string {
	var parts []string
	var current strings.Builder
	inString := false
	stringChar := rune(0)
	parenDepth := 0

	for _, c := range sql {
		switch {
		case inString:
			current.WriteRune(c)
			if c == stringChar {
				inString = false
			}
		case c == '\'' || c == '"' || c == '`':
			current.WriteRune(c)
			inString = true
			stringChar = c
		case c == '(':
			current.WriteRune(c)
			parenDepth++
		case c == ')':
			current.WriteRune(c)
			parenDepth--
		case c == ',' && parenDepth == 0:
			part := strings.TrimSpace(current.String())
			if part != "" {
				parts = append(parts, part)
			}
			current.Reset()
		default:
			current.WriteRune(c)
		}
	}

	part := strings.TrimSpace(current.String())
	if part != "" {
		parts = append(parts, part)
	}

	return parts
}

func parseSlowLogTime(timeStr string) (time.Time, error) {
	layouts := []string{
		"2006-01-02T15:04:05.999999Z",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"060102 15:04:05",
	}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, timeStr); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse time: %s", timeStr)
}

func generateIndexName() string {
	return fmt.Sprintf("idx_%d", time.Now().UnixNano())
}
