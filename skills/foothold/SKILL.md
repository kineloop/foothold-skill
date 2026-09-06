---
name: foothold
description: Operate a Foothold job-search pipeline through its MCP server (server name "Foothold", tools like get_today, list_employers, suggest_employers, research_employer, create_employer, create_contact, draft_email, log_event, triage_reply, prep_meeting). Use whenever the task touches the job search - starting out with no employers, building the LAMP list, scoring an employer's motivation, adding target employers or contacts, the daily outreach loop, drafting or triaging networking emails, logging replies/meetings/referrals, meeting prep, ingesting conversation screenshots, or pausing the cadence. Trigger phrases - "foothold", "my job search", "where do I start", "who's due today", "build my LAMP list", "suggest employers", "I have no employers yet", "score this employer", "outreach", "6-point email", "log this reply", "add this employer/contact", "prep for my meeting".
---

# Operating Foothold over MCP

Foothold enforces Steve Dalton's *The 2-Hour Job Search* + Gorick Ng's *The
Unspoken Rules* for one job seeker per account. The hosted product is multi-user;
the connected MCP credential resolves one account, and every tool operates only
on that account's pipeline. The cadence engine (business-day math, the 3B7 state
machine) is deterministic and server-side: never schedule, compute dates, or
advance stages yourself. You log what actually happened; the engine plans the
rest.

If the Foothold MCP server is not connected, say so and stop - never simulate
its state. When unsure how the method wants something handled, read
`get_methodology` first.

## Route the request before acting

Keep this file loaded for every Foothold task. Read the focused reference when
the request enters one of these less-common workflows:

- Interview, written offer, negotiation, acceptance, decline, or ending the
  search: read [references/opportunities.md](references/opportunities.md).
- Importing, correcting, moving, deleting, or restoring notes, Activity, or
  conversation messages: read
  [references/records-and-corrections.md](references/records-and-corrections.md).
- Employer/contact discovery, public-profile privacy, settings, profile, AI
  configuration, templates, or custom queue work: read
  [references/pipeline-operations.md](references/pipeline-operations.md).
- To identify the right tool or audit capability coverage, read
  [references/tool-catalog.md](references/tool-catalog.md).
- Whenever the user says something happened (sent, received, met, completed,
  skipped, corrected, or deleted), read
  [references/side-effects.md](references/side-effects.md) before writing. It is
  the required-record matrix that prevents Messages, Activity, last-touched,
  cadence, and Today from drifting apart.

The live tool description and schema are authoritative for call arguments. A
reference explains intent and sequencing; it never overrides a tool rejection.

## Hard rules (violating these corrupts the pipeline)

1. **Log only what actually happened.** `log_event` advances the state
   machine and sets reminders. Never log SIX_PT_SENT / FOLLOW_UP_SENT etc.
   because a draft exists - only after the user confirms it was actually sent.
2. **Never send anything yourself.** Drafts are copy material; the user sends.
3. **Record every semantic outcome exactly once.** Never stack events
   speculatively. One message can contain more than one verified outcome (for
   example, a first reply that also confirms a meeting); when the state machine
   requires separate legal transitions, log each verified outcome once in legal
   order and store the message text once.
4. **Destructive actions need explicit confirmation.** `rule_out_employer`
   deletes the employer AND its contacts and history, irreversibly.
5. **Never invent contact facts - and never *infer* them from a brand.** Drafts
   must ground in stored memory and conversation. Do NOT guess a person's skills,
   focus, or seniority from their employer's name (a VMware alum is not
   automatically an infra engineer; a Microsoft alum is not automatically .NET) -
   read their stated role / About / memory, or ask. The same discipline applies
   when you *write* `memory` or `connection`: putting an inferred "fact" in those
   fields poisons every future draft (the model grounds in it faithfully). Thin
   context? Ask the user, or pass what they give you as `extraContext` - never
   fabricate specifics.
6. **Motivation is always the user's gut, never yours.** `research_employer`
   and `suggest_employers` inform the 0-3 score; the user sets it. Never
   propose or auto-fill a Motivation number.
7. **Transcribe verbatim** when ingesting conversations - no summarizing.
   Dedup is server-side, so re-ingesting overlap is always safe.
8. **Read before writing.** `get_contact` / `get_employer` / `get_today` /
   `list_employers` before logging or editing - act on current state, not
   remembered state.
9. **Ground your coaching, and label what's yours.** When you state a
   methodology rule, number, cadence, or rationale, it must trace to
   `get_methodology` (the encoded book law) - read it, don't recite from memory
   or general knowledge. Anything you add beyond what the spec says (a rationale,
   an example, a number the book does not give - e.g. "2-3 contacts per employer"
   or a "same-company spam" reason are NOT in the book) must be flagged
   explicitly as your own reasoning, never dressed up as "the book says". This is
   Rule 5's grounding discipline applied to advice, not just drafts.
10. **The engine rejects illegal events - respect the rejection.** `log_event`
   and `log_opportunity_event` validate every event against the contact's
   current `status` (or the opportunity's stage) and throw an error naming the
   legal alternatives (e.g. a second `FOLLOW_UP_SENT`, any event on a
   `DROPPED`/`ABANDONED` contact, `OFFER_ACCEPTED` on a withdrawn
   opportunity). On rejection: re-read state (`get_contact` / `get_employer`),
   then either log the event from the legal set that describes what actually
   happened, or tell the user why nothing can be logged. Never "fix" a
   rejection by logging a different event that didn't happen, and never retry
   the same call. `complete_action` / `skip_action` likewise reject actions
   that are no longer pending - that means the queue moved; re-read
   `get_today`.
11. **Separate proposals, records, and queue bookkeeping.** Draft/research tools
    propose; they do not prove a send or change cadence. `log_event` and
    `log_opportunity_event` record real happenings and advance their engines.
    `complete_action` / `skip_action` only clear queue rows. Never substitute one
    layer for another or call all three mechanically.
12. **Confirm irreversible or search-ending changes at the moment of action.**
    Confirm `rule_out_employer`, `end_search`, `OFFER_ACCEPTED`, and any delete
    tool immediately before the call. Note and conversation deletes are
    restorable; employer deletion is not, and MCP search-end undo exists only in
    the web app. A prior statement of intent is not confirmation if the target or
    consequence has since changed.
13. **Finish the whole write-set.** A successful tool call is not proof the
    real-world action is fully recorded. Use the matrix in
    [references/side-effects.md](references/side-effects.md), then re-read the
    contact/opportunity and Today queue. If step two fails after step one
    succeeds, resume only the missing step; never replay the successful event.

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
P-score updates to apply via `update_employer`. Then use `suggest_contacts` for
one Top-5 employer and obey its `needsContact` and `gateReason`; sourced
candidates are proposals, not contacts. Add only a user-selected, verified
person with `create_contact`, which auto-queues the 6-Point Email for today.
Never bulk-add a shortlist. **The Top-5 pipeline
refills on any of the book's three triggers** (2HJS Quick-Start step 8): a true
Booster identified at a Top-5 employer frees that slot; an employer ruled out is
replaced immediately ("no thinking, just execution"); and once three flawless
3B7 rounds are complete, time permitting, a *sixth or seventh* simultaneous
employer may be added - never an open throttle. Outside those triggers, stay at
5. Aim for two starter contacts per Top-5 employer.

**Stage 2 - Contacts exist, outreach due.** The daily loop (below) is the steady
state: the engine queues 6-Points, follow-ups, and check-ins; you draft and log.

**Stage 3 - Sent, awaiting / replies.** 3B7 runs server-side: at 3 business days
with no reply the engine queues a *second* contact at that employer (add via
`create_contact`) - NOT a follow-up to the first; at 7 it queues the one allowed
follow-up. Out-of-office -> `log_event OOO_RECEIVED` (businessDays, max 30;
legal only while `EMAILED` or `FOLLOWED_UP` - an autoresponder outside the
outreach window is not engagement and logs nothing). Inbound -> `triage_reply`
-> `log_event(proposed.event)` -> `add_conversation` (INBOUND) ->
`append_contact_memory`.

**Stage 4 - Meeting booked (Convince).** `log_event MEETING_SCHEDULED` ->
`prep_meeting` (research dossier + TIARA questions + the Two-Part Closing part-1
line). Thank-you within 24h (`THANK_YOU_SENT`). No referral offered -> the
Two-Part Closing: the referral ask goes out the *next* business week
(`REFERRAL_ASK_SENT`), never on the spot.

**Stage 5 - Referrals & harvest (maintenance).** Referral received
(`REFERRAL_RECEIVED`) -> add the referred person (`create_contact`, a fresh 3B7)
and a progress update to the referrer ~2 weeks out (`PROGRESS_UPDATE_SENT`).
Monthly check-ins (`CHECKIN_SENT` / `CHECKIN_REPLY`, `NEWS_SHARED`) keep contacts
warm; per-contact outcomes are `ADVANCE` / `HOLD` / `DROP`. Two *confirmed*
unanswered check-ins close the contact: after the second silent one the engine
queues a drop-advice action, and it drops the contact rather than sending a
third. Loop until an offer.

Segments come back on `get_contact` and `log_event`. The engine only ever
*assigns* `BOOSTER` (reply within 3B of the FIRST outreach - a reply to the 7B
follow-up does not qualify) and `CURMUDGEON` (on abandon); `SUPER_BOOSTER` and
`OBLIGATE` are coaching vocabulary you may narrate (a helper at a non-hiring
firm; a slow, vague responder with negative ROI), never states you'll read
back. Narrate without guilt.

## Contact state machine (the per-contact stages the engine drives)

The Stage 0-5 frame above is where the *user* is in building the pipeline; each
*contact* also walks a fixed 12-state `status` ladder the engine advances on
`log_event`. Read the live `status` from `get_contact` - never set it yourself -
then narrate the current state and the one legal next touch the engine queued.

| `status` | Reached by (event) | What the engine queues next |
|---|---|---|
| `IDENTIFIED` | contact created | 6-Point Email today (`SEND_6PT`) |
| `EMAILED` | `SIX_PT_SENT` | 3B try-second-contact + 7B one follow-up |
| `FOLLOWED_UP` | `FOLLOW_UP_SENT` | +3B abandon check (one follow-up, ever) |
| `RESPONDED` | `REPLY_RECEIVED` (no callback) | reply + lock meeting within 24h |
| `MEETING_SCHEDULED` | `MEETING_SCHEDULED` | calendar invite, prep, (referrer ack) |
| `MEETING_DONE` | `MEETING_HELD` | thank-you +1B, referral ask +5B, (advice update) |
| `CLOSING` | `REFERRAL_ASK_SENT` | monthly check-in (+1 month); silence is not a no |
| `NURTURE` | `REFERRAL_RECEIVED` / progress sent / check-in reply | monthly check-in |
| `ADVANCED` | `ADVANCE` (resume requested / connected onward) | send requested materials today |
| `HOLD` | reply-with-callback, or the ask answered but no referral | callback / monthly check-in |
| `DROPPED` | two confirmed-unanswered check-ins, or `DROP` | restart 3B7 with a new contact |
| `ABANDONED` | `ABANDON` (silent after the one follow-up) | none; Curmudgeon, cheaply filtered |

`ADVANCED` / `HOLD` / `NURTURE` keep the relationship warm; `DROPPED` /
`ABANDONED` close it without guilt. A contact reaching any of these terminal
outcomes with no outreach reminder skipped is one **flawless 3B7 round** - three
of those unlock widening past the Top 5 (`countFlawlessRounds`).

## Warm introductions (double opt-in - a parallel entry path)

A referred person does NOT start at a cold 6-Point. Use `create_referred_contact`
(links them to the referrer), then run the double opt-in - the book never chases
a reputation-bearing favor with an invented cadence:

1. `log_event INTRO_REQUEST_SENT` (`REQUEST_INTRO`): ask the connector for the
   intro (show homework, easy out). Nothing else is scheduled; you wait.
2. Intro arrives -> `log_event INTRO_RECEIVED`: queues `RESPOND_TO_INTRO` today.
3. Reply-all, move the connector to BCC, make the small advice ask directly ->
   `log_event INTRO_REPLY_SENT`. **That direct reply is the first real touch, so
   3B7 begins here** - same clock as a 6-Point, not before.
4. When the meeting books, the engine also queues `ACKNOWLEDGE_REFERRER` - close
   the connector's loop without sharing private conversation details.

## Advice result update (Stage 4 add-on)

When meeting notes record concrete advice + the user's commitment + a future
result date, run `analyze_advice_commitment`; if it returns a follow-up the user
approves, pass it to `log_event MEETING_HELD` (`adviceFollowUp`) and the engine
schedules one `ADVICE_UPDATE` ("close the loop: 'thanks to you, I...'"). Vague or
dateless advice stays unscheduled - never invent the date.

If the result reminder comes due before the result exists, do not mark it done
or manufacture progress. Use `draft_commitment_recovery` with the user's exact
current status, revised commitment, and future date. Only after they confirm the
exact recovery message was sent, call `record_commitment_recovery`; it records
the message and moves the same reminder while keeping it pending.

## The daily loop

1. `get_today` - the finite queue (never invent extra work; empty = done, or
   see Stage 0/1 above if the pipeline isn't built yet).
2. Per send-type action: `draft_email` (contactId + a templateKey from
   `list_templates`; include `extraContext` if the user supplies anything). The
   `draft_outreach` MCP prompt scaffolds the same by-the-book. **For any contact
   who already has history (anything past the first 6-Point - follow-ups,
   check-ins, re-warms), first pull `get_conversation` + `get_contact` memory and
   ground the draft in the real thread:** mirror the register that actually earned
   a reply, reuse the contact's own tone and wording, and avoid whatever preceded
   silence. Never hand-compose a message that ignores the existing thread - a
   generic note reads like the outreach that got ignored. Show the draft; the user
   edits and sends it themselves. **Before you show any draft, run the pre-send
   checklist below** - the app's `sixPointCheck` is a backstop, not a substitute
   for reading your own output.
3. After the user confirms a send, use the exact row in
   [references/side-effects.md](references/side-effects.md). Most sent-event
   schemas cannot carry body text, so call `log_event` first and then
   `add_conversation` with the exact sent text as OUTBOUND. `log_event` writes
   Activity (which the UI uses to derive last-touched) and advances cadence;
   `add_conversation` writes the drafting corpus; `complete_action` only changes
   the queue. A generic touch is not automatically a `CHECKIN_SENT`: if that
   event is illegal or does not describe what happened, record the exact message
   plus a factual Activity note instead of lying to the cadence engine.
4. Anything inbound: `triage_reply` -> pass its `proposed.event` to
   `log_event` VERBATIM (the mapping is deterministic; don't second-guess) ->
   `append_contact_memory` only for lines the user approves. For
   `REPLY_RECEIVED` and `CHECKIN_REPLY`, include the exact reply as event
   `content`; `log_event` then writes Activity and the INBOUND corpus atomically,
   so do not add the same message again. **`proposed.event` can be `null`** (no
   legal cadence event fits the contact's stage - e.g. an autoresponder after a
   meeting booked, or a mid-meeting-flow reply): skip `log_event`, use
   `add_conversation`, and add a short factual Activity note only if this is a
   new real touch that should move last-touched. A `DECLINE` that names a future
   date ("try me in September") comes back as a reply WITH a callback - log it;
   the engine holds the contact and schedules the callback.
5. `complete_action` / `skip_action` - queue bookkeeping only; records no
   Activity event and moves no cadence. "Non-send" means no message actually
   went out (e.g. "update my resume", "review this posting"). If the action
   *did* produce a real touch - even a CUSTOM re-warm/check-in row - run step 3
   (`log_event` + `add_conversation`) FIRST, then `complete_action` to clear it.
6. `add_custom_action` for user-requested to-dos ("remind me to update my
   resume") - due today by default, never touches the cadence. Only add what
   the user actually asked for; the queue stays finite and calm.

## Pre-send draft checklist (first outreach)

Read the finished draft against these before showing it. `draft_email` reports a
`sixPointCheck` (words, question mark, about-them ratio, no meeting times, no
visa/relocation language) - trust it, but also eyeball the two it can't judge:

- **Grounded?** Every recipient-specific claim traces to their stored role /
  About / memory - not inferred from an employer brand. If you can't cite the
  source, cut it or make it a placeholder the user verifies.
- **No visa/immigration undertone.** Never mention (or hint at) visa, OPT/CPT, a
  green card, sponsorship, work authorization, or "moving to the US" / "same
  path" in a first message - it reframes an advice ask as "I want a sponsor".
  Save it for a far-later conversation, if ever.
- **Wrong-person test.** At least one detail only this recipient could own; the
  connection line is a short phrase (completes "a fellow ___"), not a paragraph.
- **Their language, not a fabricated overlap.** If your stack and theirs don't
  overlap, they're a relationship/path/culture contact - keep the interest broad
  and about them, don't invent a shared technical niche.
- **No em-dashes.** Never put an em-dash (or en-dash) in a drafted message, email,
  or subject line - use a period, comma, or a spaced hyphen instead. Em-dashes read
  as machine-written and break the human register you're matching.

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
- **Historical Activity:** use `record_historical_event` only for a verified
  past event that should appear at its real date without advancing current
  state or creating stale reminders. Use `correct_event_date` to repair only
  the date of an existing Activity row. Cadence events otherwise remain
  immutable: never treat either tool as event deletion, reversal, or replay.
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

`run_search_safety_review` is an optional privacy/public-profile review, not a
background investigation. Use only the user's own situation description and the
exact public URLs they supply. Never discover additional profiles or change an
external account. Read [references/pipeline-operations.md](references/pipeline-operations.md)
before running it.

## Reporting frame

Expected reply rate is 20-40%: silence is the funnel working, not failure.
Success is measured in informational meetings held, never applications sent.
Keep that frame in anything you write or report - process metrics (touches,
informationals, Boosters found), never guilt.
