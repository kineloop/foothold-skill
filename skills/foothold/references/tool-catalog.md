# Foothold MCP tool catalog

Use live tool descriptions and schemas for arguments. This catalog exists for
routing and completeness, not as a duplicate API specification.

| Intent | Tools |
| --- | --- |
| Read pipeline | `list_employers`, `get_employer`, `get_contact`, `get_today`, `get_settings`, `list_opportunities` |
| Build LAMP/contact pipeline | `suggest_employers`, `research_employer`, `refresh_postings`, `create_employer`, `update_employer`, `suggest_contacts`, `create_contact`, `create_referred_contact`, `update_contact`, `rule_out_employer` |
| Draft and maintain relationships | `list_templates`, `render_template`, `draft_email`, `draft_monthly_checkin`, `find_useful_news`, `prep_meeting`, `triage_reply`, `analyze_advice_commitment`, `draft_commitment_recovery`, `record_commitment_recovery` |
| Record contact history | `log_event`, `record_historical_event`, `correct_event_date`, `append_contact_note`, `update_contact_note`, `delete_contact_note`, `restore_contact_note`, `append_contact_memory` |
| Conversation corpus | `add_conversation`, `get_conversation`, `update_conversation_message`, `move_conversation_message`, `delete_conversation_message`, `restore_conversation_message` |
| Queue | `add_custom_action`, `complete_action`, `skip_action`, `set_vacation_pause` |
| Interview and offer | `list_opportunities`, `create_opportunity`, `update_opportunity`, `log_opportunity_event`, `end_search` |
| Configuration and safety | `get_settings`, `update_settings`, `run_search_safety_review`, `update_profile`, `import_profile_from_url`, `update_template`, `update_llm_settings` |
| Product law | `get_methodology` |

Read tools and proposal tools are safe to use for understanding. Mutation tools
still require a real user intent and verified input. The explicitly destructive
or search-ending calls require immediate confirmation: `rule_out_employer`,
`delete_contact_note`, `delete_conversation_message`, `end_search`, and
`log_opportunity_event` with `OFFER_ACCEPTED`.
