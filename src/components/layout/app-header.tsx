import Link from "next/link";
import { PlantSwitcher } from "@/components/plants/plant-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ALL_PLANTS } from "@/lib/plants/scope";
import type { PlantScope } from "@/lib/plants/scope";

type PlantOption = { id: string; name: string };

function NavLink(props: { href: string; children: React.ReactNode }) {
  return (
    <Link prefetch={false} className="text-ink-soft hover:text-ink" href={props.href}>
      {props.children}
    </Link>
  );
}

export function AppHeader(props: {
  organizationName: string | null;
  role: string;
  plants: PlantOption[];
  scope: PlantScope;
  canUseAllPlants: boolean;
  canManageOrg: boolean;
  canSeeAudit: boolean;
}) {
  const selected =
    props.scope.mode === "all" ? ALL_PLANTS : props.scope.mode === "one" ? props.scope.plantId : "";

  return (
    <header className="border-b border-line bg-panel px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Production Manager</p>
          <p className="text-xs text-ink-soft">
            {props.organizationName ?? "Platform"} · {props.role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {props.organizationName ? (
            <PlantSwitcher
              plants={props.plants}
              selected={selected}
              canUseAllPlants={props.canUseAllPlants}
            />
          ) : null}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
      {props.organizationName ? (
        <nav className="mt-3 flex flex-wrap gap-4 text-sm">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/orders">Orders</NavLink>
          <NavLink href="/entries">Entries</NavLink>
          <NavLink href="/plants">Plants</NavLink>
          <NavLink href="/clients">Clients</NavLink>
          <NavLink href="/products">Products</NavLink>
          <NavLink href="/product-categories">Product categories</NavLink>
          <NavLink href="/processes">Processes</NavLink>
          <NavLink href="/mappings">Mappings</NavLink>
          <NavLink href="/special-activities">Special activities</NavLink>
          {props.canManageOrg ? (
            <>
              <NavLink href="/organization">Organization</NavLink>
              <NavLink href="/users">Users</NavLink>
            </>
          ) : null}
          {props.canSeeAudit ? (
            <>
              <NavLink href="/import">Import</NavLink>
              <NavLink href="/audit">Audit</NavLink>
            </>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
