import { forwardRef } from "react";
import { Rect, Ellipse, Line, Text, Image as KonvaImage, Path, Group } from "react-konva";
import useImage from "use-image";
import { Layer } from "../../store/useCanvasStore";
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
  }
>(({ id, layer, isSelected, onPointerDown, onDragEnd }, ref) => {
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
    draggable: isSelected, // Konva handles dragging natively if draggable=true
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
        <Ellipse
          ref={ref}
          x={x + width / 2}
          y={y + height / 2}
          radiusX={Math.max(0.5, width / 2)}
          radiusY={Math.max(0.5, height / 2)}
          fill={fill}
          stroke={stroke === "transparent" ? undefined : stroke}
          strokeWidth={stroke === "transparent" ? 0 : 2}
          {...interactiveProps}
        />
      );

    case "LINE":
      return (
        <Line
          ref={ref}
          points={[x, y + height / 2, x + width, y + height / 2]}
          stroke={fill}
          strokeWidth={Math.max(2, height)}
          {...interactiveProps}
        />
      );

    case "ARROW":
      // We can use Konva's built-in Arrow component!
      const Arrow = require("react-konva").Arrow;
      return (
        <Arrow
          ref={ref}
          points={[x, y + height / 2, x + width, y + height / 2]}
          stroke={fill}
          fill={fill}
          strokeWidth={Math.max(2, height / 2)}
          pointerLength={10}
          pointerWidth={7}
          {...interactiveProps}
        />
      );

    case "TEXT":
      let fontStyle = "";
      if (isBold) fontStyle += "bold ";
      if (isItalic) fontStyle += "italic ";
      
      let textDecoration = "";
      if (isUnderline) textDecoration += "underline ";
      if (isStrikethrough) textDecoration += "line-through ";

      return (
        <Group x={x} y={y} {...interactiveProps} ref={ref}>
          {sampledBackgroundColor && sampledBackgroundColor !== "transparent" && (
            <Rect width={width} height={height} fill={sampledBackgroundColor} />
          )}
          <Text
            width={width}
            height={height}
            text={text || ""}
            fontSize={fontSize || 16}
            fontFamily={fontFamily || "sans-serif"}
            fill={fill}
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
        <Path
          ref={ref}
          x={x}
          y={y}
          data={pathData}
          fill={stroke}
          {...interactiveProps}
        />
      );

    case "IMAGE":
      return <ImageLoader layer={layer} interactiveProps={interactiveProps} fref={ref} />;

    default:
      return null;
  }
});

// Helper component to load image hook safely without breaking Rules of Hooks inside the switch statement
function ImageLoader({ layer, interactiveProps, fref }: { layer: Layer; interactiveProps: any, fref: any }) {
  const [image] = useImage(layer.src || "");
  if (!image) return null;

  return (
    <KonvaImage
      ref={fref}
      image={image}
      x={layer.x}
      y={layer.y}
      width={Math.max(10, layer.width)}
      height={Math.max(10, layer.height)}
      {...interactiveProps}
    />
  );
}

export default LayerComponent;
