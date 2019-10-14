
const env = process.env.BABEL_ENV || 'esm';

module.exports = {
    presets: [
        '@babel/flow',
        '@babel/typescript',
        ['@babel/env', {
            targets: {
                node: '6.9', // LTS (Boron)
                browsers: ['>0.25%', 'not dead'],
            },
            
            // Whether to transpile modules
            modules: env === 'cjs' ? 'commonjs' : false,
            
            exclude: [
                // Do not transpile generators (saves us from needing a polyfill)
                'transform-regenerator',
            ],
        }],
    ],
    plugins: [
        // Note: this may cause issues with `export * from` syntax:
        // https://github.com/babel/babel-loader/issues/195 (should be fixed in the latest version)
        // 'transform-runtime', // Needed to support generators
        
        '@babel/proposal-class-properties',
        
        ['transform-builtin-extend', {
            // See: http://stackoverflow.com/questions/33870684/why-doesnt-instanceof-work
            globals: ['Error', 'String', 'Number', 'Array', 'Promise'],
        }],
    ],
};
