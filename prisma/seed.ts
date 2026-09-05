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

  async function upsertCategory(input: {
    code: string;
    name: string;
    inputType: "OPEN_TEXT" | "DROPDOWN";
    choiceMode?: "SINGLE" | "MULTI" | null;
    options?: { code: string; name: string }[];
  }) {
    const category = await prisma.productCategory.upsert({
      where: { organizationId_code: { organizationId: acme.id, code: input.code } },
      update: {
        name: input.name,
        isActive: true,
        inputType: input.inputType,
        choiceMode: input.inputType === "DROPDOWN" ? input.choiceMode ?? "SINGLE" : null,
      },
      create: {
        organizationId: acme.id,
        code: input.code,
        name: input.name,
        inputType: input.inputType,
        choiceMode: input.inputType === "DROPDOWN" ? input.choiceMode ?? "SINGLE" : null,
        isActive: true,
      },
    });
    if (input.inputType === "DROPDOWN" && input.options) {
      await prisma.productCategoryOption.deleteMany({ where: { productCategoryId: category.id } });
      await prisma.productCategoryOption.createMany({
        data: input.options.map((option, index) => ({
          organizationId: acme.id,
          productCategoryId: category.id,
          code: option.code,
          name: option.name,
          sortOrder: index,
          isActive: true,
          updatedAt: new Date(),
        })),
      });
    }
    await prisma.productCategoryAssignment.upsert({
      where: { productId_productCategoryId: { productId: door.id, productCategoryId: category.id } },
      update: {},
      create: { organizationId: acme.id, productId: door.id, productCategoryId: category.id },
    });
    return category;
  }

  const thickness = await upsertCategory({
    code: "THICKNESS",
    name: "Thickness",
    inputType: "DROPDOWN",
    choiceMode: "SINGLE",
    options: [
      { code: "30MM", name: "30 MM" },
      { code: "32MM", name: "32 MM" },
      { code: "35MM", name: "35 MM" },
      { code: "40MM", name: "40 MM" },
    ],
  });
  await upsertCategory({
    code: "FILLER",
    name: "Filler",
    inputType: "DROPDOWN",
    choiceMode: "SINGLE",
    options: [
      { code: "PINE", name: "Pine" },
      { code: "HARDWOOD", name: "Hardwood" },
      { code: "PARTICLE", name: "Particle Board" },
    ],
  });
  await upsertCategory({
    code: "FEATURES",
    name: "Door features",
    inputType: "DROPDOWN",
    choiceMode: "MULTI",
    options: [
      { code: "LIPPING", name: "Lipping Patti" },
      { code: "VISION", name: "Vision Panel" },
      { code: "ACOUSTIC", name: "Acoustic Door" },
      { code: "DOUBLE", name: "Double Door" },
    ],
  });
  await upsertCategory({
    code: "NOTES",
    name: "Extra notes",
    inputType: "OPEN_TEXT",
  });
  async function upsertProcess(organizationId: string, name: string, code: string, unitsPerDay?: number) {
    return prisma.process.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { name, isActive: true, unitsPerDay: unitsPerDay ?? null },
      create: { organizationId, name, code, isActive: true, unitsPerDay: unitsPerDay ?? null },
    });
  }

  const cutting = await upsertProcess(acme.id, "Cutting", "CUT", 250);
  const framing = await upsertProcess(acme.id, "Framing", "FRM", 200);
  const assembly = await upsertProcess(acme.id, "Assembly", "ASM", 150);
  const glass = await upsertProcess(acme.id, "Glass", "GLS", 180);
  const finishing = await upsertProcess(acme.id, "Finishing", "FIN", 120);
  const cnc = await upsertProcess(acme.id, "CNC", "CNC", 100);

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
    include: { processes: true, lines: true },
  });
  if (!order) {
    const orderDate = parseDateOnly("2026-08-30");
    const mapping = await prisma.plantProductProcessMapping.findMany({
      where: { organizationId: acme.id, plantId: mumbai.id, productId: door.id, isActive: true },
      include: { process: true },
      orderBy: { sequence: "asc" },
    });
    const lineDefs = [
      { quantity: 200, lineNumber: 1, thicknessCode: "30MM" },
      { quantity: 300, lineNumber: 2, thicknessCode: "35MM" },
    ];
    const totalQuantity = lineDefs.reduce((sum, line) => sum + line.quantity, 0);
    const created = await prisma.productionOrder.create({
      data: {
        organizationId: acme.id,
        plantId: mumbai.id,
        clientId: clientA.id,
        productId: door.id,
        createdByUserId: admin.id,
        orderNumber: "ABC-001",
        quantity: totalQuantity,
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
        remarks: "Seed order with multi-line doors and optional thickness categories.",
      },
    });
    const thicknessOptions = await prisma.productCategoryOption.findMany({
      where: { productCategoryId: thickness.id },
    });
    for (const lineDef of lineDefs) {
      const snapshot = buildOrderProcessSnapshot(mapping, lineDef.quantity);
      const createdLine = await prisma.productionOrderLine.create({
        data: {
          organizationId: acme.id,
          productionOrderId: created.id,
          productId: door.id,
          quantity: lineDef.quantity,
          lineNumber: lineDef.lineNumber,
        },
      });
      const option = thicknessOptions.find((row) => row.code === lineDef.thicknessCode);
      if (option) {
        const selection = await prisma.productionOrderLineCategorySelection.create({
          data: {
            organizationId: acme.id,
            productionOrderLineId: createdLine.id,
            productCategoryId: thickness.id,
          },
        });
        await prisma.productionOrderLineCategoryOption.create({
          data: { selectionId: selection.id, categoryOptionId: option.id },
        });
      }
      await prisma.productionOrderProcess.createMany({
        data: snapshot.map((step) => ({
          organizationId: acme.id,
          productionOrderId: created.id,
          productionOrderLineId: createdLine.id,
          processId: step.processId,
          processName: step.processName,
          processCode: step.processCode,
          sequence: step.sequence,
          plannedQuantity: step.plannedQuantity,
        })),
      });
    }
    order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: created.id },
      include: { processes: true, lines: true },
    });
  } else if (order.lines.length === 0) {
    const createdLine = await prisma.productionOrderLine.create({
      data: {
        organizationId: acme.id,
        productionOrderId: order.id,
        productId: order.productId,
        quantity: order.quantity,
        lineNumber: 1,
      },
    });
    await prisma.productionOrderProcess.updateMany({
      where: { productionOrderId: order.id },
      data: { productionOrderLineId: createdLine.id },
    });
    order = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { processes: true, lines: true },
    });
  }

  const existingEntries = await prisma.productionEntry.count({ where: { productionOrderId: order.id } });
  if (existingEntries === 0) {
    const cuttingByLine = new Map(
      order.processes.filter((step) => step.processCode === "CUT").map((step) => [step.productionOrderLineId, step]),
    );
    const framingByLine = new Map(
      order.processes.filter((step) => step.processCode === "FRM").map((step) => [step.productionOrderLineId, step]),
    );
    const entryRows = [];
    for (const line of order.lines) {
      const cuttingStep = cuttingByLine.get(line.id);
      const framingStep = framingByLine.get(line.id);
      if (!cuttingStep || !framingStep) {
        continue;
      }
      entryRows.push(
        {
          organizationId: acme.id,
          plantId: mumbai.id,
          productionOrderId: order.id,
          orderProcessId: cuttingStep.id,
          entryDate: parseDateOnly("2026-08-30"),
          quantity: line.quantity,
          createdByUserId: admin.id,
        },
        {
          organizationId: acme.id,
          plantId: mumbai.id,
          productionOrderId: order.id,
          orderProcessId: framingStep.id,
          entryDate: parseDateOnly("2026-08-31"),
          quantity: Math.min(150, line.quantity),
          createdByUserId: admin.id,
        },
      );
    }
    if (entryRows.length > 0) {
      await prisma.productionEntry.createMany({ data: entryRows });
      await prisma.productionOrder.update({
        where: { id: order.id },
        data: { lifecycleStatus: "IN_PRODUCTION" },
      });
    }
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
