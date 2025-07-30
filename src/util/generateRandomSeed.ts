import RNG from "@gouvernathor/rng";

export default function generateRandomSeed(rng = new RNG()): string {
    return Array.from({ length: 18 }, () => rng.randRange(36).toString(36)).join("");
}
