"use client";

import { useCanvasStore } from "../../store/useCanvasStore";
import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";

export default function SelectionBox({ selectedNodes }: { selectedNodes: any[] }) {
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (trRef.current && selectedNodes.length > 0) {
      // Need to filter out nulls in case of unmounts
      const validNodes = selectedNodes.filter(Boolean);
      trRef.current.nodes(validNodes);
      trRef.current.getLayer().batchDraw();
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedNodes]);

  if (selectedNodes.length === 0) return null;

  return (
    <Transformer
      ref={trRef}
      boundBoxFunc={(oldBox, newBox) => {
        // Prevent scaling smaller than 5px
        if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
          return oldBox;
        }
        return newBox;
      }}
      borderStroke="#0b99ff"
      anchorStroke="#0b99ff"
      anchorFill="white"
      anchorSize={8}
      keepRatio={false}
      ignoreStroke={true}
      // Notify Zustand when transform ends
      onTransformEnd={(e) => {
        const tr = trRef.current;
        if (!tr) return;
        
        // Loop over selected nodes and flush their scaled width/height into store
        selectedNodes.forEach(node => {
           if (!node) return;
           const newX = node.x();
           const newY = node.y();
           const scaleX = node.scaleX();
           const scaleY = node.scaleY();
           const rotation = node.rotation();

           const id = node.attrs.id; // We inject id as attr
           if (!id) return;

           const layer = useCanvasStore.getState().layers[id];
           if (!layer) return;

           // Konva transforms usually preserve base width and apply scaling.
           // We map this back to absolute width/height for our generic PDF export
           // Fallback to layer bounds if Konva Group (like Text) returns 0 
           const baseWidth = node.width() || layer.width;
           const baseHeight = node.height() || layer.height;

           // Calculate absolute page offset so we subtract it from the screen Y
           const pageOffset = node.attrs.pageOffset || 0;

           // Flush back to store
           useCanvasStore.getState().updateLayer(id, {
              x: newX,
              y: newY - pageOffset,
              width: Math.max(1, baseWidth * scaleX),
              height: Math.max(1, baseHeight * scaleY),
              rotation: rotation, // If rotation is added later
           });

           // Reset node scales so they don't compound on next render loop
           node.scaleX(1);
           node.scaleY(1);
        });
      }}
    />
  );
}
