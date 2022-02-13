# `grampa`

When adding eslint to an exiting project, you'll usually find that there are a lot of errors to fix. Depending on the size of your project, you might even have thousands of linting errors.

You're a busy developer and you don't have time to make thousands of lint changes right now and then test everything to be sure that your app hasn't broken.

That's where `grampa` comes in.

You can use `grampa` to add `// eslint-disable-next-line` comments to all of the lint errors in your codebase.

## Installation

In your project:

```
yarn add -D eslint-formatter-grampa
```

## Usage

First, be sure you've fixed everything that's auto-fixable in your project. Eg:

```
npx eslint --quiet --fix './src/**/*.{js,jsx,ts,tsx}'
```

Then, use `grampa` to update all of the remaining errors with `// eslint-disable` comments (but be sure you have no unstaged/uncommitted changes because `grampa` will edit a bunch of your local files):

```
npx eslint --format grampa --quiet --fix './src/**/*.{js,jsx,ts,tsx}'
```

Then run `git diff` and see what's changed.

You might need to run `eslint --fix` again if you have a code formatter enabled, to ensure that the new `// eslint-disable` comments have appropriate indentation.

⚠️ **Warnings**:
1. You should review the diff carefully before committing it
1. `grampa` may run slowly on larger codebases with lots of lint errors
1. `grampa` hasn't yet been tested on Windows/Linux systems