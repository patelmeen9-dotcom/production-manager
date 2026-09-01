import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js fragment used by middleware.
 * Must not import Prisma, bcrypt, or other Node-only modules.
 */
export const authConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    /**
     * Edge-safe: map JWT subject (and optional userId claim) onto session.user.id
     * so middleware authorized() agrees with Node auth()/getAuthContext().
     */
    session({ session, token }) {
      const userId =
        (typeof token.sub === "string" && token.sub) ||
        (typeof token.userId === "string" && token.userId) ||
        "";
      if (session.user && userId) {
        session.user.id = userId;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user?.id);
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/login")) {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
