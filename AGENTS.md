# Agent instructions

## Architecture decisions

Before planning or changing the project, check `docs/adr/` and read relevant records, including their status and superseding decisions. Follow accepted decisions; if a request conflicts, explain the conflict and ask the user before proceeding. If the directory is absent, verify the repository root and branch, report it and continue unless a specific missing record is needed. Ask if a requested record is missing or inaccessible.

## Project context

This is an English local learning site for four Bootlin slide courses. See `README.md` for setup, source credits and progress storage. `slides.json` is generated from the pinned PDFs by `scripts/extract-slides.cjs`; don't edit its section boundaries by hand. Keep the PDFs' attribution and third-party notices intact.

Run checks relevant to changes and report skips and unverified behavior. Before suggesting hardware operations, verify electrical compatibility, device identity and recovery; distinguish software checks from physical board tests. Preserve unrelated work and do not commit without user authorization.
