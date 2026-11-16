import { describe, expect, it } from "vitest";
import { assessSpike, median } from "./spikes";

const h = (n: number) => new Date(Date.UTC(2026, 10, 16, n));

describe("assessSpike", () => {
  it("is quiet on a normal thread", () => {
    expect(assessSpike({ snapshots: [{ takenAt: h(0), numComments: 10 }, { takenAt: h(6), numComments: 16 }], firstSightRate: null, baselineRate: 1 }).spiking).toBe(false);
  });
  it("flags a burst of new comments between checks", () => {
    const r = assessSpike({ snapshots: [{ takenAt: h(0), numComments: 20 }, { takenAt: h(1), numComments: 80 }], firstSightRate: null, baselineRate: 1 });
    expect(r).toMatchObject({ spiking: true, reason: "+60 comments since the last check" });
  });
  it("flags a fast thread relative to the brand's baseline (first sight)", () => {
    // Real fixture case: r/cycling "400+ FTP" thread at 12.3 comments/hour.
    expect(assessSpike({ snapshots: [], firstSightRate: 12.3, baselineRate: 1.5 }).spiking).toBe(true);
  });
  it("needs both the absolute floor and the multiple", () => {
    expect(assessSpike({ snapshots: [], firstSightRate: 8, baselineRate: 1 }).spiking).toBe(false); // < 10/h
    expect(assessSpike({ snapshots: [], firstSightRate: 15, baselineRate: 6 }).spiking).toBe(false); // < 3× baseline
  });
  it("uses a floor for brands without history", () => {
    expect(assessSpike({ snapshots: [], firstSightRate: 10, baselineRate: 0 }).spiking).toBe(true);
  });
});

describe("median", () => {
  it("handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
