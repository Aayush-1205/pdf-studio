/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { forwardRef, useMemo, useEffect, useRef } from "react";
import { Image as KonvaImage, Group } from "react-konva";
import useImage from "use-image";
import { Layer } from "../../../store/useCanvasStore";

interface ImageLayerProps {
  id: string;
  layer: Layer;
  isSelected: boolean;
  onPointerDown: (e: any) => void;
  onDragEnd: (e: any) => void;
  onDblClick?: (e: any) => void;
  interactiveProps: any;
}

export const ImageLayer = forwardRef<
  any,
  ImageLayerProps
>(({ layer, interactiveProps }, ref) => {
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
    if (layer.filters.brightness !== undefined && layer.filters.brightness !== 0) {
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
    if (layer.filters.saturate !== undefined && layer.filters.saturate !== 100) {
      const Konva = require("konva").default;
      filters.push(Konva.Filters.HSL);
    }
    if (layer.filters.sepia) {
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
      ref={ref}
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
});

ImageLayer.displayName = "ImageLayer";
export default ImageLayer;
