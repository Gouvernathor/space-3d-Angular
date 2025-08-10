import { ApplicationRef, Component, computed, ElementRef, inject, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Pane } from 'tweakpane';
import * as glm from 'gl-matrix';
import { ZipWriter } from '@zip.js/zip.js';
import AnimationFrameManager from '../util/animationFrameManager';
import generateRandomSeed from '../util/generateRandomSeed';
import initialQueryParamMap from '../util/initialQueryParamMap';
import { newWorkerManager, RenderWorkManager } from '../worker/renderWorkerManager';
import { getBlobFromCanvas } from '../util/canvasToBlob';
import BlobManager from '../util/copyDownloadBlobManager';

@Component({
    selector: 'app-root',
    imports: [],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
    title = 'Space-3D';

    private readonly applicationRef = inject(ApplicationRef);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);

    renderCanvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('rendercanvas');
    renderCanvas = computed(() => this.renderCanvasRef().nativeElement);
    leftRef = viewChild.required<ElementRef<HTMLCanvasElement>>('left');
    rightRef = viewChild.required<ElementRef<HTMLCanvasElement>>('right');
    topRef = viewChild.required<ElementRef<HTMLCanvasElement>>('top');
    bottomRef = viewChild.required<ElementRef<HTMLCanvasElement>>('bottom');
    frontRef = viewChild.required<ElementRef<HTMLCanvasElement>>('front');
    backRef = viewChild.required<ElementRef<HTMLCanvasElement>>('back');
    canvasses = computed(() => ({
        left: this.leftRef().nativeElement,
        right: this.rightRef().nativeElement,
        top: this.topRef().nativeElement,
        bottom: this.bottomRef().nativeElement,
        front: this.frontRef().nativeElement,
        back: this.backRef().nativeElement,
    }));

    private readonly params = {
        seed: generateRandomSeed(),
        fov: 45,
        pointStars: true,
        stars: true,
        nebulae: true,
        sun: true,
        resolution: 1024,
        animate: true,
        animationSpeed: 1.0,
    };

    private renderWorkManager!: RenderWorkManager;

    async ngOnInit() {
        const renderCanvas = this.renderCanvas();

        this.renderWorkManager = newWorkerManager(renderCanvas, this.canvasses());
        await this.renderWorkManager.actuateRenderCanvasSize(renderCanvas.clientWidth, renderCanvas.clientHeight);

        // Load param values from the URL
        const queryParams = await initialQueryParamMap(this.applicationRef, this.router);
        if (queryParams.has("seed")) {
            this.params.seed = queryParams.get("seed")!;
        }

        let fov: number;
        if (queryParams.has("fov") && !isNaN(fov = +queryParams.get("fov")!)) {
            this.params.fov = fov;
        }

        if (queryParams.has("pointStars")) {
            this.params.pointStars = queryParams.get("pointStars") === "true";
        }
        if (queryParams.has("stars")) {
            this.params.stars = queryParams.get("stars") === "true";
        }
        if (queryParams.has("nebulae")) {
            this.params.nebulae = queryParams.get("nebulae") === "true";
        }
        if (queryParams.has("sun")) {
            this.params.sun = queryParams.get("sun") === "true";
        }

        let resolution: number;
        if (queryParams.has("resolution") && (resolution = parseInt(queryParams.get("resolution")!)) > 0) {
            this.params.resolution = resolution;
        }

        if (queryParams.has("animate")) {
            this.params.animate = queryParams.get("animate") === "true";
        }
        let animationSpeed: number;
        if (queryParams.has("animationSpeed") && !isNaN(animationSpeed = parseFloat(queryParams.get("animationSpeed")!))) {
            this.params.animationSpeed = animationSpeed;
        }

        const displayUI = !queryParams.has("noGUI") || queryParams.get("noGUI")! === "false";
        this.displayPatron(displayUI);
        if (displayUI) {
            this.initTweakpanePane();
        }

        this.renderTextures();
    }

    private displayPatron(doDisplay: boolean) {
        for (const canvas of Object.values(this.canvasses())) {
            canvas.hidden = !doDisplay;
        }
    }

    // Exports (URL and blobs)

    private isClipboardWriteTextSupported(): boolean {
        return !!(globalThis.navigator?.clipboard?.writeText);
    }

    private updateURL() {
        this.router.navigate([], {
            queryParams: this.params,
            replaceUrl: true,
            relativeTo: this.route,
        });
    }
    private async copyUrlToClipboard(withNoGUI = false) {
        const params = withNoGUI ? { ...this.params, noGUI: "" } : this.params;

        const urlTree = this.router.createUrlTree([], {
            queryParams: params,
            relativeTo: this.route,
        });
        const fullURL = location.host + urlTree.toString();

        try {
            await navigator.clipboard.writeText(fullURL);
        } catch (err) {
            console.error(`Failed to copy URL to clipboard: ${err}`);
        }
    }

    private readonly blobManager = new BlobManager();

    private async downloadSkybox() {
        const zipFileStream = new TransformStream();
        const zipFileBlobPromise = new Response(zipFileStream.readable).blob()
            .then(blob => new Blob([blob], { type: "application/zip" }));

        const zipWriter = new ZipWriter(zipFileStream.writable);
        for (const [side, canvas] of Object.entries(this.canvasses())) {
            const [blob, ext] = await getBlobFromCanvas(canvas);
            await zipWriter.add(`${side}.${ext}`, blob.stream());
        }
        const [cubemapBlob, cubemapExt] = await getBlobFromCanvas(this.generateCubeMap());
        await zipWriter.add(`cubemap.${cubemapExt}`, cubemapBlob.stream());
        await zipWriter.close();

        const zipFileBlob = await zipFileBlobPromise;
        await this.blobManager.downloadBlob(zipFileBlob, "skybox.zip");
    }
    private generateCubeMap() {
        const resolution = this.params.resolution;
        const cubemapCanvas = new OffscreenCanvas(resolution*4, resolution*3);
        const { left, right, top, bottom, front, back } = this.canvasses();

        const context = cubemapCanvas.getContext("2d")!;
        context.drawImage(left, 0, resolution);
        context.drawImage(top, resolution, 0);
        context.drawImage(front, resolution, resolution);
        context.drawImage(bottom, resolution, resolution*2);
        context.drawImage(right, resolution*2, resolution);
        context.drawImage(back, resolution*3, resolution);
        return cubemapCanvas;
    }

    // Tweakpane options pane

    private pane?: Pane;

    private initTweakpanePane() {
        const pane = this.pane = new Pane({
            title: "", // enables a toggle bar
        });
        pane.element.style.position = "fixed";
        pane.element.style.left = "16px";
        pane.element.style.top = "272px";

        pane.addBinding(this.params, "seed", { label: "Seed" })
            .on("change", () => this.renderTextures());

        pane.addButton({ title: "Randomize seed" }).on("click", () => {
            this.params.seed = generateRandomSeed();
            pane.refresh();
            this.renderTextures();
        });

        pane.addBinding(this.params, "fov", { label: "Field of View °", min: 10, max: 150, step: 1 })
            .on("change", () => this.animationFrameManager.scheduleRender());

        pane.addBinding(this.params, "pointStars", { label: "Point Stars" })
            .on("change", () => this.renderTextures());
        pane.addBinding(this.params, "stars", { label: "Bright Stars" })
            .on("change", () => this.renderTextures());
        pane.addBinding(this.params, "nebulae", { label: "Nebulae" })
            .on("change", () => this.renderTextures());
        pane.addBinding(this.params, "sun", { label: "Sun" })
            .on("change", () => this.renderTextures());

        pane.addBinding(this.params, "resolution", { label: "Resolution",
                options: { 256:256, 512:512, 1024:1024, 2048:2048, 4096:4096 }
        }).on("change", () => this.renderTextures());

        pane.addBinding(this.params, "animate", { label: "Animate" }).on("change", () => {
            if (this.params.animate) {
                this.animationFrameManager.scheduleRender();
                // calculate a fake new epoch such that the current position is the same
                this.animationEpoch = performance.now() - (this.lastPosition||0)/(this.params.animationSpeed*AppComponent.ANIMATION_SPEED_FACTOR);
            } else {
                this.animationFrameManager.stopRenderLoop();
            }
        });
        pane.addBinding(this.params, "animationSpeed", { label: "Animation Speed", min: .000001, max: 10 }).on("change", () => {
            if (this.lastPosition !== null) {
                // calculate a fake new epoch resulting in the same position
                this.animationEpoch = performance.now() - (this.lastPosition||0)/(this.params.animationSpeed*AppComponent.ANIMATION_SPEED_FACTOR);
            }
        });

        pane.addBlade({ view: "separator" });
        const noGUIClue = "Add &noGUI to the URL (or ?noGUI if there are no parameters)\nto prevent this UI from being displayed";
        if (this.isClipboardWriteTextSupported()) {
            pane.addButton({ title: "Copy URL to clipboard" }).on("click", () => {
                this.copyUrlToClipboard();
            });
            pane.addButton({ title: "Copy no-GUI URL to clipboard" }).on("click", () => {
                this.copyUrlToClipboard(true);
            });
        } else {
            pane.element.title = noGUIClue;
        }
        pane.addButton({ title: "Copy parameters to URL" }).on("click", () => {
            this.updateURL();
        });

        pane.addBlade({ view: "separator" });
        pane.addButton({ title: "Download skybox" })
            .on("click", () => this.downloadSkybox());
    }

    private async renderTextures() {
        await this.renderWorkManager.renderTextures({
            seed: this.params.seed,
            pointStars: this.params.pointStars,
            stars: this.params.stars,
            nebulae: this.params.nebulae,
            sun: this.params.sun,
            resolution: this.params.resolution,
        });

        this.animationFrameManager.scheduleRender();
    }

    private readonly animationFrameManager = new AnimationFrameManager((t) => this.render(t));

    private animationEpoch: number|null = null;
    private lastPosition: number|null = null;
    private static readonly ANIMATION_SPEED_FACTOR = .00008;
    private computePosition(nowTimestamp: number, epoch: number): number {
        return (nowTimestamp - epoch) * this.params.animationSpeed*AppComponent.ANIMATION_SPEED_FACTOR;
    }
    private async render(nowTimestamp: number) {
        // Actuating the canvas size
        const renderCanvas = this.renderCanvas();
        await this.renderWorkManager.actuateRenderCanvasSize(renderCanvas.clientWidth, renderCanvas.clientHeight);

        // Creating the position matrix
        const position = this.lastPosition = this.params.animate ?
            this.computePosition(nowTimestamp, (this.animationEpoch ??= nowTimestamp)) :
            (this.lastPosition ?? this.computePosition(0, 0));
        const view = glm.mat4.lookAt(glm.mat4.create(),
            [0, 0, 0],
            [Math.cos(position), Math.sin(position*.555), Math.sin(position)],
            [0, 1, 0]);

        // Creating the projection matrix
        const fov = (this.params.fov / 180) * Math.PI;
        const projection = glm.mat4.perspective(glm.mat4.create(),
            fov,
            renderCanvas.width / renderCanvas.height,
            0.1, 8);

        // Rendering the skybox
        await this.renderWorkManager.renderSkybox(view, projection);

        // Setting up the next render pass
        if (this.params.animate) {
            this.animationFrameManager.scheduleRender();
        }
    }
}
