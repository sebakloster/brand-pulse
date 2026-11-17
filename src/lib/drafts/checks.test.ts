import { describe, expect, it } from "vitest";
import { checkDraft, tidyReply, worstLevel, type CheckContext } from "./checks";

const ctx: CheckContext = { brandName: "Peloton", allowedHosts: ["support.onepeloton.com", "onepeloton.com"], threadFlags: [] };
const level = (text: string, id: string, c = ctx) => checkDraft(text, c).find((x) => x.id === id)?.level;

const GOOD = "That's a long wait, sorry you've had to chase it. Can you DM us your case number so we can look into it?";

describe("checkDraft", () => {
  it("passes a good reply", () => {
    expect(worstLevel(checkDraft(GOOD, ctx))).toBe("pass");
  });
  it("fails promises, health advice, marketing and requests for passwords", () => {
    expect(level("We guarantee a new screen by Friday.", "promises")).toBe("fail");
    expect(level("Try a lower resistance to protect your knee pain.", "medical")).toBe("fail");
    expect(level("Check out our Black Friday deal!", "marketing")).toBe("fail");
    expect(level("Please reply with your password and we'll check.", "sensitive")).toBe("fail");
  });
  it("doesn't treat a negated promise as a promise", () => {
    expect(level("We'll pass it on, though I can't promise a timeline from here.", "promises")).toBe("pass");
    expect(level("There's no refund yet, but DM us.", "promises")).toBe("pass");
    expect(level("We promise it'll be fixed.", "promises")).toBe("fail");
  });
  it("allows the official support link but not others", () => {
    expect(level("See support.onepeloton.com for steps.", "links")).toBe("pass");
    expect(level("Try pelowrapped.com instead.", "links")).toBe("fail");
  });
  it("warns on corporate or AI tone, emoji, signatures and placeholders", () => {
    expect(level("We apologize for any inconvenience.", "corporate")).toBe("warn");
    expect(level("I understand your frustration, rest assured we're on it.", "ai_tone")).toBe("warn");
    expect(level("Great!! 🎉", "calm")).toBe("warn");
    expect(level("Sorry about that. — Sam, Peloton team", "signoff")).toBe("warn");
    expect(level("Sorry about that.", "signoff")).toBeUndefined();
    expect(level("DM us your [order number].", "placeholders")).toBe("warn");
  });
  it("fails replies that are too long", () => {
    expect(level("a".repeat(650), "length")).toBe("fail");
  });
  it("flags threads about named staff", () => {
    expect(level(GOOD, "staff", { ...ctx, threadFlags: ["named_staff"] })).toBe("warn");
  });
  it("flags blaming partners but not neutral mentions (real false positive: 'the Garmin issue')", () => {
    expect(level("Could you DM us so we can look at the Garmin issue again?", "blame")).toBe("pass");
    expect(level("This is caused by Apple, not us.", "blame")).toBe("warn");
    expect(level("Sounds like it's Garmin's fault.", "blame")).toBe("warn");
  });
});

describe("tidyReply", () => {
  it("drops sign-offs and em dashes", () => {
    expect(tidyReply("Sorry about that. DM us your case number?\n\n— Sam, Peloton team", "Peloton")).toBe("Sorry about that. DM us your case number?");
    expect(tidyReply("Sorry about that. — [first name], Peloton team", "Peloton")).toBe("Sorry about that.");
    expect(tidyReply("Good catch — that's a bug.", "Peloton")).toBe("Good catch, that's a bug.");
    expect(tidyReply("Ask the Peloton team on the forum.", "Peloton")).toBe("Ask the Peloton team on the forum.");
  });
});
