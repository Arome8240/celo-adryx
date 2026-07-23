import * as React from "react";
import { ArrowDown2 } from "iconsax-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "onChange" | "value"
  > {
  label?: string;
  options: SelectOption[];
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

/**
 * A native <select> under the hood, not a Radix dropdown — this app doesn't
 * need custom option rendering (icons, multi-select, etc.) anywhere it uses
 * this, so the extra dependency isn't worth it.
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, value, placeholder, onChange, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium leading-none text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              "flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ArrowDown2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
