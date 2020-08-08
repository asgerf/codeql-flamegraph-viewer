import * as fs from 'fs';
import * as pathlib from 'path';

/** Creates the given directory and its parent directories, like `mkdir -p`. */
export function mkdirp(path: string) {
    if (!fs.existsSync(path)) {
        let parent = pathlib.dirname(path);
        if (parent.length < path.length) {
            mkdirp(pathlib.dirname(path));
        }
        fs.mkdirSync(path);
    }
}
