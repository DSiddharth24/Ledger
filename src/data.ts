/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const WORDS_POOL = [
  // Vintage Ledger & Typewriter Theme Words
  "ledger", "typewriter", "ribbon", "ink", "brass", "paper", "stamp", "record",
  "balance", "entry", "credit", "debit", "account", "audit", "journal", "document",
  "office", "clerk", "signature", "column", "number", "sum", "total", "page",
  "date", "year", "month", "time", "clock", "letter", "note", "key", "press",
  "strike", "sound", "bell", "metal", "iron", "steel", "gold", "silver", "seal",
  "archive", "receipt", "ledgerbook", "wax", "copper", "ribbonred", "sageink", "ivory",

  // Common Typing Words
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it", "for", "not",
  "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from",
  "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all",
  "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "no", "just", "him", "know",
  "take", "people", "into", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first", "well", "way",
  "even", "new", "want", "because", "any", "these", "give", "day", "most", "us",
  "here", "such", "our", "take", "right", "state", "point", "home", "hand", "port",
  "large", "small", "word", "line", "read", "write", "print", "sheet", "record",
  "bind", "hold", "draw", "mark", "sign", "view", "mind", "think", "trust", "fact",
  "form", "turn", "case", "system", "file", "index", "draft", "book", "bound",
  "cover", "gilt", "thread", "spine", "margin", "rule", "line", "space", "count",
  "value", "rate", "cost", "price", "wage", "coin", "note", "bill", "cash", "bank"
];

// Generates a random sequence of words totaling around 60-80 words to give the user plenty to type.
export function generateTestPassage(count = 60): string {
  const passage: string[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * WORDS_POOL.length);
    passage.push(WORDS_POOL[randomIndex]);
  }
  return passage.join(" ");
}
