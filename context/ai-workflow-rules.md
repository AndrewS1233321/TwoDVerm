# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. The
context files define what to build, how to build it, and the current
state of progress. Implement against `context/specs/` files. Do not
infer or invent game behaviour from scratch.

The project owner is not an experienced developer. Explain what was
built and how to test it in plain language at the end of each unit.

## Scoping Rules

- Work on one unit (one spec file) at a time.
- Prefer small, playable increments over large speculative changes.
- Do not add features, enemies, weapons or systems from later units.
- Do not install a package before the unit that first needs it.

## When to Split Work

Split an implementation step if it combines:

- Networking changes and gameplay rule changes
- More than one new combat mechanic
- Behaviour not clearly defined in the context files or spec

If a change cannot be tested by playing it within a few minutes,
the scope is too broad. Split it.

## Handling Missing Requirements

- Do not invent product behaviour not defined in the context files.
- If a requirement is ambiguous, ask the project owner, then record
  the answer in the relevant context file before implementing.
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` before continuing.
- Tuning numbers (damage, speeds, timings) may be chosen freely, but
  must be placed in `shared/` data tables so they are easy to change.

## Protected Files

Do not modify the following unless explicitly instructed:

- `templates/` — original playbook templates
- `README.md` — original playbook guide
- `node_modules/` and lockfiles (except via npm commands)

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- Architecture, boundaries or the simulation model
- Entity model fields
- Code conventions
- Feature scope

## Before Moving to the Next Unit

1. The unit works end to end and has been played (two browser tabs
   minimum for networked features).
2. No invariant in `architecture.md` was violated.
3. `npm run typecheck` passes.
4. `progress-tracker.md` reflects the completed work.
5. Changes are committed to git with a clear message.
