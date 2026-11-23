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

## Submission writeup

I built MergeCourt to make code review feel like a game you can play with friends. Two to six players pick from 18 challenges across seven languages and four difficulty levels. After a countdown, everyone reviews the same snippet and saves fixes in private. The game highlights one proposal at a time, collects votes, and then shows the jury’s vote and reasoning. The final screen shows who won and walks through the original code.

DeepSpace Auth handles sign-in, PresenceRoom shows who’s online, and RecordRoom stores and syncs the game. Server actions use the signed-in player’s room membership and the current phase to control what they can see and change. The main tradeoff was using authored challenges so I could focus on private submissions and reliable timed reveals. Owner-hosted games use one batched AI request through DeepSpace. The labeled reference jury covers other rooms and missing model votes.

I directed the build and the game design. Codex implemented the app and ran the checks, and Claude CLI reviewed the plan, permissions, state transitions, AI request boundary, and challenge explanations. The checks passed 23 unit tests and 19 local browser and API tests. A live three-player game verified the countdown, private voting, reload recovery, and final scores. A separate live owner-hosted game produced a real AI vote that stayed visible in the proposal history after reload.

