# Phase 3: Email Feature (Resend + React Email password reset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a complete password-reset flow — a `passwordResetTokens` table, a signed jose reset token isolated from session tokens by a `purpose` claim, account-enumeration-safe request/confirm orchestration with auto-sign-in on success, a Resend-backed `packages/email` with React Email templates, both a Route Handler pair and Server Actions over the same orchestration logic, and the `forgot-password`/`reset-password` pages — plus close the pre-existing `// TODO: Send invitation email` gap in `inviteTeamMember` by building the team-invitation email alongside password-reset, since the incremental cost is low.

**Architecture:** A `passwordResetTokens` table (in `packages/db`) is keyed by a SHA-256 hash of a signed jose JWT's `jti` claim (not bcrypt — bcrypt's per-call salting makes it unusable for a `WHERE` clause). The JWT itself reuses `session.ts`'s exact `SignJWT`/`jwtVerify` primitive and the same `AUTH_SECRET`, but carries a `purpose: 'password-reset'` claim so a leaked session cookie can never be replayed as a reset token (and vice versa). `requestPasswordReset(email)` and `confirmPasswordReset(token, newPassword)` (in `apps/web/lib/auth/password-reset.ts`, next to `session.ts` — both are saturated with Next.js-only APIs and have exactly one consumer, so per Phase 2's design they stay in `apps/web`, not a shared package) are the single source of truth for the flow's business logic; a Route Handler pair (`app/api/password-reset/{request,confirm}/route.ts`) and Server Actions (`requestPasswordReset`/`resetPassword` in `app/(login)/actions.ts`) are both thin, Zod-validated wrappers over it. `packages/email` (scaffolded empty in Phase 2, filled in here) exposes a lazy Resend client (`src/client.ts`), two typed send helpers (`src/send.ts`), and three React Email templates (`src/templates/{EmailLayout,PasswordResetEmail,TeamInvitationEmail}.tsx`). `confirmPasswordReset` never throws for any of its known failure modes (bad token, expired token, already-used token) — it always resolves to `{ success: true } | { error: string }`, and every caller (both the confirm Route Handler and the `resetPassword` Server Action) checks that resolved shape rather than treating the call as throw-or-succeed.

**Tech Stack:** Next.js App Router (`apps/web`, Next 16.2.10), TypeScript 5.9.3, React 19.2.7, Drizzle ORM 0.45.2 + Postgres (`packages/db`), jose 5.9.6 + bcryptjs 2.4.3 (`apps/web/lib/auth`), Resend 4.0.1 + `@react-email/components` 0.0.36 (`packages/email`), Zod 4.4.3, Vitest 4.1.10 + `@testing-library/react` 16.3.2, pnpm + Turborepo monorepo.

**User decisions (already made):**
- Password reset auto-signs the user in after success, matching the existing signIn/signUp UX (confirmed with the user during the design phase).
- Team-invitation email is built alongside password-reset in this phase (template + send function, wired into the existing `inviteTeamMember` TODO) — the incremental cost is low and it closes an already-flagged gap.
- `PASSWORD_RESET_SECRET` is not introduced as a separate env var — the reset token reuses `AUTH_SECRET`, isolated from session tokens by a `purpose: 'password-reset'` claim.
- No rate-limiting is added to the forgot-password endpoint in this pass — a real gap (no rate-limiting infrastructure exists anywhere in the repo today), but scoped out to avoid stalling this phase on infrastructure the rest of the app doesn't have either.

---

## Operational note for every task in this plan (read before dispatching any task)

**Phase-2 prerequisite:** this plan assumes Phase 2's monorepo conversion has already landed — `apps/web/` (package name `"web"`), `packages/db` (package name `"@repo/db"`, subpath exports `@repo/db/client`, `@repo/db/schema`, `@repo/db/queries`), `packages/email` (package name `"@repo/email"`, scaffolded with a placeholder export by Phase 2, filled in by this plan's Tasks 4–8), and `packages/ui` (package name `"@repo/ui"`, subpath exports like `@repo/ui/components/button`). If Phase 2 has not landed yet when this plan is picked up, execute it first — every file path and `pnpm --filter` command below assumes its layout already exists. As of this writing, `aitutor-api-saas-starter`'s `main` branch is still pre-Phase-2 (`lib/`, `app/` at the repo root) — the file paths in this plan are the **post-Phase-2 target locations**, not what exists in `main` today.

**pnpm filter convention:** every command in this plan filters by package name, not by path — `pnpm --filter web ...` for `apps/web`, `pnpm --filter @repo/db ...` for `packages/db`, `pnpm --filter @repo/email ...` for `packages/email`. Use this consistently; do not mix in path-based filters (`--filter ./apps/web`) — both work, but this plan standardizes on name-based filters so every task's commands are copy-pasteable without adjustment.

**`confirmPasswordReset` never throws for a known failure** (bad/garbage token, expired token, already-used token) — it always resolves to `{ success: true } | { error: string }`. Task 11's Route Handler and Task 12's `resetPassword` Server Action both check that resolved shape (`'error' in outcome`) rather than wrapping the call in a try/catch that expects a thrown error. This is deliberate: don't "fix" a caller that looks like it's missing error handling by adding a try/catch around `confirmPasswordReset` — check the return value instead.

---

### Task 1: `passwordResetTokens` schema + `ActivityType` additions + migration

**Goal:** Add the `passwordResetTokens` table and two new `ActivityType` enum members to `packages/db/src/schema.ts`, then generate the corresponding Drizzle migration.

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/000X_<drizzle-generated-name>.sql` (exact numeric prefix/slug chosen by `drizzle-kit generate` at run time)
- Test: `apps/web/tests/unit/schema-password-reset.test.ts`

**Acceptance Criteria:**
- [ ] `packages/db/src/schema.ts` exports `passwordResetTokens` (table), `passwordResetTokensRelations`, `PasswordResetToken`, `NewPasswordResetToken`
- [ ] `ActivityType` gains `REQUEST_PASSWORD_RESET = 'REQUEST_PASSWORD_RESET'` and `RESET_PASSWORD = 'RESET_PASSWORD'`
- [ ] `passwordResetTokens` has columns `id`, `user_id` (FK → `users.id`), `token_hash` (unique, `varchar(64)` — exactly long enough for a SHA-256 hex digest), `expires_at`, `used_at` (nullable), `created_at`
- [ ] `pnpm --filter @repo/db run db:generate` produces exactly one new migration file touching only `password_reset_tokens`; the three existing migration files are untouched (`git diff --stat packages/db/migrations` shows no changes to `0000_*`, `0001_*`, `0002_*`)
- [ ] `pnpm --filter web exec tsc --noEmit` is clean
- [ ] `apps/web/tests/unit/schema-password-reset.test.ts` passes without a live Postgres connection (pure schema-shape introspection via `getTableConfig`)

**Verify:** `pnpm --filter web exec tsc --noEmit && pnpm --filter web test -- tests/unit/schema-password-reset.test.ts && pnpm --filter @repo/db run db:generate` → tsc clean; vitest reports `tests/unit/schema-password-reset.test.ts` passing; `db:generate` reports one new migration file, no diff to prior ones.

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/schema-password-reset.test.ts
import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { passwordResetTokens, ActivityType } from '@repo/db/schema';

describe('passwordResetTokens table shape', () => {
  const { name, columns } = getTableConfig(passwordResetTokens);
  const columnNames = columns.map((c) => c.name);

  it('is named password_reset_tokens', () => {
    expect(name).toBe('password_reset_tokens');
  });

  it('has the expected columns', () => {
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id',
        'user_id',
        'token_hash',
        'expires_at',
        'used_at',
        'created_at',
      ]),
    );
  });

  it('enforces token_hash uniqueness and non-nullability', () => {
    const tokenHash = columns.find((c) => c.name === 'token_hash');
    expect(tokenHash?.isUnique).toBe(true);
    expect(tokenHash?.notNull).toBe(true);
  });

  it('leaves used_at nullable (null means the token is still live)', () => {
    const usedAt = columns.find((c) => c.name === 'used_at');
    expect(usedAt?.notNull).toBe(false);
  });

  it('requires user_id and expires_at', () => {
    const userId = columns.find((c) => c.name === 'user_id');
    const expiresAt = columns.find((c) => c.name === 'expires_at');
    expect(userId?.notNull).toBe(true);
    expect(expiresAt?.notNull).toBe(true);
  });
});

describe('ActivityType additions', () => {
  it('adds REQUEST_PASSWORD_RESET', () => {
    expect(ActivityType.REQUEST_PASSWORD_RESET).toBe('REQUEST_PASSWORD_RESET');
  });

  it('adds RESET_PASSWORD', () => {
    expect(ActivityType.RESET_PASSWORD).toBe('RESET_PASSWORD');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/schema-password-reset.test.ts`
Expected: FAIL — `@repo/db/schema` does not export `passwordResetTokens` (module resolves but the named import is `undefined`/throws "does not provide an export named 'passwordResetTokens'"), and `ActivityType.REQUEST_PASSWORD_RESET`/`ActivityType.RESET_PASSWORD` are `undefined`.

- [ ] **Step 3: Write minimal implementation**

```diff
 export const workflowHistoryRelations = relations(workflowHistory, ({ one }) => ({
   team: one(teams, {
     fields: [workflowHistory.teamId],
     references: [teams.id],
   }),
   user: one(users, {
     fields: [workflowHistory.userId],
     references: [users.id],
   }),
 }));
 
+export const passwordResetTokens = pgTable('password_reset_tokens', {
+  id: serial('id').primaryKey(),
+  userId: integer('user_id')
+    .notNull()
+    .references(() => users.id),
+  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
+  expiresAt: timestamp('expires_at').notNull(),
+  usedAt: timestamp('used_at'),
+  createdAt: timestamp('created_at').notNull().defaultNow(),
+});
+
+export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
+  user: one(users, {
+    fields: [passwordResetTokens.userId],
+    references: [users.id],
+  }),
+}));
+
 // Add these types
 export type WorkflowHistory = typeof workflowHistory.$inferSelect;
 export type NewWorkflowHistory = typeof workflowHistory.$inferInsert;
 
 export type User = typeof users.$inferSelect;
 export type NewUser = typeof users.$inferInsert;
 export type Team = typeof teams.$inferSelect;
 export type NewTeam = typeof teams.$inferInsert;
 export type TeamMember = typeof teamMembers.$inferSelect;
 export type NewTeamMember = typeof teamMembers.$inferInsert;
 export type ActivityLog = typeof activityLogs.$inferSelect;
 export type NewActivityLog = typeof activityLogs.$inferInsert;
 export type Invitation = typeof invitations.$inferSelect;
 export type NewInvitation = typeof invitations.$inferInsert;
 // Added Message types
 export type Message = typeof messages.$inferSelect;
 export type NewMessage = typeof messages.$inferInsert;
+// Added PasswordResetToken types
+export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
+export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
 
 export type TeamDataWithMembers = Team & {
   teamMembers: (TeamMember & {
     user: Pick<User, 'id' | 'name' | 'email'>;
   })[];
 };
 
 export enum ActivityType {
   SIGN_UP = 'SIGN_UP',
   SIGN_IN = 'SIGN_IN',
   SIGN_OUT = 'SIGN_OUT',
   UPDATE_PASSWORD = 'UPDATE_PASSWORD',
   DELETE_ACCOUNT = 'DELETE_ACCOUNT',
   UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
   CREATE_TEAM = 'CREATE_TEAM',
   REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
   INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
   ACCEPT_INVITATION = 'ACCEPT_INVITATION',
+  REQUEST_PASSWORD_RESET = 'REQUEST_PASSWORD_RESET',
+  RESET_PASSWORD = 'RESET_PASSWORD',
 }
```

Then generate the migration (mechanical CLI step — do not hand-write the SQL):

```bash
pnpm --filter @repo/db run db:generate
```

Inspect the generated file before applying anything. Given this repo's drizzle-kit 0.31.10 output style (see `packages/db/migrations/0001_amused_umar.sql` / `0002_short_roxanne_simpson.sql` for precedent — no `IF NOT EXISTS`, no `DO $$ ... EXCEPTION` wrapper), the new file should look like:

```sql
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
```

If `db:generate`'s actual output differs from this (e.g. drizzle-kit changed its constraint-naming or FK-clause conventions since 0.31.10), treat the tool's real output as authoritative — this block is the expected shape to sanity-check against, not something to force by hand-editing the generated file.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web test -- tests/unit/schema-password-reset.test.ts`
Expected: PASS (tsc clean; all 6 assertions in `schema-password-reset.test.ts` green)

- [ ] **Step 5: Commit**
```bash
git add packages/db/src/schema.ts packages/db/migrations apps/web/tests/unit/schema-password-reset.test.ts
git commit -m "Add passwordResetTokens table and REQUEST_PASSWORD_RESET/RESET_PASSWORD activity types"
```

---

### Task 2: `apps/web/lib/auth/reset-token.ts` — signed jose reset token

**Goal:** Add a jose-based signed token primitive carrying a `purpose: 'password-reset'` claim, with a SHA-256 `jti` hash for DB lookup, reusing `session.ts`'s exact `SignJWT`/`jwtVerify` pattern so a leaked session token (same `AUTH_SECRET`) cannot be replayed as a reset token.

**Files:**
- Create: `apps/web/lib/auth/reset-token.ts`
- Test: `apps/web/tests/unit/reset-token.test.ts`

**Acceptance Criteria:**
- [ ] `signResetToken(userId)` returns `{ token, jti, tokenHash, expiresAt }`; `tokenHash` is the SHA-256 hex digest (64 chars) of `jti`
- [ ] `verifyResetToken(token)` round-trips a token signed by `signResetToken`, returning `{ purpose: 'password-reset', user: { id }, jti }`
- [ ] `verifyResetToken` rejects any validly-signed token lacking `purpose: 'password-reset'` — including an actual `session.ts` session token signed with the same `AUTH_SECRET` — by throwing `InvalidResetTokenError`
- [ ] `verifyResetToken` rejects an expired token (jose's own `exp` check)
- [ ] Two calls to `signResetToken` for the same user produce different `jti`/`tokenHash` values (no reuse across requests)
- [ ] No network/DB/email access in this module or its test

**Verify:** `pnpm --filter web exec tsc --noEmit && pnpm --filter web test -- tests/unit/reset-token.test.ts` → tsc clean; vitest reports all cases passing.

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/reset-token.test.ts
import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  signResetToken,
  verifyResetToken,
  hashResetTokenId,
  InvalidResetTokenError,
} from '@/lib/auth/reset-token';
import { signToken } from '@/lib/auth/session';

describe('reset token round-trip', () => {
  it('signs and verifies a reset token, preserving userId, purpose, and jti', async () => {
    const { token, jti, tokenHash, expiresAt } = await signResetToken(42);
    expect(typeof token).toBe('string');
    expect(tokenHash).toBe(hashResetTokenId(jti));
    expect(tokenHash).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const verified = await verifyResetToken(token);
    expect(verified.purpose).toBe('password-reset');
    expect(verified.user.id).toBe(42);
    expect(verified.jti).toBe(jti);
  });

  it('produces a distinct jti and tokenHash on every call', async () => {
    const a = await signResetToken(1);
    const b = await signResetToken(1);
    expect(a.jti).not.toBe(b.jti);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe('purpose-claim rejection', () => {
  it('rejects a real session token (no purpose claim) signed with the same AUTH_SECRET', async () => {
    const sessionToken = await signToken({
      user: { id: 42 },
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    await expect(verifyResetToken(sessionToken)).rejects.toThrow(
      InvalidResetTokenError,
    );
  });

  it('rejects a token carrying a different purpose claim', async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const wrongPurposeToken = await new SignJWT({
      purpose: 'team-invitation',
      user: { id: 42 },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti('some-jti')
      .setIssuedAt()
      .setExpirationTime('1 hour from now')
      .sign(key);

    await expect(verifyResetToken(wrongPurposeToken)).rejects.toThrow(
      InvalidResetTokenError,
    );
  });
});

describe('expiry', () => {
  it('rejects a token whose expiration has already passed', async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({
      purpose: 'password-reset',
      user: { id: 42 },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti('expired-jti')
      .setIssuedAt(nowSeconds - 3600)
      .setExpirationTime(nowSeconds - 60)
      .sign(key);

    await expect(verifyResetToken(expiredToken)).rejects.toThrow();
  });
});
```

(`session.ts`'s `signToken` doesn't touch cookies — only `setSession`/`getSession` do — so this file needs no `next/headers` mock, unlike `tests/unit/session.test.ts`.)

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/reset-token.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/reset-token` (module does not exist)

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/lib/auth/reset-token.ts
import { createHash, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const key = new TextEncoder().encode(process.env.AUTH_SECRET);

export const RESET_TOKEN_PURPOSE = 'password-reset' as const;
export const RESET_TOKEN_TTL_MINUTES = 30;

export type ResetTokenPayload = {
  purpose: typeof RESET_TOKEN_PURPOSE;
  user: { id: number };
  jti: string;
};

export class InvalidResetTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResetTokenError';
  }
}

/** SHA-256 hex digest of a token's `jti`, used as the DB lookup key. Not
 * bcrypt: bcrypt's per-call salting makes it unusable for a WHERE clause. */
export function hashResetTokenId(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

export async function signResetToken(userId: number): Promise<{
  token: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
}> {
  const jti = randomUUID();
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
  );

  const token = await new SignJWT({
    purpose: RESET_TOKEN_PURPOSE,
    user: { id: userId },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key);

  return { token, jti, tokenHash: hashResetTokenId(jti), expiresAt };
}

export async function verifyResetToken(
  token: string,
): Promise<ResetTokenPayload> {
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });

  if (payload.purpose !== RESET_TOKEN_PURPOSE) {
    throw new InvalidResetTokenError(
      'Token is not a password-reset token (missing or wrong purpose claim)',
    );
  }
  if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
    throw new InvalidResetTokenError('Token is missing a jti claim');
  }

  const user = payload.user as { id?: unknown } | undefined;
  if (!user || typeof user.id !== 'number') {
    throw new InvalidResetTokenError('Token is missing a valid user claim');
  }

  return { purpose: RESET_TOKEN_PURPOSE, user: { id: user.id }, jti: payload.jti };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web test -- tests/unit/reset-token.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/auth/reset-token.ts apps/web/tests/unit/reset-token.test.ts
git commit -m "Add jose-based password-reset token with a purpose claim, isolated from session tokens"
```

---

### Task 3: `apps/web/lib/auth/password-reset.ts` — request/confirm orchestration

**Goal:** Implement `requestPasswordReset`/`confirmPasswordReset`, account-enumeration-safe, single-use-token-enforcing, with auto-sign-in on a successful reset.

**Files:**
- Create: `apps/web/lib/auth/password-reset.ts`
- Test: `apps/web/tests/unit/password-reset.test.ts`

**Acceptance Criteria:**
- [ ] `requestPasswordReset(email)` returns the identical `{ success: true }` shape whether or not `email` belongs to an account (no branch visible to the caller)
- [ ] For an existing account: prior unused tokens for that user are deleted, a new `passwordResetTokens` row is inserted, `ActivityType.REQUEST_PASSWORD_RESET` is logged (when the user has a team), and `sendPasswordResetEmail` (from `@repo/email/send`) is called exactly once
- [ ] For a non-existent account: no DB write and no email send occur at all
- [ ] `confirmPasswordReset(token, newPassword)` on a valid, unused, unexpired token: updates `users.passwordHash`, marks the token row `usedAt`, logs `ActivityType.RESET_PASSWORD`, and calls `setSession` (auto-sign-in, per the confirmed product decision)
- [ ] `confirmPasswordReset` rejects a second confirm attempt against an already-used token row with an `{ error }` result (single-use enforcement) — the mocked DB row's `usedAt` reflects the prior use
- [ ] `confirmPasswordReset` rejects an expired DB row and a garbage/invalid token string, both with an `{ error }` result, never throwing — every caller relies on this: `confirmPasswordReset` always resolves to `{ success: true } | { error: string }`
- [ ] No real Postgres connection or real Resend call in this test — `@repo/db/client` and `@repo/email/send` are fully mocked; `@/lib/auth/reset-token` is used for real (unmocked) to generate/verify tokens end-to-end

**Verify:** `pnpm --filter web exec tsc --noEmit && pnpm --filter web test -- tests/unit/password-reset.test.ts` → tsc clean; vitest reports all cases passing.

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/password-reset.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { passwordResetTokens, activityLogs } from '@repo/db/schema';
import { signResetToken } from '@/lib/auth/reset-token';

const mockDb = vi.hoisted(() => ({
  query: {
    users: { findFirst: vi.fn() },
    teamMembers: { findFirst: vi.fn() },
    passwordResetTokens: { findFirst: vi.fn() },
  },
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockSendPasswordResetEmail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'email_test_id' }),
);

const mockCookieStore = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@repo/db/client', () => ({ db: mockDb }));
vi.mock('@repo/email/send', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

import {
  requestPasswordReset,
  confirmPasswordReset,
} from '@/lib/auth/password-reset';

function mockInsert() {
  const values = vi.fn().mockResolvedValue(undefined);
  mockDb.insert.mockReturnValue({ values });
  return values;
}
function mockUpdate() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValue({ set });
  return { set, where };
}
function mockDelete() {
  const where = vi.fn().mockResolvedValue(undefined);
  mockDb.delete.mockReturnValue({ where });
  return where;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert();
  mockUpdate();
  mockDelete();
  mockDb.query.teamMembers.findFirst.mockResolvedValue({ teamId: 99 });
});

describe('requestPasswordReset: account-enumeration safety', () => {
  it('returns { success: true } and emails when the account exists', async () => {
    mockDb.query.users.findFirst.mockResolvedValue({
      id: 7,
      email: 'exists@example.com',
      name: 'Existing User',
      passwordHash: 'old-hash',
    });

    const result = await requestPasswordReset('exists@example.com');

    expect(result).toEqual({ success: true });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'exists@example.com' }),
    );
    expect(mockDb.delete).toHaveBeenCalledWith(passwordResetTokens);
    expect(mockDb.insert).toHaveBeenCalledWith(passwordResetTokens);
    expect(mockDb.insert).toHaveBeenCalledWith(activityLogs);
  });

  it('returns the identical { success: true } and sends no email when the account does not exist', async () => {
    mockDb.query.users.findFirst.mockResolvedValue(undefined);

    const result = await requestPasswordReset('missing@example.com');

    expect(result).toEqual({ success: true });
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});

describe('confirmPasswordReset: single-use token behavior', () => {
  it('accepts a valid unused token, updates the password, and signs the user in', async () => {
    const { token, tokenHash } = await signResetToken(7);
    mockDb.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 1,
      userId: 7,
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    mockDb.query.users.findFirst.mockResolvedValue({
      id: 7,
      email: 'a@example.com',
      name: 'A',
      passwordHash: 'old-hash',
    });

    const result = await confirmPasswordReset(token, 'new-password-123');

    expect(result).toEqual({ success: true });
    // Two update() calls occurred: users.passwordHash + passwordResetTokens.usedAt.
    expect(mockDb.update).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.any(Object),
    );
  });

  it('rejects a second confirm attempt once the token row is marked used', async () => {
    const { token, tokenHash } = await signResetToken(7);
    mockDb.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 1,
      userId: 7,
      tokenHash,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });

    const result = await confirmPasswordReset(token, 'another-password');

    expect(result).toEqual({
      error: 'This reset link has already been used.',
    });
  });

  it('rejects an expired DB row even if the JWT itself still verifies', async () => {
    const { token, tokenHash } = await signResetToken(7);
    mockDb.query.passwordResetTokens.findFirst.mockResolvedValue({
      id: 1,
      userId: 7,
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    });

    const result = await confirmPasswordReset(token, 'another-password');

    expect(result).toEqual({
      error: 'This reset link is invalid or has expired.',
    });
  });

  it('rejects a garbage token string without throwing', async () => {
    const result = await confirmPasswordReset('not-a-real-token', 'x');

    expect(result).toEqual({
      error: 'This reset link is invalid or has expired.',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- tests/unit/password-reset.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/password-reset` (module does not exist)

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/lib/auth/password-reset.ts
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@repo/db/client';
import {
  users,
  teamMembers,
  activityLogs,
  passwordResetTokens,
  ActivityType,
  type NewActivityLog,
} from '@repo/db/schema';
import { hashPassword, setSession } from './session';
import {
  signResetToken,
  verifyResetToken,
  hashResetTokenId,
  RESET_TOKEN_TTL_MINUTES,
} from './reset-token';
import { sendPasswordResetEmail } from '@repo/email/send';

const GENERIC_INVALID_TOKEN_ERROR = 'This reset link is invalid or has expired.';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
    userId,
    action: type,
  };
  await db.insert(activityLogs).values(newActivity);
}

async function getTeamIdForUser(userId: number): Promise<number | null> {
  const membership = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, userId),
  });
  return membership?.teamId ?? null;
}

/**
 * Always resolves to the same shape whether or not `email` belongs to an
 * account, so callers can render one generic "check your email" message
 * with no observable branch on account existence.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: true }> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (user) {
    // Invalidate any prior outstanding token for this user so only the
    // most recently requested link is usable.
    await db
      .delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    const { token, tokenHash, expiresAt } = await signResetToken(user.id);

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const teamId = await getTeamIdForUser(user.id);
    await logActivity(teamId, user.id, ActivityType.REQUEST_PASSWORD_RESET);

    const resetUrl = `${process.env.BASE_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name ?? user.email,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
  }

  return { success: true };
}

/**
 * Always resolves — never throws for a known failure mode (bad token,
 * expired token, already-used token). Callers must check the resolved
 * shape (`'error' in outcome`), not wrap this in a try/catch expecting a
 * thrown error.
 */
export async function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: true } | { error: string }> {
  let payload;
  try {
    payload = await verifyResetToken(token);
  } catch {
    // Covers both our own InvalidResetTokenError (wrong/missing purpose
    // claim) and jose's own errors (bad signature, malformed, expired JWT).
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }

  const tokenHash = hashResetTokenId(payload.jti);
  const tokenRow = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!tokenRow) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }
  if (tokenRow.usedAt) {
    return { error: 'This reset link has already been used.' };
  }
  if (tokenRow.expiresAt < new Date()) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }
  if (tokenRow.userId !== payload.user.id) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, tokenRow.userId),
  });
  if (!user) {
    return { error: GENERIC_INVALID_TOKEN_ERROR };
  }

  const passwordHash = await hashPassword(newPassword);

  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  const teamId = await getTeamIdForUser(user.id);
  await logActivity(teamId, user.id, ActivityType.RESET_PASSWORD);

  // Product decision (confirmed during design): a successful reset signs
  // the user in immediately, matching the existing signIn/signUp UX.
  await setSession(user);

  return { success: true };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web test -- tests/unit/password-reset.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/auth/password-reset.ts apps/web/tests/unit/password-reset.test.ts
git commit -m "Add requestPasswordReset/confirmPasswordReset orchestration, account-enumeration-safe with auto-sign-in"
```

---

### Task 4: `packages/email` client (lazy Resend client + generic `sendEmail`)

**Goal:** Flesh out the Phase-2 `packages/email` placeholder scaffold with real dependencies and a lazy Resend client exposing a generic `sendEmail({ to, subject, react })` that throws at call time (not import time) if `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are missing.

**Files:**
- Modify: `packages/email/package.json` (replace the Phase-2 placeholder-export scaffold with real deps/scripts/exports)
- Create: `packages/email/vitest.config.ts`
- Create: `packages/email/tsconfig.json`
- Create: `packages/email/src/client.ts`
- Test: `packages/email/tests/unit/client.test.ts`

**Acceptance Criteria:**
- [ ] `sendEmail` throws a clear error mentioning `RESEND_API_KEY` when it is unset, only when called (not on import)
- [ ] `sendEmail` throws a clear error mentioning `RESEND_FROM_EMAIL` when it is unset
- [ ] The underlying `Resend` client is constructed once and reused across calls (lazy singleton)
- [ ] `sendEmail` resolves to `{ id }` from Resend's response on success
- [ ] `sendEmail` throws a descriptive error when Resend's response contains an `error`

**Verify:** `pnpm --filter @repo/email test -- client` → `5 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

First scaffold the package so it's a runnable workspace member:

```json
// packages/email/package.json
{
  "name": "@repo/email",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./client": "./src/client.ts",
    "./send": "./src/send.ts",
    "./templates/EmailLayout": "./src/templates/EmailLayout.tsx",
    "./templates/PasswordResetEmail": "./src/templates/PasswordResetEmail.tsx",
    "./templates/TeamInvitationEmail": "./src/templates/TeamInvitationEmail.tsx"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "resend": "4.0.1",
    "@react-email/components": "0.0.36"
  },
  "peerDependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7"
  },
  "devDependencies": {
    "@react-email/render": "1.0.4",
    "@types/react": "19.2.17",
    "@vitejs/plugin-react": "^6.0.3",
    "typescript": "^5.9.3",
    "vitest": "^4.1.10"
  }
}
```

```ts
// packages/email/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    env: {
      BASE_URL: 'http://localhost:3000',
    },
  },
});
```

```json
// packages/email/tsconfig.json
{
  "extends": "@repo/config/typescript/react-library.json",
  "include": ["src", "tests"],
  "exclude": ["node_modules"]
}
```

```ts
// packages/email/tests/unit/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendMock = vi.fn();

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { sendEmail, __resetClientForTests } from '../../src/client';
import { Resend } from 'resend';

describe('sendEmail', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    sendMock.mockReset();
    (Resend as unknown as ReturnType<typeof vi.fn>).mockClear();
    __resetClientForTests();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws at call time, not import time, when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';

    await expect(
      sendEmail({ to: 'user@example.com', subject: 'Hi', react: null as any }),
    ).rejects.toThrow('RESEND_API_KEY');
  });

  it('throws when RESEND_FROM_EMAIL is missing', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    delete process.env.RESEND_FROM_EMAIL;

    await expect(
      sendEmail({ to: 'user@example.com', subject: 'Hi', react: null as any }),
    ).rejects.toThrow('RESEND_FROM_EMAIL');
  });

  it('constructs a single Resend client and reuses it across calls', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });

    await sendEmail({ to: 'a@example.com', subject: 'One', react: null as any });
    await sendEmail({ to: 'b@example.com', subject: 'Two', react: null as any });

    expect(Resend).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('returns the Resend message id on success', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: null as any,
    });

    expect(result).toEqual({ id: 'email_123' });
  });

  it('throws a descriptive error when Resend reports an error', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@example.com';
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'Invalid `to` field' },
    });

    await expect(
      sendEmail({ to: 'bad', subject: 'Oops', react: null as any }),
    ).rejects.toThrow('Invalid `to` field');
  });
});
```

Then link the new deps into the workspace:

```bash
pnpm install
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter @repo/email test -- client`
Expected: FAIL with `Cannot find module '../../src/client' imported from 'packages/email/tests/unit/client.test.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/email/src/client.ts
import { Resend } from 'resend';
import type { ReactElement } from 'react';

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to your environment before sending email.',
    );
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export type SendEmailArgs = {
  to: string;
  subject: string;
  react: ReactElement;
};

export type SendEmailResult = {
  id: string;
};

export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailArgs): Promise<SendEmailResult> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      'RESEND_FROM_EMAIL is not set. Add it to your environment before sending email.',
    );
  }

  const client = getResendClient();
  const { data, error } = await client.emails.send({
    from,
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }

  if (!data) {
    throw new Error(
      'Resend returned no data for a send that reported no error.',
    );
  }

  return { id: data.id };
}

// Exposed for tests only, so the lazy singleton can be reset between cases
// without requiring a fresh module import.
export function __resetClientForTests() {
  cachedClient = null;
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/email test -- client`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**
```bash
git add packages/email/package.json packages/email/vitest.config.ts packages/email/tsconfig.json packages/email/src/client.ts packages/email/tests/unit/client.test.ts pnpm-lock.yaml
git commit -m "Add lazy Resend client and generic sendEmail to packages/email"
```

---

### Task 5: `packages/email` `EmailLayout` template

**Goal:** Build the shared `@react-email/components` wrapper (logo, gradient accent, footer) that every transactional email template renders inside.

**Files:**
- Create: `packages/email/src/templates/EmailLayout.tsx`
- Test: `packages/email/tests/unit/email-layout.test.tsx`

**Acceptance Criteria:**
- [ ] Renders the logo at an absolute URL derived from `BASE_URL` + `/logo-long.png`
- [ ] Renders the given `previewText` and `children`
- [ ] Renders the app's purple/pink/orange gradient accent bar

**Verify:** `pnpm --filter @repo/email test -- email-layout` → `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// packages/email/tests/unit/email-layout.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@react-email/render';
import { EmailLayout } from '../../src/templates/EmailLayout';

describe('EmailLayout', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BASE_URL: 'https://example.com' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('renders the logo at an absolute URL derived from BASE_URL', async () => {
    const html = await render(
      <EmailLayout previewText="Preview text">
        <p>Body content</p>
      </EmailLayout>,
    );
    expect(html).toContain('src="https://example.com/logo-long.png"');
  });

  it('renders the preview text and children', async () => {
    const html = await render(
      <EmailLayout previewText="Reset your password">
        <p>Unique body marker</p>
      </EmailLayout>,
    );
    expect(html).toContain('Reset your password');
    expect(html).toContain('Unique body marker');
  });

  it('matches the known-good markup snapshot', async () => {
    const html = await render(
      <EmailLayout previewText="Preview text">
        <p>Body content</p>
      </EmailLayout>,
    );
    expect(html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter @repo/email test -- email-layout`
Expected: FAIL with `Cannot find module '../../src/templates/EmailLayout'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/email/src/templates/EmailLayout.tsx
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components';
import type { ReactNode } from 'react';

export type EmailLayoutProps = {
  previewText: string;
  children: ReactNode;
};

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-10 max-w-[480px] rounded-lg bg-white p-8 shadow-sm">
            <Section className="mb-6 text-center">
              <Img
                src={`${baseUrl}/logo-long.png`}
                alt="Logo"
                width="150"
                height="40"
                className="mx-auto object-contain"
              />
            </Section>
            <Section className="mb-6 h-1 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />
            {children}
            <Hr className="my-6 border-gray-200" />
            <Section className="text-center text-xs text-gray-400">
              You&apos;re receiving this email because of activity on your
              account.
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/email test -- email-layout`
Expected: PASS (3 tests, including a newly-created snapshot file)

- [ ] **Step 5: Commit**
```bash
git add packages/email/src/templates/EmailLayout.tsx packages/email/tests/unit/email-layout.test.tsx packages/email/tests/unit/__snapshots__
git commit -m "Add shared EmailLayout template to packages/email"
```

---

### Task 6: `packages/email` `PasswordResetEmail` template

**Goal:** Build the password-reset email body (greeting, CTA, expiry notice, plain-text-visible fallback URL) on top of `EmailLayout`.

**Files:**
- Create: `packages/email/src/templates/PasswordResetEmail.tsx`
- Test: `packages/email/tests/unit/password-reset-email.test.tsx`

**Acceptance Criteria:**
- [ ] Renders the given `resetUrl` both as the CTA button's `href` and as visible text (plain-text fallback)
- [ ] Renders the given `expiresInMinutes` in an expiry notice
- [ ] Greets by `name` when given, falls back to "there" when omitted

**Verify:** `pnpm --filter @repo/email test -- password-reset-email` → `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// packages/email/tests/unit/password-reset-email.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@react-email/render';
import { PasswordResetEmail } from '../../src/templates/PasswordResetEmail';

describe('PasswordResetEmail', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, BASE_URL: 'https://example.com' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('includes the reset URL and expiry minutes in the rendered HTML', async () => {
    const html = await render(
      <PasswordResetEmail
        name="Ada"
        resetUrl="https://app.example.com/reset-password?token=abc123"
        expiresInMinutes={30}
      />,
    );
    expect(html).toContain(
      'https://app.example.com/reset-password?token=abc123',
    );
    expect(html).toContain('30 minutes');
    expect(html).toContain('Ada');
  });

  it('falls back to a generic greeting when no name is given', async () => {
    const html = await render(
      <PasswordResetEmail
        resetUrl="https://app.example.com/reset-password?token=abc123"
        expiresInMinutes={30}
      />,
    );
    expect(html).toContain('Hi there,');
  });

  it('matches the known-good markup snapshot', async () => {
    const html = await render(
      <PasswordResetEmail
        name="Ada"
        resetUrl="https://app.example.com/reset-password?token=abc123"
        expiresInMinutes={30}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter @repo/email test -- password-reset-email`
Expected: FAIL with `Cannot find module '../../src/templates/PasswordResetEmail'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/email/src/templates/PasswordResetEmail.tsx
import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout';

export type PasswordResetEmailProps = {
  name?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export function PasswordResetEmail({
  name,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailProps) {
  const greetingName = name?.trim() || 'there';

  return (
    <EmailLayout previewText="Reset your password">
      <Heading className="text-xl font-bold text-gray-900">
        Reset your password
      </Heading>
      <Text className="text-sm text-gray-600">Hi {greetingName},</Text>
      <Text className="text-sm text-gray-600">
        We received a request to reset your password. Click the button below
        to choose a new one. If you didn&apos;t request this, you can safely
        ignore this email.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={resetUrl}
          className="rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-6 py-3 text-sm font-medium text-white"
        >
          Reset password
        </Button>
      </Section>
      <Text className="text-xs text-gray-400">
        This link expires in {expiresInMinutes} minutes. If the button above
        doesn&apos;t work, copy and paste this URL into your browser:
      </Text>
      <Text className="break-all text-xs text-gray-400">{resetUrl}</Text>
    </EmailLayout>
  );
}

export default PasswordResetEmail;
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/email test -- password-reset-email`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add packages/email/src/templates/PasswordResetEmail.tsx packages/email/tests/unit/password-reset-email.test.tsx packages/email/tests/unit/__snapshots__
git commit -m "Add PasswordResetEmail template to packages/email"
```

---

### Task 7: `packages/email` `TeamInvitationEmail` template

**Goal:** Build the team-invitation email body (inviter, team name, role, CTA) on top of `EmailLayout`, ready to be wired into `inviteTeamMember`'s TODO.

**Files:**
- Create: `packages/email/src/templates/TeamInvitationEmail.tsx`
- Test: `packages/email/tests/unit/team-invitation-email.test.tsx`

**Acceptance Criteria:**
- [ ] Renders `teamName`, `role`, and `inviteUrl` (both as CTA href and visible fallback text)
- [ ] Renders `inviterName` when given, falls back to "A teammate" when omitted

**Verify:** `pnpm --filter @repo/email test -- team-invitation-email` → `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// packages/email/tests/unit/team-invitation-email.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { TeamInvitationEmail } from '../../src/templates/TeamInvitationEmail';

describe('TeamInvitationEmail', () => {
  it('includes the team name, role, and invite URL', async () => {
    const html = await render(
      <TeamInvitationEmail
        teamName="Acme Team"
        inviterName="Grace Hopper"
        inviteUrl="https://app.example.com/sign-up?inviteId=42"
        role="member"
      />,
    );
    expect(html).toContain('Acme Team');
    expect(html).toContain('member');
    expect(html).toContain('https://app.example.com/sign-up?inviteId=42');
    expect(html).toContain('Grace Hopper');
  });

  it('falls back to a generic inviter name when none is given', async () => {
    const html = await render(
      <TeamInvitationEmail
        teamName="Acme Team"
        inviteUrl="https://app.example.com/sign-up?inviteId=42"
        role="owner"
      />,
    );
    expect(html).toContain('A teammate');
  });

  it('matches the known-good markup snapshot', async () => {
    const html = await render(
      <TeamInvitationEmail
        teamName="Acme Team"
        inviterName="Grace Hopper"
        inviteUrl="https://app.example.com/sign-up?inviteId=42"
        role="member"
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter @repo/email test -- team-invitation-email`
Expected: FAIL with `Cannot find module '../../src/templates/TeamInvitationEmail'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/email/src/templates/TeamInvitationEmail.tsx
import { Button, Heading, Section, Text } from '@react-email/components';
import { EmailLayout } from './EmailLayout';

export type TeamInvitationEmailProps = {
  teamName: string;
  inviterName?: string;
  inviteUrl: string;
  role: string;
};

export function TeamInvitationEmail({
  teamName,
  inviterName,
  inviteUrl,
  role,
}: TeamInvitationEmailProps) {
  const inviter = inviterName?.trim() || 'A teammate';

  return (
    <EmailLayout previewText={`${inviter} invited you to join ${teamName}`}>
      <Heading className="text-xl font-bold text-gray-900">
        You&apos;ve been invited to {teamName}
      </Heading>
      <Text className="text-sm text-gray-600">
        {inviter} has invited you to join <strong>{teamName}</strong> as a{' '}
        {role}.
      </Text>
      <Section className="my-6 text-center">
        <Button
          href={inviteUrl}
          className="rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 px-6 py-3 text-sm font-medium text-white"
        >
          Accept invitation
        </Button>
      </Section>
      <Text className="text-xs text-gray-400">
        If the button above doesn&apos;t work, copy and paste this URL into
        your browser:
      </Text>
      <Text className="break-all text-xs text-gray-400">{inviteUrl}</Text>
    </EmailLayout>
  );
}

export default TeamInvitationEmail;
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/email test -- team-invitation-email`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add packages/email/src/templates/TeamInvitationEmail.tsx packages/email/tests/unit/team-invitation-email.test.tsx packages/email/tests/unit/__snapshots__
git commit -m "Add TeamInvitationEmail template to packages/email"
```

---

### Task 8: `packages/email` `send.ts` (`sendPasswordResetEmail`, `sendTeamInvitationEmail`)

**Goal:** Wrap the generic `sendEmail` with two typed, subject-specific helpers that the auth backend and `inviteTeamMember` call.

**Files:**
- Create: `packages/email/src/send.ts`
- Test: `packages/email/tests/unit/send.test.ts`

**Acceptance Criteria:**
- [ ] `sendPasswordResetEmail` calls `sendEmail` with subject `"Reset your password"` and a `PasswordResetEmail` element carrying the given props
- [ ] `sendTeamInvitationEmail` calls `sendEmail` with a team-specific subject and a `TeamInvitationEmail` element carrying the given props
- [ ] Both return whatever `sendEmail` resolves to

**Verify:** `pnpm --filter @repo/email test -- send.test` → `2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// packages/email/tests/unit/send.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendEmailMock = vi.fn();
vi.mock('../../src/client', () => ({
  sendEmail: sendEmailMock,
}));

import { sendPasswordResetEmail, sendTeamInvitationEmail } from '../../src/send';
import { PasswordResetEmail } from '../../src/templates/PasswordResetEmail';
import { TeamInvitationEmail } from '../../src/templates/TeamInvitationEmail';

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: 'email_1' });
  });

  it('sends to the given address with the reset subject and template', async () => {
    const result = await sendPasswordResetEmail({
      to: 'user@example.com',
      name: 'Ada',
      resetUrl: 'https://app.example.com/reset-password?token=abc',
      expiresInMinutes: 30,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toBe('Reset your password');
    expect(call.react.type).toBe(PasswordResetEmail);
    expect(call.react.props).toEqual({
      name: 'Ada',
      resetUrl: 'https://app.example.com/reset-password?token=abc',
      expiresInMinutes: 30,
    });
    expect(result).toEqual({ id: 'email_1' });
  });
});

describe('sendTeamInvitationEmail', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ id: 'email_2' });
  });

  it('sends to the invited address with a team-specific subject and template', async () => {
    const result = await sendTeamInvitationEmail({
      to: 'invitee@example.com',
      teamName: 'Acme Team',
      inviterName: 'Grace',
      inviteUrl: 'https://app.example.com/sign-up?inviteId=42',
      role: 'member',
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.to).toBe('invitee@example.com');
    expect(call.subject).toBe("You've been invited to join Acme Team");
    expect(call.react.type).toBe(TeamInvitationEmail);
    expect(call.react.props).toEqual({
      teamName: 'Acme Team',
      inviterName: 'Grace',
      inviteUrl: 'https://app.example.com/sign-up?inviteId=42',
      role: 'member',
    });
    expect(result).toEqual({ id: 'email_2' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter @repo/email test -- send.test`
Expected: FAIL with `Cannot find module '../../src/send'`

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/email/src/send.ts
import { createElement } from 'react';
import { sendEmail } from './client';
import { PasswordResetEmail } from './templates/PasswordResetEmail';
import { TeamInvitationEmail } from './templates/TeamInvitationEmail';

export type SendPasswordResetEmailArgs = {
  to: string;
  name?: string;
  resetUrl: string;
  expiresInMinutes: number;
};

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
  expiresInMinutes,
}: SendPasswordResetEmailArgs) {
  return sendEmail({
    to,
    subject: 'Reset your password',
    react: createElement(PasswordResetEmail, {
      name,
      resetUrl,
      expiresInMinutes,
    }),
  });
}

export type SendTeamInvitationEmailArgs = {
  to: string;
  teamName: string;
  inviterName?: string;
  inviteUrl: string;
  role: string;
};

export async function sendTeamInvitationEmail({
  to,
  teamName,
  inviterName,
  inviteUrl,
  role,
}: SendTeamInvitationEmailArgs) {
  return sendEmail({
    to,
    subject: `You've been invited to join ${teamName}`,
    react: createElement(TeamInvitationEmail, {
      teamName,
      inviterName,
      inviteUrl,
      role,
    }),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter @repo/email test -- send.test`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add packages/email/src/send.ts packages/email/tests/unit/send.test.ts
git commit -m "Add sendPasswordResetEmail and sendTeamInvitationEmail to packages/email"
```

---

### Task 9: Wire `sendTeamInvitationEmail` into `inviteTeamMember`

**Goal:** Replace the `// TODO: Send invitation email` in `inviteTeamMember` with a real call to `sendTeamInvitationEmail`, capturing the created invitation's id for the `?inviteId=` URL, without letting an email-provider failure roll back or fail the invitation itself.

**Files:**
- Modify: `apps/web/app/(login)/actions.ts`
- Test: `apps/web/tests/unit/invite-team-member-email.test.ts`

**Acceptance Criteria:**
- [ ] `inviteTeamMember` calls `sendTeamInvitationEmail` with `to`, `teamName`, `inviterName`, `role`, and `inviteUrl` containing `?inviteId={the newly-inserted invitation's id}`
- [ ] The invitation insert now uses `.returning()` so the new row's `id` is available
- [ ] If `sendTeamInvitationEmail` rejects, `inviteTeamMember` still returns `{ success: 'Invitation sent successfully' }` (the invitation row already exists; a transient email failure must not be reported as a failed invite)

**Verify:** `pnpm --filter web test -- invite-team-member-email` → `2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/invite-team-member-email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const sendTeamInvitationEmailMock = vi.fn();
vi.mock('@repo/email/send', () => ({
  sendTeamInvitationEmail: sendTeamInvitationEmailMock,
}));

vi.mock('@repo/db/client', () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'from', 'leftJoin', 'where', 'insert', 'values']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.limit = vi.fn();
  chain.returning = vi.fn();
  return { db: chain };
});

vi.mock('@repo/db/queries', () => ({
  getUser: vi.fn(),
  getUserWithTeam: vi.fn(async () => ({ user: { id: 1 }, teamId: 7 })),
}));

import { db } from '@repo/db/client';
import { getUser } from '@repo/db/queries';
import { inviteTeamMember } from '@/app/(login)/actions';

const limitMock = db.limit as unknown as ReturnType<typeof vi.fn>;
const returningMock = db.returning as unknown as ReturnType<typeof vi.fn>;
const getUserMock = getUser as unknown as ReturnType<typeof vi.fn>;

describe('inviteTeamMember email wiring', () => {
  beforeEach(() => {
    sendTeamInvitationEmailMock.mockReset();
    sendTeamInvitationEmailMock.mockResolvedValue({ id: 'email_1' });
    limitMock.mockReset();
    returningMock.mockReset();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('sends a team invitation email with the created invitation id in the URL', async () => {
    limitMock
      .mockResolvedValueOnce([]) // existingMember
      .mockResolvedValueOnce([]) // existingInvitation
      .mockResolvedValueOnce([{ name: 'Acme Team' }]); // team name lookup
    returningMock.mockResolvedValueOnce([{ id: 42 }]);

    const formData = new FormData();
    formData.set('email', 'invitee@example.com');
    formData.set('role', 'member');

    const result = await (inviteTeamMember as any)(
      { error: '', success: '' },
      formData,
    );

    expect(sendTeamInvitationEmailMock).toHaveBeenCalledTimes(1);
    const call = sendTeamInvitationEmailMock.mock.calls[0][0];
    expect(call.to).toBe('invitee@example.com');
    expect(call.teamName).toBe('Acme Team');
    expect(call.role).toBe('member');
    expect(call.inviterName).toBe('Ada Lovelace');
    expect(call.inviteUrl).toContain('/sign-up?inviteId=42');
    expect(result).toEqual({ success: 'Invitation sent successfully' });
  });

  it('still returns success to the user even when the email send fails', async () => {
    limitMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: 'Acme Team' }]);
    returningMock.mockResolvedValueOnce([{ id: 43 }]);
    sendTeamInvitationEmailMock.mockRejectedValue(new Error('Resend is down'));

    const formData = new FormData();
    formData.set('email', 'invitee2@example.com');
    formData.set('role', 'member');

    const result = await (inviteTeamMember as any)(
      { error: '', success: '' },
      formData,
    );

    expect(result).toEqual({ success: 'Invitation sent successfully' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- invite-team-member-email`
Expected: FAIL with `expect(sendTeamInvitationEmailMock).toHaveBeenCalledTimes(1)` receiving `0` calls (the TODO comment is still a no-op)

- [ ] **Step 3: Write minimal implementation**

Add the import (near the other top-of-file imports in `apps/web/app/(login)/actions.ts`, which post-Phase-2 already reads `db`/schema/queries from `@repo/db/*`):

```ts
import { sendTeamInvitationEmail } from '@repo/email/send';
```

Replace the tail of `inviteTeamMember` (from the invitation insert onward):

```ts
export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
      .where(
        and(
          eq(users.email, email),
          eq(teamMembers.teamId, userWithTeam.teamId),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'User is already a member of this team' };
    }

    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.teamId, userWithTeam.teamId),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' };
    }

    const [createdInvitation] = await db
      .insert(invitations)
      .values({
        teamId: userWithTeam.teamId,
        email,
        role,
        invitedBy: user.id,
        status: 'pending',
      })
      .returning();

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.INVITE_TEAM_MEMBER,
    );

    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, userWithTeam.teamId))
      .limit(1);

    try {
      await sendTeamInvitationEmail({
        to: email,
        teamName: team?.name ?? 'your team',
        inviterName: user.name ?? user.email,
        inviteUrl: `${process.env.BASE_URL}/sign-up?inviteId=${createdInvitation.id}`,
        role,
      });
    } catch (err) {
      console.error('Failed to send team invitation email', err);
    }

    return { success: 'Invitation sent successfully' };
  },
);
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- invite-team-member-email`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/\(login\)/actions.ts apps/web/tests/unit/invite-team-member-email.test.ts
git commit -m "Send a real invitation email from inviteTeamMember instead of a TODO"
```

---

### Task 10: `POST /api/password-reset/request` route handler

**Goal:** Add a Zod-validated Route Handler that always responds with an identical generic message regardless of whether the account exists, delegating the actual side effect to `requestPasswordReset` (built in Task 3, `apps/web/lib/auth/password-reset.ts`).

**Files:**
- Create: `apps/web/app/api/password-reset/request/route.ts`
- Test: `apps/web/tests/unit/password-reset-request-route.test.ts`

**Acceptance Criteria:**
- [ ] An invalid email returns `400` with a Zod issue message, and never calls `requestPasswordReset`
- [ ] A known-account email and an unknown-account email both return the identical `200` generic message
- [ ] If `requestPasswordReset` throws, the route still returns the identical `200` generic message (no enumeration leak via error behavior either), after logging server-side

**Verify:** `pnpm --filter web test -- password-reset-request-route` → `4 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/password-reset-request-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestPasswordResetMock = vi.fn();
vi.mock('@/lib/auth/password-reset', () => ({
  requestPasswordReset: requestPasswordResetMock,
}));

import { POST } from '@/app/api/password-reset/request/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/password-reset/request', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('rejects an invalid email with a 400 and a validation message', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email' }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(typeof json.error).toBe('string');
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns the generic 200 message for a known account', async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });
    const response = await POST(makeRequest({ email: 'known@example.com' }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/if an account exists/i);
    expect(requestPasswordResetMock).toHaveBeenCalledWith('known@example.com');
  });

  it('returns the identical 200 generic message for an unknown account', async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });
    const response = await POST(makeRequest({ email: 'unknown@example.com' }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/if an account exists/i);
  });

  it('still returns the generic 200 message when the underlying call throws', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('db unreachable'));
    const response = await POST(makeRequest({ email: 'known@example.com' }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/if an account exists/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- password-reset-request-route`
Expected: FAIL with `Cannot find module '@/app/api/password-reset/request/route'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/app/api/password-reset/request/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '@/lib/auth/password-reset';

const requestSchema = z.object({
  email: z.string().email(),
});

const GENERIC_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = requestSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await requestPasswordReset(result.data.email);
  } catch (err) {
    // Never let an infra failure distinguish this response from the
    // known-account or unknown-account paths -- log server-side only.
    console.error('requestPasswordReset failed', err);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- password-reset-request-route`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/api/password-reset/request/route.ts apps/web/tests/unit/password-reset-request-route.test.ts
git commit -m "Add POST /api/password-reset/request route handler"
```

---

### Task 11: `POST /api/password-reset/confirm` route handler

**Goal:** Add a Zod-validated Route Handler that confirms a password reset by delegating to `confirmPasswordReset`, surfacing its resolved error message on failure and a success message otherwise.

**Files:**
- Create: `apps/web/app/api/password-reset/confirm/route.ts`
- Test: `apps/web/tests/unit/password-reset-confirm-route.test.ts`

**Acceptance Criteria:**
- [ ] A password shorter than 8 characters or an empty token returns `400` without calling `confirmPasswordReset`
- [ ] A valid token/password returns `200` with a success message and calls `confirmPasswordReset(token, password)`
- [ ] When `confirmPasswordReset` resolves with `{ error }` (invalid/expired/used token), the route returns `400` with that same error message — note that `confirmPasswordReset` (Task 3) never throws for this; it always resolves, so the route must check the resolved value, not catch a thrown error

**Verify:** `pnpm --filter web test -- password-reset-confirm-route` → `4 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/password-reset-confirm-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const confirmPasswordResetMock = vi.fn();
vi.mock('@/lib/auth/password-reset', () => ({
  confirmPasswordReset: confirmPasswordResetMock,
}));

import { POST } from '@/app/api/password-reset/confirm/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/password-reset/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/password-reset/confirm', () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
  });

  it('rejects a short password with a 400 and a validation message', async () => {
    const response = await POST(makeRequest({ token: 'abc', password: 'short' }));
    expect(response.status).toBe(400);
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it('rejects a missing token with a 400', async () => {
    const response = await POST(
      makeRequest({ token: '', password: 'a-long-enough-password' }),
    );
    expect(response.status).toBe(400);
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns 200 on a valid token and password', async () => {
    confirmPasswordResetMock.mockResolvedValue({ success: true });
    const response = await POST(
      makeRequest({ token: 'valid-token', password: 'a-long-enough-password' }),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toMatch(/password has been reset/i);
    expect(confirmPasswordResetMock).toHaveBeenCalledWith(
      'valid-token',
      'a-long-enough-password',
    );
  });

  it('returns a 400 with the resolved error message when the token is invalid or expired', async () => {
    confirmPasswordResetMock.mockResolvedValue({
      error: 'This reset link is invalid or has expired.',
    });
    const response = await POST(
      makeRequest({ token: 'bad-token', password: 'a-long-enough-password' }),
    );
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('This reset link is invalid or has expired.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- password-reset-confirm-route`
Expected: FAIL with `Cannot find module '@/app/api/password-reset/confirm/route'`

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/app/api/password-reset/confirm/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmPasswordReset } from '@/lib/auth/password-reset';

const confirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = confirmSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 },
    );
  }

  // confirmPasswordReset never throws for a known failure -- it always
  // resolves to { success: true } | { error: string }. Check the resolved
  // shape rather than wrapping this in a try/catch.
  const outcome = await confirmPasswordReset(
    result.data.token,
    result.data.password,
  );

  if ('error' in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  return NextResponse.json(
    { message: 'Your password has been reset.' },
    { status: 200 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- password-reset-confirm-route`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/api/password-reset/confirm/route.ts apps/web/tests/unit/password-reset-confirm-route.test.ts
git commit -m "Add POST /api/password-reset/confirm route handler"
```

---

### Task 12: `requestPasswordReset` / `resetPassword` Server Actions

**Goal:** Add the same password-reset flow as `validatedAction`-wrapped Server Actions in `app/(login)/actions.ts`, matching the file's existing `.issues`-based error pattern, over the same `apps/web/lib/auth/password-reset.ts` logic used by the Route Handlers.

**Files:**
- Modify: `apps/web/app/(login)/actions.ts`
- Test: `apps/web/tests/unit/password-reset-actions.test.ts`

**Acceptance Criteria:**
- [ ] `requestPasswordReset` action rejects an invalid email via `validatedAction`'s existing `.issues[0].message` behavior, without calling the underlying reset logic
- [ ] `requestPasswordReset` action returns the identical generic success message whether or not the account exists, and even if the underlying call throws
- [ ] `resetPassword` action rejects a mismatched `password`/`confirmPassword` pair before calling the underlying logic
- [ ] `resetPassword` action redirects to `/dashboard` on success
- [ ] `resetPassword` action returns `{ error }` — the resolved error message from `confirmPasswordReset`, not a caught exception — when the token is invalid or expired, and does not redirect in that case

**Verify:** `pnpm --filter web test -- password-reset-actions` → `6 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/password-reset-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@repo/email/send', () => ({ sendTeamInvitationEmail: vi.fn() }));
vi.mock('@repo/db/client', () => ({ db: {} }));
vi.mock('@repo/db/queries', () => ({
  getUser: vi.fn(),
  getUserWithTeam: vi.fn(),
}));

const requestPasswordResetMock = vi.fn();
const confirmPasswordResetMock = vi.fn();
vi.mock('@/lib/auth/password-reset', () => ({
  requestPasswordReset: requestPasswordResetMock,
  confirmPasswordReset: confirmPasswordResetMock,
}));

import { redirect } from 'next/navigation';
import {
  requestPasswordReset as requestPasswordResetAction,
  resetPassword,
} from '@/app/(login)/actions';

describe('requestPasswordReset server action', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('rejects an invalid email before calling the underlying reset logic', async () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    const result = await requestPasswordResetAction({ error: '' }, formData);

    expect(result).toHaveProperty('error');
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('returns an identical generic success message whether or not the account exists', async () => {
    requestPasswordResetMock.mockResolvedValue({ success: true });
    const formData = new FormData();
    formData.set('email', 'known@example.com');

    const result = await requestPasswordResetAction({ error: '' }, formData);

    expect(result).toEqual({
      success:
        'If an account exists for that email, a password reset link has been sent.',
    });
    expect(requestPasswordResetMock).toHaveBeenCalledWith('known@example.com');
  });

  it('still returns the generic success message when the underlying call throws', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('db unreachable'));
    const formData = new FormData();
    formData.set('email', 'known@example.com');

    const result = await requestPasswordResetAction({ error: '' }, formData);

    expect(result).toEqual({
      success:
        'If an account exists for that email, a password reset link has been sent.',
    });
  });
});

describe('resetPassword server action', () => {
  beforeEach(() => {
    confirmPasswordResetMock.mockReset();
    (redirect as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  it('rejects mismatched passwords before calling the underlying reset logic', async () => {
    const formData = new FormData();
    formData.set('token', 'a-token');
    formData.set('password', 'a-long-enough-password');
    formData.set('confirmPassword', 'does-not-match');

    const result = await resetPassword({ error: '' }, formData);

    expect(result).toHaveProperty('error', "Passwords don't match");
    expect(confirmPasswordResetMock).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard on a successful reset', async () => {
    confirmPasswordResetMock.mockResolvedValue({ success: true });
    const formData = new FormData();
    formData.set('token', 'a-token');
    formData.set('password', 'a-long-enough-password');
    formData.set('confirmPassword', 'a-long-enough-password');

    await resetPassword({ error: '' }, formData);

    expect(confirmPasswordResetMock).toHaveBeenCalledWith(
      'a-token',
      'a-long-enough-password',
    );
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('returns the resolved error message when confirmPasswordReset resolves with an error (e.g. an expired token), without redirecting', async () => {
    confirmPasswordResetMock.mockResolvedValue({
      error: 'This reset link is invalid or has expired.',
    });
    const formData = new FormData();
    formData.set('token', 'expired-token');
    formData.set('password', 'a-long-enough-password');
    formData.set('confirmPassword', 'a-long-enough-password');

    const result = await resetPassword({ error: '' }, formData);

    expect(result).toEqual({
      error: 'This reset link is invalid or has expired.',
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- password-reset-actions`
Expected: FAIL with `does not provide an export named 'requestPasswordReset'` (the alias export doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Add the import (aliased, since the new action's exported name collides with the lib function's name):

```ts
import {
  requestPasswordReset as requestPasswordResetForEmail,
  confirmPasswordReset,
} from '@/lib/auth/password-reset';
```

Append to `apps/web/app/(login)/actions.ts`:

```ts
const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const requestPasswordReset = validatedAction(
  requestPasswordResetSchema,
  async (data) => {
    try {
      await requestPasswordResetForEmail(data.email);
    } catch (err) {
      console.error('requestPasswordReset action failed', err);
    }

    return {
      success:
        'If an account exists for that email, a password reset link has been sent.',
    };
  },
);

const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(100),
    confirmPassword: z.string().min(8).max(100),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const resetPassword = validatedAction(resetPasswordSchema, async (data) => {
  // confirmPasswordReset never throws for a known failure -- it always
  // resolves to { success: true } | { error: string }. Check the resolved
  // shape rather than wrapping this in a try/catch.
  const outcome = await confirmPasswordReset(data.token, data.password);

  if ('error' in outcome) {
    return { error: outcome.error };
  }

  redirect('/dashboard');
});
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- password-reset-actions`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/\(login\)/actions.ts apps/web/tests/unit/password-reset-actions.test.ts
git commit -m "Add requestPasswordReset and resetPassword Server Actions"
```

---

### Task 13: `forgot-password` page

**Goal:** Add `/forgot-password`, styled like `login.tsx` (gradient CTA, rounded-full inputs, same layout shell), that submits to the new `requestPasswordReset` Server Action and shows its generic success message in place of the form.

**Files:**
- Create: `apps/web/app/(login)/forgot-password/page.tsx`
- Test: `apps/web/tests/unit/forgot-password-page.test.tsx`

**Acceptance Criteria:**
- [ ] Renders a labeled email field and a "Send reset link" submit button
- [ ] On a successful submit, shows the action's generic success message and hides the form
- [ ] On a validation error, shows the action's error message and keeps the form visible

**Verify:** `pnpm --filter web test -- forgot-password-page` → `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/unit/forgot-password-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const requestPasswordResetMock = vi.fn();
vi.mock('@/app/(login)/actions', () => ({
  requestPasswordReset: (...args: unknown[]) =>
    requestPasswordResetMock(...args),
}));

import ForgotPasswordPage from '@/app/(login)/forgot-password/page';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    requestPasswordResetMock.mockReset();
  });

  it('renders an email field and a submit button', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Send reset link' }),
    ).toBeTruthy();
  });

  it('shows the generic success message returned by the action after submit', async () => {
    requestPasswordResetMock.mockResolvedValue({
      success:
        'If an account exists for that email, a password reset link has been sent.',
    });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(
        screen.getByText(/if an account exists for that email/i),
      ).toBeTruthy();
    });
  });

  it('shows an error and keeps the form visible when the action returns one', async () => {
    requestPasswordResetMock.mockResolvedValue({ error: 'Invalid email' });

    render(<ForgotPasswordPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeTruthy();
    });
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- forgot-password-page`
Expected: FAIL with `Cannot find module '@/app/(login)/forgot-password/page'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/app/(login)/forgot-password/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import { requestPasswordReset } from '../actions';
import { ActionState } from '@/lib/auth/middleware';

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestPasswordReset,
    { error: '' },
  );

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image alt="Logo" src="/logo-long.png" width={200} height={100} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Forgot your password?
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {state?.success ? (
          <p className="text-center text-sm text-gray-700">{state.success}</p>
        ) : (
          <form className="space-y-6" action={formAction}>
            <div>
              <Label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </Label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={255}
                  className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {state?.error && (
              <div className="text-red-500 text-sm">{state.error}</div>
            )}

            <div>
              <Button
                type="submit"
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- forgot-password-page`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/\(login\)/forgot-password/page.tsx apps/web/tests/unit/forgot-password-page.test.tsx
git commit -m "Add the forgot-password page"
```

---

### Task 14: `reset-password` page

**Goal:** Add `/reset-password`, reading `?token=` and presenting a new-password form (styled like `login.tsx`) that submits to `resetPassword`; matches the existing `sign-in/page.tsx` pattern of a thin server-component page wrapping a `'use client'` form in `<Suspense>` (required because it calls `useSearchParams`).

**Files:**
- Create: `apps/web/app/(login)/reset-password/page.tsx`
- Create: `apps/web/app/(login)/reset-password/reset-password-form.tsx`
- Test: `apps/web/tests/unit/reset-password-page.test.tsx`

**Acceptance Criteria:**
- [ ] With no `?token=`, shows a "missing or invalid" message and no form
- [ ] With `?token=`, renders "New password"/"Confirm new password" fields and a hidden `token` input carrying the token value
- [ ] On submit, shows an error returned by `resetPassword` (e.g. an expired token) without navigating away

**Verify:** `pnpm --filter web test -- reset-password-page` → `3 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/unit/reset-password-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const resetPasswordMock = vi.fn();
vi.mock('@/app/(login)/actions', () => ({
  resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
}));

const searchParamsGetMock = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

import { ResetPasswordForm } from '@/app/(login)/reset-password/reset-password-form';

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
    searchParamsGetMock.mockReset();
  });

  it('shows a missing-link message and no form when ?token= is absent', () => {
    searchParamsGetMock.mockReturnValue(null);
    render(<ResetPasswordForm />);
    expect(screen.getByText(/missing or invalid/i)).toBeTruthy();
    expect(screen.queryByLabelText('New password')).toBeNull();
  });

  it('renders the new-password form with the token in a hidden field when present', () => {
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'token' ? 'a-real-token' : null,
    );
    const { container } = render(<ResetPasswordForm />);
    expect(screen.getByLabelText('New password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm new password')).toBeTruthy();
    const hiddenInput = container.querySelector(
      'input[name="token"]',
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe('a-real-token');
  });

  it('surfaces an error returned by the action (e.g. an invalid/expired token)', async () => {
    searchParamsGetMock.mockImplementation((key: string) =>
      key === 'token' ? 'expired-token' : null,
    );
    resetPasswordMock.mockResolvedValue({
      error: 'This reset link is invalid or has expired.',
    });

    render(<ResetPasswordForm />);
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'a-new-password' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'a-new-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(
        screen.getByText('This reset link is invalid or has expired.'),
      ).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- reset-password-page`
Expected: FAIL with `Cannot find module '@/app/(login)/reset-password/reset-password-form'`

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/app/(login)/reset-password/reset-password-form.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { Loader2 } from 'lucide-react';
import { resetPassword } from '../actions';
import { ActionState } from '@/lib/auth/middleware';

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resetPassword,
    { error: '' },
  );

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image alt="Logo" src="/logo-long.png" width={200} height={100} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Choose a new password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        {!token ? (
          <p className="text-center text-sm text-red-500">
            This password reset link is missing or invalid. Please request a
            new one.
          </p>
        ) : (
          <form className="space-y-6" action={formAction}>
            <input type="hidden" name="token" value={token} />
            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                New password
              </Label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                  className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                  placeholder="Enter a new password"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm new password
              </Label>
              <div className="mt-1">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                  className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm your new password"
                />
              </div>
            </div>

            {state?.error && (
              <div className="text-red-500 text-sm">{state.error}</div>
            )}

            <div>
              <Button
                type="submit"
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    Resetting...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/app/(login)/reset-password/page.tsx
import { Suspense } from 'react';
import { ResetPasswordForm } from './reset-password-form';

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- reset-password-page`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/\(login\)/reset-password/page.tsx apps/web/app/\(login\)/reset-password/reset-password-form.tsx apps/web/tests/unit/reset-password-page.test.tsx
git commit -m "Add the reset-password page"
```

---

### Task 15: "Forgot your password?" link in `login.tsx`

**Goal:** Add a "Forgot your password?" link under the password field in `login.tsx`, sign-in mode only, pointing at `/forgot-password`.

**Files:**
- Modify: `apps/web/app/(login)/login.tsx`
- Test: `apps/web/tests/unit/login-forgot-password-link.test.tsx`

**Acceptance Criteria:**
- [ ] In sign-in mode, a link with accessible name "Forgot your password?" is rendered with `href="/forgot-password"`
- [ ] In sign-up mode, that link is not rendered

**Verify:** `pnpm --filter web test -- login-forgot-password-link` → `2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/tests/unit/login-forgot-password-link.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/app/(login)/actions', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

const searchParamsGetMock = vi.fn().mockReturnValue(null);
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

import { Login } from '@/app/(login)/login';

describe('Login forgot-password link', () => {
  it('shows a "Forgot your password?" link to /forgot-password in sign-in mode', () => {
    render(<Login mode="signin" />);
    const link = screen.getByRole('link', { name: 'Forgot your password?' });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });

  it('does not show the forgot-password link in sign-up mode', () => {
    render(<Login mode="signup" />);
    expect(
      screen.queryByRole('link', { name: 'Forgot your password?' }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- login-forgot-password-link`
Expected: FAIL with `Unable to find an accessible element with the role "link" and name "Forgot your password?"`

- [ ] **Step 3: Write minimal implementation**

In `apps/web/app/(login)/login.tsx`, insert immediately after the password field's closing `</div>` and before the `{state?.error && (...)}` block:

```tsx
          {mode === 'signin' && (
            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Forgot your password?
              </Link>
            </div>
          )}
```

(`Link` is already imported at the top of `login.tsx`; no new imports are required.)

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- login-forgot-password-link`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/app/\(login\)/login.tsx apps/web/tests/unit/login-forgot-password-link.test.tsx
git commit -m "Add a Forgot your password? link to the sign-in form"
```

---

### Task 16: `RESEND_API_KEY` / `RESEND_FROM_EMAIL` env vars

**Goal:** Document the two new Resend env vars in `apps/web/.env.example` alongside the existing `AUTH_SECRET`/`BASE_URL` block.

**Files:**
- Modify: `apps/web/.env.example`
- Test: `apps/web/tests/unit/env-example.test.ts`

**Acceptance Criteria:**
- [ ] `.env.example` contains a `RESEND_API_KEY=` line
- [ ] `.env.example` contains a `RESEND_FROM_EMAIL=` line

**Verify:** `pnpm --filter web test -- env-example` → `2 passed`

**Steps:**

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/env-example.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('.env.example password-reset email vars', () => {
  const contents = readFileSync(
    path.resolve(__dirname, '../../.env.example'),
    'utf-8',
  );

  it('documents RESEND_API_KEY', () => {
    expect(contents).toMatch(/^RESEND_API_KEY=/m);
  });

  it('documents RESEND_FROM_EMAIL', () => {
    expect(contents).toMatch(/^RESEND_FROM_EMAIL=/m);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm --filter web test -- env-example`
Expected: FAIL with `expect(received).toMatch(expected)` — no match for `/^RESEND_API_KEY=/m`

- [ ] **Step 3: Write minimal implementation**

```
# apps/web/.env.example
POSTGRES_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLEKEY=
BASE_URL=http://localhost:3000
AUTH_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
AITUTOR_API_KEY=
WORKFLOW_ID=
CHATBOT_ID=
NEXT_PUBLIC_AITUTOR_TOKEN=
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm --filter web test -- env-example`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**
```bash
git add apps/web/.env.example apps/web/tests/unit/env-example.test.ts
git commit -m "Document RESEND_API_KEY and RESEND_FROM_EMAIL in .env.example"
```
