import { build } from 'esbuild';
import { createRequire, Module } from 'node:module';
import path from 'node:path';

// Obsidian and Electron are provided by the host, not available in Node tests.
export async function loadSource(entry, obsidian = {}) {
  const filename = path.resolve(entry);
  const result = await build({
    entryPoints: [filename],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'cjs',
    write: false,
    plugins: [{
      name: 'omit-ui',
      setup(build) {
        build.onLoad({ filter: /\.svelte$/ }, () => ({ contents: 'export default {};', loader: 'js' }));
      },
    }],
  });
  const compiled = new Module(filename);
  const require = createRequire(filename);
  compiled.require = (id) => {
    if (id === 'obsidian') return obsidian;
    if (id === 'electron') return {};
    return require(id);
  };
  compiled._compile(result.outputFiles[0].text, filename);
  return compiled.exports;
}
