# Static site on GitHub Pages with Supabase for data

The tracker must work from any of several laptops now and from Android later, so it is a plain HTML/JS site hosted on GitHub Pages, with data in Supabase (hosted Postgres) and sign-in through GitHub. We considered a private claude.ai page with its built-in shared database: it would need no setup, but it ties the data to Claude, its database is meant for small amounts of data while the imported history is already about 10k rows and growing, and it can't become an installable Android app.

## Consequences

- No build step, so no Node toolchain is needed on each machine; any machine with git can edit the code.
- There is one user, so access control is a Supabase row-level policy restricted to one GitHub identity.
