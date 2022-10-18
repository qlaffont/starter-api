module.exports = {
  // file paths to explicitly not transform for speed, defaults to [], plus whatever the compiler backend excludes by default, which is `node_modules` for both esbuild and swc
  ignore: ['data'],
};
