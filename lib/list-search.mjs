function collapseWhitespace(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeSearchText(value) {
  return collapseWhitespace(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

export function sanitizeListSearchQuery(value) {
  return collapseWhitespace(value);
}

export function matchesListSearch(query, values) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystack = values.map((value) => normalizeSearchText(value)).join(" ");
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  return tokens.every((token) => haystack.includes(token));
}

export function buildSqlContainsPattern(query) {
  const sanitized = sanitizeListSearchQuery(query);

  if (!sanitized) {
    return null;
  }

  const escaped = sanitized.replace(/[\\%_]/g, "\\$&");
  return `%${escaped}%`;
}
