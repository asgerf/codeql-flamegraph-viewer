import { EventStream } from './event_stream';
import { EventCategory, Phase, Scope, Trace, TraceEvent } from './event_traces';
import { LineStream, streamLinesSync } from './line_stream';
import { TupleCountStream, TupleCountParser } from './tuple_counts';

export function getTraceEventsFromLogTextOld(text: string) {
    return streamLinesSync(text).thenNew(TupleCountParser).then(toTraceEvents).then(makeTraceEventJson).get();
}

export function getTraceEventsFromLogText(text: string) {
    return streamLinesSync(text).then(fromLogStream).then(makeTraceEventJson).get();
}

export interface TraceEventStream {
    onTraceEvent: EventStream<TraceEvent>;
    end: EventStream<void>;
}

export function toTraceEvents(input: TupleCountStream): TraceEventStream {
    const onTraceEvent = new EventStream<TraceEvent>();
    let currentTime = 0;
    let previousRA = new Map<string, number>();
    input.onPipeline.listen(pipeline => {
        currentTime += 1; // We don't currently parse time from the log
        let tupleCounts: number[] = [];
        let duplicationFactors: number[] = [];
        let raTexts: string[] = [];
        for (let step of pipeline.steps) {
            tupleCounts.push(step.tupleCount);
            duplicationFactors.push(step.duplication / 100.0);
            raTexts.push(step.raText);
        }

        // Store the RA if not found
        let fullRa = raTexts.join('\n');
        let raValue: string[] | number = raTexts;
        let id: number | undefined = undefined;
        if (previousRA.has(fullRa)) {
            raValue = previousRA.get(fullRa)!;
        } else {
            id = previousRA.size;
            previousRA.set(fullRa, id);
        }

        onTraceEvent.fire({
            ph: Phase.complete,
            cat: EventCategory.evaluation,
            name: pipeline.predicate,
            tid: 1,
            pid: 1,
            ts: currentTime,
            dur: 1,
            args: {
                rows: 0,
                tc: tupleCounts,
                dup: duplicationFactors,
                ra: raValue,
                id,
            }
        } as any);
    });
    return {
        onTraceEvent,
        end: input.end,
    };
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

    function flushPipeline(numberOfRows: number) {
        if (currentPipeline !== undefined) {
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
                    ra: currentPipeline.raTexts,
                }
            });
            currentPipeline = undefined;
        }
    }

    function beginPipeline(name: string) {
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

    input.on(/Tuple counts for (.*):/, match => {
        beginPipeline(match[1]);
    });

    const parseRelationSize = ([, name, rowsStr]: string[]) => {
        let rows = Number(rowsStr);
        if (currentPipeline != null && currentPipeline.name === name) {
            flushPipeline(rows);
        } else {
            onTraceEvent.fire({
                ph: Phase.instant,
                cat: EventCategory.cacheHit,
                name,
                pid,
                tid,
                ts,
                scope: Scope.process,
                args: {
                    rows
                }
            });
        }
    };
    input.on(/>>> Relation ([\w#:]+): (\d+) rows/, parseRelationSize);
    input.on(/>>> Wrote relation ([\w#:]+) with (\d+) rows/, parseRelationSize);
    input.on(/- ([\w#:]+) has (\d+) rows/, parseRelationSize);
    input.on(/Found relation ([\w#:]+)\b.*\bRelation has (\d+) rows/, parseRelationSize);

    input.on(/(\d+)\s+(?:~(\d+)%)?\s+[{](\d+)[}]\s+r(\d+)\s+=\s+(.*)/, match => {
        if (currentPipeline == null) { return; }
        let [, tupleCountStr, duplicationStr, arityStr, resultVariable, raText] = match;
        currentPipeline.tupleCounts.push(Number(tupleCountStr));
        currentPipeline.duplicationFactors.push(Number(duplicationStr));
        currentPipeline.raTexts.push(raText);
    });

    return {
        onTraceEvent,
        end: input.end,
    };
}

export function makeTraceEventJson(stream: TraceEventStream): Trace {
    let traceEvents: TraceEvent[] = [];
    stream.onTraceEvent.listen(te => traceEvents.push(te));
    return { traceEvents };
}
