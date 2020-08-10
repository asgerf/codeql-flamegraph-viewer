
function allMatches(regexp: RegExp, input: string): RegExpMatchArray[] {
    if (!regexp.flags.includes('g')) { throw new Error('allMatches requires a RegExp with /g flag'); }
    let match: RegExpMatchArray | null;
    let result = [];
    while ((match = regexp.exec(input)) != null) {
        result.push(match);
    }
    return result;
}

export interface RADependencies {
    inputVariables: number[];
    inputRelations: string[];
}

export function getDependenciesFromRA(racode: string): RADependencies {
    let inputVariables = new Set<number>();
    let inputRelations = new Set<string>();
    let stripped = racode.replace(/"[^"]+"/g, '""');
    for (let [ref] of allMatches(/(?<!HIGHER-ORDER RELATION |PRIMITIVE |[$@#])\b[a-zA-Z#][\w:#_]+\b(?!\()/g, stripped)) {
        if (/^([A-Z]+|true|false)$/.test(ref)) { continue; } // Probably an RA keyword
        if (/^r\d+$/.test(ref)) {
            inputVariables.add(Number(ref.substring(1)));
        } else {
            inputRelations.add(ref);
        }
    }
    return {
        inputVariables: Array.from(inputVariables),
        inputRelations: Array.from(inputRelations)
    };
}

export function isUnionOperator(raText: string) {
    return raText.includes('\\/');
}
