#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findJSFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

function runLint() {
  const jsFiles = findJSFiles('src');
  let failed = 0;
  
  console.log('Running syntax check on all JS files...\n');
  
  for (const file of jsFiles) {
    try {
      execSync(`node --check "${file}"`, { stdio: 'pipe' });
      console.log(`  ✓ ${file}`);
    } catch (error) {
      console.log(`  ✗ ${file}`);
      console.log(`    ${error.stderr ? error.stderr.toString().trim() : error.message}`);
      failed++;
    }
  }
  
  console.log(`\n${jsFiles.length - failed}/${jsFiles.length} files passed`);
  
  if (failed > 0) {
    console.log(`\n❌ Lint failed with ${failed} errors`);
    process.exit(1);
  } else {
    console.log('\n✅ All files passed syntax check');
    process.exit(0);
  }
}

runLint();
