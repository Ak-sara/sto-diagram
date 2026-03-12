import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser  from '@rollup/plugin-terser'

export default [
  // ESM build (for npm / Svelte / Nuxt)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/sto-diagram.js',
      format: 'esm',
    },
    plugins: [resolve(), commonjs(), terser()],
  },
  // UMD build (for CDN / plain HTML <script> tag)
  {
    input: 'src/index.js',
    output: {
      file: 'dist/sto-diagram.umd.js',
      format: 'umd',
      name: 'StoDiagram',
      exports: 'named',
    },
    plugins: [resolve(), commonjs(), terser()],
  },
]
