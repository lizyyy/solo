package com.maven.dependency.cli;

import com.maven.dependency.analyzer.ConflictAnalyzer;
import com.maven.dependency.model.AnalysisResult;
import com.maven.dependency.parser.DependencyTreeParser;
import com.maven.dependency.report.ReportGenerator;
import java.io.File;

public class ConflictAnalyzerCommand {

    public static void main(String[] args) {
        if (args.length == 0 || args[0].equals("-h") || args[0].equals("--help")) {
            printHelp();
            System.exit(args.length == 0 ? 1 : 0);
        }

        if (args[0].equals("-v") || args[0].equals("--version")) {
            System.out.println("Maven Dependency Conflict CLI - 1.0.0");
            System.exit(0);
        }

        File inputFile = new File(args[0]);
        if (!inputFile.exists()) {
            System.err.println("Error: Input file not found: " + inputFile.getAbsolutePath());
            System.exit(1);
        }

        File outputDir = new File(".");
        String jsonFilename = null;
        String mdFilename = null;
        boolean noConsole = false;

        for (int i = 1; i < args.length; i++) {
            if ((args[i].equals("-o") || args[i].equals("--output-dir")) && i + 1 < args.length) {
                outputDir = new File(args[++i]);
            } else if (args[i].equals("--json") && i + 1 < args.length) {
                jsonFilename = args[++i];
            } else if (args[i].equals("--md") || args[i].equals("--markdown")) {
                if (i + 1 < args.length) mdFilename = args[++i];
            } else if (args[i].equals("--no-console")) {
                noConsole = true;
            }
        }

        if (!outputDir.exists()) {
            outputDir.mkdirs();
        }

        try {
            DependencyTreeParser parser = new DependencyTreeParser();
            ConflictAnalyzer analyzer = new ConflictAnalyzer();
            ReportGenerator reporter = new ReportGenerator();

            AnalysisResult result = parser.parse(inputFile);
            result = analyzer.analyze(result);

            if (!noConsole) {
                System.out.println(reporter.generateConsoleSummary(result));
            }

            String baseName = getBaseName(inputFile.getName());
            String jsonFile = jsonFilename != null ? jsonFilename : baseName + "-conflicts.json";
            String mdFile = mdFilename != null ? mdFilename : baseName + "-conflicts.md";

            reporter.writeJsonReport(result, new File(outputDir, jsonFile));
            reporter.writeMarkdownReport(result, new File(outputDir, mdFile));

            System.out.println("Reports generated:");
            System.out.println("  - JSON: " + new File(outputDir, jsonFile).getAbsolutePath());
            System.out.println("  - Markdown: " + new File(outputDir, mdFile).getAbsolutePath());

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String getBaseName(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex > 0 ? filename.substring(0, dotIndex) : filename;
    }

    private static void printHelp() {
        System.out.println("Usage: java -jar dependency-conflict-cli.jar [options] <input-file>");
        System.out.println();
        System.out.println("Analyze Maven dependency tree conflicts and generate actionable reports");
        System.out.println();
        System.out.println("Options:");
        System.out.println("  -h, --help                Show this help message");
        System.out.println("  -v, --version             Show version");
        System.out.println("  -o, --output-dir <dir>    Output directory for reports (default: current directory)");
        System.out.println("  --json <filename>         Custom JSON output filename");
        System.out.println("  --md, --markdown <file>   Custom Markdown output filename");
        System.out.println("  --no-console              Disable console summary output");
        System.out.println();
        System.out.println("Example:");
        System.out.println("  java -jar dependency-conflict-cli.jar dependency-tree.txt");
        System.out.println("  java -jar dependency-conflict-cli.jar -o reports/ dependency-tree.txt");
    }
}
