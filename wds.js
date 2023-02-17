module.exports = {
  // file paths to explicitly not transform for speed, defaults to [], plus whatever the compiler backend excludes by default, which is `node_modules` for both esbuild and swc
  ignore: ['data'],
  swc: {
    env: {
      targets: {
        node: 16,
      },
    },
    jsc: {
      parser: {
        syntax: "typescript",
        decorators: true,
        dynamicImport: true,
      },
      target: "es2015",
      "transform": {
        "legacyDecorator": true,
        "decoratorMetadata": true
      },
      "baseUrl": ".",
      "paths": {
        "@prisma/type-graphql": [
          "prisma/type-graphql/index.ts"
        ]
      },
    },
    module: {
      type: "commonjs",
      lazy: true,
    },
  }
};
