"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export interface SidebarLink {
  href: string;
  label: string;
  exact?: boolean;
}

export function SidebarNav({ links, horizontal }: { links: SidebarLink[]; horizontal?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={cn(horizontal ? "flex items-center gap-1 overflow-x-auto px-3 py-2" : "flex flex-col gap-0.5 px-3 py-4")}>
      {links.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
