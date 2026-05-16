import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(process.cwd(), '.monobound-test');

export async function runSelfCheck() {
  console.log('🔧 开始自检测试...');
  console.log('');

  await setupTestMonorepo();
  
  console.log('✅ 测试 Monorepo 环境已创建');
  console.log('');
  console.log('📍 测试目录:', TEST_DIR);
  console.log('');
  console.log('📋 测试用例:');
  console.log('  - apps/web 依赖 packages/shared (✅ 允许)');
  console.log('  - apps/web 依赖 packages/ui (✅ 允许)');
  console.log('  - packages/shared 依赖 packages/ui (✅ 允许)');
  console.log('  - packages/ui 依赖 apps/web (❌ 违规 - 不允许)');
  console.log('  - packages/shared 依赖 packages/api (❌ 违规 - 不在允许列表)');
  console.log('');

  return {
    testDir: TEST_DIR,
    message: '测试环境已就绪，请在此目录下运行 monobound check',
  };
}

async function setupTestMonorepo() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
  await fs.mkdir(TEST_DIR, { recursive: true });

  await fs.writeFile(
      path.join(TEST_DIR, '.monoboundrc.json'),
      JSON.stringify(
        {
          packages: ['packages/*', 'apps/*'],
          rules: {
            '@test/web': {
              allow: ['@test/*'],
            },
            '@test/*': {
              allow: ['@test/*'],
              deny: ['@test/web'],
            },
          },
          ignore: ['**/node_modules/**'],
          extensions: ['.js'],
          output: {
            dir: './monobound-reports',
            formats: ['terminal', 'json', 'html'],
          },
        },
        null,
        2
      )
    );

  await createPackage(path.join(TEST_DIR, 'packages', 'shared'), '@test/shared');
  await createPackage(path.join(TEST_DIR, 'packages', 'ui'), '@test/ui');
  await createPackage(path.join(TEST_DIR, 'packages', 'api'), '@test/api');
  await createPackage(path.join(TEST_DIR, 'apps', 'web'), '@test/web');

  await fs.writeFile(
    path.join(TEST_DIR, 'packages', 'shared', 'src', 'index.js'),
    `import { Button } from '@test/ui';
export function sharedUtil() {
  return Button();
}
`
  );

  await fs.writeFile(
    path.join(TEST_DIR, 'packages', 'ui', 'src', 'index.js'),
    `import { config } from '@test/web';
export function Button() {
  return '<button>' + config.theme + '</button>';
}
`
  );

  await fs.writeFile(
    path.join(TEST_DIR, 'packages', 'api', 'src', 'index.js'),
    `export function fetchData() {
  return Promise.resolve({ data: 'test' });
}
`
  );

  await fs.writeFile(
    path.join(TEST_DIR, 'apps', 'web', 'src', 'index.js'),
    `import { sharedUtil } from '@test/shared';
import { Button } from '@test/ui';
import { fetchData } from '@test/api';

export const config = {
  theme: 'dark',
};

export function App() {
  return (
    <div>
      <Button />
      {sharedUtil()}
      {fetchData()}
    </div>
  );
}
`
  );

  await fs.writeFile(
    path.join(TEST_DIR, 'packages', 'shared', 'src', 'utils.js'),
    `import { fetchData } from '@test/api';
export function loadData() {
  return fetchData();
}
`
  );
}

async function createPackage(dir, name) {
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        main: 'src/index.js',
      },
      null,
      2
    )
  );
}

export async function cleanupTestDir() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}
