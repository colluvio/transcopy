const test = require("node:test");
const assert = require("node:assert/strict");
const { parseTimestamp, formatTimestamp } = require("../extension/content/timestamps.js");
const { normalizeText, formatTranscript, formatWithDetails } = require("../extension/content/format.js");

test("parseTimestamp reads m:ss and h:mm:ss labels", () => {
  assert.equal(parseTimestamp("0:00"), 0);
  assert.equal(parseTimestamp("0:07"), 7);
  assert.equal(parseTimestamp("1:08"), 68);
  assert.equal(parseTimestamp("13:29"), 809);
  assert.equal(parseTimestamp(" 1:02:03 \n"), 3723);
  assert.equal(parseTimestamp("120:00"), 7200);
});

test("parseTimestamp rejects anything that is not a plain timestamp", () => {
  for (const bad of ["", "1", "1:8:", "1:60", "a:bc", "1 minute, 8 seconds", "1:081 minute", null, undefined, 68]) {
    assert.equal(parseTimestamp(bad), null, String(bad));
  }
});

test("formatTimestamp pads to MM:SS or HH:MM:SS", () => {
  assert.equal(formatTimestamp(0, false), "00:00");
  assert.equal(formatTimestamp(7, false), "00:07");
  assert.equal(formatTimestamp(809, false), "13:29");
  assert.equal(formatTimestamp(7, true), "00:00:07");
  assert.equal(formatTimestamp(3723, true), "01:02:03");
  // Never drops the hour when called without it.
  assert.equal(formatTimestamp(3723, false), "62:03");
});

test("normalizeText collapses whitespace but keeps words, punctuation and Unicode", () => {
  assert.equal(normalizeText("  So this is\na model that's\t fine. "), "So this is a model that's fine.");
  assert.equal(normalizeText("¡Gracias! Ça va — 日本語 & “quotes”"), "¡Gracias! Ça va — 日本語 & “quotes”");
  assert.equal(normalizeText(undefined), "");
});

const SEGMENTS = [
  { timestamp: "0:00", text: "All right. Today we start." },
  { timestamp: "0:07", text: "So this is\nthe second line." },
  { timestamp: "1:08", text: "[Music]" },
  { timestamp: "1:08", text: "[Music]" },
  { timestamp: "13:29", text: "  " },
];

test("text-only output: one segment per line, repeats kept, empty segments dropped", () => {
  assert.equal(
    formatTranscript(SEGMENTS),
    "All right. Today we start.\nSo this is the second line.\n[Music]\n[Music]"
  );
});

test("timestamped output uses [MM:SS] under an hour", () => {
  assert.equal(
    formatTranscript(SEGMENTS, { timestamps: true }),
    "[00:00] All right. Today we start.\n[00:07] So this is the second line.\n[01:08] [Music]\n[01:08] [Music]"
  );
});

test("timestamped output switches every line to [HH:MM:SS] for long videos", () => {
  const out = formatTranscript(
    [
      { timestamp: "0:02", text: "Start" },
      { timestamp: "59:58", text: "Middle" },
      { timestamp: "1:02:03", text: "End" },
    ],
    { timestamps: true }
  );
  assert.equal(out, "[00:00:02] Start\n[00:59:58] Middle\n[01:02:03] End");
});

test("unknown timestamp labels are kept as shown, missing ones omitted", () => {
  const out = formatTranscript(
    [
      { timestamp: "LIVE", text: "One" },
      { timestamp: "", text: "Two" },
    ],
    { timestamps: true }
  );
  assert.equal(out, "[LIVE] One\nTwo");
});

test("formats a long transcript quickly", () => {
  const many = Array.from({ length: 20000 }, (_, i) => ({
    timestamp: formatTimestamp(i * 3, i * 3 >= 3600).replace(/^0/, ""),
    text: `Line ${i}`,
  }));
  const started = Date.now();
  const out = formatTranscript(many, { timestamps: true });
  assert.equal(out.split("\n").length, 20000);
  assert.ok(Date.now() - started < 1000);
});

test("details header lists known fields, then the transcript", () => {
  const details = {
    title: "4 inversiones que resisten las crisis",
    url: "https://www.youtube.com/watch?v=abc",
    channel: "Canal\nde prueba",
    published: "2026-10-01",
  };
  assert.equal(
    formatWithDetails(details, "[00:00] Hola"),
    "Title: 4 inversiones que resisten las crisis\nURL: https://www.youtube.com/watch?v=abc\nChannel: Canal de prueba\nPublished: 2026-10-01\n\nTranscript:\n[00:00] Hola"
  );
});

test("details header leaves out unknown fields", () => {
  assert.equal(
    formatWithDetails({ title: null, url: "https://www.youtube.com/watch?v=abc", channel: " ", published: undefined }, "Hola"),
    "URL: https://www.youtube.com/watch?v=abc\n\nTranscript:\nHola"
  );
});
