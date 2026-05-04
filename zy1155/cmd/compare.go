package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/yourname/pcheck/internal/benchmark"
	"github.com/yourname/pcheck/internal/payload"
	"github.com/yourname/pcheck/pkg/types"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "Compare JSON, Protobuf, and MessagePack encoding performance",
	Long: `Replay historical payloads and compare encoding/decoding performance 
between JSON, Protobuf, and MessagePack formats. Measures size, encode time, 
decode time, and identifies failure cases.`,
	RunE: runCompare,
}

func init() {
	rootCmd.AddCommand(compareCmd)
	
	compareCmd.Flags().StringP("payloads", "p", "", "Historical payloads file (jsonl)")
	compareCmd.Flags().StringP("rules", "r", "", "Rules configuration file (yaml)")
	compareCmd.Flags().IntP("iterations", "i", 10, "Number of iterations for each encode/decode")
	compareCmd.Flags().IntP("sample-size", "s", 100, "Sample size (0 = all)")
	compareCmd.Flags().Bool("no-json", false, "Skip JSON comparison")
	compareCmd.Flags().Bool("no-protobuf", false, "Skip Protobuf comparison")
	compareCmd.Flags().Bool("no-msgpack", false, "Skip MessagePack comparison")
	
	compareCmd.MarkFlagRequired("payloads")
}

func runCompare(cmd *cobra.Command, args []string) error {
	payloadsPath, _ := cmd.Flags().GetString("payloads")
	rulesPath, _ := cmd.Flags().GetString("rules")
	iterations, _ := cmd.Flags().GetInt("iterations")
	sampleSize, _ := cmd.Flags().GetInt("sample-size")
	noJSON, _ := cmd.Flags().GetBool("no-json")
	noProtobuf, _ := cmd.Flags().GetBool("no-protobuf")
	noMsgpack, _ := cmd.Flags().GetBool("no-msgpack")
	outputFormat, _ := cmd.Flags().GetString("format")
	outputPath, _ := cmd.Flags().GetString("output")

	var rules *types.Rules
	if rulesPath != "" {
		var err error
		rules, err = payload.LoadRulesFromYAML(rulesPath)
		if err != nil {
			return fmt.Errorf("failed to parse rules: %w", err)
		}
	} else {
		rules = &types.Rules{}
	}

	rules.PerformanceChecks.CompareJSON = !noJSON
	rules.PerformanceChecks.CompareProtobuf = !noProtobuf
	rules.PerformanceChecks.CompareMessagePack = !noMsgpack
	if rules.PerformanceChecks.SampleSize == 0 {
		rules.PerformanceChecks.SampleSize = sampleSize
	}
	if rules.PerformanceChecks.Iterations == 0 {
		rules.PerformanceChecks.Iterations = iterations
	}

	fmt.Fprintf(os.Stderr, "Loading payloads: %s\n", payloadsPath)
	allPayloads, err := payload.LoadPayloadsFromJSONL(payloadsPath)
	if err != nil {
		return fmt.Errorf("failed to load payloads: %w", err)
	}

	var selectedPayloads []types.Payload
	if sampleSize > 0 && sampleSize < allPayloads.TotalCount {
		fmt.Fprintf(os.Stderr, "Sampling %d out of %d payloads...\n", sampleSize, allPayloads.TotalCount)
		sampled := payload.SamplePayloads(allPayloads, sampleSize)
		selectedPayloads = sampled.Payloads
	} else {
		selectedPayloads = allPayloads.Payloads
	}

	fmt.Fprintf(os.Stderr, "Running benchmark on %d payloads, %d iterations each...\n", 
		len(selectedPayloads), iterations)
	fmt.Fprintln(os.Stderr, "Formats:", getFormatsString(rules))

	comparer := benchmark.NewComparer(rules)
	benchResults := comparer.CompareAll(selectedPayloads, iterations)
	comparisons := comparer.GenerateComparisonReport(benchResults)

	fmt.Fprintln(os.Stderr, "\n=== Benchmark Results ===")

	jsonStats, hasJSON := benchResults.FormatStats[types.FormatJSON]
	protoStats, hasProto := benchResults.FormatStats[types.FormatProtobuf]
	msgpackStats, hasMsgpack := benchResults.FormatStats[types.FormatMessagePack]

	if hasJSON {
		fmt.Fprintf(os.Stderr, "\nJSON:\n")
		fmt.Fprintf(os.Stderr, "  Average Size: %.0f bytes\n", jsonStats.AverageSize)
		fmt.Fprintf(os.Stderr, "  Avg Encode: %s\n", jsonStats.AverageEncodeTime)
		fmt.Fprintf(os.Stderr, "  Avg Decode: %s\n", jsonStats.AverageDecodeTime)
		fmt.Fprintf(os.Stderr, "  Success: %d/%d\n", jsonStats.SuccessCount, jsonStats.TotalCount)
	}

	if hasProto {
		fmt.Fprintf(os.Stderr, "\nProtobuf:\n")
		fmt.Fprintf(os.Stderr, "  Average Size: %.0f bytes", protoStats.AverageSize)
		if hasJSON && jsonStats.AverageSize > 0 {
			ratio := protoStats.AverageSize / jsonStats.AverageSize
			fmt.Fprintf(os.Stderr, " (%.1f%% of JSON)", ratio*100)
		}
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "  Avg Encode: %s", protoStats.AverageEncodeTime)
		if hasJSON && jsonStats.AverageEncodeTime > 0 {
			ratio := float64(jsonStats.AverageEncodeTime) / float64(protoStats.AverageEncodeTime)
			fmt.Fprintf(os.Stderr, " (%.1fx faster)", ratio)
		}
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "  Avg Decode: %s", protoStats.AverageDecodeTime)
		if hasJSON && jsonStats.AverageDecodeTime > 0 {
			ratio := float64(jsonStats.AverageDecodeTime) / float64(protoStats.AverageDecodeTime)
			fmt.Fprintf(os.Stderr, " (%.1fx faster)", ratio)
		}
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "  Success: %d/%d\n", protoStats.SuccessCount, protoStats.TotalCount)
	}

	if hasMsgpack {
		fmt.Fprintf(os.Stderr, "\nMessagePack:\n")
		fmt.Fprintf(os.Stderr, "  Average Size: %.0f bytes", msgpackStats.AverageSize)
		if hasJSON && jsonStats.AverageSize > 0 {
			ratio := msgpackStats.AverageSize / jsonStats.AverageSize
			fmt.Fprintf(os.Stderr, " (%.1f%% of JSON)", ratio*100)
		}
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "  Avg Encode: %s", msgpackStats.AverageEncodeTime)
		if hasJSON && jsonStats.AverageEncodeTime > 0 {
			ratio := float64(jsonStats.AverageEncodeTime) / float64(msgpackStats.AverageEncodeTime)
			fmt.Fprintf(os.Stderr, " (%.1fx faster)", ratio)
		}
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "  Avg Decode: %s", msgpackStats.AverageDecodeTime)
		if hasJSON && jsonStats.AverageDecodeTime > 0 {
			ratio := float64(jsonStats.AverageDecodeTime) / float64(msgpackStats.AverageDecodeTime)
			fmt.Fprintf(os.Stderr, " (%.1fx faster)", ratio)
		}
		fmt.Fprintln(os.Stderr)
		fmt.Fprintf(os.Stderr, "  Success: %d/%d\n", msgpackStats.SuccessCount, msgpackStats.TotalCount)
	}

	if len(benchResults.Failures) > 0 {
		fmt.Fprintf(os.Stderr, "\n=== Failures (%d) ===\n", len(benchResults.Failures))
		for i, f := range benchResults.Failures {
			if i >= 5 {
				fmt.Fprintf(os.Stderr, "... and %d more\n", len(benchResults.Failures)-5)
				break
			}
			fmt.Fprintf(os.Stderr, "  [%s] Payload %s: %s\n", f.Format, f.PayloadID, f.ErrorMessage)
		}
	}

	var output []byte
	switch outputFormat {
	case "json":
		output, err = formatBenchmarkJSON(benchResults, comparisons)
	case "markdown":
		output, err = formatBenchmarkMarkdown(benchResults, comparisons)
	case "csv":
		output, err = formatBenchmarkCSV(benchResults)
	default:
		output, err = formatBenchmarkJSON(benchResults, comparisons)
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
		fmt.Fprintf(os.Stderr, "\nReport written to: %s\n", outputPath)
	} else if outputFormat != "json" {
		fmt.Println(string(output))
	}

	if len(benchResults.Failures) > 0 {
		os.Exit(1)
	}

	return nil
}

func getFormatsString(rules *types.Rules) string {
	var formats []string
	if rules.PerformanceChecks.CompareJSON {
		formats = append(formats, "JSON")
	}
	if rules.PerformanceChecks.CompareProtobuf {
		formats = append(formats, "Protobuf")
	}
	if rules.PerformanceChecks.CompareMessagePack {
		formats = append(formats, "MessagePack")
	}
	return fmt.Sprintf("%v", formats)
}

func formatBenchmarkJSON(bench *types.BenchmarkCollection, comp *types.ComparisonReport) ([]byte, error) {
	type output struct {
		Benchmarks  *types.BenchmarkCollection `json:"benchmarks"`
		Comparisons *types.ComparisonReport    `json:"comparisons"`
	}

	out := output{
		Benchmarks:  bench,
		Comparisons: comp,
	}

	return json.MarshalIndent(out, "", "  ")
}

func formatBenchmarkMarkdown(bench *types.BenchmarkCollection, comp *types.ComparisonReport) ([]byte, error) {
	var output []byte
	output = append(output, []byte("# Performance Comparison Report\n\n")...)

	output = append(output, []byte("## Summary\n\n")...)
	output = append(output, []byte(fmt.Sprintf("Total payloads tested: %d\n\n", bench.TotalCount))...)

	output = append(output, []byte("### Format Statistics\n\n")...)
	output = append(output, []byte("| Format | Avg Size | Min Size | Max Size | Avg Encode | Avg Decode | Success |\n")...)
	output = append(output, []byte("|--------|----------|----------|----------|------------|------------|---------|\n")...)

	for format, stats := range bench.FormatStats {
		successRate := "N/A"
		if stats.TotalCount > 0 {
			successRate = fmt.Sprintf("%.1f%%", float64(stats.SuccessCount)/float64(stats.TotalCount)*100)
		}
		
		output = append(output, []byte(fmt.Sprintf("| %s | %.0f B | %d B | %d B | %s | %s | %s |\n",
			format, stats.AverageSize, stats.MinSize, stats.MaxSize,
			stats.AverageEncodeTime, stats.AverageDecodeTime, successRate))...)
	}

	output = append(output, []byte("\n")...)

	if comp.ProtobufVsJSON.FormatA != "" {
		output = append(output, []byte("### Protobuf vs JSON\n\n")...)
		output = append(output, []byte(fmt.Sprintf("- Size Ratio: %.2fx\n", comp.ProtobufVsJSON.SizeRatio))...)
		output = append(output, []byte(fmt.Sprintf("- Encode Speed Ratio: %.2fx\n", comp.ProtobufVsJSON.EncodeSpeedRatio))...)
		output = append(output, []byte(fmt.Sprintf("- Decode Speed Ratio: %.2fx\n", comp.ProtobufVsJSON.DecodeSpeedRatio))...)
		output = append(output, []byte("\n")...)
	}

	if comp.MsgpackVsJSON.FormatA != "" {
		output = append(output, []byte("### MessagePack vs JSON\n\n")...)
		output = append(output, []byte(fmt.Sprintf("- Size Ratio: %.2fx\n", comp.MsgpackVsJSON.SizeRatio))...)
		output = append(output, []byte(fmt.Sprintf("- Encode Speed Ratio: %.2fx\n", comp.MsgpackVsJSON.EncodeSpeedRatio))...)
		output = append(output, []byte(fmt.Sprintf("- Decode Speed Ratio: %.2fx\n", comp.MsgpackVsJSON.DecodeSpeedRatio))...)
		output = append(output, []byte("\n")...)
	}

	if len(bench.Failures) > 0 {
		output = append(output, []byte("### Failures\n\n")...)
		for _, f := range bench.Failures {
			output = append(output, []byte(fmt.Sprintf("- **[%s]** Payload %s: %s\n", 
				f.Format, f.PayloadID, f.ErrorMessage))...)
		}
		output = append(output, []byte("\n")...)
	}

	return output, nil
}

func formatBenchmarkCSV(bench *types.BenchmarkCollection) ([]byte, error) {
	var output []byte
	output = append(output, []byte("Format,PayloadID,SizeBytes,EncodeTimeNS,DecodeTimeNS,Success,ErrorMessage\n")...)

	for _, result := range bench.Results {
		line := fmt.Sprintf("%s,%s,%d,%d,%d,%t,%s\n",
			result.Format,
			result.PayloadID,
			result.SizeBytes,
			result.EncodeTime.Nanoseconds(),
			result.DecodeTime.Nanoseconds(),
			result.Success,
			escapeCSV(result.ErrorMessage))
		output = append(output, []byte(line)...)
	}

	return output, nil
}
