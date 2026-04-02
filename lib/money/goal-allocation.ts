import type { Goal, GoalAccount } from "./database.types";

interface NormalizedGoalAccountLink {
  goal_id: string;
  account_id: string;
  allocated_amount: number | null;
}

export interface GoalProgressResult {
  goalCurrentById: Record<string, number>;
  goalAccountIdsByGoalId: Record<string, string[]>;
  goalAccountCurrentByGoalId: Record<string, Record<string, number>>;
}

function sanitizeAllocatedAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function normalizeGoalAccountLinks(goals: Goal[], goalAccounts: GoalAccount[]): NormalizedGoalAccountLink[] {
  const linkByKey = new Map<string, NormalizedGoalAccountLink>();
  const goalsWithLinks = new Set<string>();

  for (const link of goalAccounts) {
    if (!link.goal_id || !link.account_id) continue;
    goalsWithLinks.add(link.goal_id);
    const key = `${link.goal_id}::${link.account_id}`;
    const normalizedAmount = sanitizeAllocatedAmount(link.allocated_amount);
    const existing = linkByKey.get(key);
    if (!existing) {
      linkByKey.set(key, {
        goal_id: link.goal_id,
        account_id: link.account_id,
        allocated_amount: normalizedAmount,
      });
      continue;
    }
    if (existing.allocated_amount === null && normalizedAmount !== null) {
      linkByKey.set(key, { ...existing, allocated_amount: normalizedAmount });
    }
  }

  for (const goal of goals) {
    if (goalsWithLinks.has(goal.id) || !goal.linked_account_id) continue;
    const key = `${goal.id}::${goal.linked_account_id}`;
    if (!linkByKey.has(key)) {
      linkByKey.set(key, {
        goal_id: goal.id,
        account_id: goal.linked_account_id,
        allocated_amount: null,
      });
    }
  }

  return Array.from(linkByKey.values());
}

export function computeGoalProgress(
  goals: Goal[],
  goalAccounts: GoalAccount[],
  balances: Record<string, number>
): GoalProgressResult {
  const normalizedLinks = normalizeGoalAccountLinks(goals, goalAccounts);
  const goalCurrentById: Record<string, number> = {};
  const goalAccountIdsByGoalId: Record<string, string[]> = {};
  const goalAccountCurrentByGoalId: Record<string, Record<string, number>> = {};
  const linksByAccountId = new Map<string, NormalizedGoalAccountLink[]>();

  for (const goal of goals) {
    goalCurrentById[goal.id] = 0;
  }

  const addContribution = (goalId: string, accountId: string, amount: number) => {
    if (!goalAccountCurrentByGoalId[goalId]) {
      goalAccountCurrentByGoalId[goalId] = {};
    }
    goalAccountCurrentByGoalId[goalId][accountId] =
      (goalAccountCurrentByGoalId[goalId][accountId] ?? 0) + amount;
    goalCurrentById[goalId] = (goalCurrentById[goalId] ?? 0) + amount;
  };

  for (const link of normalizedLinks) {
    if (!goalAccountIdsByGoalId[link.goal_id]) {
      goalAccountIdsByGoalId[link.goal_id] = [];
    }
    if (!goalAccountIdsByGoalId[link.goal_id].includes(link.account_id)) {
      goalAccountIdsByGoalId[link.goal_id].push(link.account_id);
    }
    if (!linksByAccountId.has(link.account_id)) {
      linksByAccountId.set(link.account_id, []);
    }
    linksByAccountId.get(link.account_id)!.push(link);
  }

  for (const [accountId, links] of linksByAccountId.entries()) {
    const accountBalance = Math.max(0, balances[accountId] ?? 0);
    const explicitLinks = links.filter((link) => link.allocated_amount !== null);
    const implicitLinks = links.filter((link) => link.allocated_amount === null);
    const explicitTotal = explicitLinks.reduce(
      (sum, link) => sum + (link.allocated_amount ?? 0),
      0
    );
    const scale = explicitTotal > 0 && explicitTotal > accountBalance
      ? accountBalance / explicitTotal
      : 1;

    let allocatedExplicitTotal = 0;
    for (const link of explicitLinks) {
      const allocated = (link.allocated_amount ?? 0) * scale;
      allocatedExplicitTotal += allocated;
      addContribution(link.goal_id, accountId, allocated);
    }

    const remaining = Math.max(0, accountBalance - allocatedExplicitTotal);
    const implicitShare = implicitLinks.length > 0 ? remaining / implicitLinks.length : 0;
    for (const link of implicitLinks) {
      addContribution(link.goal_id, accountId, implicitShare);
    }
  }

  return {
    goalCurrentById,
    goalAccountIdsByGoalId,
    goalAccountCurrentByGoalId,
  };
}
