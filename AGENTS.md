# AGENTS.md

Read <https://docs.deep.space/llms.txt>, then fetch the relevant documentation
page as Markdown by appending `.md`. The installed package types and CLI
`--help` describe the exact version in this project. Use your existing HTTP,
shell, and browser tools; no skill, plugin, connector, or session restart is
required. Installing the optional skill is a separate explicit choice.

## About this project

This is a **DeepSpace** app — a real-time collaborative app built on the
[`deepspace`](https://www.npmjs.com/package/deepspace) SDK and deployed to
Cloudflare Workers via `npx deepspace deploy`.

## Version control

MergeCourt uses `hoverdart/deepspace` as its source of truth. DeepSpace
deploys the local working tree and records the GitHub repository and release ID.
Deploy from a clean checkout pushed to GitHub so the release can be compared to
its source. Use `npx deepspace app source --json` and `npx deepspace releases`
to check the live app and its source binding.

## Project commands

```sh
npx deepspace auth login   # authenticate with app.space
npx deepspace dev start    # local dev server (vite + miniflare)
npx deepspace deploy       # deploy to <app>.app.space
npx deepspace test run all # run local unit, browser, and API tests
```

The room workflow and access rules live in `src/server/mergecourt-workflow.ts`
and `src/schemas/mergecourt-schema.ts`. The AI second opinion is exposed through
the owner-gated `requestAiOpinion` action. The authored guides are stored in the
app’s Worker secret. See [README.md](./README.md) for verification.

In a headless shell without an action, run `npx deepspace auth login --help` and use
the operator-supplied credential path it names; never invent credentials or put
a password on the command line.
