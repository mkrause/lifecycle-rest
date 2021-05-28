
const env = process.env.BABEL_ENV || 'esm';

module.exports = {
    targets: {
        node: '12.13', // Support Node v12.13 LTS (Erbium) or higher
        browsers: [
            'defaults',
            'not IE >= 0',
        ],
    },
    presets: [
        ['@babel/env', {
            // Whether to transpile modules
            modules: env === 'cjs' ? 'commonjs' : false,
            
            // Do not include polyfills automatically. Leave it up to the consumer to include the right polyfills
            // for their required environment.
            useBuiltIns: false,
            
            exclude: [
                // Do not transpile generators (saves us from needing a polyfill)
                'transform-regenerator',
            ],
        }],
        '@babel/typescript',
    ],
    plugins: [
        // Note: this may cause issues with `export * from` syntax:
        // https://github.com/babel/babel-loader/issues/195 (should be fixed in the latest version)
        // 'transform-runtime', // Needed to support generators
        
        ['transform-builtin-extend', {
            // See: http://stackoverflow.com/questions/33870684/why-doesnt-instanceof-work
            globals: ['Error', 'String', 'Number', 'Array', 'Promise'],
        }],
    ],
};
