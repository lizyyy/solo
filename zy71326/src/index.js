const ScoreParser = require('./score-parser');
const TransposeEngine = require('./transpose-engine');
const ScoreExporter = require('./exporter');
const musicTheory = require('./music-theory');

function transposeFile(inputPath, targetKey, options = {}) {
  const parser = new ScoreParser();
  const score = parser.parseFile(inputPath);

  if (!score) {
    return {
      success: false,
      errors: parser.getErrors(),
      warnings: parser.getWarnings()
    };
  }

  const engine = new TransposeEngine(options);
  const result = engine.transpose(score, targetKey, options);

  if (!result) {
    return {
      success: false,
      errors: engine.issues.filter(i => i.severity === 'error'),
      warnings: [...parser.getWarnings(), ...engine.issues.filter(i => i.severity !== 'error')]
    };
  }

  return {
    success: true,
    result,
    warnings: parser.getWarnings()
  };
}

function transposeScore(score, targetKey, options = {}) {
  const engine = new TransposeEngine(options);
  return engine.transpose(score, targetKey, options);
}

function exportResult(result, outputPath, format = 'text') {
  const exporter = new ScoreExporter();
  
  if (format === 'json') {
    return exporter.exportToJSON(result, outputPath);
  } else if (format === 'diff') {
    return exporter.exportDiffOnly(result, outputPath);
  } else {
    return exporter.exportToText(result, outputPath);
  }
}

module.exports = {
  ScoreParser,
  TransposeEngine,
  ScoreExporter,
  musicTheory,
  transposeFile,
  transposeScore,
  exportResult
};
