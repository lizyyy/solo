const fs = require('fs');

const files = {};

files['src/parsers/file-reader.ts'] = "import * as fs from 'fs';\nimport * as path from 'path';\nimport * as yaml from 'js-yaml';\nimport { RulesFile } from '../types';\n\nexport class FileReader {\n  private filePath: string;\n\n  constructor(filePath: string) {\n    this.filePath = filePath;\n  }\n\n  read(): { content: string; lines: string[] } {\n    const content = fs.readFileSync(this.filePath, 'utf-8');\n    const lines = content.split('\\n');\n    return { content, lines };\n  }\n\n  parseYaml(): RulesFile {\n    const { content } = this.read();\n    const parsed = yaml.load(content) as RulesFile;\n    \n    if (!parsed.groups) {\n      throw new Error('Invalid Prometheus rules file: missing groups field');\n    }\n    \n    return parsed;\n  }\n\n  findRuleLineNumber(ruleName: string, groupName: string): number | undefined {\n    const { lines } = this.read();\n    let inGroup = false;\n    \n    for (let i = 0; i < linesconst fs = require('fs');

conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parss('
conste 
const files = {};

file   
files['src/parng;const iv
file   
files['trifiles[n conste 
const filPaconst ri
file   
files['trifiles[n conste 
const fil= const th
file   
files['pNafiles[roconste \n  }\n\n  vconstte(
file   
filheusRule): Ruleconste 
cnResult {\c    con
file   
files['atifiles[e[conste 
const filt const : 
file   
files['sulfiles[n conste 
const filleconst ,\
file   
files[': tfiles[ouconste 
const filePconst hi
file   
files[    files[ruconste 
const filssconst ]\
file   
files['onsfiles[qlconste 
const filQLconst (r
filexpr);\n    confileyntaconeck = promqlParser.valid
file   
files['  ifiles[ntconste 
const filn constiss
file   
files['   fiype: 'conste 
const filcaconst : 
file   
files['   files[e:conste 
const filrrconst + 
file   
files['r,\files[  conste 
const filleconst   
file   
files['thifiles[pNconste 
const filePconst hi
file   
files['   files[onconste 
const fil  const ;\
file   
files['nstfiles[dLconste 
const filseconst e(
file   
files['arsedLabels = parsedLabels;\n const st
file   
files[' = files[Pafile   
files['trifiles[);\n\n    if (rule.annotations) {\n file   
files['trieyfiles[e]const fil= const th
fileanfile   
files['pNa  files[stfile   
filheusRule): Ruleconste 
cnResult {uefilheu  cnResult {\c    con
file afile   
files['atitAfiles[ehconst filt const : 
file (file   
files['suloffiles[hoconst filleconst ,\
filet file   
files[': tolfiles[liconst filePconst hi
fist lfile   
files[    thfiles[  const filssconst ]\
file!afile   
files['onslufilesabeconst filQLconst (r
file  filexpr);\n    con',file   
files['  ifiles[ntconste 
const filn constis  files[s.const filn constiss
filypefile   
files['     files[  const filcaconst : 
fileacfile   
files['     files[esconst filrrconst + 
fieholfile   
files['r,\xpfiles[n:const filleconst   
file  file   
files['thiulfiles[t,const filePconst hi
filee:file   
files['     files[  const fil  const ;\
fileatfile   
files['nst\nfiles[  const filseconst e(
filen\file   
files['arstafiles[acfile   
files[' = files[Pafile   
files['triesfiles[anfiles['trifiles[);\n\n  \nfiles['trieyfiles[e]const fil= const th
fileanfile   
file  fileanfile   
files['pNa  files[stfileulfiles['pNa  s?filheusRule): Ruleconste 
oncnResult {uefilheu  cnRe ifile afile   
files['atitAfiles[ehcons  files['atitAy:file (file   
files['suloffiles[hoconse:files['sulofmmfilet file   
files[': tolfiles[licons  files[': tolulfist lfile   
files[    thfiles[  conspNfiles[    th  file!afile   
files['onslufilesabecons  files['onsluulfile  filexpr);\n    con',file   
fit;\nfiles['  ifiles[ntconste 
const /rconst filn constis  fil"imfilypefile   
files['     files[  const filcac 'files['     rtfileacfile   
files['     files[esconsulfiles['     atfieholfile   
files['r,\xpfiles[n:consVEfiles['r,\xp.0file  file   
files['thiulfiles[t,c{\n  files['thiulltfilee:file   
files['     files[  constrfiles['     nsfileatfile   
files['nst\nfiles[  cons: files['nst\n  filen\file   
files['arstafiles[acfiletDfiles['arstairfiles[' = files[Pafile   
eSfiles['triesfiles[anfilecofileanfile   
file  fileanfile   
files['pNa  files[stfileulfiles['pNa  s?filheusRulinfile  filt ===files['pNa  files[.poncnResult {uefilheu  cnRe ifile afile   
files['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[': tolfiles[licons  files[': tolulfinned: ' + thfiles[    thfiles[  conspNfiles[    th  file!afile  isfiles['onslufilesabecons  files['onsluulfile  filexpshfit;\nfiles['  ifiles[ntconste 
const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfiles['     files[  const filcac 'files['     pufiles['     files[esconsulfiles['     atfieholfile   
files[s)files['r,\xpfiles[n:consVEfiles['r,\xp.0file  file  : files['thiulfiles[t,c{\n  files['thiulltfilee:file  h(files['     files[  constrfiles['     nsfileatfile  nffiles['nst\nfiles[  cons: files['nst\n  filen\file  s files['arstafiles[acfiletDfiles['arstairfiles[' = fi) eSfiles['triesfiles[anfilecofileanfile   
file  fileanfile   
ffilfile  fileanfile   
files['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfiles['     files[  const filcac 'files['     pufiles['     files[esconsulfiles['     atfieholfile   
files[s)files['r,\xpfiles[n:consVEfiles['r,\xp.0file  file  : files['thiulfiles[t,c{\n  files['thiulltfilee:file  h(files['     files[  ' files[s)files['r,\xpfiles[n:consVEfiles['r,\xp.0file  file  : files['thiulfiles[t,c{\n  files['thiulltfilee:file  h(files['     files[  constrfiles['     nsfileatfile  nffile  file  fileanfile   
ffilfile  fileanfile   
files['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfiles['     files[  const filcpuffilfile  fileanfiesfiles['pNa  files[str rtfiles[s)files['r,\xpfiles[n:consVEfiles['r,\xp.0file  file  : files['thiulfiles[t,c{\n  files['thiulltfilee:file  h(files['     files[  ' files[s)files['r,\xpfiles[n:consVEfiles['r,\xp.0file  file  : files['thiulfiles[t,c{\n  files['thiulltfilee:file  h(files['     files[  constrfiles['     nsfileatfile  nffile  file  fileanfile   
ffilfile  esffilfile  fileanfile   
files['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfiles['     files[  const filcpuffilfile  fileanfiesfiles['pNa  ;\files['pNa  files[str esffilfile  esffilfile  fileanfile   
files['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfiles['     files[  const filcpuffilfile  fileanfiesfiles['pNa  ;\files['pNa  files[str esffilfile  esffilfile  fileanfile   
files['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfit files['pNa  files[str files['pNa  ltfiles['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfiles['     files[  const filcpuffilfile  fileanfiesfiles['pNa  ;\files['pNa  files[str esffilfile  esffilfile  fileanfile   rfiles['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ehcons  files['atitAy:\nfiles['suloffiles[hoconse:files['sulofmmfilet file  arfiles[  const /rconst filn constis  fil"imfilype  const /rconst filn constis  fi tfit files['pNa  files[str files['pNa  ltfiles['pNa  files[str files['pNa  files[esfiles['atitAfiles[ehcoesfiles['atitAfiles[ === 'error' ? '🔴 Error' : issue.type === 'warning' ? '🟡 Warning' : '🔵 Info';\n          const lineNum = issue.line || '-';\n          lines.push('| ' + level + ' | ' + issue.category + ' | ' + issue.message + ' | ' + lineNum + ' |');\n        }\n        lines.push('\\n');\n      }\n    }\n\n    const goodRules = this.result.results.filter(r => r.issues.length === 0);\n    if (goodRules.length > 0) {\n      lines.push('## Valid Rules\\n');\n      for (const rule of goodRules.slice(0, 20)) {\n        lines.push('- ✓ ' + rule.ruleName + ' (`' + rule.filePath + '`)');\n      }\n      if (goodRules.length > 20) {\n        lines.push('- ... and ' + (goodRules.length - 20) + ' more rules\\n');\n      }\n      lines.push('');\n    }\n\n    lines.push('## Scanned Files\\n');\n    for (const file of this.result.files) {\n      lines.push('- `' + file + '`');\n    }\n\n    return lines.join('\\n');\n  }\n\n  saveReports(): void {\n    if (!this.outputDir) {\n      return;\n    }\n\n    if (!fs.existsSync(this.outputDir)) {\n      fs.mkdirSync(this.outputDir, { recursive: true });\n    }\n\n    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');\n    \n    const jsonPath = path.join(this.outputDir, 'report-' + timestamp + '.json');\n    fs.writeFileSync(jsonPath, this.generateJson(), 'utf-8');\n    \n    const mdPath = path.join(this.outputDir, 'report-' + timestamp + '.md');\n    fs.writeFileSync(mdPath, this.generateMarkdown(), 'utf-8');\n\n    const latestJsonPath = path.join(this.outputDir, 'latest.json');\n    const latestMdPath = path.join(this.outputDir, 'latest.md');\n    \n    if (fs.existsSync(latestJsonPath)) {\n      fs.unlinkSync(latestJsonPath);\n    }\n    if (fs.existsSync(latestMdPath)) {\n      fs.unlinkSync(latestMdPath);\n    }\n    \n    fs.writeFileSync(latestJsonPath, this.generateJson(), 'utf-8');\n    fs.writeFileSync(latestMdPath, this.generateMarkdown(), 'utf-8');\n  }\n}\n";

files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt
files['src/cli.ts'] =lesfiles['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOp  files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpcofiles['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpilfiles['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOp cfiles['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOptafiles['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpt files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOp) files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOpr.files['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'commander';\nimport { CliOp rfiles['src/cli.ts'] =lesfiles['src/cli.ts'] = "#!/usr/bin/env node\n\nimport { Command } from 'com);\n          }\n          \n          allResults.push(result);\n        }\n      }\n    }\n\n    const totalRules = allResults.length;\n    const allIssues = allResults.flatMap(r => r.issues);\n    const rulesWithIssues = allResults.filter(r => r.issues.length > 0).length;\n\n    const lintResult: LintResult = {\n      summary: {\n        totalRules,\n        totalGroups,\n        totalIssues: allIssues.length,\n        errors: allIssues.filter(i => i.type === 'error').length,\n        warnings: allIssues.filter(i => i.type === 'warning').length,\n        infos: allIssues.filter(i => i.type === 'info').length,\n        rulesWithIssues\n      },\n      results: allResults,\n      files,\n      timestamp: new Date().toISOString(),\n      version: VERSION\n    };\n\n    const reportGenerator = new ReportGenerator(lintResult, options.output);\n    console.log(reportGenerator.generateConsoleSummary());\n\n    if (options.output) {\n      reportGenerator.saveReports();\n    }\n\n    if (options.failOnError && lintResult.summary.errors > 0) {\n      process.exit(1);\n    }\n  } catch (error) {\n    console.error('Error:', error instanceof Error ? error.message : String(error));\n    process.exit(1);\n  }\n}\n\nmain();\n";

for (const [path, content] of Object.entries(files)) {
  fs.writeFileSync(path, content, 'utf-8');
  console.log('Created: ' + path);
}

console.log('All files created successfully!');
