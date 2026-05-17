import { getCurrentWindow } from "@tauri-apps/api/window";

type Dir =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

function startResize(direction: Dir) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void getCurrentWindow().startResizeDragging(direction);
  };
}

const EDGE = "absolute z-50";
const EDGE_THICK = "3px";

export function ResizeHandles() {
  return (
    <>
      {/* edges */}
      <div
        onMouseDown={startResize("North")}
        className={EDGE + " inset-x-2 top-0 cursor-n-resize"}
        style={{ height: EDGE_THICK }}
      />
      <div
        onMouseDown={startResize("South")}
        className={EDGE + " inset-x-2 bottom-0 cursor-s-resize"}
        style={{ height: EDGE_THICK }}
      />
      <div
        onMouseDown={startResize("West")}
        className={EDGE + " inset-y-2 left-0 cursor-w-resize"}
        style={{ width: EDGE_THICK }}
      />
      <div
        onMouseDown={startResize("East")}
        className={EDGE + " inset-y-2 right-0 cursor-e-resize"}
        style={{ width: EDGE_THICK }}
      />
      {/* corners */}
      <div
        onMouseDown={startResize("NorthWest")}
        className={EDGE + " left-0 top-0 h-2 w-2 cursor-nw-resize"}
      />
      <div
        onMouseDown={startResize("NorthEast")}
        className={EDGE + " right-0 top-0 h-2 w-2 cursor-ne-resize"}
      />
      <div
        onMouseDown={startResize("SouthWest")}
        className={EDGE + " bottom-0 left-0 h-2 w-2 cursor-sw-resize"}
      />
      <div
        onMouseDown={startResize("SouthEast")}
        className={EDGE + " bottom-0 right-0 h-2 w-2 cursor-se-resize"}
      />
    </>
  );
}
