import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ORGANIZATION_SETTINGS } from "../src/lib/organization-settings";

const prisma = new PrismaClient();

// Helper to upsert a user with a fixed password "123"
async function upsertUser(data: {
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
}) {
  const passwordHash = await bcrypt.hash("123", 12);
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

// Helper to upsert a plant
async function upsertPlant(organizationId: string, code: string, name: string, location: string) {
  return prisma.plant.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: { name, location, isActive: true },
    create: { organizationId, code, name, location, isActive: true },
  });
}

// Helper to upsert a category and assign it to the product
async function upsertCategory(input: {
  code: string;
  name: string;
  inputType: "OPEN_TEXT" | "DROPDOWN";
  choiceMode?: "SINGLE" | "MULTI" | null;
  options?: { code: string; name: string }[];
  organizationId: string;
  productId: string;
}) {
  const { organizationId, productId, ...rest } = input;
  const category = await prisma.productCategory.upsert({
    where: { organizationId_code: { organizationId, code: rest.code } },
    update: {
      name: rest.name,
      isActive: true,
      inputType: rest.inputType,
      choiceMode: rest.inputType === "DROPDOWN" ? rest.choiceMode ?? "SINGLE" : null,
    },
    create: {
      organizationId,
      code: rest.code,
      name: rest.name,
      inputType: rest.inputType,
      choiceMode: rest.inputType === "DROPDOWN" ? rest.choiceMode ?? "SINGLE" : null,
      isActive: true,
    },
  });
  if (rest.inputType === "DROPDOWN" && rest.options) {
    await prisma.productCategoryOption.deleteMany({ where: { productCategoryId: category.id } });
    await prisma.productCategoryOption.createMany({
      data: rest.options.map((option, index) => ({
        organizationId,
        productCategoryId: category.id,
        code: option.code,
        name: option.name,
        sortOrder: index,
        isActive: true,
        updatedAt: new Date(),
      })),
    });
  }
  // Assign this category to the product
  await prisma.productCategoryAssignment.upsert({
    where: { productId_productCategoryId: { productId, productCategoryId: category.id } },
    update: {},
    create: { organizationId, productId, productCategoryId: category.id },
  });
  return category;
}

// Helper to upsert a process
async function upsertProcess(organizationId: string, name: string, code: string, unitsPerDay?: number) {
  return prisma.process.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: { name, isActive: true, unitsPerDay: unitsPerDay ?? null },
    create: { organizationId, name, code, isActive: true, unitsPerDay: unitsPerDay ?? null },
  });
}

// Helper to replace process mapping for a plant+product
async function replaceMapping(
  organizationId: string,
  plantId: string,
  productId: string,
  processIds: string[]
) {
  await prisma.plantProductProcessMapping.deleteMany({
    where: { organizationId, plantId, productId },
  });
  await prisma.plantProductProcessMapping.createMany({
    data: processIds.map((processId, index) => ({
      organizationId,
      plantId,
      productId,
      processId,
      sequence: index + 1,
      isActive: true,
    })),
  });
}

// Helper to upsert a special activity
async function upsertActivity(
  organizationId: string,
  name: string,
  code: string,
  activityType: "SPECIAL_PROCESS" | "REWORK" | "OTHER"
) {
  return prisma.specialActivity.upsert({
    where: { organizationId_code: { organizationId, code } },
    update: { name, activityType, isActive: true },
    create: { organizationId, name, code, activityType, isActive: true },
  });
}

async function main() {
  // 1. Create organization: Sankalp Doors
  const sp = await prisma.organization.upsert({
    where: { slug: "spdoors" },
    update: { name: "Sankalp Doors", settings: DEFAULT_ORGANIZATION_SETTINGS },
    create: {
      name: "Sankalp Doors",
      slug: "spdoors",
      settings: DEFAULT_ORGANIZATION_SETTINGS,
    },
  });

  // 2. Create users with password "123"
  const users = [
    { email: "admin@spdoors.com", name: "Admin", role: Role.ORGANIZATION_ADMIN },
    { email: "manager@spdoors.com", name: "Manager", role: Role.PRODUCTION_MANAGER },
    { email: "operator@spdoors.com", name: "Operator", role: Role.PRODUCTION_OPERATOR },
    { email: "viewer@spdoors.com", name: "Viewer", role: Role.VIEWER },
  ];
  for (const u of users) {
    await upsertUser({ ...u, organizationId: sp.id });
  }

  // 3. Create plants
  const plantSurat = await upsertPlant(sp.id, "PLANT-SURAT", "Plant-Surat", "Surat");
  const plantSurat2 = await upsertPlant(sp.id, "PLANT-SURAT2", "Plant-Surat unit2", "Surat");

  // 4. All users get access to both plants
  const allUsers = await prisma.user.findMany({
    where: { organizationId: sp.id },
    select: { id: true },
  });
  const userIds = allUsers.map((u) => u.id);
  // Clear any existing access for these users
  await prisma.userPlantAccess.deleteMany({
    where: { userId: { in: userIds } },
  });
  // Give access to both plants
  await prisma.userPlantAccess.createMany({
    data: [
      ...userIds.map((userId) => ({ organizationId: sp.id, userId, plantId: plantSurat.id })),
      ...userIds.map((userId) => ({ organizationId: sp.id, userId, plantId: plantSurat2.id })),
    ],
  });

  // 5. Create product: Door (only one, for both plants)
  const door = await prisma.product.upsert({
    where: { organizationId_code: { organizationId: sp.id, code: "DOOR" } },
    update: { name: "Door", isActive: true },
    create: { organizationId: sp.id, name: "Door", code: "DOOR", isActive: true },
  });

  // 6. Create categories and assign to Door
  // All categories are organization-wide; we assign each to the door product.
  // The list from user:
  const categories = [
    {
      code: "FILLER",
      name: "FILLER",
      inputType: "DROPDOWN" as const,
      choiceMode: "SINGLE" as const,
      options: [
        { code: "PINE", name: "PINE" },
        { code: "PARTICLE", name: "PARTICAL BOARD" },
        { code: "TUMBLER", name: "TUMBLER" },
        { code: "HARDWOOD", name: "HARWOOD" },
      ],
    },
    {
      code: "RESIN",
      name: "RESIN",
      inputType: "DROPDOWN" as const,
      choiceMode: "SINGLE" as const,
      options: [
        { code: "MR", name: "MR" },
        { code: "PF", name: "PF" },
      ],
    },
    {
      code: "THICKNESS",
      name: "THICKNESS",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "VARIANT",
      name: "Variant",
      inputType: "DROPDOWN" as const,
      choiceMode: "SINGLE" as const,
      options: [
        { code: "SINGLE", name: "SINGLE" },
        { code: "DOUBLE", name: "DOUBLE" },
      ],
    },
    {
      code: "SURFACE_FINISH",
      name: "SURFACE FINISH",
      inputType: "DROPDOWN" as const,
      choiceMode: "MULTI" as const,
      options: [
        { code: "LAMINATE", name: "LAMINATE" },
        { code: "VENEER", name: "VENEER" },
        { code: "FACE", name: "FACE" },
        { code: "CALIBRATED", name: "CALIBRATED" },
        { code: "HDF", name: "HDF" },
        { code: "HDHMR", name: "HDHMR" },
      ],
    },
    {
      code: "LOCK_RAIL",
      name: "LOCK RAIL",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "CONSTRUCTION",
      name: "CONSTRUCTION",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "FRAME_THICKNESS",
      name: "FRAME THICKNESS",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "FRAME_JOINT",
      name: "FRAME JOINT",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "CORE",
      name: "CORE",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "AREA",
      name: "AREA",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "WIDTH",
      name: "WIDTH",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "HEIGHT",
      name: "HEIGHT",
      inputType: "OPEN_TEXT" as const,
    },
    {
      code: "ADD_FEATURES",
      name: "Additional Door Features",
      inputType: "DROPDOWN" as const,
      choiceMode: "MULTI" as const,
      options: [
        { code: "LIPPING", name: "Lipping Patti" },
        { code: "VISION", name: "Vision Panel" },
        { code: "ACOUSTIC", name: "Acoustic Door" },
        { code: "DOUBLE", name: "Double Door" },
      ],
    },
  ];

  for (const cat of categories) {
    await upsertCategory({
      ...cat,
      organizationId: sp.id,
      productId: door.id,
    });
  }

  // 7. Create processes for each plant
  // Plant-Surat processes
  const plantSuratProcesses = [
    { name: "FRAME", code: "FRAME" },
    { name: "BEAT", code: "BEAT" },
    { name: "HOT PRESS", code: "HOT_PRESS" },
    { name: "ROUGH CUTTING", code: "ROUGH_CUT" },
    { name: "LAMINATE / HDF CUTTING", code: "LAM_HDF_CUT" },
    { name: "REPRESSING", code: "REPRESS" },
  ];
  const psProcessIds = [];
  for (const p of plantSuratProcesses) {
    const proc = await upsertProcess(sp.id, p.name, p.code);
    psProcessIds.push(proc.id);
  }

  // Plant-Surat unit2 processes
  const plantSurat2Processes = [
    { name: "RAW MATERIAL CUTTING & PASTING", code: "RAW_CUT_PASTE" },
    { name: "EDGE COVERING - P.F & EDGEBANDING", code: "EDGE_COVER" },
    { name: "DRILLING & MILLING - HARDWARE SLOTTING", code: "DRILL_MILL" },
    { name: "FRAME FINAL CUTTING & BOARING - 45 DEGREE CUTTING", code: "FRAME_FINAL_CUT" },
    { name: "Q/C", code: "QC" },
    { name: "CLEANING & PACKING", code: "CLEAN_PACK" },
  ];
  const ps2ProcessIds = [];
  for (const p of plantSurat2Processes) {
    const proc = await upsertProcess(sp.id, p.name, p.code);
    ps2ProcessIds.push(proc.id);
  }

  // 8. Map processes to door product per plant
  await replaceMapping(sp.id, plantSurat.id, door.id, psProcessIds);
  await replaceMapping(sp.id, plantSurat2.id, door.id, ps2ProcessIds);

  // 9. Create special activities (all as SPECIAL_PROCESS)
  await upsertActivity(sp.id, "Glass Mating", "GLASS-MATING", "SPECIAL_PROCESS");
  await upsertActivity(sp.id, "Special Polish", "SPECIAL-POLISH", "SPECIAL_PROCESS");
  await upsertActivity(sp.id, "Rework", "REWORK", "SPECIAL_PROCESS");

  // 10. No clients, no production orders, no entries – skip entirely

  console.log("Seed complete.");
  console.log("Organization: Sankalp Doors (slug: spdoors)");
  console.log("Plants: Plant-Surat, Plant-Surat unit2");
  console.log("Users created with password '123':");
  console.log("  admin@spdoors.com (ORGANIZATION_ADMIN)");
  console.log("  manager@spdoors.com (PRODUCTION_MANAGER)");
  console.log("  operator@spdoors.com (PRODUCTION_OPERATOR)");
  console.log("  viewer@spdoors.com (VIEWER)");
  console.log("All users have access to both plants.");
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