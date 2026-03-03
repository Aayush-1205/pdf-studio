import { forwardRef, useRef, useMemo, useEffect } from "react";
import {
  Rect,
  Ellipse,
  Line,
  Text,
  Image as KonvaImage,
  Path,
  Group,
} from "react-konva";
import useImage from "use-image";
import { Layer, useCanvasStore } from "../../store/useCanvasStore";
import { getStroke } from "perfect-freehand";
import { getSvgPathFromStroke } from "../../app/lib/pdfUtils";

const LayerComponent = forwardRef<
  any,
  {
    id: string;
    layer: Layer;
    isSelected: boolean;
    onPointerDown: (e: any) => void;
    onDragEnd: (e: any) => void;
    onDblClick?: (e: any) => void;
  }
>(({ id, layer, isSelected, onPointerDown, onDragEnd, onDblClick }, ref) => {
  const {
    type,
    x,
    y,
    width,
    height,
    fill,
    stroke,
    text,
    fontSize,
    fontFamily,
    textAlign,
    points,
    src,
    opacity,
    isBold,
    isItalic,
    isUnderline,
    isStrikethrough,
    sampledBackgroundColor,
    rotation,
  } = layer;

  const interactiveProps = {
    id,
    opacity: (opacity ?? 100) / 100,
    rotation: rotation || 0,
    onPointerDown,
    onDragEnd,
    onDblClick,
    draggable: isSelected,
    onPointerEnter: () => {
      // Figma distance ruler target logic
      useCanvasStore.getState().setHoveredLayerId(id);
      document.body.style.cursor = isSelected ? "move" : "default"; // or whatever standard handling
    },
    onPointerLeave: () => {
      useCanvasStore.getState().setHoveredLayerId(null);
      document.body.style.cursor = "default";
    },
  };

  switch (type) {
    case "RECTANGLE":
      return (
        <Rect
          ref={ref}
          x={x}
          y={y}
          width={Math.max(1, width)}
          height={Math.max(1, height)}
          fill={fill}
          stroke={stroke === "transparent" ? undefined : stroke}
          strokeWidth={stroke === "transparent" ? 0 : 2}
          {...interactiveProps}
        />
      );

    case "ELLIPSE":
      return (
        <Group
          x={x}
          y={y}
          width={Math.max(1, width)}
          height={Math.max(1, height)}
          {...interactiveProps}
          ref={ref}
        >
          <Ellipse
            x={Math.max(0.5, width / 2)}
            y={Math.max(0.5, height / 2)}
            radiusX={Math.max(0.5, width / 2)}
            radiusY={Math.max(0.5, height / 2)}
            fill={fill}
            stroke={stroke === "transparent" ? undefined : stroke}
            strokeWidth={stroke === "transparent" ? 0 : 2}
          />
        </Group>
      );

    case "LINE":
      return (
        <Group
          x={x}
          y={y}
          width={Math.max(1, width)}
          height={Math.max(1, height)}
          {...interactiveProps}
          ref={ref}
        >
          <Line
            points={[0, height / 2, width, height / 2]}
            stroke={fill}
            strokeWidth={Math.max(2, height)}
          />
        </Group>
      );

    case "ARROW":
      // We can use Konva's built-in Arrow component!
      const Arrow = require("react-konva").Arrow;
      return (
        <Group
          x={x}
          y={y}
          width={Math.max(1, width)}
          height={Math.max(1, height)}
          {...interactiveProps}
          ref={ref}
        >
          <Arrow
            points={[0, height / 2, width, height / 2]}
            stroke={fill}
            fill={fill}
            strokeWidth={Math.max(2, height / 2)}
            pointerLength={10}
            pointerWidth={7}
          />
        </Group>
      );

    case "TEXT":
      let fontStyle = "";
      if (isBold) fontStyle += "bold ";
      if (isItalic) fontStyle += "italic ";

      let textDecoration = "";
      if (isUnderline) textDecoration += "underline ";
      if (isStrikethrough) textDecoration += "line-through ";

      const isOriginalUnedited = layer.isOriginal && !layer.isEdited;

      return (
        <Group
          x={x}
          y={y}
          width={width}
          height={height}
          {...interactiveProps}
          ref={ref}
        >
          {layer.isEdited && layer.isOriginal && (
            <Rect
              x={layer.originX !== undefined ? layer.originX - x : 0}
              y={layer.originY !== undefined ? layer.originY - y : 0}
              width={layer.originWidth || width}
              height={layer.originHeight || height}
              fill={
                sampledBackgroundColor !== "transparent" &&
                sampledBackgroundColor
                  ? sampledBackgroundColor
                  : "#ffffff"
              }
            />
          )}
          {sampledBackgroundColor &&
            sampledBackgroundColor !== "transparent" &&
            !layer.isOriginal && (
              <Rect
                width={width}
                height={height}
                fill={sampledBackgroundColor}
              />
            )}
          <Text
            width={width}
            height={height}
            text={text || ""}
            fontSize={fontSize || 16}
            fontFamily={fontFamily || "sans-serif"}
            fill={isOriginalUnedited ? "rgba(0,0,0,0.01)" : fill}
            align={textAlign || "left"}
            fontStyle={fontStyle.trim()}
            textDecoration={textDecoration.trim()}
            lineHeight={layer.lineHeight || 1.2}
            wrap="word" // Konva auto wraps word
          />
        </Group>
      );

    case "PATH":
      if (!points || points.length === 0) return null;
      const strokePoints = getStroke(points, {
        size: 4,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      });
      const pathData = getSvgPathFromStroke(strokePoints);

      return (
        <Group
          x={x}
          y={y}
          width={Math.max(1, width)}
          height={Math.max(1, height)}
          {...interactiveProps}
          ref={ref}
        >
          <Path data={pathData} fill={stroke} />
        </Group>
      );

    case "IMAGE":
      return (
        <ImageLoader
          layer={layer}
          interactiveProps={interactiveProps}
          fref={ref}
        />
      );

    default:
      return null;
  }
});

// Helper component to load image hook safely without breaking Rules of Hooks inside the switch statement
function ImageLoader({
  layer,
  interactiveProps,
  fref,
}: {
  layer: Layer;
  interactiveProps: any;
  fref: any;
}) {
  const [image] = useImage(layer.src || "", "anonymous");
  const imageRef = useRef<any>(null);

  // Build the active Konva filter array based on layer.filters
  const activeFilters = useMemo(() => {
    const filters: any[] = [];
    if (!layer.filters) return filters;
    if (layer.filters.blurRadius && layer.filters.blurRadius > 0) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.Blur);
    }
    if (
      layer.filters.brightness !== undefined &&
      layer.filters.brightness !== 0
    ) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.Brighten);
    }
    if (layer.filters.contrast !== undefined && layer.filters.contrast !== 0) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.Contrast);
    }
    if (layer.filters.grayscale) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.Grayscale);
    }
    if (
      layer.filters.saturate !== undefined &&
      layer.filters.saturate !== 100
    ) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.HSL);
    }
    if (layer.filters.sepia) {
      // Konva doesn't have a native Sepia, but we can approximate with HSL
      const Konva = require("konva").default;
      filters.push(Konva.Filters.HSL);
    }
    if (layer.filters.invert) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.Invert);
    }
    return filters;
  }, [layer.filters]);

  // Re-cache the image node whenever filters change so they are GPU-rendered
  useEffect(() => {
    const node = imageRef.current;
    if (node && activeFilters.length > 0) {
      node.cache();
    } else if (node) {
      node.clearCache();
    }
  }, [activeFilters, image, layer.filters]);

  if (!image) return null;

  // Compute crop source rectangle
  const cropProps = layer.crop
    ? {
        crop: {
          x: layer.crop.x,
          y: layer.crop.y,
          width: layer.crop.width,
          height: layer.crop.height,
        },
      }
    : {};

  // Compute shadow props
  const shadowProps = layer.shadow
    ? {
        shadowColor: layer.shadow.color || "rgba(0,0,0,0.3)",
        shadowBlur: layer.shadow.blur || 10,
        shadowOffsetX: layer.shadow.offsetX || 4,
        shadowOffsetY: layer.shadow.offsetY || 4,
        shadowEnabled: true,
      }
    : {};

  return (
    <Group
      x={layer.x}
      y={layer.y}
      width={Math.max(10, layer.width)}
      height={Math.max(10, layer.height)}
      {...interactiveProps}
      ref={fref}
    >
      <KonvaImage
        ref={imageRef}
        image={image}
        width={Math.max(10, layer.width)}
        height={Math.max(10, layer.height)}
        cornerRadius={layer.cornerRadius || 0}
        filters={activeFilters.length > 0 ? activeFilters : undefined}
        blurRadius={layer.filters?.blurRadius || 0}
        brightness={(layer.filters?.brightness || 0) / 100}
        contrast={layer.filters?.contrast || 0}
        saturation={
          layer.filters?.saturate !== undefined
            ? (layer.filters.saturate - 100) / 100
            : 0
        }
        {...cropProps}
        {...shadowProps}
      />
    </Group>
  );
}

export default LayerComponent;
