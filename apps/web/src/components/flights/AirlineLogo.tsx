"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function AirlineLogo({
  code,
  size = 20,
  className,
}: {
  code: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <span className={cn("text-xs font-semibold text-muted-foreground", className)}>
        {code}
      </span>
    );
  }

  return (
    <Image
      src={`https://www.gstatic.com/flights/airline_logos/70px/${code}.png`}
      alt={code}
      width={size}
      height={size}
      className={cn("rounded-sm object-contain", className)}
      onError={() => setErrored(true)}
    />
  );
}
