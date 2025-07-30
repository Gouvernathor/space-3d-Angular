import { Component, computed, ElementRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Pane } from 'tweakpane';
import * as glm from 'gl-matrix';
import generateRandomSeed from '../util/generateRandomSeed';
import Skybox from '../lib/skybox';
import Space3D from '../lib/space3d';
import { SideName } from '../lib/constants';
import { firstValueFrom } from 'rxjs';

type ControlParams = {
    seed: string;
    fov: number;
    pointStars: boolean;
    stars: boolean;
    nebulae: boolean;
    sun: boolean;
    resolution: number;
    animationSpeed: number;
};

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

    params!: ControlParams;

    private skybox!: Skybox;
    private space!: Space3D;

    async ngOnInit() {
        // Load param values from the URL
        // the await is important : tweakpane init needs the params object to be set
        // the firstValueFrom is also important : we can't have the params be reassigned
        // otherwise tweakpane will fail
        await firstValueFrom(this.route.queryParamMap).then((queryParams) => {
            const seed = queryParams.has("seed") ?
                queryParams.get("seed")! :
                generateRandomSeed();

            const fov = queryParams.has("fov") ?
                +queryParams.get("fov")! || 60.0 : 60.0;

            const pointStars = queryParams.has("pointStars") ?
                queryParams.get("pointStars") === "true" : true;
            const stars = queryParams.has("stars") ?
                queryParams.get("stars") === "true" : true;
            const nebulae = queryParams.has("nebulae") ?
                queryParams.get("nebulae") === "true" : true;
            const sun = queryParams.has("sun") ?
                queryParams.get("sun") === "true" : true;

            const resolution = parseInt(queryParams.get("resolution")!) || 1024;
            const animationSpeed = parseFloat(queryParams.get("animationSpeed")!) || 1.0;

            this.params = {
                seed,
                fov,
                pointStars,
                stars,
                nebulae,
                sun,
                resolution,
                animationSpeed,
            };
        });

        this.initTweakpanePane();

        const renderCanvas = this.renderCanvas();
        renderCanvas.width = renderCanvas.clientWidth;
        renderCanvas.height = renderCanvas.clientHeight;

        this.skybox = new Skybox(renderCanvas);
        this.space = new Space3D();

        this.renderTextures();

        this.render();
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
        const pane = this.pane = new Pane();
        pane.element.style.position = "fixed";
        pane.element.style.left = "16px";
        pane.element.style.top = "272px";

        // TODO add a toggle for the pane display

        pane.addBinding(this.params, "seed", { label: "Seed" });

        pane.addButton({ title: "Randomize seed" }).on("click", () => {
            this.params.seed = generateRandomSeed();
            pane.refresh();
            this.renderTextures();
        });

        pane.addBinding(this.params, "fov", { label: "Field of View °", min: 10, max: 150, step: 1 });

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

        pane.addBinding(this.params, "animationSpeed", { label: "Animation Speed", min: 0, max: 10 });

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

        this.drawIndividual(textures.left, "left");
        this.drawIndividual(textures.right, "right");
        this.drawIndividual(textures.front, "front");
        this.drawIndividual(textures.back, "back");
        this.drawIndividual(textures.top, "top");
        this.drawIndividual(textures.bottom, "bottom");
    }

    private drawIndividual(source: HTMLCanvasElement, targetId: SideName) {
        const canvas = this.canvasses[targetId]();
        canvas.width = canvas.height = this.params.resolution;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(source, 0, 0);
    }

    private tick = 0;

    private render() {
        this.tick += .0025 * this.params.animationSpeed;

        const view = glm.mat4.create();
        const projection = glm.mat4.create();

        const renderCanvas = this.renderCanvas();
        renderCanvas.width = renderCanvas.clientWidth;
        renderCanvas.height = renderCanvas.clientHeight;

        glm.mat4.lookAt(view,
            [0, 0, 0],
            [Math.cos(this.tick), Math.sin(this.tick*.555), Math.sin(this.tick)],
            [0, 1, 0]);

        const fov = (this.params.fov / 180) * Math.PI;
        glm.mat4.perspective(projection,
            fov,
            renderCanvas.width / renderCanvas.height,
            0.1, 8);

        this.skybox.render(view, projection);

        requestAnimationFrame(() => this.render());

        // this.updateParams();
    }
}
