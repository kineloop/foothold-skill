#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const toolsPath = process.argv[2]

if (!toolsPath) {
  console.error("Usage: validate-tool-coverage.mjs <path-to-foothold-tools.ts>")
  process.exit(2)
}

function markdownFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (entry === "agents" || entry === "scripts") return []
    if (statSync(path).isDirectory()) return markdownFiles(path)
    return entry.endsWith(".md") ? [path] : []
  })
}

const source = readFileSync(resolve(toolsPath), "utf8")
const registered = [...source.matchAll(/registerTool\(\s*\n\s*"([a-z_]+)"/g)].map(
  (match) => match[1]
)
const eventSchema = source.match(
  /const contactEventSchema = z\.discriminatedUnion\("type", \[([\s\S]*?)\n\]\)\n\nconst motivationSchema/
)?.[1]
const contactEvents = eventSchema
  ? [...eventSchema.matchAll(/z\.literal\("([A-Z_]+)"\)/g)].map(
      (match) => match[1]
    )
  : []
const corpus = markdownFiles(skillDir)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n")
const sideEffects = readFileSync(
  join(skillDir, "references", "side-effects.md"),
  "utf8"
)
const missing = registered.filter((tool) => !corpus.includes(`\`${tool}\``))
const missingEventScenarios = contactEvents.filter(
  (event) => !sideEffects.includes(`\`${event}\``) && !sideEffects.includes(`(${event}`)
)
const duplicateRegistrations = registered.filter(
  (tool, index) => registered.indexOf(tool) !== index
)
const banned = ["each Foothold deployment is single-user"].filter((phrase) =>
  corpus.includes(phrase)
)

if (registered.length === 0) {
  console.error("No registerTool declarations found; source shape may have changed.")
  process.exit(1)
}
if (contactEvents.length === 0) {
  console.error("No contact event schema found; source shape may have changed.")
  process.exit(1)
}
if (
  missing.length ||
  missingEventScenarios.length ||
  duplicateRegistrations.length ||
  banned.length
) {
  if (missing.length) console.error(`Missing tool coverage: ${missing.join(", ")}`)
  if (missingEventScenarios.length)
    console.error(
      `Missing contact-event scenarios: ${missingEventScenarios.join(", ")}`
    )
  if (duplicateRegistrations.length)
    console.error(`Duplicate registrations: ${duplicateRegistrations.join(", ")}`)
  if (banned.length) console.error(`Stale claims: ${banned.join(", ")}`)
  process.exit(1)
}

console.log(
  `Covered ${registered.length} Foothold MCP tools and ${contactEvents.length} contact events.`
)
