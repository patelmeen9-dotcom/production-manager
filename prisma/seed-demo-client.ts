/**
 * Demo seed for the real client's data, modeled on their actual Excel tracking sheet.
 *
 * This is ADDITIVE — it does not touch Acme, Globex, or ABC-001. It creates a new
 * Organization ("Prime Doors Manufacturing" — rename the DISPLAY_NAME/SLUG below to
 * taste) with one plant, one product, the client's real fixed process sequence, three
 * special activities, a client list drawn from their sheet, and ~17 production orders
 * with daily entries reconstructed from their raw data.
 *
 * All dates are re-based around ANCHOR_DATE (2026-09-01) so the dashboard's status
 * logic (On Time / Getting Delayed / Delayed / Not Started) has a realistic spread to
 * demonstrate, including one deliberately overdue order.
 *
 * Run standalone with:
 *   npx tsx prisma/seed-demo-client.ts
 * or import `seedDemoClient` from your main prisma/seed.ts and call it there.
 */
import { DateInputType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ORGANIZATION_SETTINGS } from "../src/lib/organization-settings";
import { parseDateOnly, resolveDueDate, resolveEffectiveStartDate } from "../src/lib/orders/date-rules";
import { buildOrderProcessSnapshot } from "../src/lib/orders/snapshot";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Config — edit these two if you want a different org name/slug.
// ---------------------------------------------------------------------------
const DISPLAY_NAME = "Prime Doors Manufacturing";
const SLUG = "prime-doors-mfg";
const DEMO_PASSWORD = "123";

// Anchor date: "today" for the purposes of this demo dataset. All re-dated entries
// are relative to this so status calculations (on time / getting delayed / delayed)
// look correct when you actually load the app around this date.
const ANCHOR_DATE = "2026-09-01";

function daysBefore(anchor: string, days: number): string {
  const d = parseDateOnly(anchor);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function daysAfter(anchor: string, days: number): string {
  return daysBefore(anchor, -days);
}

async function upsertUser(data: {
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      role: data.role,
      organizationId: data.organizationId,
      passwordHash,
      isActive: true,
    },
    create: {
      email: data.email,
      name: data.name,
      role: data.role,
      organizationId: data.organizationId,
      passwordHash,
      isActive: true,
    },
  });
}

/** One stage entry to log against an order: process code + quantity + date offset from ANCHOR_DATE (negative = in the past). */
type StageEntry = { processCode: string; quantity: number; daysFromAnchor: number };

/** One demo order, modeled on a real row from the client's tracking sheet. */
type DemoOrder = {
  orderNumber: string;
  clientCode: string;
  quantity: number;
  orderDateOffset: number; // days before anchor
  dueDays: number; // days from effective start
  entries: StageEntry[]; // stage-by-stage daily entries, in the order they should be inserted
  remarks?: string;
};

async function main() {
  console.log(`Seeding demo organization: ${DISPLAY_NAME} (${SLUG})`);

  const org = await prisma.organization.upsert({
    where: { slug: SLUG },
    update: { name: DISPLAY_NAME, settings: DEFAULT_ORGANIZATION_SETTINGS },
    create: {
      name: DISPLAY_NAME,
      slug: SLUG,
      settings: DEFAULT_ORGANIZATION_SETTINGS,
    },
  });

  // -------------------------------------------------------------------------
  // Users — simple emails, password "123" for everyone in this demo org.
  // -------------------------------------------------------------------------
  const admin = await upsertUser({
    email: "admin@primedoors.com",
    name: "Admin",
    role: Role.ORGANIZATION_ADMIN,
    organizationId: org.id,
    password: DEMO_PASSWORD,
  });
  const manager = await upsertUser({
    email: "manager@primedoors.com",
    name: "Production Manager",
    role: Role.PRODUCTION_MANAGER,
    organizationId: org.id,
    password: DEMO_PASSWORD,
  });
  const operator = await upsertUser({
    email: "operator@primedoors.com",
    name: "Production Operator",
    role: Role.PRODUCTION_OPERATOR,
    organizationId: org.id,
    password: DEMO_PASSWORD,
  });
  const viewer = await upsertUser({
    email: "viewer@primedoors.com",
    name: "Viewer",
    role: Role.VIEWER,
    organizationId: org.id,
    password: DEMO_PASSWORD,
  });

  // -------------------------------------------------------------------------
  // Plant — single plant, matches "all steps happen in one physical plant."
  // -------------------------------------------------------------------------
  const plant = await prisma.plant.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "PLANT-MAIN" } },
    update: { name: "Main Plant", location: "Ahmedabad", isActive: true },
    create: {
      organizationId: org.id,
      code: "PLANT-MAIN",
      name: "Main Plant",
      location: "Ahmedabad",
      isActive: true,
    },
  });

  await prisma.userPlantAccess.deleteMany({
    where: { userId: { in: [manager.id, operator.id, viewer.id] }, organizationId: org.id },
  });
  await prisma.userPlantAccess.createMany({
    data: [
      { organizationId: org.id, userId: manager.id, plantId: plant.id },
      { organizationId: org.id, userId: operator.id, plantId: plant.id },
      { organizationId: org.id, userId: viewer.id, plantId: plant.id },
    ],
  });

  // -------------------------------------------------------------------------
  // Product — single "Door" product (Pine/HW/FRD are material notes, not separate products).
  // -------------------------------------------------------------------------
  const door = await prisma.product.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "DOOR" } },
    update: { name: "Door", isActive: true },
    create: { organizationId: org.id, name: "Door", code: "DOOR", isActive: true },
  });

  // -------------------------------------------------------------------------
  // Processes — fixed sequence confirmed: Frame -> Beat -> Hot Press -> Rough Cutting
  // -> Laminate/HDF Cutting -> Repressing.
  // -------------------------------------------------------------------------
  async function upsertProcess(name: string, code: string, unitsPerDay?: number) {
    return prisma.process.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      update: { name, isActive: true, unitsPerDay: unitsPerDay ?? null },
      create: { organizationId: org.id, name, code, isActive: true, unitsPerDay: unitsPerDay ?? null },
    });
  }

  const frame = await upsertProcess("Frame", "FRAME", 80);
  const beat = await upsertProcess("Beat", "BEAT", 100);
  const hotPress = await upsertProcess("Hot Press", "HOT-PRESS", 60);
  const roughCutting = await upsertProcess("Rough Cutting", "ROUGH-CUT", 120);
  const laminate = await upsertProcess("Laminate / HDF Cutting", "LAMINATE", 90);
  const repressing = await upsertProcess("Repressing", "REPRESSING", 70);

  async function replaceMapping(processIds: string[]) {
    await prisma.plantProductProcessMapping.deleteMany({
      where: { organizationId: org.id, plantId: plant.id, productId: door.id },
    });
    await prisma.plantProductProcessMapping.createMany({
      data: processIds.map((processId, index) => ({
        organizationId: org.id,
        plantId: plant.id,
        productId: door.id,
        processId,
        sequence: index + 1,
        isActive: true,
      })),
    });
  }

  await replaceMapping([frame.id, beat.id, hotPress.id, roughCutting.id, laminate.id, repressing.id]);

  // -------------------------------------------------------------------------
  // Special activities — Patty, Vision Panel, Glass Fixing. These stay outside the
  // main sequence, matching the order form you described.
  // -------------------------------------------------------------------------
  async function upsertActivity(name: string, code: string) {
    return prisma.specialActivity.upsert({
      where: { organizationId_code: { organizationId: org.id, code } },
      update: { name, activityType: "SPECIAL_PROCESS" as const, isActive: true },
      create: {
        organizationId: org.id,
        name,
        code,
        activityType: "SPECIAL_PROCESS" as const,
        isActive: true,
      },
    });
  }
  await upsertActivity("Patty", "PATTY");
  await upsertActivity("Vision Panel / Louver", "VISION-PANEL");
  await upsertActivity("Glass Fixing / Louver Fixing", "GLASS-FIXING");

  // -------------------------------------------------------------------------
  // Clients — drawn from the client's real party names. TUFWUD is their catch-all
  // for not-yet-established clients, and is seeded here as a normal Client row like
  // any other, since ProductionOrder requires a clientId.
  // -------------------------------------------------------------------------
  const clientDefs: { code: string; name: string }[] = [
    { code: "TUFWUD", name: "Tufwud" },
    { code: "GAGAN-ADHIRA", name: "Gagan Adhira" },
    { code: "ULTIMA-GZANDEUR", name: "Ultima Gzandeur" },
    { code: "64-HILLS", name: "64 Hills" },
    { code: "KUMAR-PRIME", name: "Kumar Prime View" },
    { code: "MAYURBEN", name: "Mayurben" },
    { code: "SHUBH-NIRAVANA", name: "Shubh Niravana" },
    { code: "MAJISTIC", name: "Majistic" },
    { code: "ADITYA-SHAGUN", name: "Aditya Shagun" },
    { code: "GEECEE", name: "Geecee" },
    { code: "VIKAS", name: "Vikas" },
    { code: "CLIENT-A", name: "Client A" }, // used for the invented delayed order
  ];
  const clients = new Map<string, { id: string }>();
  for (const def of clientDefs) {
    const client = await prisma.client.upsert({
      where: { organizationId_code: { organizationId: org.id, code: def.code } },
      update: { name: def.name, isActive: true },
      create: { organizationId: org.id, code: def.code, name: def.name, isActive: true },
    });
    clients.set(def.code, client);
  }

  // -------------------------------------------------------------------------
  // Orders — 17 real (re-dated) rows + 1 invented delayed order, spanning every
  // dashboard status: Completed, in-progress at various stages, Not Started, Delayed.
  // Stage entries mirror the client's actual sheet: quantity done per stage, re-dated
  // relative to ANCHOR_DATE so recent orders look freshly active.
  // -------------------------------------------------------------------------
  const demoOrders: DemoOrder[] = [
    // --- Completed orders ---
    {
      orderNumber: "1144.1",
      clientCode: "GAGAN-ADHIRA",
      quantity: 148,
      orderDateOffset: 30,
      dueDays: 20,
      entries: [
        { processCode: "FRAME", quantity: 148, daysFromAnchor: -28 },
        { processCode: "BEAT", quantity: 148, daysFromAnchor: -27 },
        { processCode: "HOT-PRESS", quantity: 148, daysFromAnchor: -26 },
        { processCode: "ROUGH-CUT", quantity: 148, daysFromAnchor: -25 },
        { processCode: "LAMINATE", quantity: 148, daysFromAnchor: -23 },
        { processCode: "REPRESSING", quantity: 148, daysFromAnchor: -20 },
      ],
      remarks: "Completed order — full run through all six stages.",
    },
    {
      orderNumber: "1144.8",
      clientCode: "GAGAN-ADHIRA",
      quantity: 30,
      orderDateOffset: 25,
      dueDays: 18,
      entries: [
        { processCode: "FRAME", quantity: 30, daysFromAnchor: -23 },
        { processCode: "BEAT", quantity: 30, daysFromAnchor: -22 },
        { processCode: "HOT-PRESS", quantity: 24, daysFromAnchor: -21 },
        { processCode: "HOT-PRESS", quantity: 6, daysFromAnchor: -19 },
        { processCode: "ROUGH-CUT", quantity: 30, daysFromAnchor: -18 },
        { processCode: "LAMINATE", quantity: 30, daysFromAnchor: -16 },
        { processCode: "REPRESSING", quantity: 30, daysFromAnchor: -14 },
      ],
      remarks: "Completed order — small batch, clean run.",
    },
    {
      orderNumber: "1180",
      clientCode: "ULTIMA-GZANDEUR",
      quantity: 7,
      orderDateOffset: 20,
      dueDays: 15,
      entries: [
        { processCode: "FRAME", quantity: 7, daysFromAnchor: -18 },
        { processCode: "BEAT", quantity: 7, daysFromAnchor: -17 },
        { processCode: "HOT-PRESS", quantity: 7, daysFromAnchor: -16 },
        { processCode: "ROUGH-CUT", quantity: 7, daysFromAnchor: -15 },
        { processCode: "LAMINATE", quantity: 7, daysFromAnchor: -13 },
        { processCode: "REPRESSING", quantity: 7, daysFromAnchor: -11 },
      ],
      remarks: "Completed order — tiny sample-sized batch.",
    },

    // --- In progress: stuck early ---
    {
      orderNumber: "OA-4062",
      clientCode: "TUFWUD",
      quantity: 10,
      orderDateOffset: 10,
      dueDays: 18,
      entries: [
        { processCode: "FRAME", quantity: 10, daysFromAnchor: -8 },
        { processCode: "BEAT", quantity: 10, daysFromAnchor: -7 },
        { processCode: "HOT-PRESS", quantity: 10, daysFromAnchor: -1 },
      ],
      remarks: "In progress — stuck at Hot Press.",
    },

    // --- In progress: mid pipeline, at risk ---
    {
      orderNumber: "CO-79.1",
      clientCode: "64-HILLS",
      quantity: 125,
      orderDateOffset: 14,
      dueDays: 12,
      entries: [
        { processCode: "FRAME", quantity: 37, daysFromAnchor: -12 },
        { processCode: "FRAME", quantity: 48, daysFromAnchor: -11 },
        { processCode: "FRAME", quantity: 40, daysFromAnchor: -10 },
        { processCode: "BEAT", quantity: 26, daysFromAnchor: -12 },
        { processCode: "BEAT", quantity: 39, daysFromAnchor: -10 },
        { processCode: "BEAT", quantity: 49, daysFromAnchor: -8 },
        { processCode: "HOT-PRESS", quantity: 37, daysFromAnchor: -11 },
        { processCode: "HOT-PRESS", quantity: 88, daysFromAnchor: -7 },
      ],
      remarks: "In progress — mid pipeline, due date approaching.",
    },

    // --- In progress: near finish line ---
    {
      orderNumber: "932.14",
      clientCode: "KUMAR-PRIME",
      quantity: 196,
      orderDateOffset: 16,
      dueDays: 20,
      entries: [
        { processCode: "FRAME", quantity: 96, daysFromAnchor: -14 },
        { processCode: "FRAME", quantity: 100, daysFromAnchor: -13 },
        { processCode: "BEAT", quantity: 139, daysFromAnchor: -13 },
        { processCode: "BEAT", quantity: 57, daysFromAnchor: -12 },
        { processCode: "HOT-PRESS", quantity: 29, daysFromAnchor: -13 },
        { processCode: "HOT-PRESS", quantity: 167, daysFromAnchor: -12 },
        { processCode: "ROUGH-CUT", quantity: 153, daysFromAnchor: -12 },
        { processCode: "ROUGH-CUT", quantity: 43, daysFromAnchor: -11 },
        { processCode: "LAMINATE", quantity: 98, daysFromAnchor: -5 },
        { processCode: "LAMINATE", quantity: 98, daysFromAnchor: -1 },
      ],
      remarks: "In progress — near finish line, Repressing not yet started.",
    },

    // --- In progress: Laminate bottleneck ---
    {
      orderNumber: "CO-99.1",
      clientCode: "MAYURBEN",
      quantity: 172,
      orderDateOffset: 9,
      dueDays: 15,
      entries: [
        { processCode: "FRAME", quantity: 172, daysFromAnchor: -7 },
        { processCode: "BEAT", quantity: 40, daysFromAnchor: -7 },
        { processCode: "BEAT", quantity: 102, daysFromAnchor: -6 },
        { processCode: "HOT-PRESS", quantity: 8, daysFromAnchor: -5 },
        { processCode: "HOT-PRESS", quantity: 22, daysFromAnchor: -4 },
        { processCode: "ROUGH-CUT", quantity: 59, daysFromAnchor: -6 },
        { processCode: "LAMINATE", quantity: 87, daysFromAnchor: -4 },
        { processCode: "LAMINATE", quantity: 26, daysFromAnchor: -3 },
      ],
      remarks: "In progress — Laminate stage is the current bottleneck.",
    },

    // --- In progress: just started (very early stage only) ---
    {
      orderNumber: "OA-4132",
      clientCode: "TUFWUD",
      quantity: 180,
      orderDateOffset: 5,
      dueDays: 25,
      entries: [{ processCode: "ROUGH-CUT", quantity: 10, daysFromAnchor: -1 }],
      remarks: "In progress — just started.",
    },
    {
      orderNumber: "1031.38",
      clientCode: "SHUBH-NIRAVANA",
      quantity: 1,
      orderDateOffset: 3,
      dueDays: 14,
      entries: [{ processCode: "FRAME", quantity: 1, daysFromAnchor: -1 }],
      remarks: "In progress — just started, single-unit order.",
    },
    {
      orderNumber: "758.36",
      clientCode: "MAJISTIC",
      quantity: 4,
      orderDateOffset: 3,
      dueDays: 14,
      entries: [{ processCode: "FRAME", quantity: 4, daysFromAnchor: -1 }],
      remarks: "In progress — just started.",
    },
    {
      orderNumber: "CO-112",
      clientCode: "MAJISTIC",
      quantity: 12,
      orderDateOffset: 3,
      dueDays: 14,
      entries: [{ processCode: "FRAME", quantity: 12, daysFromAnchor: -1 }],
      remarks: "In progress — just started.",
    },

    // --- In progress: irregular pacing, re-dated cleanly ---
    {
      orderNumber: "OA-4130",
      clientCode: "TUFWUD",
      quantity: 170,
      orderDateOffset: 18,
      dueDays: 22,
      entries: [
        { processCode: "FRAME", quantity: 90, daysFromAnchor: -16 },
        { processCode: "BEAT", quantity: 40, daysFromAnchor: -13 },
        { processCode: "HOT-PRESS", quantity: 20, daysFromAnchor: -12 },
        { processCode: "ROUGH-CUT", quantity: 12, daysFromAnchor: -9 },
        { processCode: "ROUGH-CUT", quantity: 8, daysFromAnchor: -8 },
        { processCode: "ROUGH-CUT", quantity: 98, daysFromAnchor: -7 },
        { processCode: "LAMINATE", quantity: 16, daysFromAnchor: -6 },
      ],
      remarks: "In progress — uneven daily pace across stages.",
    },

    // --- In progress: partial multi-stage ---
    {
      orderNumber: "242.6",
      clientCode: "VIKAS",
      quantity: 47,
      orderDateOffset: 12,
      dueDays: 16,
      entries: [
        { processCode: "FRAME", quantity: 47, daysFromAnchor: -10 },
        { processCode: "BEAT", quantity: 47, daysFromAnchor: -8 },
        { processCode: "HOT-PRESS", quantity: 30, daysFromAnchor: -6 },
        { processCode: "ROUGH-CUT", quantity: 17, daysFromAnchor: -5 },
      ],
      remarks: "In progress — partial completion across four stages.",
    },

    // --- Not started, no entries ---
    {
      orderNumber: "CO-111",
      clientCode: "ADITYA-SHAGUN",
      quantity: 7,
      orderDateOffset: 2,
      dueDays: 14,
      entries: [],
      remarks: "Not started — no production entries yet.",
    },
    {
      orderNumber: "248.4",
      clientCode: "GEECEE",
      quantity: 32,
      orderDateOffset: 2,
      dueDays: 14,
      entries: [],
      remarks: "Not started — no production entries yet.",
    },
    {
      orderNumber: "OA-4143",
      clientCode: "TUFWUD",
      quantity: 9,
      orderDateOffset: 1,
      dueDays: 14,
      entries: [],
      remarks: "Not started — no production entries yet.",
    },

    // --- Invented: deliberately delayed, to demonstrate the red-flag dashboard feature ---
    {
      orderNumber: "OA-4051",
      clientCode: "CLIENT-A",
      quantity: 40,
      orderDateOffset: 20,
      dueDays: 12, // due 8 days before anchor -> currently overdue
      entries: [
        { processCode: "FRAME", quantity: 40, daysFromAnchor: -18 },
        { processCode: "BEAT", quantity: 40, daysFromAnchor: -16 },
        { processCode: "HOT-PRESS", quantity: 22, daysFromAnchor: -14 },
      ],
      remarks: "Delayed — stuck at Hot Press, past due date. Demonstrates the Action Required panel.",
    },
  ];

  for (const def of demoOrders) {
    const client = clients.get(def.clientCode);
    if (!client) {
      throw new Error(`Unknown client code in demo data: ${def.clientCode}`);
    }

    const existing = await prisma.productionOrder.findUnique({
      where: { organizationId_orderNumber: { organizationId: org.id, orderNumber: def.orderNumber } },
      include: { processes: true },
    });
    if (existing) {
      console.log(`Skipping ${def.orderNumber} — already exists.`);
      continue;
    }

    const orderDate = parseDateOnly(daysBefore(ANCHOR_DATE, def.orderDateOffset));
    const effectiveStartDate = resolveEffectiveStartDate({ orderDate, startDateType: "NONE" });
    const resolvedDueDate = resolveDueDate({
      orderDate,
      effectiveStartDate,
      dueDateType: "DAYS_FROM_START",
      dueDays: def.dueDays,
    });

    const mapping = await prisma.plantProductProcessMapping.findMany({
      where: { organizationId: org.id, plantId: plant.id, productId: door.id, isActive: true },
      include: { process: true },
      orderBy: { sequence: "asc" },
    });
    const snapshot = buildOrderProcessSnapshot(mapping, def.quantity);

    const generalCategory = await prisma.productCategory.upsert({
      where: { organizationId_code: { organizationId: org.id, code: "GENERAL" } },
      update: { isActive: true, inputType: "OPEN_TEXT", choiceMode: null },
      create: { organizationId: org.id, code: "GENERAL", name: "General", inputType: "OPEN_TEXT", isActive: true },
    });
    await prisma.productCategoryAssignment.upsert({
      where: {
        productId_productCategoryId: { productId: door.id, productCategoryId: generalCategory.id },
      },
      update: {},
      create: {
        organizationId: org.id,
        productId: door.id,
        productCategoryId: generalCategory.id,
      },
    });

    const created = await prisma.productionOrder.create({
      data: {
        organizationId: org.id,
        plantId: plant.id,
        clientId: client.id,
        productId: door.id,
        createdByUserId: admin.id,
        orderNumber: def.orderNumber,
        quantity: def.quantity,
        orderDate,
        startDateType: DateInputType.NONE,
        effectiveStartDate,
        dueDateType: DateInputType.DAYS_FROM_START,
        dueDays: def.dueDays,
        resolvedDueDate,
        remarks: def.remarks,
        lifecycleStatus: def.entries.length > 0 ? "IN_PRODUCTION" : "NOT_STARTED",
      },
    });

    const createdLine = await prisma.productionOrderLine.create({
      data: {
        organizationId: org.id,
        productionOrderId: created.id,
        productId: door.id,
        quantity: def.quantity,
        lineNumber: 1,
      },
    });

    await prisma.productionOrderProcess.createMany({
      data: snapshot.map((step) => ({
        organizationId: org.id,
        productionOrderId: created.id,
        productionOrderLineId: createdLine.id,
        processId: step.processId,
        processName: step.processName,
        processCode: step.processCode,
        sequence: step.sequence,
        plannedQuantity: step.plannedQuantity,
      })),
    });

    if (def.entries.length > 0) {
      const orderProcesses = await prisma.productionOrderProcess.findMany({
        where: { productionOrderId: created.id },
      });
      const byCode = new Map(orderProcesses.map((p) => [p.processCode, p]));

      const entryData = def.entries.map((stage) => {
        const orderProcess = byCode.get(stage.processCode);
        if (!orderProcess) {
          throw new Error(`Order ${def.orderNumber}: process code ${stage.processCode} not found in snapshot.`);
        }
        return {
          organizationId: org.id,
          plantId: plant.id,
          productionOrderId: created.id,
          orderProcessId: orderProcess.id,
          entryDate: parseDateOnly(daysBefore(ANCHOR_DATE, -stage.daysFromAnchor)),
          quantity: stage.quantity,
          createdByUserId: operator.id,
        };
      });

      await prisma.productionEntry.createMany({ data: entryData });
    }

    console.log(`Created order ${def.orderNumber} (${client.id}) — ${def.entries.length} stage entries.`);
  }

  console.log("Demo client seed complete.");
  console.log(`Organization: ${org.name} (${org.slug})`);
  console.log("Logins (password for all: " + DEMO_PASSWORD + "):");
  console.log("  admin@primedoors.com");
  console.log("  manager@primedoors.com");
  console.log("  operator@primedoors.com");
  console.log("  viewer@primedoors.com");
}

export { main as seedDemoClient };

// Allow standalone execution: `npx tsx prisma/seed-demo-client.ts`
if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
