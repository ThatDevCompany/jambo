import type { MidiBus } from "../midi/MidiBus"
import type { NoteTracker } from "../midi/NoteTracker"
import { noteName, pitchClass } from "../music/theory"
import { fitCanvas, layoutKeys, noteColor, type KeyRect } from "./keyboardLayout"

const SOURCE = "screen"
const BLACK_KEY_DEPTH = 0.62

/** An 88-key keyboard that lights up what's sounding. It can also be played by touch or mouse. */
export class KeyboardView {
    private readonly ctx: CanvasRenderingContext2D
    private keys: KeyRect[] = []
    private layoutWidth = 0
    private height = 0
    /** Which note each finger or mouse pointer is holding. */
    private readonly pointers = new Map<number, number>()

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly tracker: NoteTracker,
        private readonly bus: MidiBus,
    ) {
        this.ctx = canvas.getContext("2d")!
        canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e))
        canvas.addEventListener("pointermove", (e) => this.onPointerMove(e))
        for (const type of ["pointerup", "pointercancel"] as const) {
            canvas.addEventListener(type, (e) => this.onPointerUp(e))
        }
    }

    draw(): void {
        const ctx = this.ctx
        const { width, height } = fitCanvas(this.canvas, ctx)
        if (width !== this.layoutWidth) {
            this.keys = layoutKeys(width)
            this.layoutWidth = width
        }
        this.height = height
        ctx.clearRect(0, 0, width, height)
        const blackHeight = height * BLACK_KEY_DEPTH

        for (const key of this.keys) {
            if (key.black) continue
            ctx.fillStyle = this.fill(key.note, "#f3efe6")
            ctx.fillRect(key.x, 0, key.width, height)
            ctx.strokeStyle = "rgba(0, 0, 0, 0.35)"
            ctx.strokeRect(key.x + 0.5, 0, key.width, height)
            if (pitchClass(key.note) === 0) {
                ctx.fillStyle = key.note === 60 ? "#c0392b" : "rgba(0, 0, 0, 0.45)"
                ctx.font = `${Math.max(8, Math.min(12, key.width * 0.55))}px system-ui, sans-serif`
                ctx.textAlign = "center"
                ctx.fillText(noteName(key.note), key.x + key.width / 2, height - 6)
            }
        }
        for (const key of this.keys) {
            if (!key.black) continue
            ctx.fillStyle = this.fill(key.note, "#1c1d24")
            ctx.fillRect(key.x, 0, key.width, blackHeight)
        }
    }

    private fill(note: number, idle: string): string {
        if (this.tracker.held.has(note)) return noteColor(note)
        if (this.tracker.sustained.has(note)) return noteColor(note, 0.55, 72)
        return idle
    }

    private noteAt(x: number, y: number): number | null {
        if (y < this.height * BLACK_KEY_DEPTH) {
            const black = this.keys.find((k) => k.black && x >= k.x && x < k.x + k.width)
            if (black !== undefined) return black.note
        }
        return this.keys.find((k) => !k.black && x >= k.x && x < k.x + k.width)?.note ?? null
    }

    /** Pressing nearer the front edge of a key plays louder. */
    private velocityAt(y: number): number {
        return Math.round(45 + Math.min(1, Math.max(0, y / this.height)) * 75)
    }

    private onPointerDown(e: PointerEvent): void {
        this.canvas.setPointerCapture(e.pointerId)
        this.press(e)
    }

    private onPointerMove(e: PointerEvent): void {
        const current = this.pointers.get(e.pointerId)
        if (current === undefined) return
        const note = this.noteAt(e.offsetX, e.offsetY)
        if (note !== current) {
            this.releasePointer(e.pointerId)
            this.press(e)
        }
    }

    private onPointerUp(e: PointerEvent): void {
        this.releasePointer(e.pointerId)
    }

    private press(e: PointerEvent): void {
        const note = this.noteAt(e.offsetX, e.offsetY)
        if (note === null) return
        this.pointers.set(e.pointerId, note)
        this.bus.publish({
            type: "noteOn",
            note,
            velocity: this.velocityAt(e.offsetY),
            time: performance.now(),
            source: SOURCE,
        })
    }

    private releasePointer(pointerId: number): void {
        const note = this.pointers.get(pointerId)
        if (note === undefined) return
        this.pointers.delete(pointerId)
        this.bus.publish({ type: "noteOff", note, time: performance.now(), source: SOURCE })
    }
}
