import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "@/lib/money/goal-allocation";
import type { Goal, GoalAccount } from "@/lib/money/database.types";

const uid = "00000000-0000-0000-0000-000000000001";

function goal(id: string, name: string, linkedAccountId: string | null): Goal {
  return {
    id,
    user_id: uid,
    name,
    target_amount: null,
    target_date: null,
    linked_account_id: linkedAccountId,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

function goalAccount(
  id: string,
  goalId: string,
  accountId: string,
  allocatedAmount: number | null
): GoalAccount {
  return {
    id,
    user_id: uid,
    goal_id: goalId,
    account_id: accountId,
    allocated_amount: allocatedAmount,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("computeGoalProgress", () => {
  it("falls back to linked_account_id when no goal-account rows exist", () => {
    const goals = [goal("g1", "Emergency", "a1")];
    const result = computeGoalProgress(goals, [], { a1: 15000 });
    expect(result.goalCurrentById.g1).toBe(15000);
  });

  it("splits account balance equally across shared goals when allocations are blank", () => {
    const goals = [goal("g1", "Emergency", null), goal("g2", "Car", null)];
    const links = [
      goalAccount("ga1", "g1", "a1", null),
      goalAccount("ga2", "g2", "a1", null),
    ];
    const result = computeGoalProgress(goals, links, { a1: 15000 });
    expect(result.goalCurrentById.g1).toBeCloseTo(7500, 6);
    expect(result.goalCurrentById.g2).toBeCloseTo(7500, 6);
  });

  it("honors explicit allocations and leaves remaining balance for blank links", () => {
    const goals = [goal("g1", "Emergency", null), goal("g2", "Car", null), goal("g3", "Trip", null)];
    const links = [
      goalAccount("ga1", "g1", "a1", 10000),
      goalAccount("ga2", "g2", "a1", 5000),
      goalAccount("ga3", "g3", "a1", null),
    ];
    const result = computeGoalProgress(goals, links, { a1: 18000 });
    expect(result.goalCurrentById.g1).toBeCloseTo(10000, 6);
    expect(result.goalCurrentById.g2).toBeCloseTo(5000, 6);
    expect(result.goalCurrentById.g3).toBeCloseTo(3000, 6);
  });

  it("scales explicit allocations when explicit total exceeds account balance", () => {
    const goals = [goal("g1", "Emergency", null), goal("g2", "Car", null)];
    const links = [
      goalAccount("ga1", "g1", "a1", 10000),
      goalAccount("ga2", "g2", "a1", 5000),
    ];
    const result = computeGoalProgress(goals, links, { a1: 12000 });
    expect(result.goalCurrentById.g1).toBeCloseTo(8000, 6);
    expect(result.goalCurrentById.g2).toBeCloseTo(4000, 6);
  });

  it("never exceeds an account balance across all goals sharing that account", () => {
    const goals = [goal("g1", "Emergency", null), goal("g2", "Car", null), goal("g3", "Home", null)];
    const links = [
      goalAccount("ga1", "g1", "a1", 9000),
      goalAccount("ga2", "g2", "a1", 9000),
      goalAccount("ga3", "g3", "a1", null),
    ];
    const result = computeGoalProgress(goals, links, { a1: 10000 });
    const totalAcrossGoals = result.goalCurrentById.g1 + result.goalCurrentById.g2 + result.goalCurrentById.g3;
    expect(totalAcrossGoals).toBeCloseTo(10000, 6);
  });
});
