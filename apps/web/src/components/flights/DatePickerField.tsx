"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "iconsax-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface DatePickerFieldProps {
  label: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** "YYYY-MM-DD", inclusive */
  minDate?: string;
  /** "YYYY-MM-DD", inclusive */
  maxDate?: string;
  placeholder?: string;
}

function formatDisplay(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Select date",
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium leading-none text-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <Calendar
            value={value || undefined}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
