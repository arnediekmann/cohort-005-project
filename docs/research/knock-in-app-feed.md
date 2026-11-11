# What Knock offers for Cadence's in-app feed

Research for issue #10 (parent map #9). Checked on 2026-11-11 against Knock's pricing page, docs.knock.app (including `llms-full.txt`), and the published npm packages, read from source:

| Package | Version read |
| --- | --- |
| `@knocklabs/react` | 0.15.1 |
| `@knocklabs/react-core` | 0.17.1 |
| `@knocklabs/client` | 0.23.1 |
| `@knocklabs/node` | 1.41.1 |
| `@knocklabs/cli` | 1.6.2 |

The pages under docs.knock.app/in-app-ui lag the package source in places. Where they disagree, this note follows the source.

## TL;DR

- **The free tier fits.** It costs $0 and allows 10,000 messages a month, with no cap on users or stored profiles and unlimited environments and seats. One in-app message to one user counts as one message. The catch: on Free, the stock `NotificationFeed` shows a "Powered by Knock" footer.
- **Auth.** The client uses a public API key plus the user id. With enhanced security mode on, the server also signs an RS256 JWT with `signUserToken`, and the client passes it as `userToken`. Turn it off in development and on in production.
- **Server.** Call `knock.workflows.trigger(key, { recipients, actor, data })`. Recipients can be identified inline as objects, so Cadence never needs a separate sync step.
- **React.** You get a bell, a popover feed, an unseen or unread badge, mark all as read, and per-item archive. You can style it with CSS variables, or go headless with `useKnockFeed` and `useNotificationStore` and build the UI from shadcn parts.
- **Workflows as code.** Supported. The Knock CLI pulls and pushes a `.knock/` directory (`workflow.json` plus template files) and handles commit and promote.
- **User switching.** Supported natively. When `KnockProvider` receives a new `user.id` or token, it re-authenticates and remounts the feed.

## 1. Free tier

Source: <https://knock.app/pricing>

- **Price:** $0 a month, no credit card required.
- **Messages:** 10,000 a month. A message is "a single message delivered to a single user on a single channel". Failed messages, bounces, and messages blocked by a user's preferences do not count.
- **Users and environments:** No MAU cap. Stored profiles, environments, seats, workflows, and channels are all unlimited.
- **Overage:** There is no hard cap. Knock contacts you to set up billing for the following month.
- **Not included on Free:** branding removal, translations, per-tenant branding, audit logs, and analytics. Log retention is 30 days.
- **Visible branding (from the source):** `NotificationFeed` renders a `rnf-notification-feed__knock-branding` "Powered by Knock" link whenever the feed settings return `features.branding_required` (`@knocklabs/react/dist/esm/modules/feed/components/NotificationFeed/NotificationFeed.mjs`). A headless feed that does not render `NotificationFeed` does not get this footer.

**Fit for a cohort project:** Yes, comfortably. Nothing on the Free plan blocks Cadence.

## 2. Identity and client feed auth

Sources: <https://docs.knock.app/in-app-ui/security-and-authentication>, <https://docs.knock.app/managing-recipients/identifying-recipients>, `@knocklabs/node/src/lib/tokenSigner.ts`, `@knocklabs/client/src/knock.ts`

- **User ids are Cadence's own ids.** Knock recipients use your application's user ids. Identifying always upserts: `PUT /v1/users/{id}`, inline identification on a trigger, or bulk identify.
- **Public key only (no enhanced security).** The client calls a fixed set of endpoints for feeds, preferences, and the user's own profile. The docs warn: "Without enhanced security mode, a request with your public key can act as any user." This is fine for local development.
- **Enhanced security mode** (a per-environment setting) rejects client requests that lack a signed user token.
  - The server signs an RS256 JWT with a private signing key from Dashboard > Platform > API keys. The key is shown once. By convention it goes in `KNOCK_SIGNING_KEY`, as PEM or base64-encoded PEM.
  - Claims: `sub` is the user id. `iat` and `exp` are recommended. Optional grants can scope what the token can access.
  - Helper: `import { signUserToken } from "@knocklabs/node/lib/tokenSigner"` produces `signUserToken(userId, { expiresInSeconds?, signingKey?, grants? })`. The default lifetime is 3600 seconds. Signing happens locally with no network call, so a React Router loader can sign the token on every request.
  - Client: pass the token as the `userToken` prop on **`KnockProvider`**. The current docs page shows it on `KnockFeedProvider`, but in the source the prop only exists on `KnockProvider`. `onUserTokenExpiring` and `timeBeforeExpirationInMs` handle refresh.
- **Recommendation from the docs:** turn on enhanced security mode before going to production. You can leave it off in development and build with only the public key.
- **Client-side inline identify.** Passing `user={{ id, name, email }}` to `KnockProvider` upserts that user from the browser on mount. This is the default `identificationStrategy: "inline"`. Use `"skip"` to turn it off and leave identification to the server.

## 3. Server-side triggering (Node SDK)

Sources: `@knocklabs/node/src/resources/workflows.ts`, `src/client.ts`, <https://docs.knock.app/managing-recipients/identifying-recipients>, <https://docs.knock.app/api-reference/workflows/trigger>

```ts
import Knock from "@knocklabs/node"; // reads KNOCK_API_KEY (secret key), KNOCK_BASE_URL
const knock = new Knock();
await knock.workflows.trigger("refund-approved", {
  recipients: [{ id: user.id, name: user.name, email: user.email }], // inline identify
  actor: admin.id,              // optional, string id or inline object
  data: { courseTitle, amountCents }, // up to 10MB, used by the templates
  cancellation_key: `refund-${refund.id}`, // optional, enables cancelling
  settings: { sandbox_mode: true, skip_delay: true }, // optional, for tests
});
// response: { workflow_run_id }. Runs execute asynchronously.
```

- **Recipients:** an array of up to 1,000 entries. Each entry is a user id string, an inline user object (`id` required, other fields are upserted), or an object reference.
- **Recipients that don't exist in Knock yet.** Use inline identification. The docs say: "Knock guarantees that recipients are identified before executing any other action. This enables lazy recipient creation." The docs do not state what happens when you pass a bare string id that Knock has never seen. The safe pattern is to always pass the inline object.
- **People without a Cadence account** (for example, a Seat invite to an email address). Any stable string works as a Knock user id, but an in-app feed only reaches someone who later loads the app as that same id. In-app delivery to a person with no account therefore has no target. Map #9 has to decide this.
- **Payload:** the `data` object is available in templates as `{{ data.x }}`. A workflow can enforce a trigger data schema.
- **Commits:** API triggers run the last *committed* version of a workflow. The dashboard test runner runs the last *saved* version.
- **Inactive workflows:** triggering one returns a `workflow_inactive` error.

## 4. What `@knocklabs/react` provides

Sources: `@knocklabs/react@0.15.1` type definitions and dist, <https://docs.knock.app/in-app-ui/react/feed>

**Exports relevant to the feed:**

- `KnockProvider`
- `KnockFeedProvider` (`feedId`, `colorMode`, `defaultFeedOptions`)
- `NotificationIconButton` (the bell; `badgeCountType`: `"unseen"` by default, or `"unread"` / `"all"`)
- `UnseenBadge`
- `NotificationFeedPopover` (`buttonRef`, `isVisible`, `onClose`, `onOpen`, `onNotificationClick`)
- `NotificationFeed` (`renderItem`, `renderHeader`, `EmptyComponent`, `onMarkAllAsReadClick`, `initialFilterStatus`)
- `NotificationFeedHeader`, `MarkAsRead`, `NotificationCell` (includes an `ArchiveButton`), `Avatar`, `EmptyFeed`
- Hooks: `useKnockFeed`, `useNotificationStore`, `useNotifications`, `useKnockClient`

**Feed actions on the `feedClient`** (`@knocklabs/client/src/clients/feed/feed.ts`):

- `markAsSeen`, `markAllAsSeen`
- `markAsRead`, `markAllAsRead`, `markAsUnread`
- `markAsInteracted`
- `markAsArchived`, `markAllAsArchived`, `markAllReadAsArchived`, `markAsUnarchived`

Fetch options include `status` (`unread`, `read`, `unseen`, `seen`, `all`), `archived` (`exclude`, which is the default, `include`, or `only`), and `page_size`. Store metadata provides `unread_count`, `unseen_count`, and `total_count`. Real-time updates arrive over a websocket.

**Default behaviour:** opening the popover marks items as *seen*, not read. The header has an "All / Unread / Read" filter and a "Mark all as read" button.

**Styling:**

- Import `@knocklabs/react/dist/index.css`. You can override the `--rnf-*` CSS variables (92 of them) or replace the `rnf-*` classes entirely.
- The CSS also ships about 250 `--tgph-*` (Telegraph design system) variables and `--knock-*` tokens.
- `colorMode="dark"` on the feed provider switches to the dark theme.
- **Tailwind v4 caveat:** Knock's CSS is unlayered (it has no `@layer`). Unlayered styles beat Tailwind v4's layered utilities in the cascade, so you cannot override Knock's rules by adding Tailwind classes to Knock components. Override the `--rnf-*` variables instead.
- **Dependencies it pulls in:** its own `lucide-react@^0.544.0` (Cadence uses `^0.563.0`, and caret ranges on 0.x do not overlap, so this installs a second copy), `@radix-ui/react-dialog`, `@radix-ui/react-hover-card`, `@popperjs/core`, and about ten `@telegraph/*` packages.
- **Peer dependencies:** React 17–19 and React DOM 17–19. `next` and `@tanstack/react-router` are *optional* peers, so React Router works without them.

**Fit beside shadcn:** there are two realistic options.

1. **Stock components, themed through `--rnf-*` variables mapped to Cadence's shadcn tokens.** Quickest to build. It looks close to the rest of the app but not identical, and it shows the "Powered by Knock" footer.
2. **Headless.** Wrap the app in `KnockProvider` and `KnockFeedProvider`, then build the bell from a shadcn `Button` plus a badge, the panel from a `Popover`, and the rows from Cadence components. Read `useNotificationStore(feedClient)` for items and metadata, and call the `feedClient.mark*` methods. You skip the Knock CSS and the footer, and you write a little more code. This is the natural fit for a shadcn app.

## 5. Local dev and testing

Sources: <https://docs.knock.app/version-control/environments>, <https://docs.knock.app/send-notifications/testing-workflows>, <https://docs.knock.app/integrations/overview>, `@knocklabs/node/src/client.ts`

**Environments:**

- An account starts with **Production** only. Enabling environments adds **Development**, and this cannot be undone.
- You can add more environments (such as Staging) in the dashboard, but not programmatically.
- Each environment has its own API keys and its own users, messages, and logs. "Data is never copied between environments."
- Content can only be edited in the environment that created it. You commit in Development and promote upward.

**Test mode:**

- There is no global test mode. The workflow test runner and the trigger option `settings.sandbox_mode` generate and preview messages without delivering them to providers. `settings.skip_delay` skips delay steps.
- Per-channel sandbox mode exists, but the docs say it covers "all channel types (except for in-app)".
- The Development environment is the practical sandbox for local development.

**Vitest:**

- Knock has no official page on mocking its SDK in your own app tests. (A testing guide exists in the `@knocklabs/client` package, but it covers testing the SDK itself.)
- Options:
  - Put Knock behind one Cadence module and `vi.mock` it. This is the simplest.
  - The Node SDK accepts `new Knock({ apiKey, fetch, baseURL })`, so tests can inject a fake `fetch` or point `KNOCK_BASE_URL` at a stub.
  - The Node client throws at construction if `KNOCK_API_KEY` is missing, so construct it lazily or mock it in tests.
- On the client, `KnockProvider` accepts `enabled={false}`. Its children then render with no identify call, no API requests, and no websocket. This is useful for tests and for sessions with no user. It also only opens a websocket when `window` and `WebSocket` exist, which keeps SSR safe.

## 6. Workflows and templates as code

Sources: <https://docs.knock.app/cli/overview>, <https://docs.knock.app/cli/workflow/file-structure>, <https://docs.knock.app/cli/workflow/push>, <https://docs.knock.app/tutorials/ci-cd>

- **Knock CLI** (`@knocklabs/cli`, binary `knock`): manages workflows, layouts, partials, translations, message types, guides, audiences, and schemas.
- **Directory layout:** `knock.json` sets `knockDir` (for example `.knock`). Each workflow lives in `workflows/<key>/workflow.json`, with step templates as files, such as `in_app_feed_1/markdown_body.md`.
- **Commands:**
  - `knock workflow pull <key>`
  - `knock workflow push <key> [--commit] [--environment] [--all]`. Push "will update an existing workflow ... or create a new workflow if it does not exist yet", so you can author workflows from scratch in the repo.
  - `knock commit promote --to=production`
  - Knock branches: `knock branch switch x --create`, `knock push --branch=x --commit`
- **Auth:** `knock login` in the browser, or a service token (`--service-token`) for CI.
- **Management API:** the same operations exist over HTTP (`/mapi-reference`), including running a workflow.
- **Default environment:** once environments are enabled, Development is the default target for the CLI and the Management API.

**Conclusion:** dashboard-only is not required. You can check workflows into `.knock/` and push them with the CLI. Note that the in-app feed *channel* itself (and its `feedId`) is created and configured in the dashboard per environment.

## 7. Switching the active user on the client (DevUI)

Source: `@knocklabs/react-core/src/modules/core/hooks/useAuthenticatedKnockClient.ts`, `KnockFeedProvider.tsx`, `@knocklabs/client/src/knock.ts`

- When `KnockProvider`'s `user.id` or `userToken` changes, the existing client calls `authenticate` again. That tears down the feed instances and the socket, creates a new API client, and reinitialises the feeds.
- `KnockFeedProvider` is keyed on `feedProviderKey(userId, feedId, options)`, so the feed subtree remounts and refetches for the new user.
- `enabled={false}` gives a clean "logged out" state with empty stores and no stale notifications.
- **Implication for Cadence:** the DevUI user switcher needs no special handling, provided the root layout loader returns the session user's id (and a fresh signed token, if enhanced security is on) and passes them to `KnockProvider`.
- **Caveat with enhanced security off in development:** any user id works with only the public key. This makes the DevUI convenient, and it is also exactly why production must turn enhanced security on.

## Open questions for the map

- What do recipients without a Cadence account (Seat invites) get in-app, if anything?
- Stock components with themed variables, or a headless build with shadcn parts? Prototype this.
- Enable environments (Development + Production) from day one? It cannot be undone, and it changes the default CLI target.
