import type { OrganizationSettings } from "@/lib/organization-settings";
import { utcDayDiff } from "@/lib/production/dates";
import { addUtcDays } from "@/lib/orders/date-rules";
import type { IncrementalEntry, ProcessSnapshot } from "@/lib/production/validate";

export type StartStatus = "NOT_STARTED" | "START_WARNING" | "START_DELAYED" | "NOT_APPLICABLE";
export type TimingStatus = "ON_TIME" | "GETTING_DELAYED" | "DELAYED" | "NOT_APPLICABLE";
export type DisplayStatus =
  | "ON_TIME"
  | "GETTING_DELAYED"
  | "DELAYED"
  | "NOT_STARTED"
  | "START_WARNING"
  | "START_DELAYED"
  | "COMPLETED"
  | "CANCELLED"
  | "ON_HOLD";

export type StageState = ProcessSnapshot & {
  cumulative: number;
  remaining: number;
  percentComplete: number;
};

export type OrderEvaluation = {
  stages: StageState[];
  currentStageName: string | null;
  currentStageComplete: boolean;
  completedQuantity: number;
  remainingQuantity: number;
  progressPercent: number;
  productionStarted: boolean;
  derivedLifecycle: "NOT_STARTED" | "IN_PRODUCTION" | "COMPLETED";
  startStatus: StartStatus;
  timingStatus: TimingStatus;
  displayStatus: DisplayStatus;
  productionRatePerDay: number | null;
  estimatedCompletionDate: Date | null;
};

/**
 * Overall progress = last-stage cumulative / order quantity.
 * This is finished-goods progress, not an average of stage percentages.
 */
export function evaluateOrder(input: {
  orderQuantity: number;
  effectiveStartDate: Date;
  resolvedDueDate: Date;
  lifecycleStatus: string;
  processes: ProcessSnapshot[];
  entries: IncrementalEntry[];
  firstEntryDate: Date | null;
  asOfDate: Date;
  settings: OrganizationSettings;
}): OrderEvaluation {
  const processes = [...input.processes].sort((a, b) => a.sequence - b.sequence);
  const cumulative = new Map<string, number>();
  for (const process of processes) {
    cumulative.set(process.id, 0);
  }
  for (const entry of input.entries) {
    cumulative.set(entry.orderProcessId, (cumulative.get(entry.orderProcessId) ?? 0) + entry.quantity);
  }

  const stages: StageState[] = processes.map((process) => {
    const done = cumulative.get(process.id) ?? 0;
    return {
      ...process,
      cumulative: done,
      remaining: Math.max(process.plannedQuantity - done, 0),
      percentComplete: process.plannedQuantity === 0 ? 0 : Math.min(100, (done / process.plannedQuantity) * 100),
    };
  });

  const incomplete = stages.find((stage) => stage.cumulative < stage.plannedQuantity);
  const last = stages[stages.length - 1];
  const completedQuantity = last?.cumulative ?? 0;
  const remainingQuantity = Math.max(input.orderQuantity - completedQuantity, 0);
  const progressPercent = input.orderQuantity === 0 ? 0 : Math.min(100, (completedQuantity / input.orderQuantity) * 100);
  const productionStarted = input.entries.length > 0;
  const fullyComplete = Boolean(last) && completedQuantity >= input.orderQuantity && stages.every((stage) => stage.cumulative >= stage.plannedQuantity);

  const derivedLifecycle: OrderEvaluation["derivedLifecycle"] = fullyComplete
    ? "COMPLETED"
    : productionStarted
      ? "IN_PRODUCTION"
      : "NOT_STARTED";

  const startStatus = resolveStartStatus({
    lifecycleStatus: input.lifecycleStatus,
    productionStarted,
    effectiveStartDate: input.effectiveStartDate,
    asOfDate: input.asOfDate,
    settings: input.settings,
  });

  const timing = resolveTimingStatus({
    lifecycleStatus: input.lifecycleStatus,
    productionStarted,
    fullyComplete,
    remainingQuantity,
    completedQuantity,
    firstEntryDate: input.firstEntryDate,
    asOfDate: input.asOfDate,
    dueDate: input.resolvedDueDate,
    settings: input.settings,
  });

  return {
    stages,
    currentStageName: fullyComplete ? (last?.processName ?? null) : (incomplete?.processName ?? null),
    currentStageComplete: fullyComplete,
    completedQuantity,
    remainingQuantity,
    progressPercent,
    productionStarted,
    derivedLifecycle,
    startStatus,
    timingStatus: timing.status,
    displayStatus: resolveDisplayStatus(input.lifecycleStatus, derivedLifecycle, startStatus, timing.status),
    productionRatePerDay: timing.ratePerDay,
    estimatedCompletionDate: timing.estimatedCompletionDate,
  };
}

export function resolveStartStatus(input: {
  lifecycleStatus: string;
  productionStarted: boolean;
  effectiveStartDate: Date;
  asOfDate: Date;
  settings: OrganizationSettings;
}): StartStatus {
  if (input.lifecycleStatus === "CANCELLED" || input.lifecycleStatus === "ON_HOLD" || input.productionStarted) {
    return "NOT_APPLICABLE";
  }
  if (utcDayDiff(input.asOfDate, input.effectiveStartDate) > 0) {
    return "NOT_STARTED";
  }
  const elapsed = utcDayDiff(input.effectiveStartDate, input.asOfDate);
  if (elapsed < input.settings.startDelayWarningDays) {
    return "NOT_STARTED";
  }
  if (elapsed < input.settings.startDelayCriticalDays) {
    return "START_WARNING";
  }
  return "START_DELAYED";
}

function resolveTimingStatus(input: {
  lifecycleStatus: string;
  productionStarted: boolean;
  fullyComplete: boolean;
  remainingQuantity: number;
  completedQuantity: number;
  firstEntryDate: Date | null;
  asOfDate: Date;
  dueDate: Date;
  settings: OrganizationSettings;
}): { status: TimingStatus; ratePerDay: number | null; estimatedCompletionDate: Date | null } {
  if (input.lifecycleStatus === "CANCELLED" || input.lifecycleStatus === "ON_HOLD" || !input.productionStarted) {
    return { status: "NOT_APPLICABLE", ratePerDay: null, estimatedCompletionDate: null };
  }
  if (input.fullyComplete) {
    return { status: "ON_TIME", ratePerDay: null, estimatedCompletionDate: input.asOfDate };
  }

  const pastDue = utcDayDiff(input.dueDate, input.asOfDate) > 0;
  if (pastDue && input.remainingQuantity > 0) {
    return { status: "DELAYED", ratePerDay: rate(input), estimatedCompletionDate: estimate(input) };
  }

  const estimatedCompletionDate = estimate(input);
  const ratePerDay = rate(input);
  if (estimatedCompletionDate && utcDayDiff(input.dueDate, estimatedCompletionDate) > 0) {
    return { status: "GETTING_DELAYED", ratePerDay, estimatedCompletionDate };
  }
  if (!estimatedCompletionDate) {
    const daysUntilDue = utcDayDiff(input.asOfDate, input.dueDate);
    if (daysUntilDue <= input.settings.gettingDelayedLeadDays && input.remainingQuantity > 0) {
      return { status: "GETTING_DELAYED", ratePerDay, estimatedCompletionDate };
    }
  }
  return { status: "ON_TIME", ratePerDay, estimatedCompletionDate };
}

function rate(input: { completedQuantity: number; firstEntryDate: Date | null; asOfDate: Date }): number | null {
  if (!input.firstEntryDate || input.completedQuantity <= 0) {
    return null;
  }
  const days = Math.max(1, utcDayDiff(input.firstEntryDate, input.asOfDate) || 1);
  return input.completedQuantity / days;
}

function estimate(input: {
  remainingQuantity: number;
  completedQuantity: number;
  firstEntryDate: Date | null;
  asOfDate: Date;
}): Date | null {
  const perDay = rate(input);
  if (!perDay || perDay <= 0) {
    return null;
  }
  const daysNeeded = Math.ceil(input.remainingQuantity / perDay);
  return addUtcDays(input.asOfDate, daysNeeded);
}

function resolveDisplayStatus(
  storedLifecycle: string,
  derived: OrderEvaluation["derivedLifecycle"],
  start: StartStatus,
  timing: TimingStatus,
): DisplayStatus {
  if (storedLifecycle === "CANCELLED") {
    return "CANCELLED";
  }
  if (storedLifecycle === "ON_HOLD") {
    return "ON_HOLD";
  }
  if (derived === "COMPLETED") {
    return "COMPLETED";
  }
  if (!["NOT_APPLICABLE", "NOT_STARTED"].includes(start) && start !== "NOT_STARTED") {
    if (start === "START_WARNING") {
      return "START_WARNING";
    }
    if (start === "START_DELAYED") {
      return "START_DELAYED";
    }
  }
  if (start === "NOT_STARTED") {
    return "NOT_STARTED";
  }
  if (timing === "DELAYED") {
    return "DELAYED";
  }
  if (timing === "GETTING_DELAYED") {
    return "GETTING_DELAYED";
  }
  return "ON_TIME";
}

export function displayStatusLabel(status: DisplayStatus): string {
  switch (status) {
    case "ON_TIME":
      return "On Time";
    case "GETTING_DELAYED":
      return "Getting Delayed";
    case "DELAYED":
      return "Delayed";
    case "NOT_STARTED":
      return "Not Started";
    case "START_WARNING":
      return "Start Warning";
    case "START_DELAYED":
      return "Start Delayed";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "ON_HOLD":
      return "On Hold";
  }
}
