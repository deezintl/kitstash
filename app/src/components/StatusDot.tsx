"use client";

import clsx from "clsx";

export function StatusDot({ status }: { status: "production" | "discontinued" }) {
  return (
    <span
      className={clsx(
        "inline-block w-1.5 h-1.5 rounded-full shrink-0",
        status === "production" ? "bg-accent" : "bg-warning"
      )}
      title={status === "production" ? "In Production" : "Discontinued"}
    />
  );
}
