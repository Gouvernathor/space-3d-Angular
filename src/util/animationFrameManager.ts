export default class AnimationFrameManager {
    private animationFrameHandle: number|null = null;

    constructor(
        private readonly callback: FrameRequestCallback,
    ) {}

    public stopRenderLoop() {
        if (this.animationFrameHandle !== null) {
            cancelAnimationFrame(this.animationFrameHandle);
            this.animationFrameHandle = null;
        }
    }

    public scheduleRender() {
        this.stopRenderLoop();
        this.animationFrameHandle = requestAnimationFrame(this.callback);
    }
}
