# MergeCourt

MergeCourt is a two-person code review game. Pick a short TypeScript challenge, invite a teammate, and file findings privately. After both reviews are locked, the host reveals the findings so both reviewers can vote and compare verdicts.

[Play MergeCourt](https://mergecourt-hoverdart.app.space) · [GitHub repository](https://github.com/hoverdart/deepspace)

## Run locally

Use Node 24 and npm 11.6 or newer. Run `npm ci`, `npx deepspace auth login`, and `npm run dev`. The repository points to the existing DeepSpace app. A separate deployment needs its own DeepSpace app ID and secrets.

Run `npm run validate` for TypeScript and unit tests and `npm run build` for the production bundle. Run `npx deepspace test run all` with three usable DeepSpace test accounts for the browser and API suite. The tests reuse the local account pool. [DeepSpace test account setup](https://docs.deep.space/guides/testing#provisioning-test-accounts)

For the local admin, interrupted-reveal, and AI checks, set `MERGECOURT_TEST_ADMIN_JWT` to the app owner’s CLI token. Set both `MERGECOURT_TEST_AI_FIXTURE` and `DEEPSPACE_API_URL` to `http://127.0.0.1:5187` to route the paid integration boundary to the local fixture. Playwright starts the fixture. To verify a deployed release without sending a paid request, set `MERGECOURT_TEST_URL` to its URL and run `npx playwright test -c tests/playwright.config.ts`.

The reference guide is Base64-encoded UTF-8 JSON in the DeepSpace secret `MERGECOURT_REFERENCE_GUIDE`. The mapping is keyed by challenge ID and each value is an array of objects with `title` and `explanation`. Keep the local source file out of Git. MergeCourt retrieves the guide from a Worker action after the host closes the room. [DeepSpace secrets](https://docs.deep.space/guides/secrets)

## Review the implementation

- The [collection rules](src/schemas/mergecourt-schema.ts) deny direct client access to private drafts, staged copies, and AI claims, including app admin access. The action that reads a private review filters on both room and verified author.
- The [room workflow](src/server/mergecourt-workflow.ts) serializes mutations through the app’s RecordRoom. Trace `revealRoom` from the authenticated action to staged copies and the single shared session update. RecordRoom sends that update to both reviewers, and the room route renders it from a `useQuery` subscription.
- The [AI action](src/server/mergecourt-ai.ts) checks the app owner and room host, then claims the room’s one paid request before calling the provider. The core review stays usable if that request fails.

## Submission draft

I built MergeCourt for two developers to review the same pull request. Each person commits their findings in private, then both can see and vote on what the other person found. There are two short TypeScript challenges and a reference guide after the room closes.

The main tradeoff was keeping the game to two people and authored code so I could focus on making the shared reveal work correctly. DeepSpace Auth handles sign-in, RecordRoom persists and broadcasts authorized data, PresenceRoom shows who’s online, and server actions enforce the review phases. An optional AI opinion is available after reveal in rooms I host as the app owner.

Codex implemented the app and ran the verification. I used Claude Code to review the plan, the room permissions and state transitions, and the AI request boundary.

Before submission, add your own verification details after stepping through the deployed flow in two signed-in sessions, checking a rejected request and the Worker logs, and tracing a reveal from the action to the browser.
