import { EventStream } from './event_stream';
import { EventCategory, Phase, Scope, Trace, TraceEvent } from './event_traces';
import { LineStream, streamLinesSync } from './line_stream';

export function getTraceEventsFromLogText(text: string) {
    return streamLinesSync(text).then(fromLogStream).then(makeTraceEventJson).get();
}

export interface TraceEventStream {
    onTraceEvent: EventStream<TraceEvent>;
    end: EventStream<void>;
}

export function fromLogStream(input: LineStream): TraceEventStream {
    const onTraceEvent = new EventStream<TraceEvent>();

    const pid = 1;
    const tid = 1;
    const ts = 1;

    let seenCsvImbQueriesHeader = false;
    input.on(/CSV_IMB_QUERIES:\s*(.*)/, ([whole, row]) => {
        if (!seenCsvImbQueriesHeader) {
            seenCsvImbQueriesHeader = true;
            return;
        }
        let [queryType, queryPredicateStr, queryName, stage, success, time, numResult, cumulativeTime] = row.split(',');
        onTraceEvent.fire({
            ph: Phase.instant,
            cat: EventCategory.stageEnded,
            name: queryPredicateStr,
            scope: Scope.process,
            ts,
            pid,
            tid,
        });
    });

    interface Pipeline {
        name: string;
        tupleCounts: number[];
        duplicationFactors: number[];
        raTexts: string[];
    }

    let currentPipeline: Pipeline | undefined;
    let raCache = new Map<string, number>();
    let nextId = 1;

    function flushPipeline(numberOfRows: number) {
        if (currentPipeline !== undefined) {
            let id = nextId++;
            let fullRaText = currentPipeline.raTexts.join('\n');
            let reusedRaId = raCache.get(fullRaText);
            if (reusedRaId == null) {
                raCache.set(fullRaText, id);
            }
            onTraceEvent.fire({
                ph: Phase.complete,
                cat: EventCategory.evaluation,
                name: currentPipeline.name,
                dur: 1,
                ts,
                pid,
                tid,
                args: {
                    rows: numberOfRows,
                    dup: currentPipeline.duplicationFactors,
                    tc: currentPipeline.tupleCounts,
                    ra: reusedRaId ?? currentPipeline.raTexts,
                    id,
                }
            });
            currentPipeline = undefined;
        }
    }

    function beginPipeline(name: string) {
        if (currentPipeline !== undefined) {
            if (currentPipeline.raTexts.length > 0) {
                throw new Error('Unterminated pipeline ' + currentPipeline.name);
            }
            return;
        }
        currentPipeline = {
            name,
            tupleCounts: [],
            duplicationFactors: [],
            raTexts: []
        };
    }

    input.on(/Starting to evaluate predicate (.*)\/.*/, match => {
        beginPipeline(match[1]);
    });

    input.on(/Tuple counts for (.*):$/, match => {
        beginPipeline(match[1]);
    });

    function stripSuffix(name: string) {
        return name.replace(/(#(cur_delta|prev_delta|prev)|@staged_ext|_delta)$/, '');
    }

    const parseRelationSize = ([, name, rowsStr]: string[]) => {
        let rows = Number(rowsStr);
        if (currentPipeline != null) {
            if (stripSuffix(currentPipeline.name) === stripSuffix(name)) {
                flushPipeline(rows);
            } else {
                console.warn(`On line ${input.lineNumber}:\nPipeline for ${currentPipeline.name} unexpectedly terminated by ${name}`);
            }
        }
    };

    const relationNameRex = '(?:[\\w@#:]|"[^"]*"|[(][^)]*[)]|<[^>]*>)+';

    input.on(new RegExp(`>>> Relation (${relationNameRex}): (\\d+) rows`), parseRelationSize);
    input.on(new RegExp(`>>> Wrote relation (${relationNameRex})(?:/[^ ]*)? with (\\d+) rows`), parseRelationSize);
    input.on(new RegExp(`- (${relationNameRex}) has (\\d+) rows`), parseRelationSize);
    input.on(new RegExp(`Empty delta for (${relationNameRex})`), match => {
        parseRelationSize(['', match[1], '0']);
    })

    input.on(new RegExp(`Found relation (${relationNameRex})\\b.*\\bRelation has (\\d+) rows`), ([, name, rowsStr]) => {
        onTraceEvent.fire({
            ph: Phase.instant,
            cat: EventCategory.cacheHit,
            name,
            pid,
            tid,
            ts,
            scope: Scope.process,
            args: {
                rows: Number(rowsStr)
            }
        });
    });

    input.on(/(\d+)\s+(?:~(\d+)%)?\s+[{](\d+)[}]\s+r(\d+)\s+=\s+(.*)/, match => {
        if (currentPipeline == null) { return; }
        let [, tupleCountStr, duplicationStr, arityStr, resultVariable, raText] = match;
        currentPipeline.tupleCounts.push(Number(tupleCountStr));
        currentPipeline.duplicationFactors.push(Number(duplicationStr) / 100.0);
        currentPipeline.raTexts.push(raText);
    });

    return {
        onTraceEvent,
        end: input.end,
    };
}

export function makeTraceEventJson(stream: TraceEventStream): Trace {
    let traceEvents: TraceEvent[] = [];
    stream.onTraceEvent.listen(te => {
        traceEvents.push(te);
    });
    return { traceEvents };
}
