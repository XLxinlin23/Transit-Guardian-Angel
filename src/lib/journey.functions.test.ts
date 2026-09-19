import { describe, expect, it } from "vitest";

import { rankCandidates, type JourneyCandidate } from "./journey.functions";

function candidate(id: string, metres: number, walkingMinutes: number, duration: number): JourneyCandidate {
  return {
    id,
    legs: [],
    totalDurationMinutes: duration,
    totalWalkingDistanceMetres: metres,
    totalWalkingTimeMinutes: walkingMinutes,
    fare: 1.5,
    numberOfTransfers: 1,
    signature: id,
  };
}

describe("least-walking ranking", () => {
  it("uses walking distance rather than walking time", () => {
    const shorterTimeButFarther = candidate("farther", 900, 8, 40);
    const longerTimeButNearer = candidate("nearer", 700, 14, 50);

    expect(rankCandidates([shorterTimeButFarther, longerTimeButNearer], "walking")[0]?.id).toBe("nearer");
  });

  it("uses duration only when walking distances are equal", () => {
    const slower = candidate("slower", 700, 10, 50);
    const faster = candidate("faster", 700, 12, 40);

    expect(rankCandidates([slower, faster], "walking")[0]?.id).toBe("faster");
  });
});