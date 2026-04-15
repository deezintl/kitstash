"use client";

import clsx from "clsx";
import type { Category } from "@/lib/types";

const styles: Record<Category, string> = {
  Recon: "badge-recon",
  "Direct Action": "badge-direct-action",
  Arrest: "badge-arrest",
};

export function CategoryBadge({ category }: { category: Category | null }) {
  if (!category) return null;
  return (
    <span
      className={clsx(
        "inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider rounded-sm",
        styles[category]
      )}
    >
      {category}
    </span>
  );
}
