export const sideNames = [
    'left',
    'right',
    'top',
    'bottom',
    'front',
    'back',
] as const;
export type SideName = (typeof sideNames)[number];

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
