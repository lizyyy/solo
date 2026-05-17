package com.maven.dependency.cli;

import com.maven.dependency.analyzer.ConflictAnalyzer;
import com.maven.dependency.model.AnalysisResult;
import com.maven.dependency.parser.DependencyTreeParser;
import com.maven.dependency.report.ReportGenerator;
import picocli.CommandLine;
import java.io.File;
import java.util.concurrent.Callable;

@CommandLine.Command(
    name = "dep-conflict",
    mixinStandardHelpOptions = true,
    version = "1.0.0",
    description = "Analyze Maven dependency tree conflicts and generate actionable reports"
)
public class ConflictAnalyzerCommand implements Callable<Integer> {

    @CommandLine.Parameters(
        index = "0",
        description = "Input file containing Maven dependency:tree output"
    )
    private File inputFile;

    @CommandLine.Option(
        names = {"-o", "--output-dir"},
        description = "Output directory for reports (default: same directory as input)"
    )
    private File outputDir;

    @CommandLine.Option(
        names = {"--json"},
        description = "JSON output filename (default: {input-name}-conflicts.json)"
    )
    private String jsonFilename;

    @CommandLine.Option(
        names = {"--md", "--markdown"},
        description = "Markdown output filename (default: {input-name}-conflicts.md)"
    )
    private String mdFilename;

    @CommandLine.Option(
        names = {"--no-console"},
        description = "Disable console summary output"
    )
    private boolean noConsole;

    @CommandLine.Option(
        names = {"--append-timestamp"},
        description = "Append timestamp to output filenames to avoid overwriting"
    )
    private boolean appendTimestamp;

    @Override
    public Integer call() throws Exception {
        if (!inputFile.exists()) {
            System.err.println("Error: Input file not found: " + inputFile.getAbsolutePath());
            return 1;
        }

        if (outputDir == null) {
            outputDir = inputFile.getParentFile();
            if (outputDir == null) {
                outputDir = new File(".");
            }
        }

        if (!outputDir.exists()) {
            outputDir.mkdirs();
        }

        DependencyTreeParser parser = new DependencyTreeParser();
        ConflictAnalyzer analyzer = new ConflictAnalyzer();
        ReportGenerator reporter = new ReportGenerator();

        AnalysisResult result = parser.parse(inputFile);
        result = analyzer.analyze(result);

        if (!noConsole) {
            System.out.println(reporter.generateConsoleSummary(result));
        }

        String baseName = getBaseName(inputFile.getName());
        String timestamp = appendTimestamp ? "-" + System.currentTimeMillis() : "";

        String jsonFile = jsonFilename != null ? jsonFilename : baseName + "-conflicts" + timestamp + ".json";
        String mdFile = mdFilename != null ? mdFilename : baseName + "-conflicts" + timestamp + ".md";

        reporter.writeJsonReport(result, new File(outputDir, jsonFile));
        reporter.writeMarkdownReport(result, new File(outputDir, mdFile));

        System.out.println("Reports generated:");
        System.out.println("  - JSON: " + new File(outputDir, jsonFile).getAbsolutePath());
        System.out.println("  - Markdown: " + new File(outputDir, mdFile).getAbsolutePath());

        return 0;
    }

    private String getBaseName(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
    }

    public static void main(String[] args) {
        int exitCode = new CommandLine(new ConflictAnalyzerCommand()).execute(args);
        System.exit(exitCode);
    }
}
