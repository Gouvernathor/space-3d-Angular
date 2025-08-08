import { ApplicationRef } from "@angular/core";
import { Router } from "@angular/router";

/**
 * Plugs a hole in the Angular routing/navigation system.
 * Returns a promise that resolves to the initial query parameter map.
 */
export default async function(ref: ApplicationRef, router: Router) {
    await ref.whenStable();
    return router.routerState.snapshot.root.queryParamMap;
}
