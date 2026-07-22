---
name: foothold
description: Operate a Foothold job-search pipeline through its MCP server (server name "Foothold", tools like get_today, list_employers, suggest_employers, research_employer, create_employer, create_contact, draft_email, log_event, triage_reply, prep_meeting). Use whenever the task touches the job search - starting out with no employers, building the LAMP list, scoring an employer's motivation, adding target employers or contacts, the daily outreach loop, drafting or triaging networking emails, logging replies/meetings/referrals, meeting prep, ingesting conversation screenshots, or pausing the cadence. Trigger phrases - "foothold", "my job search", "where do I start", "who's due today", "build my LAMP list", "suggest employers", "I have no employers yet", "score this employer", "outreach", "6-point email", "log this reply", "add this employer/contact", "prep for my meeting".
---

# Operating Foothold over MCP

Foothold enforces Steve Dalton's *The 2-Hour Job Search* + Gorick Ng's *The
Unspoken Rules* for one job seeker (the user - each Foothold deployment is
single-user). The cadence engine (business-day math, the 3B7 state machine)
is deterministic and server-side: never schedule, compute dates, or advance
stages yourself. You log what actually happened; the engine plans the rest.

If the Foothold MCP server is not connected, say so and stop - never simulate
its state. When unsure how the method wants something handled, read
`get_methodology` first.

## Hard rules (violating these corrupts the pipeline)

1. **Log only what actually happened.** `log_event` advances the state
   machine and sets reminders. Never log SIX_PT_SENT / FOLLOW_UP_SENT etc.
   because a draft exists - only after the user confirms it was actually sent.
2. **Never send anything yourself.** Drafts are copy material; the user sends.
3. **One event per real-world happening.** Never stack events speculatively.
4. **Destructive actions need explicit confirmation.** `rule_out_employer`
   deletes the employer AND its contacts and history, irreversibly.
5. **Never invent contact facts.** Drafts must ground in stored memory and
   conversation. Thin context? Ask the user, or pass what they give you as
   `extraContext` - never fabricate specifics.
6. **Motivation is always the user's gut, never yours.** `research_employer`
   and `suggest_employers` inform the 0-3 score; the user sets it. Never
   propose or auto-fill a Motivation number.
7. **Transcribe verbatim** when ingesting conversations - no summarizing.
   Dedup is server-side, so re-ingesting overlap is always safe.
8. **Read before writing.** `get_contact` / `get_employer` / `get_today` /
   `list_employers` before logging or editing - act on current state, not
   remembered state.

## Meet the user where they are

The engine only generates actions once contacts exist, so an empty `get_today`
means one of two opposite things: *done for the day* (pipeline built, nothing
due) or *nothing built yet* (no employers/contacts to act on). On any new-user,
"where do I start", "what next", or empty-queue turn, **read the pipeline before
advising** - don't assume a stage:

- `get_settings` -> is the About-you `profile` set? (drafts and suggestions need it)
- `list_employers` -> count, `top5` flags, each row's contacts summary +
  `nextAction`, and any `motivation: 0` rows
- `get_today` -> what the engine has actually queued

Then locate them. Stages 0-1 are where the user needs you to *build*; the engine
drives 2-5 by queuing the right action, and you draft and log.

**Stage 0 - Empty (no profile / no employers).** Onboard, don't draft. Get the
profile in first: `import_profile_from_url` (their resume/LinkedIn/portfolio) or
`update_profile`. Then `suggest_employers` (15-25 from the profile) -> the user
picks -> `create_employer` for each. Build toward the book's 40+ target (cap 100).
Advocacy Y/N; Posting 1-3; Motivation the user's gut 0-3. Nothing is due yet -
that is correct, not a failure.

**Stage 1 - LAMP exists but isn't actionable.** Employers, but `motivation: 0`
rows (unfamiliar) or no contacts. For any M=0 employer, `research_employer`
builds a dossier so the *user* can score Motivation. `refresh_postings` proposes
P-score updates to apply via `update_employer`. Then add contacts on the Top 5:
`create_contact` auto-queues the 6-Point Email for today. **Hard gate: never run
more than 5 active employers until three flawless 3B7 rounds** - the book's rule.
Widen only when a Booster frees a slot, an employer is ruled out, or the user has
cleanly worked a third contact at each Top-5 employer. Aim for two starter
contacts per Top-5 employer.

**Stage 2 - Contacts exist, outreach due.** The daily loop (below) is the steady
state: the engine queues 6-Points, follow-ups, and check-ins; you draft and log.

**Stage 3 - Sent, awaiting / replies.** 3B7 runs server-side: at 3 business days
with no reply the engine queues a *second* contact at that employer (add via
`create_contact`) - NOT a follow-up to the first; at 7 it queues the one allowed
follow-up. Out-of-office -> `log_event OOO_RECEIVED` (businessDays) and the engine
shifts the reminders. Inbound -> `triage_reply` -> `log_event(proposed.event)` ->
`add_conversation` (INBOUND) -> `append_contact_memory`.

**Stage 4 - Meeting booked (Convince).** `log_event MEETING_SCHEDULED` ->
`prep_meeting` (research dossier + TIARA questions + the Two-Part Closing part-1
line). Thank-you within 24h (`THANK_YOU_SENT`). No referral offered -> the
Two-Part Closing: the referral ask goes out the *next* business week
(`REFERRAL_ASK_SENT`), never on the spot.

**Stage 5 - Referrals & harvest (maintenance).** Referral received
(`REFERRAL_RECEIVED`) -> add the referred person (`create_contact`, a fresh 3B7)
and a progress update to the referrer ~2 weeks out (`PROGRESS_UPDATE_SENT`).
Monthly check-ins (`CHECKIN_SENT` / `CHECKIN_REPLY`, `NEWS_SHARED`) keep contacts
warm; per-contact outcomes are `ADVANCE` / `HOLD` / `DROP`; two silent check-ins
-> `DROP` and start a fresh contact. Loop until an offer.

Segments (`BOOSTER` / `SUPER_BOOSTER` / `OBLIGATE` / `CURMUDGEON`) come back on
`get_contact` and `log_event` - narrate them (a fast reply is a likely Booster; a
third-attempt responder is an Obligate with negative ROI), never guilt.

## The daily loop

1. `get_today` - the finite queue (never invent extra work; empty = done, or
   see Stage 0/1 above if the pipeline isn't built yet).
2. Per send-type action: `draft_email` (contactId + a templateKey from
   `list_templates`; include `extraContext` if the user supplies anything). The
   `draft_outreach` MCP prompt scaffolds the same by-the-book. Show the draft;
   the user edits and sends it themselves.
3. After the user confirms a send: `log_event` (the matching *_SENT event)
   + `add_conversation` (the sent text, OUTBOUND).
4. Anything inbound: `triage_reply` -> pass its `proposed.event` to
   `log_event` VERBATIM (the mapping is deterministic; don't second-guess) ->
   `add_conversation` (the reply, INBOUND) -> `append_contact_memory` for
   lines the user agrees with.
5. `complete_action` / `skip_action` for non-send actions.
6. `add_custom_action` for user-requested to-dos ("remind me to update my
   resume") - due today by default, never touches the cadence. Only add what
   the user actually asked for; the queue stays finite and calm.

## Building the LAMP list and contacts

- `create_employer`: the LAMP fields. Motivation is the user's gut 0-3 (ask,
  never guess); posting 1-3 from live posting relevance; advocacy Y/N.
  `suggest_employers` seeds candidates from the profile; `research_employer`
  (M=0 dossier) and `refresh_postings` (P proposals) help the user score - the
  user always decides.
- `create_contact`: auto-queues the 6-Point Email for today. Seed `memory`,
  `connection`, and `preferredChannel` when known - drafts get better.

## Conversations, memory, and templates

- Screenshot or pasted thread -> extract every message verbatim with
  direction (OUTBOUND = the user) and dates -> `add_conversation` (resolves
  the contact by name + employer). `get_conversation` reads it back.
- **Messages vs notes:** real exchanged message text -> `add_conversation`;
  the user's own observations -> `append_contact_note` (timeline) or
  `append_contact_memory` (durable facts about the person).
- `render_template` fills a template without the LLM; `update_template` edits
  one (keep `{{placeholder}}` tokens intact; 6-point templates must still
  pass their checks).

## Settings and profile

`get_settings` / `update_settings` (timezone drives all business-day math),
`set_vacation_pause` (resume shifts everything forward - nothing ever goes
overdue), `update_profile` / `import_profile_from_url` (the About-you facts
drafts ground in), `update_llm_settings` (provider/model pick; null/null =
app default). API keys live in the web Settings only - never ask for them,
never accept them over chat.

## Reporting frame

Expected reply rate is 20-40%: silence is the funnel working, not failure.
Success is measured in informational meetings held, never applications sent.
Keep that frame in anything you write or report - process metrics (touches,
informationals, Boosters found), never guilt.
