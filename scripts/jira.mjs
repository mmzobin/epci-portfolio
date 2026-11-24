#!/usr/bin/env node
// Minimal Jira Cloud client for agents running without the Atlassian MCP (e.g. in CI).
// Credentials come from env and are never printed: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.
//
// Usage:
//   node scripts/jira.mjs search "<JQL>"                 # list matching issues (key, type, status, summary)
//   node scripts/jira.mjs find-open "<text>"             # open EPCI issues whose text matches (dedupe check)
//   node scripts/jira.mjs create-bug <bug.json> [--dry-run]
//   node scripts/jira.mjs comment <KEY> <comment.md> [--dry-run]
//   node scripts/jira.mjs get <KEY>                      # summary, status, labels, description + comments as text
//   node scripts/jira.mjs transition <KEY> "<status name>"   # e.g. "In Progress", "Done" (picked by name)
//
// bug.json: { "summary": "...", "description": "markdown-ish text", "labels": ["needs-triage"] }
// Descriptions support paragraphs, "## " headings, "- " bullets and ``` code blocks.
import { readFileSync } from "node:fs";

const PROJECT = process.env.JIRA_PROJECT_KEY ?? "EPCI";
const DEFAULT_LABELS = ["needs-triage", "nightly-triage"];

function config() {
  const base = (process.env.JIRA_BASE_URL ?? "https://mmzobin.atlassian.net").replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) {
    console.error("JIRA_EMAIL and JIRA_API_TOKEN must be set (values are never printed).");
    process.exit(2);
  }
  return { base, auth: "Basic " + Buffer.from(`${email}:${token}`).toString("base64") };
}

async function jira(method, path, body) {
  const { base, auth } = config();
  const res = await fetch(base + path, {
    method,
    headers: { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Jira ${method} ${path} failed: HTTP ${res.status} ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : {};
}

// Tiny markdown → Atlassian Document Format converter (enough for bug reports).
function inline(text) {
  const parts = [];
  for (const piece of text.split(/(`[^`]+`)/)) {
    if (!piece) continue;
    if (piece.startsWith("`") && piece.endsWith("`")) parts.push({ type: "text", text: piece.slice(1, -1), marks: [{ type: "code" }] });
    else parts.push({ type: "text", text: piece });
  }
  return parts.length ? parts : [{ type: "text", text: " " }];
}

function toAdf(markdown) {
  const content = [];
  const lines = markdown.replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      content.push({ type: "codeBlock", content: [{ type: "text", text: code.join("\n") || " " }] });
    } else if (/^#{1,6} /.test(line)) {
      const level = Math.min(line.match(/^#+/)[0].length, 6);
      content.push({ type: "heading", attrs: { level }, content: inline(line.replace(/^#+ /, "")) });
    } else if (/^\s*[-*] /.test(line)) {
      const items = [];
      for (; i < lines.length && /^\s*[-*] /.test(lines[i]); i++) {
        items.push({ type: "listItem", content: [{ type: "paragraph", content: inline(lines[i].replace(/^\s*[-*] /, "")) }] });
      }
      i--;
      content.push({ type: "bulletList", content: items });
    } else if (line.trim()) {
      const para = [line];
      for (; i + 1 < lines.length && lines[i + 1].trim() && !/^(```|#{1,6} |\s*[-*] )/.test(lines[i + 1]); i++) para.push(lines[i + 1]);
      content.push({ type: "paragraph", content: inline(para.join(" ")) });
    }
  }
  return { type: "doc", version: 1, content: content.length ? content : [{ type: "paragraph", content: [{ type: "text", text: " " }] }] };
}

// ADF → plain text (enough to read a ticket).
function adfText(node) {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const inner = (node.content ?? []).map(adfText).join(node.type === "bulletList" || node.type === "orderedList" ? "" : "");
  if (["paragraph", "heading", "codeBlock"].includes(node.type)) return inner + "\n";
  if (node.type === "listItem") return "- " + inner;
  if (node.type === "hardBreak") return "\n";
  return inner;
}

const KEY_RE = new RegExp(`^${PROJECT}-\\d+$`);
function checkKey(key) {
  if (!KEY_RE.test(key ?? "")) {
    console.error(`Issue key must look like ${PROJECT}-123`);
    process.exit(2);
  }
  return key;
}

async function search(jql, max = 20) {
  const params = new URLSearchParams({ jql, maxResults: String(max), fields: "summary,status,issuetype,labels" });
  const data = await jira("GET", `/rest/api/3/search/jql?${params}`);
  const { base } = config();
  const issues = (data.issues ?? []).map((i) => ({
    key: i.key,
    type: i.fields.issuetype?.name,
    status: i.fields.status?.name,
    summary: i.fields.summary,
    url: `${base}/browse/${i.key}`
  }));
  console.log(JSON.stringify(issues, null, 2));
}

const [cmd, ...args] = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((a) => a !== "--dry-run");

if (cmd === "search") {
  await search(positional[0]);
} else if (cmd === "find-open") {
  const text = positional[0].replace(/["\\]/g, " ");
  await search(`project = ${PROJECT} AND statusCategory != Done AND text ~ "${text}" ORDER BY created DESC`);
} else if (cmd === "create-bug") {
  const bug = JSON.parse(readFileSync(positional[0], "utf8"));
  if (!bug.summary || !bug.description) throw new Error("bug.json needs summary and description");
  const fields = {
    project: { key: PROJECT },
    issuetype: { name: "Bug" },
    summary: bug.summary.slice(0, 250),
    description: toAdf(bug.description),
    labels: [...new Set([...(bug.labels ?? []), ...DEFAULT_LABELS])]
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, fields }, null, 2));
  } else {
    const created = await jira("POST", "/rest/api/3/issue", { fields });
    console.log(JSON.stringify({ key: created.key, url: `${config().base}/browse/${created.key}` }));
  }
} else if (cmd === "comment") {
  const [key, file] = positional;
  const body = { body: toAdf(readFileSync(file, "utf8")) };
  if (dryRun) console.log(JSON.stringify({ dryRun: true, key, body }, null, 2));
  else {
    await jira("POST", `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, body);
    console.log(JSON.stringify({ key, commented: true }));
  }
} else if (cmd === "get") {
  const key = checkKey(positional[0]);
  const i = await jira("GET", `/rest/api/3/issue/${key}?fields=summary,status,issuetype,labels,description,comment`);
  console.log(JSON.stringify({
    key: i.key,
    url: `${config().base}/browse/${i.key}`,
    type: i.fields.issuetype?.name,
    status: i.fields.status?.name,
    labels: i.fields.labels,
    summary: i.fields.summary,
    description: adfText(i.fields.description).trim(),
    comments: (i.fields.comment?.comments ?? []).map((c) => ({ author: c.author?.displayName, created: c.created, body: adfText(c.body).trim() }))
  }, null, 2));
} else if (cmd === "transition") {
  const key = checkKey(positional[0]);
  const target = (positional[1] ?? "").toLowerCase();
  const { transitions = [] } = await jira("GET", `/rest/api/3/issue/${key}/transitions`);
  const t = transitions.find((x) => x.name.toLowerCase() === target || x.to?.name?.toLowerCase() === target);
  if (!t) {
    console.error(`No transition to "${positional[1]}". Available: ${transitions.map((x) => x.to?.name ?? x.name).join(", ")}`);
    process.exit(1);
  }
  if (dryRun) console.log(JSON.stringify({ dryRun: true, key, transition: t.id, to: t.to?.name }));
  else {
    await jira("POST", `/rest/api/3/issue/${key}/transitions`, { transition: { id: t.id } });
    console.log(JSON.stringify({ key, status: t.to?.name ?? t.name }));
  }
} else {
  console.error("Usage: node scripts/jira.mjs search <JQL> | find-open <text> | create-bug <file> [--dry-run] | comment <KEY> <file> [--dry-run] | get <KEY> | transition <KEY> <status> [--dry-run]");
  process.exit(2);
}
