import * as cli from '@asgerf/strongcli';
import { Constants, TraceEvent, TraceStreamJson } from '@tracerbench/trace-event';
import * as fs from 'fs';
import * as pathlib from 'path';
import { FlamegraphNode, getFlamegraphFromLogStream, getFlamegraphFromLogText } from '../common/flamegraph_builder';
import { getLogFileFromCliArg } from '../common/get_log_file';
import { mkdirp } from '../common/mkdirp';
import escapeHtml = require('lodash.escape');

enum Format {
    html = 'html',
    trace = 'trace',
}

interface Options {
    outputFile?: string;
    open: boolean;
    async: boolean;
    format: Format;
    relative: boolean;
}
let program = cli.program({
    helpIfEmpty: true,
    positionalArgHint: '<logfile or database>',
    description: `
  Parses tuple counts from the given log file and generates a flamegraph of
  evaluated predicates weighted by tuple counts.

  If given a database, the most recent log file from that database is used.
`
});
let { options, args } = program.main<Options>({
    outputFile: {
        name: ['-o', '--output'],
        value: String,
        valueHint: 'file',
        description: 'Where to write the output.',
    },
    format: {
        value: cli.oneOf(Format),
        default: Format.html,
        description: `
Output format. Takes one of the following values:
html:  Static HTML file with d3-flame-graph. (the default)
trace: Trace Event JSON file.
       Can be viewed in chrome://tracing or https://speedscope.app
`
    },
    open: {
        description: 'Open the generated HTML file in a browser.\nHas no effect if not generating HTML.'
    },
    async: {
        description: 'Use asynchronous parsing (for benchmarking)',
    },
    relative: {
        description: 'Emit relative paths to files in flamegraph-viewer'
    }
});

let input = getLogFileFromCliArg(args[0]);

let outputFile = options.outputFile ?? (options.format === Format.html ? 'flamegraph.html' : 'flamegraph.json');
let outputDir = pathlib.dirname(outputFile);

mkdirp(outputDir);
let outputDataFile = outputFile + '.data.js';

const formatters: { [K in Format]: (node: FlamegraphNode) => void } = {
    [Format.html]: flamegraph => {
        let ownDirectory = __dirname;
        let htmlTemplateFile = pathlib.join(ownDirectory, 'flamegraph.html');
        let htmlTemplateText = fs.readFileSync(htmlTemplateFile, 'utf8');

        let pathToOwnDirectory = options.relative
            ? pathlib.relative(outputDir, ownDirectory)
            : ownDirectory;

        let htmlText = htmlTemplateText
            .replace(/(flamegraph_webmain\.js|d3-flamegraph\.css)/g, m => pathlib.join(pathToOwnDirectory, m))
            .replace('<!--%DATA%-->', `<script src="${escapeHtml(pathlib.basename(outputDataFile))}"></script>`);

        fs.writeFileSync(outputFile, htmlText, { encoding: 'utf8' });

        let dataJs = 'window.codeqlFlamegraphData = ' + JSON.stringify(flamegraph);
        fs.writeFileSync(outputFile + '.data.js', dataJs, { encoding: 'utf8' });

        if (options.open) {
            require('open')(outputFile);
        }
    },
    [Format.trace]: flamegraph => {
        let traceEvents: TraceEvent[] = [];
        function writeNode(node: FlamegraphNode, startTime: number) {
            traceEvents.push({
                ph: Constants.TRACE_EVENT_PHASE_BEGIN,
                cat: 'p',
                name: node.name,
                pid: 0,
                tid: 0,
                ts: startTime,
                args: {}
            });
            let currentTime = startTime;
            for (let child of node.children) {
                writeNode(child, currentTime);
                currentTime += child.value;
            }
            traceEvents.push({
                ph: Constants.TRACE_EVENT_PHASE_END,
                cat: 'p',
                name: node.name,
                pid: 0,
                tid: 0,
                ts: startTime + node.value,
                args: {}
            });
        }
        writeNode(flamegraph, 0);

        let trace: TraceStreamJson = {
            traceEvents,
            metadata: {}
        };
        fs.writeFileSync(outputFile, JSON.stringify(trace), { encoding: 'utf8' });
    }
};

async function main() {
    let flamegraph = options.async
        ? await getFlamegraphFromLogStream(fs.createReadStream(input))
        : getFlamegraphFromLogText(fs.readFileSync(input, 'utf8'));
    
    let formatter = formatters[options.format];
    formatter(flamegraph);
}

main();