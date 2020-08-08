/**
 * The type of a trace event produced by CodeQL.
 *
 * For CodeQL we only use the `begin`, `end`, `complete`, `instant`, and `metadata` events.
 * Other types of events are in the `UnusedPhase` enum.
 *
 * Documentation based on this document:
 *   https://docs.google.com/document/d/1CvAClvFfyA5R-PhYUmn5OOQtYMH4h6I0nSsKchNAySU/preview#
 */
export const enum Phase {
    /**
     * Begin a duration event. Must be terminated by a corresponding `end` event with the same
     * name and thread ID.
     *
     * Within a given thread ID, duration events must be properly nested and must occur
     * in weakly ascending timestamp order.
     */
    begin = 'B',

    /** Marks the end of an event previously started with `begin`. */
    end = 'E',

    /** An event with no associated duration. */
    instant = 'I',

    /**
     * Pseudo-event for attaching metadata to the enclosing process/thread.
     */
    metadata = 'M',
}

/** Phases from the Event Trace format that we currently do not use in CodeQL. */
export const enum UnusedPhase {
    /**
     * A begin/end pair merged into a single event.
     *
     * The timestamp (`ts`) is the start of the event, and the duration (`dur`) is required.
     *
     * Unlike begin/end events, complete events do not need to occur in ascending timestamp order.
     */
    complete = 'X',
    counter = 'C',
    asyncStart = 'b',
    asyncInstant = 'n',
    asyncEnd = 'e',
    flowStart = 's',
    flowStep = 't',
    flowEnd = 'f',
    sample = 'p',
    objectCreated = 'N',
    objectSnapshot = 'O',
    objectDestroyed = 'D',
    memoryDumpGlobal = 'V',
    memoryDumpProcess = 'v',
    mark = 'R',
    clockSync = 'c',
    contextBegin = '(',
    contextEnd = ')',
}

/** The scope of an `instant` event, indicating how tall its line should be in the trace viewer. */
export enum Scope {
    /** Affects everything, drawn as a vertical line crossing all processes and threads. */
    global = 'g',

    /** Affects a single process, drawn as a vertical line crossing all threads in that process. */
    process = 'p',

    /** Affects a single thread, drawn as a vertical line contained to that thread. */
    thread = 't',
}

/**
 * An category (`cat`) of an event emitted by CodeQL.
 *
 * The Event Trace format allows `cat` to be an arbitrary string. This enum documents the
 * values for `cat` we use in CodeQL.
 */
export const enum EventCategory {
    /** Evaluation of a predicate that started/ended. */
    predicateEvaluation = 'eval',

    /** A predicate was found in the cache. */
    predicateCacheHit = 'cachehit',

    /** A metadata event. */
    metadata = 'meta',
}

/** Base type for all trace events. */
export interface TraceEventBase {
    /** Name of the event, as displayed in the trace viewer. */
    name: string;

    /** The event type. See `Phase`. */
    ph: Phase;

    /**
     * Comma-separated list of event categories. Categories are arbitrary strings
     * that can be used to filter events in the trace viewer.
     */
    cat: EventCategory;

    /**
     * Time stamp, in microseconds.
     */
    ts: number;

    /** Process ID. Always 1 for now. */
    pid: 1;

    /**
     * Thread ID.
     */
    tid: number;

    /**
     * Arbitrary extra data. Can be viewed as JSON when the event is focused in the trace viewer.
     *
     * An exception is the `counter` event type, in which case all this must be an object whose
     * property values are numbers.
     */
    args?: any;
}

export interface EvaluationEvent extends TraceEventBase {
    ph: Phase.begin | Phase.end;

    cat: EventCategory.predicateEvaluation;

    /** The name of the predicate being evaluated. */
    name: string;
}

/**
 * A thread has started to evaluate a predicate.
 */
export interface BeginEvaluationEvent extends EvaluationEvent {
    ph: Phase.begin;
}

/**
 * A thread has finished evaluating a predicate.
 */
export interface EndEvaluationEvent extends EvaluationEvent {
    ph: Phase.end;

    args: {
        /** If true, the evaluation failed. Due to being rare event, this property is only present if evaluation actually failed. */
        failed?: true;

        /** Number of rows stored in the resulting predicate. */
        rows: number;

        /** Tuple counts for each step of the RA pipeline. */
        tc?: number[];

        /**
         * Estimated duplication factor for each step of the RA pipeline. A value of 1.0 corresponds to "100%".
         *
         * Must have the same length as `tc` and be absent if `tc` is absent.
         */
        dup?: number[];

        /**
         * RA text for each step in the pipeline.
         *
         * If this is a number, it is a reference to an earlier `EndEvaluationEvent` whose RA text is reused
         * by this event.
         *
         * Must have the same length as `tc` and be absent if `tc` is absent.
         */
        // TODO: experiment with backreferencing earlier predicate names in the RA text itself
        // TODO: write partial specification of RA text
        ra?: string[] | number;

        /** An ID by which later events can reference the RA text */
        id?: number;
    }
}

/**
 * A predicate was found in the cache.
 */
export interface CacheHitEvent extends TraceEventBase {
    ph: Phase.instant;

    cat: EventCategory.predicateCacheHit;

    scope: Scope.thread | Scope.process;

    /** The name of the predicate that was found in the cache. */
    name: string;

    args: {
        /** Number of rows in the predicate. */
        rows: number;
    }
}

/**
 * Meta data attached to the enclosing process/thread.
 */
export interface MetadataEvent extends TraceEventBase {
    ph: Phase.metadata;
    cat: EventCategory.metadata; // redundant data, but since metadata events are very rare, it's fine.
}

export type TraceEvent =
    | BeginEvaluationEvent
    | EndEvaluationEvent
    | CacheHitEvent
    | MetadataEvent
    ;

export interface Trace {
    traceEvents: TraceEvent[];
}
