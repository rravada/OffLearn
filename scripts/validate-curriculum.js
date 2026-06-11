/**
 * Validates an AP/course module's curriculum against the OffLearn authoring standard.
 * Usage:  node scripts/validate-curriculum.js <subject-id>
 * Example: node scripts/validate-curriculum.js ap-calc-ab
 *
 * Checks every lesson, unit-review, course-final, and knowledge pack for the
 * subject, plus index.json wiring (assessments must be listed as lesson entries).
 * See the "course-module-authoring-standard" memory for the full standard.
 */
const fs = require("fs");
const path = require("path");

const subject = process.argv[2];
if (!subject) {
  console.error("Usage: node scripts/validate-curriculum.js <subject-id>");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const curDir = path.join(ROOT, "public", "curriculum", subject);
const packDir = path.join(ROOT, "public", "knowledge-packs", subject);
const indexPath = path.join(ROOT, "public", "curriculum", "index.json");

const REQUIRED_TYPES = [
  "explanation", "example", "steps", "quiz",
  "table", "callout", "keypoint", "deepdive",
];
const CALLOUT_VARIANTS = ["warning", "tip", "remember"];

let ok = true;
const fail = (msg) => { ok = false; console.log("  FAIL: " + msg); };
const warn = (msg) => { console.log("  warn: " + msg); };

const idx = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const subj = (idx.subjects || []).find((s) => s.id === subject);
if (!subj) { console.error(`Subject "${subject}" not found in index.json`); process.exit(1); }

let lessonCount = 0;

function checkLessonFile(file, label) {
  if (!fs.existsSync(file)) { fail(`${label}: file missing (${file})`); return; }
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const types = (d.sections || []).map((s) => s.type);
  const counts = {};
  types.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  const missing = REQUIRED_TYPES.filter((r) => !counts[r]);
  if (missing.length) fail(`${label}: missing section types [${missing}]`);
  if ((counts.quiz || 0) < 2) fail(`${label}: <2 quizzes`);
  if ((counts.callout || 0) < 2) fail(`${label}: <2 callouts`);
  if ((counts.table || 0) < 1) fail(`${label}: no table`);
  if (types.length < 10) fail(`${label}: only ${types.length} sections (need >=10)`);
  else if (types.length > 14) warn(`${label}: ${types.length} sections (target 13-14; more is OK if every section earns its place)`);
  d.sections.forEach((s, i) => {
    if (s.type === "quiz" && !(s.correctIndex >= 0 && s.correctIndex < s.options.length))
      fail(`${label}: quiz #${i} correctIndex out of range`);
    if (s.type === "callout" && !CALLOUT_VARIANTS.includes(s.variant))
      fail(`${label}: callout #${i} bad variant "${s.variant}"`);
  });
  for (let i = 1; i < types.length; i++)
    if (types[i] === "quiz" && types[i - 1] === "quiz") fail(`${label}: back-to-back quizzes at #${i}`);
  if (typeof d.aiContext !== "string" || d.aiContext.length < 40) fail(`${label}: weak/missing aiContext`);
}

function checkAssessment(file, label, expectType, expectQpa, minBank) {
  if (!fs.existsSync(file)) { fail(`${label}: file missing (${file})`); return; }
  const a = JSON.parse(fs.readFileSync(file, "utf8"));
  if (a.type !== expectType) fail(`${label}: type "${a.type}" (want ${expectType})`);
  if (a.questionsPerAttempt !== expectQpa) fail(`${label}: qpa ${a.questionsPerAttempt} (want ${expectQpa})`);
  if (!Array.isArray(a.bank) || a.bank.length < minBank) fail(`${label}: bank ${a.bank ? a.bank.length : 0} (want >=${minBank})`);
  (a.bank || []).forEach((q, i) => {
    if (!(q.correctIndex >= 0 && q.correctIndex < q.options.length))
      fail(`${label}: question #${i} correctIndex out of range`);
  });
}

function checkPack(lessonId) {
  const file = path.join(packDir, lessonId + ".json");
  if (!fs.existsSync(file)) { fail(`pack ${lessonId}: missing`); return; }
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(p.chunks) || p.chunks.length < 20) fail(`pack ${lessonId}: ${p.chunks ? p.chunks.length : 0} chunks (want >=20)`);
  if ((p.chunks || []).some((c) => !c.id || !c.text)) fail(`pack ${lessonId}: chunk missing id/text`);
}

console.log(`Validating subject: ${subject}\n`);
for (const u of subj.units || []) {
  const ids = (u.lessons || []).map((l) => l.id);
  for (const l of u.lessons || []) {
    if (l.id === "course-final") {
      checkAssessment(path.join(curDir, "course-final.json"), `${u.id}/course-final`, "course-final", 15, 40);
    } else if (l.id === "unit-review") {
      checkAssessment(path.join(curDir, u.id, "unit-review.json"), `${u.id}/unit-review`, "unit-review", 10, 25);
    } else {
      lessonCount++;
      checkLessonFile(path.join(curDir, u.id, l.id + ".json"), `${u.id}/${l.id}`);
      checkPack(l.id);
    }
  }
  // Every content unit should wire a unit-review entry into the index.
  const isContentUnit = (u.lessons || []).some((l) => !["unit-review", "course-final"].includes(l.id));
  if (isContentUnit && !ids.includes("unit-review"))
    fail(`${u.id}: no "unit-review" entry in index.json lessons (assessment won't appear in UI)`);
  console.log(`  ${u.id}: ${ (u.lessons||[]).length } entries`);
}

console.log(`\ncontent lessons: ${lessonCount}`);
console.log(ok ? "\n*** ALL CHECKS PASSED ***" : "\n*** SOME CHECKS FAILED ***");
process.exit(ok ? 0 : 1);
