import { forwardRef } from "react";
import { Rect, Ellipse, Line, Arrow, Group } from "react-konva";
import { Layer } from "../../../store/useCanvasStore";

interface ShapeLayerProps {
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

export const ShapeLayer = forwardRef<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  ShapeLayerProps
>(({ layer, interactiveProps }, ref) => {
  const { type, x, y, width, height, fill, stroke } = layer;

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

    default:
      return null;
  }
});

ShapeLayer.displayName = "ShapeLayer";
export default ShapeLayer;
