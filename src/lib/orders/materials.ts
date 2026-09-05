/**
 * Order-line material usage helpers.
 * Total needed = quantityPerUnit × lineQuantity.
 * Used = sum over linked stages of (stageCumulative × quantityPerUnit).
 * Available = quantityReceived − used.
 */

export type MaterialUsageInput = {
  name: string;
  quantityPerUnit: number;
  quantityReceived: number;
  lineQuantity: number;
  /** Cumulative completed qty for each linked order-process stage. */
  stageCumulatives: number[];
};

export type MaterialUsage = {
  name: string;
  quantityPerUnit: number;
  quantityReceived: number;
  totalNeeded: number;
  used: number;
  available: number;
  remainingToReceive: number;
  isShort: boolean;
  warning: string | null;
};

export function evaluateMaterialUsage(input: MaterialUsageInput): MaterialUsage {
  const totalNeeded = input.quantityPerUnit * input.lineQuantity;
  const used = input.stageCumulatives.reduce(
    (sum, cumulative) => sum + Math.max(0, cumulative) * input.quantityPerUnit,
    0,
  );
  const available = input.quantityReceived - used;
  const remainingToReceive = Math.max(0, totalNeeded - input.quantityReceived);
  const isShort = available < 0 || input.quantityReceived < totalNeeded;
  let warning: string | null = null;
  if (available < 0) {
    warning = `${input.name}: used ${used} exceeds received ${input.quantityReceived} (short by ${Math.abs(available)}).`;
  } else if (input.quantityReceived < totalNeeded) {
    warning = `${input.name}: received ${input.quantityReceived} of ${totalNeeded} needed (${remainingToReceive} still required).`;
  }
  return {
    name: input.name,
    quantityPerUnit: input.quantityPerUnit,
    quantityReceived: input.quantityReceived,
    totalNeeded,
    used,
    available,
    remainingToReceive,
    isShort,
    warning,
  };
}
