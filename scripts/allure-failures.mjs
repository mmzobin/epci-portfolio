#!/usr/bin/env node
// Summarise failed/broken tests from an allure-results directory as compact JSON,
// so an agent can triage a regression without reading hundreds of raw result files.
//
// Usage: node scripts/allure-failures.mjs [allure-results-dir]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "allure-results";
const files = readdirSync(dir).filter((f) => f.endsWith("-result.json"));

// One logical test can have several result files (retries). Keep the latest attempt,
// but remember whether an earlier attempt passed -> that's a flaky signal.
const byTest = new Map();
for (const file of files) {
  const r = JSON.parse(readFileSync(join(dir, file), "utf8"));
  const key = r.historyId ?? r.fullName ?? r.name;
  const entry = byTest.get(key) ?? { attempts: [] };
  entry.attempts.push(r);
  byTest.set(key, entry);
}

const label = (r, name) => r.labels?.find((l) => l.name === name)?.value;
const failures = [];
let passed = 0;

for (const { attempts } of byTest.values()) {
  attempts.sort((a, b) => (a.stop ?? 0) - (b.stop ?? 0));
  const last = attempts.at(-1);
  if (last.status === "passed") {
    passed++;
    if (attempts.some((a) => a.status !== "passed")) {
      failures.push({ ...summarise(last), status: "flaky-passed-on-retry", attempts: attempts.length });
    }
    continue;
  }
  if (last.status === "failed" || last.status === "broken") {
    failures.push({ ...summarise(last), attempts: attempts.length });
  }
}

function summarise(r) {
  const failedStep = findFailedStep(r.steps ?? []);
  return {
    name: r.name,
    file: label(r, "package") ?? label(r, "suite"),
    fullName: r.fullName,
    status: r.status,
    message: (r.statusDetails?.message ?? "").split("\n").slice(0, 6).join("\n"),
    trace: (r.statusDetails?.trace ?? "").split("\n").filter((l) => l.includes("tests/")).slice(0, 4),
    failedStep,
    durationMs: r.stop && r.start ? r.stop - r.start : undefined,
    attachments: (r.attachments ?? []).map((a) => `${a.name}: ${a.source}`)
  };
}

function findFailedStep(steps) {
  for (const s of steps) {
    if (s.status && s.status !== "passed") return findFailedStep(s.steps ?? []) ?? s.name;
  }
  return undefined;
}

console.log(
  JSON.stringify({ total: byTest.size, passed, failedOrFlaky: failures.length, failures }, null, 2)
);
