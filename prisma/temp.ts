import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function check() {
    const user = await prisma.user.findUnique({
        where: { email: "admin@spdoors.com" },
    });
    console.log("User found:", user ? "YES" : "NO");
    if (user) {
        console.log("Email:", user.email);
        console.log("Name:", user.name);
        console.log("Role:", user.role);
        console.log("Password hash present:", !!user.passwordHash);
    }
    await prisma.$disconnect();
}
check();