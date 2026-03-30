import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSqlContainsPattern,
  matchesListSearch,
  sanitizeListSearchQuery,
} from "./list-search.mjs";

test("sanitizeListSearchQuery trims and collapses whitespace", () => {
  assert.equal(sanitizeListSearchQuery("  Mega   tienda   norte "), "Mega tienda norte");
  assert.equal(sanitizeListSearchQuery(""), "");
  assert.equal(sanitizeListSearchQuery(null), "");
});

test("matchesListSearch ignores accents and checks all tokens", () => {
  assert.equal(
    matchesListSearch("tienda san jose", ["Tienda San José", "Pendiente"]),
    true,
  );
  assert.equal(
    matchesListSearch("registro sur", ["Tienda Norte", "Registro 44"]),
    false,
  );
});

test("buildSqlContainsPattern escapes wildcard characters", () => {
  assert.equal(buildSqlContainsPattern("  50%_off  "), "%50\\%\\_off%");
  assert.equal(buildSqlContainsPattern("   "), null);
});
