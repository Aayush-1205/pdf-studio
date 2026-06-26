import { forwardRef } from "react";
import { Path, Group } from "react-konva";
import { getStroke } from "perfect-freehand";
import { Layer } from "../../../store/useCanvasStore";
import { getSvgPathFromStroke } from "../../../app/lib/pdfUtils";

interface PathLayerProps {
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

export const PathLayer = forwardRef<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  PathLayerProps
>(({ layer, interactiveProps }, ref) => {
  const { x, y, width, height, stroke, points } = layer;

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
});

PathLayer.displayName = "PathLayer";
export default PathLayer;
