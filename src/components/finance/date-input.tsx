import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayDate } from "@/lib/finance";

export function DateInput({
  name,
  defaultValue = "",
  required = false,
  value,
  onChange,
  ariaLabel,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  ariaLabel?: string;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;
  const [typed, setTyped] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  function update(next: string) {
    setInternal(next);
    onChange?.(next);
  }
  return (
    <span className="date-input-wrap">
      <input
        type="text"
        aria-label={ariaLabel}
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
        maxLength={10}
        required={required}
        value={typed ?? (current ? displayDate(current) : "")}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
          const formatted =
            digits.slice(0, 2) +
            (digits.length > 2 ? "/" + digits.slice(2, 4) : "") +
            (digits.length > 4 ? "/" + digits.slice(4) : "");
          setTyped(formatted);
          update(
            digits.length === 8
              ? `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`
              : "",
          );
        }}
        onBlur={() => setTyped(null)}
      />
      <input type="hidden" name={name} value={current} />
      <input
        ref={picker}
        type="date"
        className="native-date-picker"
        tabIndex={-1}
        aria-hidden="true"
        value={current}
        onChange={(e) => {
          setTyped(null);
          update(e.target.value);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="date-picker-button"
        aria-label="Abrir calendário"
        title="Abrir calendário"
        onClick={() => picker.current?.showPicker()}
      >
        <CalendarDays />
      </Button>
    </span>
  );
}
