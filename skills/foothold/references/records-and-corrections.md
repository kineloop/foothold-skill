# Records, imports, and corrections

Use the narrowest record type that matches reality. Read the contact and, for
message work, `get_conversation` before changing anything.

## Three distinct stores

- Conversation corpus: exact exchanged text. Use `add_conversation`; it is the
  evidence drafting and triage read.
- Activity timeline: real cadence events plus user-authored notes. Current
  cadence-changing happenings use `log_event`; verified past events use
  `record_historical_event`; observations use `append_contact_note`.
- Relationship memory: durable facts the contact actually stated or the user
  verified. Use `append_contact_memory`, one fact per line. Do not store a draft,
  inference, temporary mood, or the user's private self-review as contact fact.

One real message may require both `add_conversation` and `log_event`: they serve
different purposes. It is still one real-world happening, not two events.

## Historical imports

Transcribe messages verbatim with direction, channel, and the best supported
date. If a date is not visible, say that and ask rather than inventing precision.
Overlapping imports are safe because `add_conversation` deduplicates.

Use `record_historical_event` only for a verified past Activity event that must
appear at its real date without replaying cadence. Message bodies still belong in
`add_conversation`. Historical import never reconstructs current state or stale
reminders.

## Corrections

- `correct_event_date` changes only the real-world date of an Activity record.
  It does not replay state or reminders.
- `update_contact_note` edits only a user-authored note; cadence events are
  immutable apart from date correction.
- `update_conversation_message` corrects text or metadata but keeps canonical
  order.
- `move_conversation_message` changes canonical order without falsifying the
  timestamp. Supply exactly one `beforeMessageId` or `afterMessageId` from the
  latest `get_conversation` result.

## Delete and restore

Get explicit confirmation immediately before `delete_contact_note` or
`delete_conversation_message`. Preserve the returned identifier or undo object:

- Pass the `delete_contact_note` `undo` object unchanged to
  `restore_contact_note`.
- Pass the soft-deleted message ID to `restore_conversation_message`; it returns
  to its prior canonical position.

Never present these tools as deleting cadence history. They can delete only
user-authored notes or soft-delete conversation messages.
