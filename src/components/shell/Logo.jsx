import { cx } from "@/components/ui/primitives";

export function Logo({ className }) {
  return (
    // A kite: three round corners and one sharp one.
    <span aria-hidden="true" className={cx("flex size-[30px] shrink-0 items-center justify-center rounded-[50%_50%_50%_14%] bg-accent text-[13px] font-bold text-white", className)}>
      M
    </span>
  );
}
