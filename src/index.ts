import lr from 'line-reader';
import fs from 'fs';

type Event = {
    event: 'FILE_PATH_RECEIVED';
    filepath: string;
} | {
    event: 'ERROR_RECEIVED';
    lineNumber: number;
    name: string;
} | {
    event: null;
};

const getIsFilepath = (input: string): [boolean, string] => {
	if (input[0] !== '/') {
		return [false, ""];
	}
	const isJs = input.slice(-3) === '.js' || input.slice(-3) === '.ts';
	const isJsx = input.slice(-4) === '.jsx' || input.slice(-4) === '.tsx';
	return isJs || isJsx ? [true, input] : [false, ""];
}

const getIsError = (line: string): [boolean, number, string] => {
	if (line.toLocaleLowerCase().includes('unexpected token')) {
		return [false, -1, ""];
	}
	const splitByWhiteSpace = line.split(/\s+/).filter(e => !!e);
	if (!splitByWhiteSpace || !splitByWhiteSpace.length) {
		return [false, -1, ""];
	}
	let first = splitByWhiteSpace[0];
	const last = splitByWhiteSpace.at(-1);
    if (last === undefined) {
        return [false, -1, ""];
    }
	if (first === last) {
		return [false, -1, ""];
	}
	let lineNumberAndIndex = first.split(':');
	if (!lineNumberAndIndex || lineNumberAndIndex.length !== 2) {
		return [false, -1, ""];
	}
	let lineNumber = Number(lineNumberAndIndex[0]);
	if (lineNumber === NaN) {
		return [false, -1, ""];
	}
	return [true, lineNumber, last];
};

const parseLine = (line: string): Event => {
	const [isFilepath, filepath] = getIsFilepath(line);
	if (isFilepath) {
		return {
			event: 'FILE_PATH_RECEIVED',
			filepath
		};
	}
	const [isError, lineNumber, name] = getIsError(line);
	if (isError) {
		return {
			event: 'ERROR_RECEIVED',
			lineNumber,
			name
		};
	}
	return { event: null };
};

type Err = { lineNumber: number; name: string } | { lineNumber: number; names: string[] };

type Stateful = {
    filepath: string,
    errors: Array<Err>
}

type State = null | Stateful;

type ParsedState = {
    filepath: string,
    errors: Array<{ lineNumber: number; names: string[] }>
}

function isStateful(state: unknown): state is Stateful {
    return !!state && typeof state === 'object' && 'filepath' in state && 'errors' in state;
}

function assertIsState(state: unknown): asserts state is State {
    if (state !== null || !isStateful(state)) {
        throw new Error("Object isn't state. Huh???");
    }
}

const parseInput = (input: string) => {
	let parsed: ParsedState[] = [];
	let state: State = null;
	let lines = input.split('\n');
	lines.forEach((line) => {
		let parsedLine = parseLine(line);
		switch (parsedLine.event) {
			case 'FILE_PATH_RECEIVED': {
				const { filepath } = parsedLine;
				if (state !== null) {
					state.errors = dedupeErrors(state.errors);
					state.errors = combineErrorsByLine(state.errors)
					state.errors.sort((a, b) => b.lineNumber - a.lineNumber);
                    // shouldn't do this and should assert instead but oh well
					parsed.push(state as ParsedState);
				}
				state = {
					filepath, errors: []
				}
				return;
			}
			case 'ERROR_RECEIVED': {
				const { lineNumber, name } = parsedLine;
				state!.errors.push({
					lineNumber, name
				})
				return;
			}
			case null: {
				return;
			}
			default: {
				throw new Error('unhandled input');
			}
		}
	});

    // FIXME: IDK why TS can't infer that state is Stateful here. Odd
	if (state !== null) {
		(state as unknown as Stateful).errors = dedupeErrors((state as unknown as Stateful).errors);
		(state as unknown as Stateful).errors = combineErrorsByLine((state as unknown as Stateful).errors);
		(state as unknown as Stateful).errors.sort((a, b) => b.lineNumber - a.lineNumber);
		parsed.push(state);
	}
	return parsed;
};

const dedupeErrors = (errors: Err[]) => {
	const found = new Set();
	let results = errors.filter(err => {
        assertSingularErrorNamePresent(err);
		const key = `${err.name}-${err.lineNumber}`;
		if (found.has(key)) {
			return false;
		} else {
			found.add(key);
			return true;
		}
	});
	return results;
};

const combineErrorsByLine = (errors: Err[]): Err[] => {
	console.log(errors);
	const combined = errors.reduce((acc, err) => {
        assertSingularErrorNamePresent(err);
		const { name, lineNumber } = err;
		if (acc[lineNumber] === undefined) {
			acc[lineNumber] = { lineNumber, names: [name] }
		} else {
			acc[lineNumber].names.push(name);
		}
		return acc;
	}, {} as Record<string, {lineNumber: number, names: string[]}>);

	return Object.values(combined);
};

function assertSingularErrorNamePresent(f: object): asserts f is { name: string, lineNumber: number } {
    if (!('name' in f)) {
        throw new Error('error name not found in expected object!');
    }
}

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

const stdin = process.stdin;
let data = '';

stdin.setEncoding('utf8');

stdin.on('data', function (chunk) {
  data += chunk;
});

stdin.on('end', function () {
	const parsed = parseInput(data);
	parsed.forEach(ignoreErrorsForFile);
});

stdin.on('error', console.error);

