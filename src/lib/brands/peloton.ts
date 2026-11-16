// Seed config for the demo brand. Exclusions and blocked subreddits come
// straight from the false positives found in the real dataset.
// The voice guide is provisional until the client approves it.
export const PELOTON = {
  name: "Peloton",
  domain: "onepeloton.com",
  description:
    "Peloton Interactive: connected fitness company. Products: Peloton Bike, Bike+, Tread, Row, " +
    "Guide, the Peloton App (classes, instructors), All-Access and App memberships, accessories. " +
    "NOT the cycling term for the main group of riders in a race, and NOT the French/Spanish/Dutch word.",
  searchTerms: ["Peloton"],
  // Phrases that only appear when "peloton" means the group of riders or the foreign word.
  exclusionTerms: [
    "pelotón",
    "le peloton",
    "du peloton",
    "het peloton",
    "main peloton",
    "the peloton caught",
    "peloton of riders",
  ],
  // Subreddits where "peloton" almost never means the brand. r/peloton is pro road racing.
  blockedSubreddits: [
    "peloton",
    "cyclocross",
    "belgium2",
    "saintbarthelemy",
    "bf6",
    "warhammer40kesp",
    "grayzonewarfare",
  ],
  // Communities about the brand: every post there is on-topic, even without the word.
  brandSubreddits: ["pelotoncycle", "onepelotonrealsub"],
  supportUrl: "https://support.onepeloton.com",
};
