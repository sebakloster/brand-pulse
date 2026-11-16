// Spike detection in plain code. The AI only explains; code decides.
export const SPIKE = {
  minRate: 10, // comments/hour, absolute floor
  baselineMultiple: 3, // × the brand's median comments/hour
  burstComments: 30, // or this many new comments since the previous snapshot
  baselineFloor: 1, // a new brand with no history: median treated as at least 1/h
  windowHours: 72, // only threads younger than this can spike
  negativeShare: 0.5, // ≥ half of triaged mentions negative → negative spike (P0)
};

export type Snap = { takenAt: Date; numComments: number | null };

export type SpikeInput = {
  snapshots: Snap[]; // oldest → newest
  firstSightRate: number | null; // the scraper's comments/hour when we first saw the post
  baselineRate: number; // brand median comments/hour
};

export type SpikeResult = { spiking: boolean; rate: number | null; reason: string | null };

export function assessSpike({ snapshots, firstSightRate, baselineRate }: SpikeInput): SpikeResult {
  const baseline = Math.max(SPIKE.baselineFloor, baselineRate);
  const [prev, last] = snapshots.slice(-2);
  let rate: number | null = null;
  let burst = 0;
  if (prev && last && last.takenAt > prev.takenAt && prev.numComments != null && last.numComments != null) {
    const hours = (last.takenAt.getTime() - prev.takenAt.getTime()) / 3_600_000;
    burst = last.numComments - prev.numComments;
    rate = burst / Math.max(hours, 0.25); // avoid dividing by tiny gaps
  } else if (firstSightRate != null) {
    rate = firstSightRate;
  }
  if (burst >= SPIKE.burstComments) {
    return { spiking: true, rate, reason: `+${burst} comments since the last check` };
  }
  if (rate != null && rate >= SPIKE.minRate && rate >= SPIKE.baselineMultiple * baseline) {
    return { spiking: true, rate, reason: `${rate.toFixed(1)} comments/hour, ${(rate / baseline).toFixed(0)}× the usual ${baseline.toFixed(1)}/hour` };
  }
  return { spiking: false, rate, reason: null };
}

export function median(xs: number[]) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
