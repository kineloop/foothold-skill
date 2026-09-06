# foothold-skill

A Codex, Claude Code, and MCP-capable agent skill for operating a
[Foothold](https://github.com/kineloop/foothold)
job-search pipeline through its MCP server: the daily outreach loop, drafting
and triaging networking emails, logging events, ingesting conversation
screenshots, and building the LAMP list - all with the operating discipline
the methodology demands (never auto-send, log only what actually happened,
verbatim ingestion, destructive-action confirmation).

## Install

Copy the complete skill directory into your agent's skills directory (the
references are part of the skill). For Claude Code:

```
mkdir -p ~/.claude/skills/foothold
cp -R skills/foothold/. ~/.claude/skills/foothold/
```

For Codex:

```
mkdir -p ~/.codex/skills/foothold
cp -R skills/foothold/. ~/.codex/skills/foothold/
```

Then connect your Foothold deployment's MCP server:

```
claude mcp add --transport http Foothold https://<your-foothold-domain>/api/mcp \
  --header "Authorization: Bearer <your-fh-token>"
```

The skill triggers automatically on job-search work ("who's due today",
"log this reply", "add this employer", "draft the 6-point email", ...).

## Requirements

- A running multi-user Foothold instance and a personal `fh_...` token minted
  from Settings → Agents. The legacy deployment-wide `MCP_API_KEY` is only a
  transitional fallback and should not be used for a new connection.
- Codex, Claude Code, or another agent host that reads `SKILL.md` and speaks MCP.

## Maintainer validation

After Foothold's MCP catalog or this skill changes, run both checks:

```
uv run --with pyyaml python ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/foothold
node skills/foothold/scripts/validate-tool-coverage.mjs ../kineloop-personal/apps/foothold/lib/mcp/tools.ts
```
