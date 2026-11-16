import { describe, expect, it } from "vitest";
import { cleanText } from "./clean";

describe("cleanText (real artifacts from the fixture run)", () => {
  it.each([
    ["Owner recommends Peloton Tread as reliable. Limited context.}\"}],", "Owner recommends Peloton Tread as reliable. Limited context."],
    ["Resolvable bug in brand community. Limited context: no reply visible.}])</br>Wait, correcting output below.</br>{",
      "Resolvable bug in brand community. Limited context: no reply visible."],
    ["Positive chatter, no problem for the brand to address.}", "Positive chatter, no problem for the brand to address."],
  ])("repairs %s", (input, expected) => {
    expect(cleanText(input)).toEqual({ text: expected, repaired: true });
  });

  it("leaves clean text alone", () => {
    expect(cleanText("Bike screen failing since April; support delaying replacement."))
      .toEqual({ text: "Bike screen failing since April; support delaying replacement.", repaired: false });
  });
});
