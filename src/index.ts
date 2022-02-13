#!/usr/bin/env node

import lr from 'line-reader';
import fs from 'fs';
import { ESLint } from 'eslint';

type ParsedState = {
    filepath: string,
    errors: Array<{ lineNumber: number; names: string[] }>
}

const ERROR_SEVERITY = 2;

const parseInput = (input: ESLint.LintResult[]): ParsedState[] => {
	return input.map((lintResult) => {
		const {filePath, messages} = lintResult;
		const errors = messages.filter(e => e.severity === ERROR_SEVERITY);
		const byLineNumber = errors.reduce((acc, { line, ruleId }) => {
			if (!ruleId) {
				return acc;
			}
			if (acc[line] === undefined) {
				acc[line] = { lineNumber: line , names: [ruleId] }
			} else if (!acc[line].names.includes(ruleId)) {
				acc[line].names.push(ruleId)
			}
			return acc;
		}, {} as Record<number, { lineNumber: number, names: string[] }>);
		const errorsByLineNumber = Object.values(byLineNumber);
		// latest in the file should be fixed first, to avoid invalidating line numbers
		errorsByLineNumber.sort((a, b) => b.lineNumber - a.lineNumber);
		return { filepath: filePath, errors: errorsByLineNumber };
	});
};

const ignoreErrorsForFile = ({ filepath, errors }: ParsedState) => {
	const lines: string[] = [];
	lr.eachLine(filepath, (line, last) => {
			lines.push(line);
			if (last) {
				errors.forEach(({ lineNumber, names }) => {
					lines.splice(lineNumber - 1, 0, `// eslint-disable-next-line ${names.join(', ')}`);
				});
				const fullFileContents = lines.join('\n');
				fs.writeFileSync(filepath, fullFileContents);
			}
	});
};

module.exports = function (results: ESLint.LintResult[], context: unknown) {
	const parsed = parseInput(results);
	parsed.forEach(ignoreErrorsForFile);
	return 'Grampa ran successfully! Please run `git diff` and review the changes before committing.';
}