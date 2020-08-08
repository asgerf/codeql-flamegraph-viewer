import { TupleCountStream, TupleCountParser } from "./tuple_counts";
import { TraceEvent, Phase, EventCategory, Trace } from "./event_traces";
import { EventStream } from "./event_stream";
import { streamLinesSync } from "./line_stream";

export function getTraceEventsFromLogText(text: string) {
    return streamLinesSync(text).thenNew(TupleCountParser).then(toTraceEvents).then(makeTraceEventJson).get();
}

export interface TraceEventStream {
    onTraceEvent: EventStream<TraceEvent>;
    end: EventStream<void>;
}

export function toTraceEvents(input: TupleCountStream): TraceEventStream {
    const onTraceEvent = new EventStream<TraceEvent>();
    let currentTime = 0;
    input.onPipeline.listen(pipeline => {
        onTraceEvent.fire({
            ph: Phase.begin,
            cat: EventCategory.predicateEvaluation,
            name: pipeline.predicate,
            tid: 1,
            pid: 1,
            ts: currentTime,
        });
        currentTime += 1; // We don't currently parse time from the log
        let tc: number[] = [];
        let dup: number[] = [];
        let ra: string[] = [];
        for (let step of pipeline.steps) {
            tc.push(step.tupleCount);
            dup.push(step.duplication / 100.0);
            ra.push(step.raText);
        }
        onTraceEvent.fire({
            ph: Phase.end,
            cat: EventCategory.predicateEvaluation,
            name: pipeline.predicate,
            tid: 1,
            pid: 1,
            ts: currentTime,
            args: {
                rows: 0,
                tc,
                dup,
                ra,
            }
        });
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
