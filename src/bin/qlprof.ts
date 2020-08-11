import * as cli from '@asgerf/strongcli';
import * as fs from 'fs';
import * as pathlib from 'path';
import { getTraceEventsFromLogText } from '../common/event_trace_builder';
import { getLogFileFromCliArg } from '../common/get_log_file';
import { mkdirp } from '../common/mkdirp';

interface Options {
    outputFile: string;
}

const program = cli.program({
    name: 'qlprof',
    description: 'Manipulates CodeQL profiling data.',
    helpIfEmpty: true,
});

const { options, args } = program.main<Options>({
    outputFile: {
        name: ['-o', '--output'],
        value: String,
        valueHint: 'file',
        description: 'Where to save the output JSON file.',
        default: cli.required,
    }
});

let input = getLogFileFromCliArg(args[0]);
let json = getTraceEventsFromLogText(fs.readFileSync(input, 'utf8'));

let { outputFile } = options;
mkdirp(pathlib.dirname(outputFile));
fs.writeFileSync(outputFile, JSON.stringify(json), 'utf8');