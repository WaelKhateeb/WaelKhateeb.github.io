import { build } from 'esbuild';
await build({
  entryPoints: ['src/app.js'], bundle: true, outfile: 'app.js', format: 'esm',
  target: ['chrome109', 'safari16.4', 'firefox115'], minify: true,
  legalComments: 'eof', metafile: false,
});
