import { cx } from "@/components/ui/primitives";

export function Logo({ className }) {
  return (
    <span aria-hidden="true" className={cx("flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-[15px] font-semibold text-accent-on", className)}>
      M
    </span>
  );
}
