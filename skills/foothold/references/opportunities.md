# Interview and offer operations

Use this reference when a real hiring process has reached interviews or an
offer. Opportunities are role-level records separate from contact relationship
state. Read `get_methodology` for coaching claims and `list_opportunities` before
any opportunity mutation.

## Grounding and authority

- Create an opportunity only after the user reports a real interview process.
- Terms, decision deadline, BATNA, target, priorities, and the reason behind an
  ask are user-supplied facts. Never infer market compensation, competing
  offers, leverage, deadlines, or a counterpart's flexibility.
- Keep the employer's written terms verbatim. If the user gives incomplete
  terms, record them as incomplete rather than filling gaps.
- `log_opportunity_event` advances a separate offer state machine. On rejection,
  re-read `list_opportunities`; never swap in an event that did not happen.

## Workflow

1. Read `list_employers` or `get_employer` to resolve the owned employer.
2. `create_opportunity` with the real role title.
3. Use `update_opportunity` only for facts the user supplied. `null` intentionally
   clears nullable fields; omission preserves them.
4. Log each real event once with `log_opportunity_event`, then let its returned
   scheduled/canceled actions explain the new queue. Do not calculate dates.
5. Use `get_today` for the resulting interview thank-you, status follow-up,
   prenegotiation call, negotiation, or decision work.

The event kinds are `INTERVIEW_HELD`, `INTERVIEW_THANK_YOU_SENT`,
`STATUS_FOLLOWUP_SENT`, `OFFER_RECEIVED`, `EXTENSION_REQUESTED`, `PNC_HELD`,
`NEGOTIATION_HELD`, `REVISED_OFFER_RECEIVED`, `OFFER_ACCEPTED`,
`OFFER_DECLINED`, `OFFER_WITHDRAWN`, and `OPPORTUNITY_NOTE`.

For `INTERVIEW_HELD`, include `decisionDate` only when it is the date the
employer said the user would hear back. For `OFFER_RECEIVED`, include `deadline`
and `terms` only when actually stated. Without a deadline, the engine deliberately
schedules only what it can defend.

## Acceptance and ending the search

`OFFER_ACCEPTED` automatically ends the search: it closes the opportunity,
cancels the full pending cadence, and queues off-market thank-you notes for
advocates. `end_search` performs that same search-wide transition when acceptance
was recorded elsewhere.

Immediately before either call, re-read the opportunity/pipeline, explain the
search-wide consequence, and get explicit confirmation. Never call both for one
acceptance. MCP cannot undo the search-end transition; undo is available only in
the app UI.
