# Pipeline operations beyond the daily loop

## Contact discovery

Call `suggest_contacts` for one employer only after reading `get_employer`.
Treat its returned `needsContact` and `gateReason` as the gate: when false, stop.
When true, present the sourced shortlist or search plan. A candidate is not a
verified contact merely because research returned it; let the user select and
confirm facts before `create_contact`. Add one at a time, never bulk-create.

## Research and scoring

- `suggest_employers` proposes candidates; it never adds them and never sets
  Motivation.
- `research_employer` informs the user's Motivation judgment but must not
  propose a score.
- `refresh_postings` proposes Posting changes. Inspect `checked`, `unscored`,
  `findings`, and reasons. Never describe an unscored employer as current, and
  apply only accepted rows with `update_employer`.

Research output is evidence to review, not permission to mutate the pipeline.

## Privacy and public-profile review

`run_search_safety_review` is opt-in and mutates only Foothold's stored review.
Before calling, explain that it evaluates the user's situation plus up to five
exact public URLs they provide. Do not search for more profiles, guess identity
matches, access private pages, or change any external account. An empty URL list
is valid. Read `get_settings` first to avoid rerunning a current review without a
reason.

## Settings, profile, templates, and AI

- Read `get_settings` before changing configuration.
- `update_settings` is partial. Digest disabled means no digest email; it does
  not pause cadence. Use `set_vacation_pause` for a real pause.
- `update_profile` replaces the entire About-you profile. Read the current value,
  show the proposed replacement, and preserve verified facts the user wants.
- `import_profile_from_url` scrapes and saves; call it only for a URL the user
  supplied or explicitly selected.
- `update_llm_settings` accepts provider and model together, or both null for
  default. API keys belong only in web Settings and never in chat.
- Read `list_templates` before `render_template` or `update_template`. Preserve
  required placeholders and re-check six-point templates after edits.

## Custom actions

`add_custom_action` is for a to-do the user actually requested. It defaults to
today and never changes contact cadence. `complete_action` and `skip_action` are
queue bookkeeping only: when a task produced a real touch, record that touch
first through the appropriate event/conversation flow.
