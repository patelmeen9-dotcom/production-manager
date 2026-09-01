import { DateInputType, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ORGANIZATION_SETTINGS } from "../src/lib/organization-settings";
import { parseDateOnly, resolveDueDate, resolveEffectiveStartDate } from "../src/lib/orders/date-rules";
import { buildOrderProcessSnapshot } from "../src/lib/orders/snapshot";

const prisma = new PrismaClient();

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

async function main() {
  const acme = await prisma.organization.upsert({
    where: { slug: "acme-manufacturing" },
    update: { name: "Acme Manufacturing", settings: DEFAULT_ORGANIZATION_SETTINGS },
    create: {
      name: "Acme Manufacturing",
      slug: "acme-manufacturing",
      settings: DEFAULT_ORGANIZATION_SETTINGS,
    },
  });

  const globex = await prisma.organization.upsert({
    where: { slug: "globex-industrial" },
    update: { name: "Globex Industrial", settings: DEFAULT_ORGANIZATION_SETTINGS },
    create: {
      name: "Globex Industrial",
      slug: "globex-industrial",
      settings: DEFAULT_ORGANIZATION_SETTINGS,
    },
  });

  await upsertUser({
    email: "superadmin@example.com",
    name: "Platform Super Admin",
    role: Role.SUPER_ADMIN,
    organizationId: null,
    password: "ChangeMe!SuperAdmin1",
  });

  await upsertUser({
    email: "admin.acme@example.com",
    name: "Acme Admin",
    role: Role.ORGANIZATION_ADMIN,
    organizationId: acme.id,
    password: "ChangeMe!AcmeAdmin1",
  });

  await upsertUser({
    email: "manager.acme@example.com",
    name: "Acme Manager",
    role: Role.PRODUCTION_MANAGER,
    organizationId: acme.id,
    password: "ChangeMe!AcmeManager1",
  });

  await upsertUser({
    email: "operator.acme@example.com",
    name: "Acme Operator",
    role: Role.PRODUCTION_OPERATOR,
    organizationId: acme.id,
    password: "ChangeMe!AcmeOperator1",
  });

  await upsertUser({
    email: "viewer.acme@example.com",
    name: "Acme Viewer",
    role: Role.VIEWER,
    organizationId: acme.id,
    password: "ChangeMe!AcmeViewer1",
  });

  await upsertUser({
    email: "admin.globex@example.com",
    name: "Globex Admin",
    role: Role.ORGANIZATION_ADMIN,
    organizationId: globex.id,
    password: "ChangeMe!GlobexAdmin1",
  });

  async function upsertPlant(organizationId: string, code: string, name: string, location: string) {
    return prisma.plant.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { name, location, isActive: true },
      create: { organizationId, code, name, location, isActive: true },
    });
  }

  const mumbai = await upsertPlant(acme.id, "PLANT-MUM", "Mumbai Plant", "Mumbai");
  const pune = await upsertPlant(acme.id, "PLANT-PUN", "Pune Plant", "Pune");
  await upsertPlant(acme.id, "PLANT-AMD", "Ahmedabad Plant", "Ahmedabad");
  await upsertPlant(globex.id, "PLANT-HOU", "Houston Plant", "Houston");

  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager.acme@example.com" } });
  const operator = await prisma.user.findUniqueOrThrow({ where: { email: "operator.acme@example.com" } });
  const viewer = await prisma.user.findUniqueOrThrow({ where: { email: "viewer.acme@example.com" } });

  await prisma.userPlantAccess.deleteMany({
    where: { userId: { in: [manager.id, operator.id, viewer.id] } },
  });

  await prisma.userPlantAccess.createMany({
    data: [
      { organizationId: acme.id, userId: manager.id, plantId: mumbai.id },
      { organizationId: acme.id, userId: manager.id, plantId: pune.id },
      { organizationId: acme.id, userId: operator.id, plantId: mumbai.id },
      { organizationId: acme.id, userId: viewer.id, plantId: mumbai.id },
    ],
  });

  const clientA = await prisma.client.upsert({
    where: { organizationId_code: { organizationId: acme.id, code: "CLIENT-01" } },
    update: { name: "Client A", isActive: true, contactName: "Priya Shah" },
    create: {
      organizationId: acme.id,
      code: "CLIENT-01",
      name: "Client A",
      contactName: "Priya Shah",
      contactEmail: "priya@client-a.example",
      isActive: true,
    },
  });

  const door = await prisma.product.upsert({
    where: { organizationId_code: { organizationId: acme.id, code: "DOOR" } },
    update: { name: "Door", isActive: true },
    create: { organizationId: acme.id, name: "Door", code: "DOOR", isActive: true },
  });
  await prisma.product.upsert({
    where: { organizationId_code: { organizationId: acme.id, code: "WINDOW" } },
    update: { name: "Window", isActive: true },
    create: { organizationId: acme.id, name: "Window", code: "WINDOW", isActive: true },
  });

  async function upsertProcess(organizationId: string, name: string, code: string) {
    return prisma.process.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { name, isActive: true },
      create: { organizationId, name, code, isActive: true },
    });
  }

  const cutting = await upsertProcess(acme.id, "Cutting", "CUT");
  const framing = await upsertProcess(acme.id, "Framing", "FRM");
  const assembly = await upsertProcess(acme.id, "Assembly", "ASM");
  const glass = await upsertProcess(acme.id, "Glass", "GLS");
  const finishing = await upsertProcess(acme.id, "Finishing", "FIN");
  const cnc = await upsertProcess(acme.id, "CNC", "CNC");

  async function replaceMapping(plantId: string, productId: string, processIds: string[]) {
    await prisma.plantProductProcessMapping.deleteMany({
      where: { organizationId: acme.id, plantId, productId },
    });
    await prisma.plantProductProcessMapping.createMany({
      data: processIds.map((processId, index) => ({
        organizationId: acme.id,
        plantId,
        productId,
        processId,
        sequence: index + 1,
        isActive: true,
      })),
    });
  }

  await replaceMapping(mumbai.id, door.id, [cutting.id, framing.id, assembly.id, glass.id, finishing.id]);
  await replaceMapping(pune.id, door.id, [cutting.id, cnc.id, framing.id, assembly.id, finishing.id]);

  async function upsertActivity(
    name: string,
    code: string,
    activityType: "SPECIAL_PROCESS" | "REWORK" | "OTHER",
  ) {
    return prisma.specialActivity.upsert({
      where: { organizationId_code: { organizationId: acme.id, code } },
      update: { name, activityType, isActive: true },
      create: { organizationId: acme.id, name, code, activityType, isActive: true },
    });
  }

  await upsertActivity("Glass Mating", "GLASS-MATING", "SPECIAL_PROCESS");
  await upsertActivity("Special Polish", "SPECIAL-POLISH", "SPECIAL_PROCESS");
  await upsertActivity("Rework", "REWORK", "REWORK");

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin.acme@example.com" } });
  let order = await prisma.productionOrder.findUnique({
    where: { organizationId_orderNumber: { organizationId: acme.id, orderNumber: "ABC-001" } },
    include: { processes: true },
  });
  if (!order) {
    const orderDate = parseDateOnly("2026-08-30");
    const mapping = await prisma.plantProductProcessMapping.findMany({
      where: { organizationId: acme.id, plantId: mumbai.id, productId: door.id, isActive: true },
      include: { process: true },
      orderBy: { sequence: "asc" },
    });
    const snapshot = buildOrderProcessSnapshot(mapping, 500);
    const created = await prisma.productionOrder.create({
      data: {
        organizationId: acme.id,
        plantId: mumbai.id,
        clientId: clientA.id,
        productId: door.id,
        createdByUserId: admin.id,
        orderNumber: "ABC-001",
        quantity: 500,
        orderDate,
        startDateType: DateInputType.NONE,
        effectiveStartDate: resolveEffectiveStartDate({ orderDate, startDateType: "NONE" }),
        dueDateType: DateInputType.DAYS_FROM_START,
        dueDays: 21,
        resolvedDueDate: resolveDueDate({
          orderDate,
          effectiveStartDate: resolveEffectiveStartDate({ orderDate, startDateType: "NONE" }),
          dueDateType: "DAYS_FROM_START",
          dueDays: 21,
        }),
        remarks: "Seed order for the 500-door example.",
      },
    });
    await prisma.productionOrderProcess.createMany({
      data: snapshot.map((step) => ({
        organizationId: acme.id,
        productionOrderId: created.id,
        processId: step.processId,
        processName: step.processName,
        processCode: step.processCode,
        sequence: step.sequence,
        plannedQuantity: step.plannedQuantity,
      })),
    });
    order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: created.id },
      include: { processes: true },
    });
  }

  const cuttingStep = order.processes.find((step) => step.processCode === "CUT");
  const framingStep = order.processes.find((step) => step.processCode === "FRM");
  const existingEntries = await prisma.productionEntry.count({ where: { productionOrderId: order.id } });
  if (existingEntries === 0 && cuttingStep && framingStep) {
    await prisma.productionEntry.createMany({
      data: [
        {
          organizationId: acme.id,
          plantId: mumbai.id,
          productionOrderId: order.id,
          orderProcessId: cuttingStep.id,
          entryDate: parseDateOnly("2026-08-30"),
          quantity: 200,
          createdByUserId: admin.id,
        },
        {
          organizationId: acme.id,
          plantId: mumbai.id,
          productionOrderId: order.id,
          orderProcessId: cuttingStep.id,
          entryDate: parseDateOnly("2026-08-31"),
          quantity: 300,
          createdByUserId: admin.id,
        },
        {
          organizationId: acme.id,
          plantId: mumbai.id,
          productionOrderId: order.id,
          orderProcessId: framingStep.id,
          entryDate: parseDateOnly("2026-08-31"),
          quantity: 150,
          createdByUserId: admin.id,
        },
      ],
    });
    await prisma.productionOrder.update({
      where: { id: order.id },
      data: { lifecycleStatus: "IN_PRODUCTION" },
    });
  }

  console.log("Seed complete.");
  console.log("Organizations:", acme.slug, globex.slug);
  console.log("Use the example.com accounts from prisma/seed.ts (change passwords in production).");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
