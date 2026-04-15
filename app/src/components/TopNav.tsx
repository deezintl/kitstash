"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crosshair, Database, Upload, Home, Users } from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/gear", label: "Gear DB", icon: Database },
  { href: "/persons", label: "Persons", icon: Users },
  { href: "/upload", label: "Upload", icon: Upload },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="h-12 border-b border-border bg-surface flex items-center px-4 gap-6 shrink-0">
      <Link href="/" className="flex items-center gap-2 mr-4">
        <Crosshair className="w-5 h-5 text-accent" />
        <span className="font-mono font-semibold text-sm tracking-wide text-text-primary">
          KITSTASH
        </span>
      </Link>

      <div className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/5"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto font-mono text-[10px] text-text-secondary tracking-wider">
        v0.1.0
      </div>
    </nav>
  );
}
