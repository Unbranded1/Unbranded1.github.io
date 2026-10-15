# Codex repository workflow

## Requesting a change

Describe the desired change in natural language and include the expected behavior. For example:

> In Unbranded1/Unbranded1.github.io, fix the mobile navigation, check the result at narrow viewport widths, and open a draft pull request.

## Implementation and review

1. Read the relevant files and applicable repository guidance.
2. Create a dedicated branch from the current target branch, normally `main`.
3. Implement the requested change and run checks appropriate to its impact.
4. Review the diff for unintended changes and commit the intended files.
5. Publish the branch and open a draft pull request with a concise explanation and validation results.
6. Share the pull request URL for review. Merge only when the user requests it and repository rules permit it.

Keep changes scoped to the request. Preserve unrelated work and respect branch protections and required checks. Do not include credentials in files, commits, or pull request descriptions.

## Connection verification

The setup verification uses this documentation file on a separate branch. Creating the file and then updating it produces two commits through the authenticated GitHub connection. Read back the final file and compare the branch with `main` to verify that only this document changed.

Publishing commits through the GitHub connection and pushing with local Git are separate authentication paths. A successful connector write does not establish that local `git push` is authenticated. Local publishing requires its own GitHub CLI or Git Credential Manager sign-in.
