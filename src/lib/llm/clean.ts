// Structured outputs guarantee valid JSON, not clean text inside a string field.
// In the fixture run, 23 of ~460 triage reasons ended in leaked fragments like
// `.}"}],` or `</br>Wait, correcting output below.`; clean every free-text
// field before storing it.
const CUT_AT = [
  /[{}[\]]/, // JSON fragments
  /<\/?[a-z][^>]*>/i, // markup
  /\b(wait,|correcting output|let me (fix|correct)|actually, let me)/i, // self-corrections
];

export function cleanText(s: string, max = 300): { text: string; repaired: boolean } {
  let out = s;
  for (const re of CUT_AT) {
    const m = out.match(re);
    if (m?.index != null) out = out.slice(0, m.index);
  }
  out = out.replace(/["'\s,;:]+$/, "").trim();
  if (out && !/[.!?]$/.test(out) && out.length < s.trim().length) out += ".";
  if (out.length > max) out = `${out.slice(0, max - 1).trimEnd()}…`;
  return { text: out, repaired: out !== s.trim() };
}
