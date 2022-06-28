import * as React from "react";
import { classNames } from "../../lib/classNames";
import { Touch, TouchEvent } from "../Touch/Touch";
import HorizontalScrollArrow from "../HorizontalScroll/HorizontalScrollArrow";
import { useExternRef } from "../../hooks/useExternRef";
import { useDOM } from "../../lib/dom";
import { useAdaptivity } from "../../hooks/useAdaptivity";
import { useIsomorphicLayoutEffect } from "../../lib/useIsomorphicLayoutEffect";
import { useGlobalEventListener } from "../../hooks/useGlobalEventListener";
import { calcMax, calcMin } from "./helpers";
import {
  BaseGalleryProps,
  GallerySlidesState,
  LayoutState,
  ShiftingState,
} from "./types";
import "./BaseGallery.css";

const ANIMATION_DURATION = 0.24;

const LAYOUT_DEFAULT_STATE = {
  containerWidth: 0,
  viewportOffsetWidth: 0,
  layerWidth: 0,
  min: 0,
  max: 0,
  slides: [],
  isFullyVisible: true,
};

const SHIFT_DEFAULT_STATE = {
  animation: undefined,
  shiftX: 0,
  dragging: false,
  deltaX: 0,
  indent: 0,
};

export const BaseGallery = ({
  bullets = false,
  getRootRef,
  children,
  slideWidth = "100%",
  slideIndex = 0,
  isDraggable = true,
  onDragStart,
  onDragEnd,
  onChange,
  onPrevClick,
  onNextClick,
  onEnd: onEndProp,
  align = "left",
  showArrows,
  getRef,
  ...restProps
}: BaseGalleryProps) => {
  const slidesStore = React.useRef<Record<string, HTMLDivElement | null>>({});
  const layoutState = React.useRef<LayoutState>(LAYOUT_DEFAULT_STATE);
  const [shiftState, setShiftState] =
    React.useState<ShiftingState>(SHIFT_DEFAULT_STATE);

  const rootRef = useExternRef(getRootRef);
  const viewportRef = useExternRef(getRef);

  const { window } = useDOM();
  const { hasMouse } = useAdaptivity();

  const isCenterWithCustomWidth = slideWidth === "custom" && align === "center";

  const validateIndent = (value: number) => {
    const localMax = layoutState.current.max ?? 0;
    const localMin = layoutState.current.min ?? 0;

    if (value < localMin) {
      return localMin;
    } else if (value > localMax) {
      return localMax;
    }

    return value;
  };

  /*
   * Считает отступ слоя галереи
   */
  const calculateIndent = (targetIndex: number) => {
    if (layoutState.current.isFullyVisible) {
      return 0;
    }

    const targetSlide = layoutState.current.slides?.length
      ? layoutState.current.slides[targetIndex]
      : null;

    if (targetSlide) {
      const { coordX, width } = targetSlide;

      if (isCenterWithCustomWidth) {
        const viewportWidth = layoutState.current.viewportOffsetWidth ?? 0;
        return viewportWidth / 2 - coordX - width / 2;
      }

      return validateIndent(-1 * coordX);
    }

    return 0;
  };

  /*
   * Считает отступ слоя галереи во время драга
   */
  const calculateDragIndent = () => {
    const localMax = layoutState.current.max ?? 0;
    const localMin = layoutState.current.min ?? 0;
    const indent = shiftState.shiftX + shiftState.deltaX;

    if (indent > localMax) {
      return localMax + Number((indent - localMax) / 3);
    } else if (indent < localMin) {
      return localMin + Number((indent - localMin) / 3);
    }

    return indent;
  };

  const initializeSlides = (options: { animation?: boolean } = {}) => {
    const localSlides =
      React.Children.map(
        children,
        (_item: React.ReactNode, i: number): GallerySlidesState => {
          const elem = slidesStore.current[`slide-${i}`];
          return {
            coordX: elem?.offsetLeft ?? 0,
            width: elem?.offsetWidth ?? 0,
          };
        }
      ) ?? [];

    const localContainerWidth = rootRef.current?.offsetWidth ?? 0;
    const localviewportOffsetWidth = viewportRef.current?.offsetWidth ?? 0;
    const localLayerWidth = localSlides.reduce(
      (val: number, slide: GallerySlidesState) => slide.width + val,
      0
    );

    layoutState.current = {
      containerWidth: localContainerWidth,
      viewportOffsetWidth: localviewportOffsetWidth,
      layerWidth: localLayerWidth,
      max: calcMax({
        slides: localSlides,
        viewportOffsetWidth: localviewportOffsetWidth,
        isCenterWithCustomWidth,
      }),
      min: calcMin({
        containerWidth: localContainerWidth,
        layerWidth: localLayerWidth,
        slides: localSlides,
        viewportOffsetWidth: localviewportOffsetWidth,
        isCenterWithCustomWidth,
        align,
      }),
      slides: localSlides,
      isFullyVisible: localLayerWidth <= localContainerWidth,
    };

    setShiftState((prevState) => ({
      ...prevState,
      shiftX: calculateIndent(slideIndex),
      animation:
        options.animation ??
        prevState.shiftX === validateIndent(prevState.shiftX),
    }));
  };

  const onResize = () => {
    if (shiftState.animation !== undefined) {
      initializeSlides({ animation: false });
    }
  };

  useGlobalEventListener(window, "resize", onResize);

  useIsomorphicLayoutEffect(() => {
    initializeSlides({ animation: false });
  }, [children, align, slideWidth]);

  useIsomorphicLayoutEffect(() => {
    if (shiftState.animation !== undefined) {
      setShiftState((prevState) => ({
        ...prevState,
        animation: true,
        deltaX: 0,
        shiftX: calculateIndent(slideIndex ?? 0),
      }));
    }
  }, [slideIndex]);

  const slideLeft = () => {
    onChange?.(slideIndex - 1);
    onPrevClick?.();
  };

  const slideRight = () => {
    onChange?.(slideIndex + 1);
    onNextClick?.();
  };

  /*
   * Получает индекс слайда, к которому будет осуществлен переход
   */
  const getTarget = (e: TouchEvent) => {
    const expectDeltaX = (shiftState.deltaX / e.duration) * 240 * 0.6;
    const shift =
      shiftState.shiftX +
      shiftState.deltaX +
      expectDeltaX -
      (layoutState.current.max ?? 0);
    const direction = shiftState.deltaX < 0 ? 1 : -1;

    // Находим ближайшую границу слайда к текущему отступу
    let targetIndex = layoutState.current.slides.reduce(
      (val: number, item: GallerySlidesState, index: number) => {
        const previousValue = Math.abs(
          layoutState.current.slides[val].coordX + shift
        );
        const currentValue = Math.abs(item.coordX + shift);

        return previousValue < currentValue ? val : index;
      },
      slideIndex
    );

    if (targetIndex === slideIndex) {
      let targetSlide = slideIndex + direction;

      if (targetSlide >= 0 && targetSlide < layoutState.current.slides.length) {
        if (
          Math.abs(shiftState.deltaX) >
          layoutState.current.slides[targetSlide].width * 0.05
        ) {
          targetIndex = targetSlide;
        }
      }
    }

    return targetIndex;
  };

  const onStart = () => {
    setShiftState((prevState) => ({ ...prevState, animation: false }));
  };

  const onMoveX = (e: TouchEvent) => {
    if (isDraggable && !layoutState.current.isFullyVisible) {
      e.originalEvent.preventDefault();

      if (e.isSlideX) {
        // TODO исправить в рамках issue #2698
        onDragStart?.(e);

        if (shiftState.deltaX !== e.shiftX) {
          setShiftState((prevState) => ({
            ...prevState,
            deltaX: e.shiftX,
            dragging: e.isSlideX,
          }));
        }
      }
    }
  };

  const onEnd = (e: TouchEvent) => {
    const targetIndex = e.isSlide ? getTarget(e) : slideIndex ?? 0;
    onDragEnd?.(e);

    const nextShiftState: Partial<ShiftingState> = {
      animation: true,
      dragging: false,
      deltaX: 0,
    };

    const shiftXStick = calculateDragIndent();
    if (targetIndex !== slideIndex) {
      // Сохраняем сдвиг слайда в том положении, в каком его оставили после драга (fix issue #2185)
      nextShiftState.shiftX = shiftXStick;
    }

    setShiftState((prevState) => ({ ...prevState, ...nextShiftState }));
    if (targetIndex !== slideIndex) {
      onChange?.(targetIndex);
    }

    // TODO исправить в рамках issue #2698
    onEndProp?.({ targetIndex });
  };

  const indent = shiftState.dragging
    ? calculateDragIndent()
    : shiftState.shiftX;

  const layerStyle = {
    WebkitTransform: `translateX(${indent}px)`,
    transform: `translateX(${indent}px)`,
    WebkitTransition: shiftState.animation
      ? `-webkit-transform ${ANIMATION_DURATION}s cubic-bezier(.1, 0, .25, 1)`
      : "none",
    transition: shiftState.animation
      ? `transform ${ANIMATION_DURATION}s cubic-bezier(.1, 0, .25, 1)`
      : "none",
  };

  const setSlideRef = (slideRef: HTMLDivElement | null, slideIndex: number) => {
    slidesStore.current[`slide-${slideIndex}`] = slideRef;
  };

  // shiftX is negative number <= 0, we can swipe back only if it is < 0
  const canSlideLeft =
    !layoutState.current.isFullyVisible && shiftState.shiftX < 0;

  const canSlideRight =
    !layoutState.current.isFullyVisible &&
    // we can't move right when gallery layer fully scrolled right, if gallery aligned by left side
    ((align === "left" &&
      layoutState.current.containerWidth - shiftState.shiftX <
        (layoutState.current.layerWidth ?? 0)) ||
      // otherwise we need to check current slide index (align = right or align = center)
      (align !== "left" && slideIndex < layoutState.current.slides.length - 1));

  return (
    <div
      {...restProps}
      vkuiClass={classNames(
        "Gallery",
        `Gallery--${align}`,
        shiftState.dragging && "Gallery--dragging",
        slideWidth === "custom" && "Gallery--custom-width"
      )}
      ref={rootRef}
    >
      <Touch
        vkuiClass="Gallery__viewport"
        onStartX={onStart}
        onMoveX={onMoveX}
        onEnd={onEnd}
        style={{ width: slideWidth === "custom" ? "100%" : slideWidth }}
        getRootRef={viewportRef}
        noSlideClick
      >
        <div vkuiClass="Gallery__layer" style={layerStyle}>
          {React.Children.map(children, (item: React.ReactNode, i: number) => (
            <div
              vkuiClass="Gallery__slide"
              key={`slide-${i}`}
              ref={(el) => setSlideRef(el, i)}
            >
              {item}
            </div>
          ))}
        </div>
      </Touch>

      {bullets && (
        <div
          aria-hidden="true"
          vkuiClass={classNames(
            "Gallery__bullets",
            `Gallery__bullets--${bullets}`
          )}
        >
          {React.Children.map(
            children,
            (_item: React.ReactNode, index: number) => (
              <div
                vkuiClass={classNames(
                  "Gallery__bullet",
                  index === slideIndex && "Gallery__bullet--active"
                )}
                key={index}
              />
            )
          )}
        </div>
      )}

      {showArrows && hasMouse && canSlideLeft && (
        <HorizontalScrollArrow direction="left" onClick={slideLeft} />
      )}
      {showArrows && hasMouse && canSlideRight && (
        <HorizontalScrollArrow direction="right" onClick={slideRight} />
      )}
    </div>
  );
};