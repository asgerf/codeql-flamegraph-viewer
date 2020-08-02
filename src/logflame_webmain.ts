// Don't use imports from this file, as it causes the file to be compiled as an ES2015 module.
type FlamegraphNode = import('./flamegraph_builder').FlamegraphNode;

// Declare values brought in through other script tags.
declare var d3: typeof import('d3');
declare var flamegraph: typeof import('d3-flame-graph').flamegraph & {
    tooltip: {
        defaultFlamegraphTooltip(): {
            html(callback: (d: { data: FlamegraphNode }) => string): void;
        }
    }
};
declare var codeqlFlamegraphData: FlamegraphNode;

const detailsView = document.getElementById('details')!;
const tupleCountView = document.getElementById('tuple-count-view')!;

var chart = flamegraph().width(960);
    
function escapeHtml(text: string | number) {
    return String(text).replace(/[<>&'"]/g, m => '&#' + m.charCodeAt(0).toString(16) + ';');
}

var tip = flamegraph.tooltip.defaultFlamegraphTooltip()
    .html(function (d) {
        let rawLines = d.data.rawLines;
        tupleCountView.innerText = rawLines == null ? '' : rawLines.join('\n');
        return escapeHtml(d.data.name) + ': ' + escapeHtml(d.data.value);
    });
chart.tooltip(tip as any);

function showFlamegraph(rootNode: FlamegraphNode) {
    d3.select('#chart')
        .datum(rootNode)
        .call(chart);
}
showFlamegraph(codeqlFlamegraphData);
