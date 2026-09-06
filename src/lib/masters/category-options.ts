export type ExistingCategoryOption = { id: string; code: string };

export type IncomingCategoryOption = { id?: string; code: string };

export type CategoryOptionSyncPlan = {
  updates: { id: string; incomingIndex: number }[];
  creates: number[];
  removeIds: string[];
};

/**
 * Match submitted dropdown options to existing rows by id, then by code.
 * Unmatched existing rows are candidates for delete (caller must skip in-use FKs).
 */
export function planCategoryOptionSync(
  existing: ExistingCategoryOption[],
  incoming: IncomingCategoryOption[],
): CategoryOptionSyncPlan {
  const remaining = [...existing];
  const updates: { id: string; incomingIndex: number }[] = [];
  const creates: number[] = [];

  for (const [incomingIndex, row] of incoming.entries()) {
    const code = row.code.trim().toUpperCase();
    let matchIndex = row.id ? remaining.findIndex((item) => item.id === row.id) : -1;
    if (matchIndex < 0 && code) {
      matchIndex = remaining.findIndex((item) => item.code.toUpperCase() === code);
    }
    if (matchIndex >= 0) {
      updates.push({ id: remaining[matchIndex]!.id, incomingIndex });
      remaining.splice(matchIndex, 1);
    } else {
      creates.push(incomingIndex);
    }
  }

  return { updates, creates, removeIds: remaining.map((item) => item.id) };
}
