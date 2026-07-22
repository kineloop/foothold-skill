# foothold-skill

A Claude Code skill for operating a [Foothold](https://github.com/kineloop/foothold)
job-search pipeline through its MCP server: the daily outreach loop, drafting
and triaging networking emails, logging events, ingesting conversation
screenshots, and building the LAMP list - all with the operating discipline
the methodology demands (never auto-send, log only what actually happened,
verbatim ingestion, destructive-action confirmation).

## Install

Copy the skill into your Claude Code skills directory:

```
mkdir -p ~/.claude/skills/foothold
cp skills/foothold/SKILL.md ~/.claude/skills/foothold/SKILL.md
```

Then connect your Foothold deployment's MCP server:

```
claude mcp add --transport http Foothold https://<your-foothold-domain>/api/mcp \
  --header "Authorization: Bearer <your MCP_API_KEY>"
```

The skill triggers automatically on job-search work ("who's due today",
"log this reply", "add this employer", "draft the 6-point email", ...).

## Requirements

- A running Foothold instance (each deployment is single-user) with its
  `MCP_API_KEY` set.
- Claude Code (or any agent host that reads `SKILL.md` skills and speaks MCP).
