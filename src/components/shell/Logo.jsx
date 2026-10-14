import { cx } from "@/components/ui/primitives";

export function Logo({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cx("flex size-7 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-accent text-[13px] font-semibold text-accent", className)}
    >
      M
    </span>
  );
}
