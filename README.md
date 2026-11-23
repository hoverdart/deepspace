# MergeCourt

MergeCourt is a timed code review game for two to six people. Choose from 18 challenges in seven languages, invite friends, and save proposed fixes in private. The game puts one proposal in the spotlight per round and reveals the jury’s ballot after voting. It ends with a scoreboard and a walkthrough of the original code.

[Play MergeCourt](https://mergecourt-hoverdart.app.space) · [GitHub repository](https://github.com/hoverdart/deepspace)

## Run locally

Use Node 24 and npm 11.6 or newer. Run `npm ci`, `npx deepspace auth login`, and `npm run dev`. The repository points to the existing DeepSpace app. A separate deployment needs its own DeepSpace app ID and secrets.

Run `npm run validate` for TypeScript and unit tests and `npm run build` for the production bundle. Run `npx deepspace test run all` with three usable DeepSpace test accounts for the browser and API suite. The tests reuse the local account pool. [DeepSpace test account setup](https://docs.deep.space/guides/testing#provisioning-test-accounts)

For the local admin, interrupted-reveal, and AI checks, set `MERGECOURT_TEST_ADMIN_JWT` to the app owner’s CLI token. Set both `MERGECOURT_TEST_AI_FIXTURE` and `DEEPSPACE_API_URL` to `http://127.0.0.1:5187` to route the paid integration boundary to the local fixture. Playwright starts the fixture. To verify a deployed release without sending a paid request, set `MERGECOURT_TEST_URL` to its URL and run `npx playwright test -c tests/playwright.config.ts`.

Timed games read their walkthroughs from `src/server/challenge-guides.ts` after the final round. The original two-player rooms can read a Base64-encoded UTF-8 JSON guide from the DeepSpace secret `MERGECOURT_REFERENCE_GUIDE`. The mapping is keyed by challenge ID and each value is an array of objects with `title` and `explanation`. The Worker action serves both guides only to room members after the room closes. [DeepSpace secrets](https://docs.deep.space/guides/secrets)

## Review the implementation

- The [collection rules](src/schemas/mergecourt-schema.ts) deny direct client access to private drafts, staged copies, and AI claims, including app admin access. The action that reads a private review filters on both room and verified author.
- The [room workflow](src/server/mergecourt-workflow.ts) serializes mutations through the app’s RecordRoom. Trace `revealRoom` from the authenticated action to staged copies and the single shared session update. RecordRoom sends that update to both reviewers, and the room route renders it from a `useQuery` subscription.
- The [timed game](src/server/mergecourt-game.ts) keeps ballots private and publishes the current proposal, jury vote, and aggregate once per round. A point requires a majority and at least one reviewer voting Valid.
- The [AI action](src/server/mergecourt-ai.ts) batches the jury’s votes into one paid request per owner-hosted game. Rooms hosted by other players and rounds without a usable model result use the labeled reference jury.

## Original MVP submission draft

I built MergeCourt for two developers to review the same pull request. Each person commits their findings in private, then both can see and vote on what the other person found. There are two short TypeScript challenges and a reference guide after the room closes.

The main tradeoff was keeping the game to two people and authored code so I could focus on making the shared reveal work correctly. DeepSpace Auth handles sign-in, RecordRoom persists and broadcasts authorized data, PresenceRoom shows who’s online, and server actions enforce the review phases. An optional AI opinion is available after reveal in rooms I host as the app owner.

Codex implemented the app and ran the verification, with Claude CLI reviews of the plan, room permissions, state transitions, and AI request boundary. The automated checks covered the two-user workflow and rejected access attempts. A single live AI request produced three cards that stayed visible after the room closed and refreshed.

Before submission, add your own verification details after stepping through the deployed flow in two signed-in sessions, checking a rejected request and the Worker logs, and tracing a reveal from the action to the browser.
