# MG account deployment

1. Run `001_accounts.sql` in the target Supabase project's SQL editor. It is additive and repeatable. It does not migrate legacy `reading_*` data.
2. Authentication → URL Configuration:
   - Site URL: `https://mghalip.github.io/mg-test-prep-lab/account.html`
   - Redirect URLs: `https://mghalip.github.io/mg-test-prep-lab/account.html`
   - Keep email confirmation enabled. Configure a production SMTP provider for student registration/reset emails; the default Supabase email service has restricted recipients and low limits.
3. Register the teacher through `account.html`, confirm their email, then replace the email placeholder in `002_teacher.sql` and run it in SQL Editor. This is an administrator-only operation. Do not commit a private teacher provisioning script containing the actual email.
4. Log in and verify the Teacher Dashboard link. Use two student accounts to verify own-record access, and check teacher access to both. Check signup, email confirmation, password reset and logout against the real project before inviting a class.

## Data and access

- `mg_profiles`: own profile; teacher can read all; students can change only their own display name.
- `mg_attempts`: own inserts and reads; teachers read all; submitted attempts cannot be edited or deleted through the browser API.
- `mg_private.teachers`: no anonymous/authenticated grants; role checks use a security-definer function with an empty search path.
- Only a publishable key is shipped. No admin/service-role key belongs in this repository.
- Existing guest history is not automatically uploaded or attributed to an account. Signed-in browser history, drafts and retry queues are namespaced by user ID.
- Completed SAT topic, SAT mock and ACT mock attempts upload automatically. Pending rows survive network failures; a composite primary key prevents duplicates. Unfinished drafts stay on the current device. Cloud history is available in `account.html`; full source-question replay remains on the device that completed a mock.
- Scores and times are browser-generated practice records, not tamper-proof assessment records or official exam scores.
- Teacher accounts can read all registered learners on this single-school site. No enrollment or class assignment system is implemented.

## Verification

Install `@electric-sql/pglite` and `playwright` into a separate working directory, then set `NODE_PATH` to its node_modules when running:

- `node backend/permissions.test.cjs`: runs actual PostgreSQL RLS/privilege checks in PGlite, including negative access tests.
- `node backend/auth.test.cjs`: mocks Auth to check signup, login, logout and password-recovery callbacks. Uses the same local server and Chrome.
- `node backend/browser.test.cjs`: serve this repository at `http://127.0.0.1:8770`; uses installed Chrome. Mocks Supabase responses to test frontend flows; does not claim to validate the deployed database or email delivery.

The public readiness function returns only a schema version. If setup is missing, existing guest practice remains available while the account page explains that cloud setup is pending.
