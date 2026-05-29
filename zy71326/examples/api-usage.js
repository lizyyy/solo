const { transposeFile, exportResult, musicTheory } = require('../src/index');

async function batchTranspose() {
  const inputFiles = [
    { input: 'examples/sample-score.json', targets: ['D', 'G', 'Bb'] },
    { input: 'examples/sample-score.txt', targets: ['Eb', 'A'] }
  ];

  for (const file of inputFiles) {
    for (const target of file.targets) {
      console.log(`\n处理: ${file.input} -> ${target}`);
      
      const result = transposeFile(file.input, target);
      
      if (result.success) {
        const outputPath = `output/batch_${target}_${Date.now()}.md`;
        exportResult(result.result, outputPath, 'text');
        console.log(`  成功: ${outputPath}`);
        console.log(`  音符变动: ${result.result.summary.noteChanges}`);
        console.log(`  和弦变动: ${result.result.summary.chordChanges}`);
        console.log(`  警告数: ${result.result.summary.warnings}`);
      } else {
        console.log(`  失败: ${result.errors.map(e => e.message).join(', ')}`);
      }
    }
  }
}

function musicTheoryDemo() {
  console.log('\n=== 音乐理论模块演示 ===\n');
  
  const note = 'C#4';
  console.log(`音符解析: ${note} ->`, musicTheory.normalizeNote(note));
  
  const chord = 'G7sus4';
  console.log(`和弦解析: ${chord} ->`, musicTheory.parseChord(chord));
  
  const fromKey = 'C';
  const toKey = 'E';
  const interval = musicTheory.calculateTransposeInterval(fromKey, toKey);
  console.log(`\n${fromKey} -> ${toKey} 移调半音数: ${interval}`);
  
  const keyInfo = musicTheory.getKeyInfo('F#');
  console.log(`F#调号信息:`, keyInfo);
}

if (require.main === module) {
  musicTheoryDemo();
  batchTranspose();
}

module.exports = { batchTranspose, musicTheoryDemo };
