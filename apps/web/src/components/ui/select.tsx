"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ArrowDown2, Check } from "iconsax-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Radix's Select.Item forbids an empty-string value (it's reserved
// internally for "show the placeholder") — but callers of this component
// legitimately use "" as a real option value (e.g. FilterSidebar's "Any"
// stops filter). Translate transparently at the boundary so that quirk
// never leaks into the rest of the app.
const EMPTY_VALUE = "__empty__";

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ label, options, value, placeholder, onChange, disabled }, ref) => {
    const generatedId = React.useId();

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={generatedId}
            className="text-sm font-medium leading-none text-foreground"
          >
            {label}
          </label>
        )}
        <SelectPrimitive.Root
          value={value === "" ? EMPTY_VALUE : value}
          onValueChange={(next) => onChange(next === EMPTY_VALUE ? "" : next)}
          disabled={disabled}
        >
          <SelectPrimitive.Trigger
            id={generatedId}
            ref={ref}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <ArrowDown2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>
          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              position="popper"
              sideOffset={4}
              className="relative z-50 max-h-96 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            >
              <SelectPrimitive.Viewport className="p-1">
                {options.map((option) => {
                  const itemValue = option.value === "" ? EMPTY_VALUE : option.value;
                  return (
                    <SelectPrimitive.Item
                      key={itemValue}
                      value={itemValue}
                      className={cn(
                        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                        "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="h-4 w-4" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  );
                })}
              </SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
