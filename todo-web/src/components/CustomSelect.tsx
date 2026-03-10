import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type Option = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
};

export function CustomSelect({
  value,
  options,
  onChange,
  className = "",
  placeholder,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder ?? "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-1 bg-bg-secondary text-[12px] text-text py-1.5 px-2 rounded outline-none focus:ring-1 focus:ring-accent/30 transition-all duration-150"
      >
        <span className={selected ? "text-text" : "text-text-tertiary"}>
          {displayLabel}
        </span>
        <ChevronDown
          size={12}
          className={`text-text-tertiary transition-transform duration-150 flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-40 top-full left-0 mt-1 min-w-full w-max bg-bg border border-border rounded-lg shadow-lg py-1 animate-fade-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-bg-hover transition-colors duration-100 ${
                opt.value === value
                  ? "text-accent font-medium"
                  : "text-text"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
