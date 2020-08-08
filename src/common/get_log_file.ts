import * as cli from '@asgerf/strongcli';
import * as fs from 'fs';
import * as pathlib from 'path';

/**
 * Returns `input` if it is an existing file, or if `input` is a database, its latest `execute-queries` log file,
 * provided one exists.
 *
 * In any other case, an error is written to stderr and the program exits with status code 1.
 */
export function getLogFileFromCliArg(input: string) {
    if (!fs.existsSync(input)) {
        cli.fail('File not found: ' + input);
    }
    if (fs.statSync(input).isDirectory()) {
        let logDir = pathlib.join(input, 'log');
        if (!fs.existsSync(logDir) || !fs.statSync(logDir).isDirectory()) {
            cli.fail('Not a snapshot or log file: ' + input);
        }
        let logFiles = fs.readdirSync(logDir).filter(f => /^execute-queries-[\d.]+\.log$/.test(f)).sort();
        if (logFiles.length === 0) {
            cli.fail('No logs in snapshot: ' + input);
        }
        return pathlib.join(logDir, logFiles[logFiles.length - 1]);
    } else {
        return input;
    }
}
