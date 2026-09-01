import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth/auth.config";

describe("auth middleware authorized callback", () => {
  const authorized = authConfig.callbacks.authorized!;

  function request(pathname: string) {
    return { nextUrl: new URL(`http://localhost:3000${pathname}`) } as Parameters<typeof authorized>[0]["request"];
  }

  function authWithId(id: string) {
    return {
      user: {
        id,
        email: "a@b.c",
        name: "Test",
        role: Role.VIEWER,
        organizationId: "org-1",
        emailVerified: null,
      },
    } as Parameters<typeof authorized>[0]["auth"];
  }

  it("allows anonymous access to /login without redirecting", () => {
    expect(authorized({ auth: null, request: request("/login") })).toBe(true);
  });

  it("redirects authenticated users away from /login", () => {
    const result = authorized({
      auth: authWithId("u1"),
      request: request("/login"),
    });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("blocks anonymous access to /dashboard", () => {
    expect(authorized({ auth: null, request: request("/dashboard") })).toBe(false);
  });

  it("allows authenticated access to /dashboard", () => {
    expect(authorized({ auth: authWithId("u1"), request: request("/dashboard") })).toBe(true);
  });

  it("treats a session without user.id as logged out (avoids redirect loop)", () => {
    expect(
      authorized({
        auth: {
          user: {
            email: "a@b.c",
            name: "Test",
            role: Role.VIEWER,
            organizationId: "org-1",
            emailVerified: null,
          },
        } as Parameters<typeof authorized>[0]["auth"],
        request: request("/dashboard"),
      }),
    ).toBe(false);
  });
});

describe("edge session id mapping", () => {
  const sessionCb = authConfig.callbacks.session!;

  it("maps token.sub onto session.user.id for middleware", () => {
    const result = sessionCb({
      session: { user: { email: "a@b.c", emailVerified: null }, expires: "" },
      token: { sub: "user-123" },
    } as never);
    expect(result.user?.id).toBe("user-123");
  });

  it("falls back to token.userId when sub is missing", () => {
    const result = sessionCb({
      session: { user: { email: "a@b.c", emailVerified: null }, expires: "" },
      token: { userId: "user-456" },
    } as never);
    expect(result.user?.id).toBe("user-456");
  });
});
