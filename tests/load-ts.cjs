const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

module.exports = function createLoader(mocks = {}) {
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const requireFrom = Module.createRequire(filename);
    const localRequire = request => {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(root, request.slice(2)) : path.resolve(path.dirname(filename), request);
        const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (resolved && /\.tsx?$/.test(resolved)) return load(resolved);
      }
      return requireFrom(request);
    };
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
    new Function('require', 'module', 'exports', result.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return file => load(path.resolve(root, file));
};
