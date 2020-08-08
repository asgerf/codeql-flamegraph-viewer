const CopyWebpackPlugin = require('copy-webpack-plugin');
const IgnorePlugin = require('webpack').IgnorePlugin;

const common = {
    resolve: {
        extensions: ['.ts', '.tsx', '.js']
    },
    mode: 'development',
    module: {
        rules: [
            { test: /\.tsx?$/, loader: 'ts-loader' }
        ]
    },
};

const nodeCommon = {
    ...common,
    target: 'node',
    node: {
        __dirname: false, // Do not rewrite __dirname
        __filename: false,
    }
}

const flamegraphCli = {
    ...nodeCommon,
    entry: './src/bin/flamegraph.ts',
    output: {
        filename: 'flamegraph.js'
    },
};

const qlprofCli = {
    ...nodeCommon,
    entry: './src/bin/qlprof.ts',
    output: {
        filename: 'qlprof.js'
    },
}

const web = {
    ...common,
    target: 'web',
    entry: './src/web/flamegraph_webmain.ts',
    output: {
        filename: 'flamegraph_webmain.js'
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'node_modules/d3-flame-graph/dist/d3-flamegraph.css',
                    to: 'd3-flamegraph.css'
                },
                {
                    from: './src/web/flamegraph.html',
                    to: 'flamegraph.html'
                }
            ]
        }),
        new IgnorePlugin({
            // Ignore NodeJS module imports when building for web
            resourceRegExp: /^readline$/
        }),
    ]
};

module.exports = [flamegraphCli, qlprofCli, web];
