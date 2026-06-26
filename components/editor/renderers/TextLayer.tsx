import { forwardRef } from "react";
import { Text, Rect, Group } from "react-konva";
import { Layer } from "../../../store/useCanvasStore";

interface TextLayerProps {
  id: string;
  layer: Layer;
  isSelected: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPointerDown: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDragEnd: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDblClick?: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interactiveProps: any;
}

export const TextLayer = forwardRef<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  TextLayerProps
>(({ layer, interactiveProps }, ref) => {
  const {
    x,
    y,
    width,
    height,
    fill,
    text,
    fontSize,
    fontFamily,
    textAlign,
    isBold,
    isItalic,
    isUnderline,
    isStrikethrough,
    sampledBackgroundColor,
  } = layer;

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
            sampledBackgroundColor !== "transparent" && sampledBackgroundColor
              ? sampledBackgroundColor
              : "#ffffff"
          }
        />
      )}
      {sampledBackgroundColor && sampledBackgroundColor !== "transparent" && !layer.isOriginal && (
        <Rect width={width} height={height} fill={sampledBackgroundColor} />
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
        wrap="word"
      />
    </Group>
  );
});

TextLayer.displayName = "TextLayer";
export default TextLayer;
