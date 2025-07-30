import { Component, computed, ElementRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Pane } from 'tweakpane';
import * as glm from 'gl-matrix';
import generateRandomSeed from '../util/generateRandomSeed';
import Skybox from '../lib/skybox';
import Space3D from '../lib/space3d';
import { sideNames } from '../lib/constants';
import AnimationFrameManager from '../util/animationFrameManager';

@Component({
    selector: 'app-root',
    imports: [],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
    title = 'Space-3D';

    constructor(
        private readonly route: ActivatedRoute,
        private readonly router: Router,
    ) {}

    renderCanvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('rendercanvas');
    renderCanvas = computed(() => this.renderCanvasRef().nativeElement);
    leftRef = viewChild.required<ElementRef<HTMLCanvasElement>>('left');
    rightRef = viewChild.required<ElementRef<HTMLCanvasElement>>('right');
    topRef = viewChild.required<ElementRef<HTMLCanvasElement>>('top');
    bottomRef = viewChild.required<ElementRef<HTMLCanvasElement>>('bottom');
    frontRef = viewChild.required<ElementRef<HTMLCanvasElement>>('front');
    backRef = viewChild.required<ElementRef<HTMLCanvasElement>>('back');
    canvasses = {
        left: computed(() => this.leftRef().nativeElement),
        right: computed(() => this.rightRef().nativeElement),
        top: computed(() => this.topRef().nativeElement),
        bottom: computed(() => this.bottomRef().nativeElement),
        front: computed(() => this.frontRef().nativeElement),
        back: computed(() => this.backRef().nativeElement),
    };

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

    private skybox!: Skybox;
    private space!: Space3D;

    ngOnInit() {
        // Load param values from the URL
        this.route.queryParamMap.subscribe((queryParams) => {
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

            this.pane?.refresh();
        });

        this.initTweakpanePane();

        const renderCanvas = this.renderCanvas();
        renderCanvas.width = renderCanvas.clientWidth;
        renderCanvas.height = renderCanvas.clientHeight;

        this.skybox = new Skybox(renderCanvas);
        this.space = new Space3D();

        this.renderTextures();
    }

    private updateParams() {
        this.router.navigate([], {
            queryParams: this.params,
            replaceUrl: true,
            relativeTo: this.route,
        });
    }
    private copyUrlToClipboard() {
        // TODO
    }

    // Tweakpane options pane

    private pane!: Pane;

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

        pane.addButton({ title: "Copy (to) URL" }).on("click", () => {
            this.updateParams();
            this.copyUrlToClipboard();
        });
        // pane.addButton({ title: "Download skybox" })
        //     .on("click", () => this.downloadSkybox());
    }

    private renderTextures() {
        const textures = this.space.render({
            seed: this.params.seed,
            pointStars: this.params.pointStars,
            stars: this.params.stars,
            nebulae: this.params.nebulae,
            sun: this.params.sun,
            resolution: this.params.resolution,
        });
        this.skybox.setTextures(textures);

        for (const side of sideNames) {
            const target = this.canvasses[side]();
            target.width = target.height = this.params.resolution;
            const ctx = target.getContext("2d")!;
            ctx.drawImage(textures[side], 0, 0);
        }

        this.animationFrameManager.scheduleRender();
    }

    private readonly animationFrameManager = new AnimationFrameManager((t) => this.render(t));

    private animationEpoch: number|null = null;
    private lastPosition: number|null = null;
    private static readonly ANIMATION_SPEED_FACTOR = .00008;
    private computePosition(nowTimestamp: number, epoch: number): number {
        return (nowTimestamp - epoch) * this.params.animationSpeed*AppComponent.ANIMATION_SPEED_FACTOR;
    }
    private render(nowTimestamp: number) {
        const view = glm.mat4.create();
        const projection = glm.mat4.create();

        const renderCanvas = this.renderCanvas();
        renderCanvas.width = renderCanvas.clientWidth;
        renderCanvas.height = renderCanvas.clientHeight;

        const position = this.lastPosition = this.params.animate ?
            this.computePosition(nowTimestamp, (this.animationEpoch ??= nowTimestamp)) :
            (this.lastPosition ?? this.computePosition(0, 0));

        glm.mat4.lookAt(view,
            [0, 0, 0],
            [Math.cos(position), Math.sin(position*.555), Math.sin(position)],
            [0, 1, 0]);

        const fov = (this.params.fov / 180) * Math.PI;
        glm.mat4.perspective(projection,
            fov,
            renderCanvas.width / renderCanvas.height,
            0.1, 8);

        this.skybox.render(view, projection);

        if (this.params.animate) {
            this.animationFrameManager.scheduleRender();
        }
    }
}
