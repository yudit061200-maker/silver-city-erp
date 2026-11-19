import { RecordRow } from '../types';

const compactAlnum = (str: string): string =>
  str.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Checks whether a single text value matches a search token.
 * Supports partial character substring matching and separator-insensitive matching
 * (e.g., "320044" matches "32.0044", "1r07" matches "1R-0749").
 */
export const fieldMatchesToken = (fieldValue: unknown, rawToken: string): boolean => {
  if (fieldValue === undefined || fieldValue === null) return false;
  const text = String(fieldValue).toLowerCase();
  if (!text) return false;

  const token = rawToken.toLowerCase();
  if (text.includes(token)) return true;

  const compactToken = compactAlnum(token);
  if (compactToken.length >= 2) {
    return compactAlnum(text).includes(compactToken);
  }
  return false;
};

/**
 * Multi-token partial-character search across specified columns.
 * Every whitespace-separated token must match at least one column.
 */
export const matchesSearchQuery = (
  row: RecordRow,
  query: string,
  columns: string[]
): boolean => {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  return tokens.every(token =>
    columns.some(col => fieldMatchesToken(row[col], token))
  );
};

/**
 * Ranks and returns items matching a partial-character query (prefix matches first).
 */
export const findMatchingItems = (
  items: RecordRow[],
  query: string,
  limit = 8
): RecordRow[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const qLower = trimmed.toLowerCase();
  const qCompact = compactAlnum(trimmed);
  const searchCols = ['ItemID', 'ItemName', 'Category', 'Location'];

  const matched = items.filter(item => matchesSearchQuery(item, trimmed, searchCols));

  matched.sort((a, b) => {
    const idA = String(a.ItemID || '').toLowerCase();
    const idB = String(b.ItemID || '').toLowerCase();
    const nameA = String(a.ItemName || '').toLowerCase();
    const nameB = String(b.ItemName || '').toLowerCase();

    const score = (id: string, name: string) => {
      if (id === qLower || (qCompact && compactAlnum(id) === qCompact)) return 0;
      if (id.startsWith(qLower) || (qCompact && compactAlnum(id).startsWith(qCompact))) return 1;
      if (name.startsWith(qLower)) return 2;
      if (id.includes(qLower)) return 3;
      if (name.includes(qLower)) return 4;
      return 5;
    };

    return score(idA, nameA) - score(idB, nameB);
  });

  return matched.slice(0, limit);
};
