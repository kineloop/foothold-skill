---
name: foothold
description: Operate a Foothold job-search pipeline through its MCP server (server name "Foothold", tools like get_today, draft_email, log_event, triage_reply, add_conversation, create_employer). Use whenever the task touches the job search - daily outreach, adding target employers or contacts, drafting or triaging networking emails, logging replies/meetings/referrals, ingesting conversation screenshots, meeting prep, or pausing the cadence. Trigger phrases - "foothold", "my job search", "outreach", "LAMP list", "6-point email", "log this reply", "add this employer/contact", "who's due today".
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
6. **Transcribe verbatim** when ingesting conversations - no summarizing.
   Dedup is server-side, so re-ingesting overlap is always safe.
7. **Read before writing.** `get_contact` / `get_employer` / `get_today`
   before logging or editing - act on current state, not remembered state.

## The daily loop

1. `get_today` - the finite queue (never invent extra work; empty = done).
2. Per send-type action: `draft_email` (contactId + a templateKey from
   `list_templates`; include `extraContext` if the user supplies anything).
   Show the draft; the user edits and sends it themselves.
3. After the user confirms a send: `log_event` (the matching *_SENT event)
   + `add_conversation` (the sent text, OUTBOUND).
4. Anything inbound: `triage_reply` -> pass its `proposed.event` to
   `log_event` VERBATIM (the mapping is deterministic; don't second-guess) ->
   `add_conversation` (the reply, INBOUND) -> `append_contact_memory` for
   lines the user agrees with.
5. `complete_action` / `skip_action` for non-send actions.

## Building the pipeline

- `create_employer`: the LAMP fields. Motivation is the user's gut 0-3 (ask,
  never guess); posting 1-3 from live posting relevance; advocacy Y/N.
- `create_contact`: auto-queues the 6-Point Email for today. Seed `memory`,
  `connection`, and `preferredChannel` when known - drafts get better.
- Screenshot or pasted thread -> extract every message verbatim with
  direction (OUTBOUND = the user) and dates -> `add_conversation` (resolves
  the contact by name + employer). `get_conversation` reads it back.
- **Messages vs notes:** real exchanged message text -> `add_conversation`;
  the user's own observations -> `append_contact_note` (timeline) or
  `append_contact_memory` (durable facts about the person).
- Meeting booked? `log_event` MEETING_SCHEDULED, then `prep_meeting` for the
  dossier + TIARA questions.
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
Keep that frame in anything you write or report - process metrics (touches,
informationals, Boosters found), never guilt.
