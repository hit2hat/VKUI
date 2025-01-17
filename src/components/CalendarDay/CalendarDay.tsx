import * as React from "react";
import { classNames } from "../../lib/classNames";
import { Tappable } from "../Tappable/Tappable";
import { ENABLE_KEYBOARD_INPUT_EVENT_NAME } from "../../hooks/useKeyboardInputTracker";
import { LocaleProviderContext } from "../LocaleProviderContext/LocaleProviderContext";
import "./CalendarDay.css";

export interface CalendarDayProps {
  day: Date;
  today?: boolean;
  selected?: boolean;
  selectionStart?: boolean;
  selectionEnd?: boolean;
  hintedSelectionStart?: boolean;
  hintedSelectionEnd?: boolean;
  active?: boolean;
  hidden?: boolean;
  disabled?: boolean;
  focused?: boolean;
  hinted?: boolean;
  sameMonth?: boolean;
  size?: "s" | "m";
  onChange(value: Date): void;
  onEnter?(value: Date): void;
  onLeave?(value: Date): void;
}

export const CalendarDay = React.memo(
  ({
    day,
    today,
    selected,
    onChange,
    hidden,
    disabled,
    active,
    selectionStart,
    selectionEnd,
    focused,
    onEnter,
    onLeave,
    hinted,
    hintedSelectionStart,
    hintedSelectionEnd,
    sameMonth,
    size,
  }: CalendarDayProps) => {
    const locale = React.useContext(LocaleProviderContext);
    const ref = React.useRef<HTMLElement>(null);
    const onClick = React.useCallback(() => onChange(day), [day, onChange]);
    const handleEnter = React.useCallback(() => onEnter?.(day), [day, onEnter]);
    const handleLeave = React.useCallback(() => onLeave?.(day), [day, onLeave]);

    React.useEffect(() => {
      if (focused && ref.current) {
        ref.current.dispatchEvent(
          new Event(ENABLE_KEYBOARD_INPUT_EVENT_NAME, { bubbles: true })
        );
        ref.current.focus();
      }
    }, [focused]);

    if (hidden) {
      return <div vkuiClass="CalendarDay__hidden"></div>;
    }

    return (
      <Tappable
        vkuiClass={classNames(
          "CalendarDay",
          `CalendarDay--size-${size}`,
          today && "CalendarDay--today",
          selected && !disabled && "CalendarDay--selected",
          active && !disabled && "CalendarDay--active",
          selectionStart && "CalendarDay--selection-start",
          selectionEnd && "CalendarDay--selection-end",
          disabled && "CalendarDay--disabled",
          !sameMonth && "CalendarDay--not-same-month"
        )}
        hoverMode={active ? "CalendarDay--active-hover" : "CalendarDay--hover"}
        hasActive={false}
        onClick={onClick}
        disabled={disabled}
        aria-label={new Intl.DateTimeFormat(locale, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }).format(day)}
        tabIndex={-1}
        getRootRef={ref}
        focusVisibleMode={active ? "outside" : "inside"}
        onEnter={handleEnter}
        onLeave={handleLeave}
      >
        <div
          vkuiClass={classNames(
            "CalendarDay__hinted",
            hinted && "CalendarDay__hinted--active",
            hintedSelectionStart && "CalendarDay__hinted--selection-start",
            hintedSelectionEnd && "CalendarDay__hinted--selection-end"
          )}
        >
          <div
            vkuiClass={classNames(
              "CalendarDay__inner",
              active && !disabled && "CalendarDay__inner--active"
            )}
          >
            <div vkuiClass="CalendarDay__day-number">{day.getDate()}</div>
          </div>
        </div>
      </Tappable>
    );
  }
);

CalendarDay.displayName = "CalendarDay";
