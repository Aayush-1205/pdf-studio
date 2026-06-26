import { forwardRef } from "react";
import { Layer, useCanvasStore } from "../../store/useCanvasStore";
import ShapeLayer from "./renderers/ShapeLayer";
import TextLayer from "./renderers/TextLayer";
import PathLayer from "./renderers/PathLayer";
import ImageLayer from "./renderers/ImageLayer";

interface LayerComponentProps {
  id: string;
  layer: Layer;
  isSelected: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPointerDown: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDragEnd: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDblClick?: (e: any) => void;
}

const LayerComponent = forwardRef<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  LayerComponentProps
>(({ id, layer, isSelected, onPointerDown, onDragEnd, onDblClick }, ref) => {
  const { type, opacity, rotation } = layer;

  const interactiveProps = {
    id,
    opacity: (opacity ?? 100) / 100,
    rotation: rotation || 0,
    onPointerDown,
    onDragEnd,
    onDblClick,
    draggable: isSelected,
    onPointerEnter: () => {
      useCanvasStore.getState().setHoveredLayerId(id);
      document.body.style.cursor = isSelected ? "move" : "default";
    },
    onPointerLeave: () => {
      useCanvasStore.getState().setHoveredLayerId(null);
      document.body.style.cursor = "default";
    },
  };

  switch (type) {
    case "TEXT":
      return (
        <TextLayer
          id={id}
          layer={layer}
          isSelected={isSelected}
          onPointerDown={onPointerDown}
          onDragEnd={onDragEnd}
          onDblClick={onDblClick}
          interactiveProps={interactiveProps}
          ref={ref}
        />
      );
    case "IMAGE":
      return (
        <ImageLayer
          id={id}
          layer={layer}
          isSelected={isSelected}
          onPointerDown={onPointerDown}
          onDragEnd={onDragEnd}
          onDblClick={onDblClick}
          interactiveProps={interactiveProps}
          ref={ref}
        />
      );
    case "PATH":
      return (
        <PathLayer
          id={id}
          layer={layer}
          isSelected={isSelected}
          onPointerDown={onPointerDown}
          onDragEnd={onDragEnd}
          onDblClick={onDblClick}
          interactiveProps={interactiveProps}
          ref={ref}
        />
      );
    default:
      return (
        <ShapeLayer
          id={id}
          layer={layer}
          isSelected={isSelected}
          onPointerDown={onPointerDown}
          onDragEnd={onDragEnd}
          onDblClick={onDblClick}
          interactiveProps={interactiveProps}
          ref={ref}
        />
      );
  }
});

LayerComponent.displayName = "LayerComponent";
export default LayerComponent;
