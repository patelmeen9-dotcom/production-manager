import Link from "next/link";
import { PlantSwitcher } from "@/components/plants/plant-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ALL_PLANTS } from "@/lib/plants/scope";
import type { PlantScope } from "@/lib/plants/scope";

type PlantOption = { id: string; name: string };

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
          <Link className="text-ink-soft hover:text-ink" href="/dashboard">
            Dashboard
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/orders">
            Orders
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/entries">
            Entries
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/plants">
            Plants
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/clients">
            Clients
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/products">
            Products
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/product-categories">
            Product categories
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/processes">
            Processes
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/mappings">
            Mappings
          </Link>
          <Link className="text-ink-soft hover:text-ink" href="/special-activities">
            Special activities
          </Link>
          {props.canManageOrg ? (
            <>
              <Link className="text-ink-soft hover:text-ink" href="/organization">
                Organization
              </Link>
              <Link className="text-ink-soft hover:text-ink" href="/users">
                Users
              </Link>
            </>
          ) : null}
          {props.canSeeAudit ? (
            <>
              <Link className="text-ink-soft hover:text-ink" href="/import">
                Import
              </Link>
              <Link className="text-ink-soft hover:text-ink" href="/audit">
                Audit
              </Link>
            </>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
