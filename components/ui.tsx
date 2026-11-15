// Ayarlar penceresi ve telefon sayfasının ortak yapı taşları.

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-edge px-5 py-4 first:border-t-0">
      <h3 className="mb-1 text-[11px] font-semibold tracking-[.24em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`group flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 text-left ${FOCUS}`}
    >
      <span
        className={`text-sm font-medium tracking-wide transition-colors ${
          checked ? "text-ink" : "text-muted group-hover:text-ink"
        }`}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={`relative h-5 w-10 shrink-0 border transition-colors duration-200 ${
          checked ? "border-ink bg-ink" : "border-edge bg-flap-lo"
        }`}
      >
        <span
          className={`absolute top-0.5 size-3.5 transition-[left,background-color] duration-200 ${
            checked ? "left-[22px] bg-pit" : "left-0.5 bg-muted"
          }`}
        />
      </span>
    </button>
  );
}

/** Birkaç seçenekten birini seçmek için yan yana düğmeler. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; aria?: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-px border border-edge bg-edge"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={o.aria}
          className={`min-h-9 cursor-pointer px-1 text-xs font-semibold tracking-wider tabular-nums transition-colors ${FOCUS} focus-visible:z-10 ${
            value === o.value ? "bg-ink text-pit" : "bg-pit text-muted hover:text-ink"
          }`}
          onClick={() => value !== o.value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const FIELD_LABEL = "mb-2 mt-3 text-sm font-medium tracking-wide";
