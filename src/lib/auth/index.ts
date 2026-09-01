import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth/auth.config";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/lib/validation/auth";

declare module "next-auth" {
  interface User {
    role: Role;
    organizationId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      organizationId: string | null;
      emailVerified: Date | null;
    };
  }
}

function readRole(value: unknown): Role {
  if (typeof value === "string" && (Object.values(Role) as string[]).includes(value)) {
    return value as Role;
  }
  return Role.VIEWER;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          logger.warn("login_failed", { email, reason: "unknown_or_inactive" });
          return null;
        }

        if (user.role !== Role.SUPER_ADMIN && !user.organizationId) {
          logger.warn("login_failed", { email, reason: "tenant_user_missing_organization" });
          return null;
        }

        const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordOk) {
          logger.warn("login_failed", { email, reason: "invalid_password" });
          return null;
        }

        logger.info("login_success", { userId: user.id, organizationId: user.organizationId, role: user.role });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Always keep token.sub in sync with the user id.
     * Middleware uses the edge authConfig (no Prisma session callback); Auth.js
     * defaults map session.user.id from token.sub. If only token.userId is set,
     * middleware treats the user as logged out while Node auth() treats them as
     * logged in — causing a /dashboard ↔ /login redirect loop.
     */
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.userId = user.id;
      }

      const userId =
        (typeof token.userId === "string" && token.userId) ||
        (typeof token.sub === "string" && token.sub) ||
        "";
      if (!userId) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          isActive: true,
        },
      });

      if (!dbUser || !dbUser.isActive) {
        token.sub = undefined;
        token.userId = "";
        token.role = Role.VIEWER;
        token.organizationId = null;
        token.email = undefined;
        token.name = undefined;
        return token;
      }

      token.sub = dbUser.id;
      token.userId = dbUser.id;
      token.role = dbUser.role;
      token.organizationId = dbUser.organizationId;
      token.email = dbUser.email;
      token.name = dbUser.name;
      return token;
    },
    async session({ session, token }) {
      const userId =
        (typeof token.userId === "string" && token.userId) ||
        (typeof token.sub === "string" && token.sub) ||
        "";
      if (!userId) {
        return session;
      }

      session.user = {
        id: userId,
        email: typeof token.email === "string" ? token.email : "",
        name: typeof token.name === "string" ? token.name : "",
        role: readRole(token.role),
        organizationId: typeof token.organizationId === "string" ? token.organizationId : null,
        emailVerified: null,
      };

      return session;
    },
  },
});
