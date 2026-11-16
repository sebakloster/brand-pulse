import { describe, expect, it } from "vitest";
import { checkDraft, worstLevel, type CheckContext } from "./checks";

const ctx: CheckContext = { brandName: "Peloton", allowedHosts: ["support.onepeloton.com", "onepeloton.com"], threadFlags: [] };
const level = (text: string, id: string, c = ctx) => checkDraft(text, c).find((x) => x.id === id)?.level;

const GOOD = "That's a long wait, sorry you've had to chase it. Can you DM us your case number so we can look into it? — [first name], Peloton team";

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
  it("allows the official support link but not others", () => {
    expect(level("See support.onepeloton.com for steps.", "links")).toBe("pass");
    expect(level("Try pelowrapped.com instead.", "links")).toBe("fail");
  });
  it("warns on corporate tone, emoji, missing sign-off and placeholders", () => {
    expect(level("We apologize for any inconvenience.", "corporate")).toBe("warn");
    expect(level("Great!! 🎉", "calm")).toBe("warn");
    expect(level("Sorry about that.", "signoff")).toBe("warn");
    expect(level("DM us your [order number]. — [first name], Peloton team", "placeholders")).toBe("warn");
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
