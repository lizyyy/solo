# Subtitle Sync Fix

CLI tool to fix timeline drift in translated subtitles using anchor points and linear drift model.

## Features

- Parse SRT and VTT subtitle formats
- Align subtitles using anchor points and linear drift model
- Handle overlapping subtitles (split, extend, or skip)
- Detect and handle missing anchor points
- Generate drift reports and visual timeline HTML

## Project Structure

```
src/
├── parser/          # SRT/VTT parsing and writing
├── alignment/       # Anchor point and linear drift alignment algorithm
├── validation/      # Rule and cue validation
├── report/          # Drift report and timeline HTML generation
└── cli/             # Command-line interface
samples/             # Sample input files for testing
```

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

## Demo

Run with sample data:

```bash
npm run demo
```

Or directly:

```bash
node dist/cli/index.js sync samples/original.srt samples/transcript.json samples/scene_marks.csv samples/sync_rules.yaml -o samples/output/
```

## Usage

```bash
subtitle-sync <srtFile> <transcriptFile> <sceneMarksFile> <rulesFile> [-o <outputDir>]
```

### Input Files

- **srtFile**: Original subtitle file (SRT or VTT format)
- **transcriptFile**: JSON file with transcript entries containing start/end times
- **sceneMarksFile**: CSV file with scene mark timestamps
- **rulesFile**: YAML or JSON file with sync rules (anchor points, linear drift config)

### Output Files

- **fixed.srt**: Fixed subtitle file
- **drift_report.md**: Detailed drift statistics and validation issues
- **timeline.html**: Visual timeline viewer (open in browser)

### Sync Rules Format

```yaml
anchorPoints:
  - originalTime: 1000
    translatedTime: 1000
    label: "Scene Start"

linearDrift:
  slope: 1.0005
  intercept: 0

overlapHandling: split  # split | extend | skip

maxDrift: 2000  # Maximum allowed drift in milliseconds
```

## Overlap Handling Strategies

- **split**: Split overlapping subtitles at midpoint
- **extend**: Extend the end of the first subtitle to match start of next
- **skip**: Skip the second overlapping subtitle

## Anchor Point Missing Handling

When an anchor point is missing for a subtitle cue, the tool:
1. Uses the nearest available anchor point
2. Generates a warning message
3. Falls back to linear drift interpolation

## License

MIT
