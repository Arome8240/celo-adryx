"use client";

import { useState } from "react";
import { ArrowLeft2, ArrowRight2 } from "iconsax-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface CalendarProps {
  /** "YYYY-MM-DD" */
  value?: string;
  onSelect: (value: string) => void;
  /** "YYYY-MM-DD", inclusive */
  minDate?: string;
  /** "YYYY-MM-DD", inclusive */
  maxDate?: string;
}

// `new Date("YYYY-MM-DD")` parses as UTC midnight, which off-by-one's in any
// timezone behind UTC — construct from local y/m/d components instead.
function parseDateString(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Hand-rolled month-grid date picker — plain Date arithmetic, no
 * react-day-picker/date-fns. Single-date selection only, with min/max
 * bounds (no-past-dates, return-not-before-departure).
 */
export function Calendar({ value, onSelect, minDate, maxDate }: CalendarProps) {
  const selected = value ? parseDateString(value) : undefined;
  const min = minDate ? parseDateString(minDate) : undefined;
  const max = maxDate ? parseDateString(maxDate) : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewDate, setViewDate] = useState(() => selected ?? min ?? today);
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const startWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function isDisabled(day: number): boolean {
    const date = new Date(viewYear, viewMonth, day);
    if (min && date < min) return true;
    if (max && date > max) return true;
    return false;
  }

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="w-72">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewYear, viewMonth - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft2 className="h-4 w-4" />
          <span className="sr-only">Previous month</span>
        </button>
        <span className="text-sm font-semibold">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => setViewDate(new Date(viewYear, viewMonth + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowRight2 className="h-4 w-4" />
          <span className="sr-only">Next month</span>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />;
          const date = new Date(viewYear, viewMonth, day);
          const disabled = isDisabled(day);
          const isSelected = selected ? isSameDay(date, selected) : false;
          const isToday = isSameDay(date, today);
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(formatDateString(date))}
              className={cn(
                "mx-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                disabled && "cursor-not-allowed text-muted-foreground/40",
                !disabled && !isSelected && "hover:bg-accent",
                isSelected && "bg-primary font-semibold text-primary-foreground",
                !isSelected && isToday && "font-semibold text-primary",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
