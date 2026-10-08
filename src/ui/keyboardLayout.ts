import { isBlackKey, pitchClass } from "../music/theory"

/** The 88 keys of the Kawai ES110: A0 to C8. */
export const LOWEST_NOTE = 21
export const HIGHEST_NOTE = 108

export interface KeyRect {
    note: number
    x: number
    width: number
    black: boolean
}

/** Horizontal position of every key across `totalWidth` pixels. Shared so the visuals line up with the keyboard. */
export function layoutKeys(totalWidth: number, low = LOWEST_NOTE, high = HIGHEST_NOTE): KeyRect[] {
    let whiteCount = 0
    for (let note = low; note <= high; note++) if (!isBlackKey(note)) whiteCount++
    const whiteWidth = totalWidth / whiteCount
    const blackWidth = whiteWidth * 0.6

    const keys: KeyRect[] = []
    let whiteIndex = 0
    for (let note = low; note <= high; note++) {
        if (isBlackKey(note)) {
            keys.push({ note, x: whiteIndex * whiteWidth - blackWidth / 2, width: blackWidth, black: true })
        } else {
            keys.push({ note, x: whiteIndex * whiteWidth, width: whiteWidth, black: false })
            whiteIndex++
        }
    }
    return keys
}

/** Each pitch class gets a hue, walking the circle of fifths so related notes have related colours. */
export function noteColor(note: number, alpha = 1, lightness = 62): string {
    const hue = ((pitchClass(note) * 7) % 12) * 30
    return `hsla(${hue}, 85%, ${lightness}%, ${alpha})`
}

/** Sizes a canvas's backing store for sharp drawing on high-DPI screens. Returns the size in CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): { width: number; height: number } {
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { width, height }
}
