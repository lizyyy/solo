package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"github.com/yourname/pcheck/internal/compatibility"
	"github.com/yourname/pcheck/internal/payload"
	"github.com/yourname/pcheck/internal/schema"
	"github.com/yourname/pcheck/pkg/types"
)

var checkCmd = &cobra.Command{
	Use:   "check",
	Short: "Check compatibility between old and new schemas",
	Long: `Check compatibility risks when migrating from old schema to new schema.
Detects field deletion, type narrowing, required field changes, enum changes, etc.`,
	RunE: runCheck,
}

func init() {
	rootCmd.AddCommand(checkCmd)

	checkCmd.Flags().String("old-schema", "", "Old schema file (yaml or proto)")
	checkCmd.Flags().StringP("new-schema", "n", "", "New schema file (yaml or proto)")
	checkCmd.Flags().StringP("payloads", "p", "", "Historical payloads file (jsonl)")
	checkCmd.Flags().StringP("rules", "r", "", "Rules configuration file (yaml)")
	checkCmd.Flags().StringP("message", "m", "", "Message type to check")
	checkCmd.Flags().Bool("all", false, "Check all messages")

	checkCmd.MarkFlagRequired("old-schema")
	checkCmd.MarkFlagRequired("new-schema")
}

func runCheck(cmd *cobra.Command, args []string) error {
	oldSchemaPath, _ := cmd.Flags().GetString("old-schema")
	newSchemaPath, _ := cmd.Flags().GetString("new-schema")
	payloadsPath, _ := cmd.Flags().GetString("payloads")
	rulesPath, _ := cmd.Flags().GetString("rules")
	messageType, _ := cmd.Flags().GetString("message")
	checkAll, _ := cmd.Flags().GetBool("all")
	outputFormat, _ := cmd.Flags().GetString("format")
	outputPath, _ := cmd.Flags().GetString("output")

	fmt.Fprintf(os.Stderr, "Loading old schema: %s\n", oldSchemaPath)
	oldSchema, err := schema.ParseSchemaFile(oldSchemaPath)
	if err != nil {
		return fmt.Errorf("failed to parse old schema: %w", err)
	}

	fmt.Fprintf(os.Stderr, "Loading new schema: %s\n", newSchemaPath)
	newSchema, err := schema.ParseSchemaFile(newSchemaPath)
	if err != nil {
		return fmt.Errorf("failed to parse new schema: %w", err)
	}

	var rules *types.Rules
	if rulesPath != "" {
		fmt.Fprintf(os.Stderr, "Loading rules: %s\n", rulesPath)
		rules, err = payload.LoadRulesFromYAML(rulesPath)
		if err != nil {
			return fmt.Errorf("failed to parse rules: %w", err)
		}
	}

	checker := compatibility.NewChecker(oldSchema, newSchema, rules)

	fmt.Fprintln(os.Stderr, "Checking schema compatibility...")
	schemaIssues := checker.CheckSchemaCompatibility()

	var payloadIssues *types.IssueCollection
	if payloadsPath != "" {
		fmt.Fprintf(os.Stderr, "Loading payloads: %s\n", payloadsPath)
		payloads, err := payload.LoadPayloadsFromJSONL(payloadsPath)
		if err != nil {
			return fmt.Errorf("failed to load payloads: %w", err)
		}

		fmt.Fprintf(os.Stderr, "Checking %d payloads against schema...\n", payloads.TotalCount)
		payloadIssues = &types.IssueCollection{
			Issues:     []types.Issue{},
			ByType:     make(map[types.IssueType][]types.Issue),
			BySeverity: make(map[types.IssueSeverity][]types.Issue),
		}

		for _, p := range payloads.Payloads {
			var msgToCheck *types.MessageDefinition

			if messageType != "" {
				msgToCheck = schema.FindMessage(newSchema, messageType)
			} else if checkAll {
				for _, msg := range newSchema.Messages {
					issues := checker.CheckPayloadAgainstSchema(&p, &msg)
					for _, issue := range issues.Issues {
						payloadIssues.Issues = append(payloadIssues.Issues, issue)
						payloadIssues.ByType[issue.Type] = append(payloadIssues.ByType[issue.Type], issue)
						payloadIssues.BySeverity[issue.Severity] = append(payloadIssues.BySeverity[issue.Severity], issue)
					}
				}
				continue
			} else if len(newSchema.Messages) > 0 {
				msgToCheck = &newSchema.Messages[0]
			}

			if msgToCheck != nil {
				issues := checker.CheckPayloadAgainstSchema(&p, msgToCheck)
				for _, issue := range issues.Issues {
					payloadIssues.Issues = append(payloadIssues.Issues, issue)
					payloadIssues.ByType[issue.Type] = append(payloadIssues.ByType[issue.Type], issue)
					payloadIssues.BySeverity[issue.Severity] = append(payloadIssues.BySeverity[issue.Severity], issue)
				}
			}
		}

		calculateIssueStats(payloadIssues)
	}

	totalIssues := mergeIssues(schemaIssues, payloadIssues)

	var output []byte
	switch outputFormat {
	case "json":
		output, err = formatIssuesJSON(totalIssues)
	case "markdown":
		output, err = formatIssuesMarkdown(totalIssues)
	case "csv":
		output, err = formatIssuesCSV(totalIssues)
	default:
		output, err = formatIssuesJSON(totalIssues)
	}

	if err != nil {
		return fmt.Errorf("failed to format output: %w", err)
	}

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if dir != "." && dir != "" {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return fmt.Errorf("failed to create output directory: %w", err)
			}
		}
		if err := os.WriteFile(outputPath, output, 0644); err != nil {
			return fmt.Errorf("failed to write output file: %w", err)
		}
		fmt.Fprintf(os.Stderr, "Report written to: %s\n", outputPath)
	} else {
		fmt.Println(string(output))
	}

	fmt.Fprintf(os.Stderr, "\n=== Summary ===\n")
	fmt.Fprintf(os.Stderr, "Total issues: %d\n", totalIssues.TotalCount)
	fmt.Fprintf(os.Stderr, "  Critical: %d\n", totalIssues.CriticalCount)
	fmt.Fprintf(os.Stderr, "  High: %d\n", totalIssues.HighCount)
	fmt.Fprintf(os.Stderr, "  Medium: %d\n", totalIssues.MediumCount)
	fmt.Fprintf(os.Stderr, "  Low: %d\n", totalIssues.LowCount)
	fmt.Fprintf(os.Stderr, "  Info: %d\n", totalIssues.InfoCount)

	if totalIssues.CriticalCount > 0 || totalIssues.HighCount > 0 {
		os.Exit(1)
	}

	return nil
}

func calculateIssueStats(collection *types.IssueCollection) {
	collection.TotalCount = len(collection.Issues)
	collection.CriticalCount = len(collection.BySeverity[types.SeverityCritical])
	collection.HighCount = len(collection.BySeverity[types.SeverityHigh])
	collection.MediumCount = len(collection.BySeverity[types.SeverityMedium])
	collection.LowCount = len(collection.BySeverity[types.SeverityLow])
	collection.InfoCount = len(collection.BySeverity[types.SeverityInfo])
}

func mergeIssues(a, b *types.IssueCollection) *types.IssueCollection {
	result := &types.IssueCollection{
		ByType:     make(map[types.IssueType][]types.Issue),
		BySeverity: make(map[types.IssueSeverity][]types.Issue),
	}

	if a != nil {
		result.Issues = append(result.Issues, a.Issues...)
		for t, issues := range a.ByType {
			result.ByType[t] = append(result.ByType[t], issues...)
		}
		for s, issues := range a.BySeverity {
			result.BySeverity[s] = append(result.BySeverity[s], issues...)
		}
	}

	if b != nil {
		result.Issues = append(result.Issues, b.Issues...)
		for t, issues := range b.ByType {
			result.ByType[t] = append(result.ByType[t], issues...)
		}
		for s, issues := range b.BySeverity {
			result.BySeverity[s] = append(result.BySeverity[s], issues...)
		}
	}

	calculateIssueStats(result)
	return result
}

func formatIssuesJSON(issues *types.IssueCollection) ([]byte, error) {
	type output struct {
		Summary map[string]int           `json:"summary"`
		Issues  []types.Issue            `json:"issues"`
		ByType  map[string][]types.Issue `json:"by_type"`
	}

	byTypeStr := make(map[string][]types.Issue)
	for t, issues := range issues.ByType {
		byTypeStr[string(t)] = issues
	}

	out := output{
		Summary: map[string]int{
			"total":    issues.TotalCount,
			"critical": issues.CriticalCount,
			"high":     issues.HighCount,
			"medium":   issues.MediumCount,
			"low":      issues.LowCount,
			"info":     issues.InfoCount,
		},
		Issues: issues.Issues,
		ByType: byTypeStr,
	}

	jsonData, err := marshalIndent(out, "", "  ")
	if err != nil {
		return nil, err
	}
	return jsonData, nil
}

func formatIssuesMarkdown(issues *types.IssueCollection) ([]byte, error) {
	var output []byte
	output = append(output, []byte("# Compatibility Check Report\n\n")...)

	output = append(output, []byte("## Summary\n\n")...)
	output = append(output, []byte("| Severity | Count |\n")...)
	output = append(output, []byte("|----------|-------|\n")...)
	output = append(output, []byte(fmt.Sprintf("| Critical | %d |\n", issues.CriticalCount))...)
	output = append(output, []byte(fmt.Sprintf("| High | %d |\n", issues.HighCount))...)
	output = append(output, []byte(fmt.Sprintf("| Medium | %d |\n", issues.MediumCount))...)
	output = append(output, []byte(fmt.Sprintf("| Low | %d |\n", issues.LowCount))...)
	output = append(output, []byte(fmt.Sprintf("| Info | %d |\n", issues.InfoCount))...)
	output = append(output, []byte(fmt.Sprintf("| **Total** | **%d** |\n\n", issues.TotalCount))...)

	if len(issues.Issues) > 0 {
		output = append(output, []byte("## Issues\n\n")...)
		for _, issue := range issues.Issues {
			severityEmoji := "🔵"
			switch issue.Severity {
			case types.SeverityCritical:
				severityEmoji = "🔴"
			case types.SeverityHigh:
				severityEmoji = "🟠"
			case types.SeverityMedium:
				severityEmoji = "🟡"
			case types.SeverityLow:
				severityEmoji = "🟢"
			}

			output = append(output, []byte(fmt.Sprintf("- %s **[%s]** %s\n",
				severityEmoji, issue.Severity, issue.Message))...)

			if issue.MessageType != "" {
				output = append(output, []byte(fmt.Sprintf("  - Message: %s\n", issue.MessageType))...)
			}
			if issue.FieldName != "" {
				output = append(output, []byte(fmt.Sprintf("  - Field: %s\n", issue.FieldName))...)
			}
			if issue.PayloadID != "" {
				output = append(output, []byte(fmt.Sprintf("  - Payload: %s\n", issue.PayloadID))...)
			}
			output = append(output, []byte("\n")...)
		}
	}

	return output, nil
}

func formatIssuesCSV(issues *types.IssueCollection) ([]byte, error) {
	var output []byte
	output = append(output, []byte("Type,Severity,Message,MessageType,FieldName,PayloadID\n")...)

	for _, issue := range issues.Issues {
		line := fmt.Sprintf("%s,%s,%s,%s,%s,%s\n",
			escapeCSV(string(issue.Type)),
			escapeCSV(string(issue.Severity)),
			escapeCSV(issue.Message),
			escapeCSV(issue.MessageType),
			escapeCSV(issue.FieldName),
			escapeCSV(issue.PayloadID))
		output = append(output, []byte(line)...)
	}

	return output, nil
}

func escapeCSV(s string) string {
	if strings.ContainsAny(s, ",\"'\n") {
		return "\"" + strings.ReplaceAll(s, "\"", "\"\"") + "\""
	}
	return s
}

func marshalIndent(v interface{}, prefix, indent string) ([]byte, error) {
	data, err := marshal(v)
	if err != nil {
		return nil, err
	}

	var indented []byte
	var level int
	var inString bool
	var prevChar byte

	for i := 0; i < len(data); i++ {
		c := data[i]

		if c == '"' && prevChar != '\\' {
			inString = !inString
		}

		if !inString {
			switch c {
			case '{', '[':
				indented = append(indented, c)
				indented = append(indented, '\n')
				level++
				for j := 0; j < level; j++ {
					indented = append(indented, []byte(indent)...)
				}
				prevChar = c
				continue
			case '}', ']':
				indented = append(indented, '\n')
				level--
				for j := 0; j < level; j++ {
					indented = append(indented, []byte(indent)...)
				}
				indented = append(indented, c)
				prevChar = c
				continue
			case ',':
				indented = append(indented, c)
				indented = append(indented, '\n')
				for j := 0; j < level; j++ {
					indented = append(indented, []byte(indent)...)
				}
				prevChar = c
				continue
			case ':':
				indented = append(indented, c)
				indented = append(indented, ' ')
				prevChar = c
				continue
			case ' ', '\t', '\n', '\r':
				prevChar = c
				continue
			}
		}

		indented = append(indented, c)
		prevChar = c
	}

	return indented, nil
}

func marshal(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}
