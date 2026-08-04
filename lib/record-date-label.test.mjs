import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRecordDateLabel } from "./record-date-label.mjs";

test("formats record dates with a full Spanish month name", () => {
  assert.equal(
    formatRecordDateLabel("2026-08-04T18:00:00.000Z"),
    "4 de agosto",
  );
});

test("returns the fallback for invalid record dates", () => {
  assert.equal(formatRecordDateLabel("not-a-date"), "Sin fecha");
});
