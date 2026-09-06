# Real-world action side effects

Read this before recording anything the user says happened. Foothold has no
stored `lastTouched` field: the UI derives last-touched from the newest Activity
(`Interaction`) row. Messages, Activity, state/cadence, and Today are separate
projections unless a domain operation explicitly updates them together.

## Before every write

1. Read `get_contact` or `list_opportunities` and `get_today`.
2. Identify the real-world fact, its exact text/date/channel, the current legal
   state, and any pending action it fulfills.
3. Choose the row below. A draft, copied text, or pending task is not proof the
   action happened.
4. After writing, re-read the record and `get_today`. Verify Activity/state,
   pending actions, and corpus where applicable. If a multi-call sequence partly
   fails, retry only the missing call.

Do not omit `channel` when it is unknown and let EMAIL become an invented fact;
ask which channel was actually used. `log_event` records at call time and has no
event-date argument. See the late-entry rule below before recording an older
happening.

## Contact communication matrix

| What actually happened | Required call(s), in order | Resulting projections |
| --- | --- | --- |
| First 6-point sent | `log_event(SIX_PT_SENT)` then `add_conversation(OUTBOUND, exact text)` | Activity/last-touched, EMAILED + 3B/7B cadence + SEND_6PT completion, Messages |
| Warm intro requested | `log_event(INTRO_REQUEST_SENT)` then `add_conversation(OUTBOUND, exact text)` | Activity/last-touched, warm-intro state, Messages |
| Introduction received | `log_event(INTRO_RECEIVED)` then `add_conversation(INBOUND, exact text)` | Activity/last-touched, RESPOND_TO_INTRO queued, Messages |
| Reply-all to introduction sent | `log_event(INTRO_REPLY_SENT)` then `add_conversation(OUTBOUND, exact text)` | Activity/last-touched, direct-outreach clock + action completion, Messages |
| Ordinary reply received | `log_event(REPLY_RECEIVED, content=exact text)` | Atomically writes Activity/last-touched, state/cadence, and INBOUND Message |
| Check-in reply received | `log_event(CHECKIN_REPLY, content=exact text)` | Atomically writes Activity/last-touched, callback/monthly cadence, and INBOUND Message |
| Out-of-office received | `log_event(OOO_RECEIVED, businessDays)` then `add_conversation(INBOUND, exact text)` | Activity/last-touched, eligible reminders shifted, Messages; never a Booster |
| One allowed follow-up sent | `log_event(FOLLOW_UP_SENT)` then `add_conversation(OUTBOUND, exact text)` | Activity/last-touched, abandon check + prior FOLLOW_UP action cleared, Messages |
| Calendar invite sent | `log_event(CALENDAR_INVITE_SENT)` then `add_conversation(OUTBOUND, exact text)` when there is real message text | Activity/last-touched + invite action completion; optional corpus |
| Referrer acknowledged | `log_event(REFERRER_ACKNOWLEDGED)` then `add_conversation(OUTBOUND, exact text)` | Activity/last-touched + acknowledgement completion, Messages |
| Thank-you, referral ask, progress update, advice-result update, or ordinary monthly check-in sent | Matching `log_event(*_SENT)` then `add_conversation(OUTBOUND, exact text)` | Activity/last-touched, matching cadence/action effects, Messages |
| Useful news sent | `log_event(NEWS_SHARED, content=exact text, monthlyCheckin=false)` | Atomically writes Activity/last-touched and OUTBOUND Message; no monthly cadence |
| Useful news fulfills a currently due monthly touch | `log_event(NEWS_SHARED, content=exact text, monthlyCheckin=true)` | Atomically writes Activity/last-touched, OUTBOUND Message, and monthly cadence; do not also log CHECKIN_SENT |
| Generic re-warm or message with no legal/descriptive cadence event | `add_conversation(direction, exact text)` then `append_contact_note` with a concise factual description | Messages plus Activity/last-touched; no fabricated state/cadence |
| Phone or in-person touch with a legal semantic event | Matching `log_event` with actual channel; add no Message unless exchanged written text exists | Activity/last-touched and legal state/cadence |
| Phone or in-person touch with no legal semantic event | `append_contact_note` with a concise factual description | Activity/last-touched only; no cadence change |

The sent-event schemas for `SIX_PT_SENT`, `INTRO_REQUEST_SENT`,
`INTRO_REPLY_SENT`, `FOLLOW_UP_SENT`, `CALENDAR_INVITE_SENT`,
`REFERRER_ACKNOWLEDGED`, `THANK_YOU_SENT`, `REFERRAL_ASK_SENT`,
`PROGRESS_UPDATE_SENT`, `ADVICE_UPDATE_SENT`, and `CHECKIN_SENT` do not accept
body content. Their companion `add_conversation` call is therefore mandatory
when written text was exchanged.

## Multi-outcome inbound messages

A single inbound message may carry multiple verified semantic outcomes. For
example, the first reply can also confirm a meeting date or provide a referral.
Store its text once. Log the state-machine events in legal order only when each
outcome is explicit: `REPLY_RECEIVED` first, then `MEETING_SCHEDULED` or
`REFERRAL_RECEIVED`. Do not log a second generic reply and do not add the corpus
twice.

If `triage_reply` returns `proposed.event: null`, no cadence event fits the
current state. Still store the exact inbound text. Add a factual Activity note
when it is a newly received real touch, because Messages alone do not move
last-touched. Never force `REPLY_RECEIVED` or `CHECKIN_REPLY` past legality.

## Meetings, referrals, and state-only outcomes

- `MEETING_SCHEDULED` writes Activity/state/reminders but not the scheduling
  message. If a message carried the booking, store it once in Messages too.
- `MEETING_HELD` writes Activity/state/reminders. Put meeting notes and optional
  user-authored self-review in that event; do not put private self-review in
  relationship memory. If written follow-up was also sent, that is a later send.
- `REFERRAL_RECEIVED` records the referral outcome and optional referred name,
  but not an inbound message body. Store the source message separately.
- `HOLD`, `ADVANCE`, `ABANDON`, and `DROP` write Activity and change state. They
  do not imply a Message. Never use one merely to make last-touched current.
- A message can be stored on a closed DROPPED/ABANDONED contact, but cadence
  events are rejected. Read state first. For a genuinely new pipeline attempt,
  create a fresh contact rather than repurposing the closed record.

## Atomic special cases

- `record_commitment_recovery` atomically writes ADVICE_RECOVERY_SENT Activity,
  the exact OUTBOUND Message, and reschedules the same ADVICE_UPDATE action.
  Do not also call `log_event`, `add_conversation`, or `complete_action`.
- `log_event(REPLY_RECEIVED|CHECKIN_REPLY, content=...)` atomically adds the
  INBOUND Message. A follow-up `add_conversation` is redundant, though exact
  deduplication makes it harmless.
- `log_event(NEWS_SHARED, content=...)` atomically adds the OUTBOUND Message.
- `record_historical_event` writes only historical Activity and never cadence.
  Pair it with `add_conversation` only when exact exchanged text also exists.
- `correct_event_date`, note/message edits, moves, deletes, and restores repair
  existing records; they must not be followed by new cadence events.

## Partial failure and incomplete evidence

- If `log_event` succeeds but `add_conversation` fails, state/cadence and
  last-touched already moved. Re-read, then retry only `add_conversation` with
  the same exact text. Never replay `log_event`.
- If `add_conversation` succeeds but the matching `log_event` fails, the corpus
  exists but last-touched/state/cadence did not move. Re-read the contact and
  report the legal-state conflict. Do not invent a different event. Use a
  factual Activity note only when it truthfully captures a touch that has no
  legal cadence event.
- If the user confirms a send but does not provide the final edited text, log
  the matching event promptly so cadence starts from the real confirmation,
  then explicitly request the final copy for Messages. Never store the draft as
  though it were the sent version.
- Check `add_conversation`'s `added` and `skipped` counts. Deduplication uses
  direction plus exact content, so an overlapping import is safely skipped. A
  genuinely repeated identical message is also skipped by the current product;
  Activity can still record the touch, but do not claim both copies exist in the
  corpus.
- For a happening before today, `log_event` would timestamp Activity now and
  plan cadence from now. `record_historical_event` preserves the old date but
  deliberately does not advance state or reminders. No MCP call does both.
  Explain this limitation and ask whether the user wants historical accuracy or
  current cadence recovery; do not silently choose or combine calls into a
  fictional result. `correct_event_date` after `log_event` changes only Activity
  display and leaves reminders planned from today, so it is not a backdated
  cadence operation.

## Queue and opportunity boundaries

- `complete_action` and `skip_action` update only Today. They do not create
  Activity, update last-touched, store Messages, or move contact state. For an
  actual touch, record the real event/message first; call queue bookkeeping only
  if the event did not already complete the matching action.
- Contact events do not advance an Opportunity. Opportunity events do not write
  contact Activity or Messages. If an interview thank-you was sent, log
  `INTERVIEW_THANK_YOU_SENT` on the opportunity and, when the recipient is a
  tracked contact, record the exact message plus a factual contact Activity note
  unless a legal contact event precisely describes it.
- `OFFER_ACCEPTED` ends the whole search and completes/cancels offer/search
  actions. Never also call `end_search` for the same acceptance.
