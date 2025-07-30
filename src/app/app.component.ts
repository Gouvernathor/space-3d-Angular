import { Component, computed, ElementRef, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

type ControlParams = {
    seed: string;
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

    // Load param values from the URL
    async ngOnInit() {
        this.route.queryParamMap.subscribe(queryParams => {
            const hasParams = queryParams.keys.length > 0;

            const seed = queryParams.has("seed") ?
                queryParams.get("seed")! :
                ""; // generateRandomSeed();

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
                pointStars,
                stars,
                nebulae,
                sun,
                resolution,
                animationSpeed,
            };
        });
    }

    private updateParams() {
        this.router.navigate([], {
            queryParams: this.params,
            replaceUrl: true,
            relativeTo: this.route,
        });
    }
}
