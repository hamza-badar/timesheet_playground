import { useRef, type MouseEvent, type PointerEvent } from "react";

const LONG_PRESS_MS = 500;

export function useLongPress(opts: {
  onClick: () => void;
  onLongPress: () => void;
  disabled?: boolean;
  ms?: number;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      if (opts.disabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fired.current = false;
      clearTimer();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        opts.onLongPress();
      }, opts.ms ?? LONG_PRESS_MS);
    },
    onPointerUp: () => clearTimer(),
    onPointerLeave: () => clearTimer(),
    onPointerCancel: () => clearTimer(),
    onClick: (e: MouseEvent) => {
      if (opts.disabled) return;
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
        return;
      }
      opts.onClick();
    },
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (!opts.disabled) opts.onLongPress();
    },
  };
}
