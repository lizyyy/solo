#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JAR_FILE="$SCRIPT_DIR/target/dependency-conflict-cli-1.0.0.jar"
CLASSES_DIR="$SCRIPT_DIR/classes"
MAIN_CLASS="com.maven.dependency.cli.ConflictAnalyzerCommand"

print_usage() {
    echo "Maven Dependency Conflict CLI"
    echo ""
    echo "Usage: $0 [options] <dependency-tree-file>"
    echo ""
    echo "Options:"
    echo "  -h, --help                Show this help message"
    echo "  -v, --version             Show version"
    echo "  -o, --output-dir <dir>    Output directory for reports (default: current directory)"
    echo "  --json <filename>         Custom JSON output filename"
    echo "  --md, --markdown <file>   Custom Markdown output filename"
    echo "  --no-console              Disable console summary output"
    echo ""
    echo "Examples:"
    echo "  $0 sample-dependency-tree.txt"
    echo "  $0 -o reports/ dependency-tree.txt"
    echo ""
    echo "First time usage: Run ./build.sh to compile the project"
}

check_java() {
    if ! command -v java &> /dev/null; then
        echo "Error: Java not found. Please install Java JDK 11 or higher."
        exit 1
    fi
}

check_build() {
    if [ -f "$JAR_FILE" ]; then
        RUN_MODE="jar"
        return 0
    fi
    
    if [ -d "$CLASSES_DIR" ] && [ -f "$CLASSES_DIR/com/maven/dependency/cli/ConflictAnalyzerCommand.class" ]; then
        RUN_MODE="classes"
        return 0
    fi
    
    echo "Error: Project not built!"
    echo ""
    echo "Please run: $SCRIPT_DIR/build.sh"
    echo ""
    echo "Or if you have Maven: mvn clean package"
    exit 1
}

run_cli() {
    if [ "$RUN_MODE" = "jar" ]; then
        java -jar "$JAR_FILE" "$@"
    else
        java -cp "$CLASSES_DIR" "$MAIN_CLASS" "$@"
    fi
}

# Main
if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    print_usage
    exit 0
fi

if [ "$1" = "-v" ] || [ "$1" = "--version" ]; then
    echo "Maven Dependency Conflict CLI - 1.0.0"
    exit 0
fi

check_java
check_build
run_cli "$@"
