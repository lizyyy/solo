import * as esbuild from 'esbuild';

async function main() {
  console.log('开始打包...');

  const result = await esbuild.build({
    entryPoints: ['dist/index.js'],
    outfile: 'dist/bundle.js',
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    minify: false,
    sourcemap: true,
    external: [],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  console.log('打包完成:', result);
  console.log('输出文件: dist/bundle.js');

  const iifeResult = await esbuild.build({
    entryPoints: ['dist/index.js'],
    outfile: 'dist/bundle.iife.js',
    bundle: true,
    format: 'iife',
    globalName: 'CanvasAuditTimeline',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    sourcemap: true,
  });

  console.log('IIFE 打包完成:', iifeResult);
  console.log('输出文件: dist/bundle.iife.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
