import type { MidiBus } from "../midi/MidiBus"
import type { MidiEvent } from "../midi/types"
import { pitchClass } from "../music/theory"
import { fitCanvas, layoutKeys, noteColor, type KeyRect } from "./keyboardLayout"

interface Bar {
    note: number
    velocity: number
    start: number
    end: number | null
}

const PIXELS_PER_MS = 0.12
const GLOW_MS = 350

/** Notes rise up out of the keyboard as you play them, leaving a trail of what was just played. */
export class NoteRollView {
    private readonly ctx: CanvasRenderingContext2D
    private bars: Bar[] = []
    private readonly open = new Map<number, Bar>()
    private keys = new Map<number, KeyRect>()
    private layoutWidth = 0

    constructor(
        private readonly canvas: HTMLCanvasElement,
        bus: MidiBus,
    ) {
        this.ctx = canvas.getContext("2d")!
        bus.subscribe((event) => this.handle(event))
    }

    draw(now: number): void {
        const ctx = this.ctx
        const { width, height } = fitCanvas(this.canvas, ctx)
        if (width !== this.layoutWidth) {
            this.keys = new Map(layoutKeys(width).map((k) => [k.note, k]))
            this.layoutWidth = width
        }
        ctx.clearRect(0, 0, width, height)

        // Faint guide line at every C so you can find your way around.
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)"
        for (const key of this.keys.values()) {
            if (pitchClass(key.note) === 0) ctx.fillRect(Math.round(key.x), 0, 1, height)
        }

        const yAt = (time: number) => height - (now - time) * PIXELS_PER_MS
        this.bars = this.bars.filter((bar) => bar.end === null || yAt(bar.end) > 0)

        for (const bar of this.bars) {
            const key = this.keys.get(bar.note)
            if (key === undefined) continue
            const top = yAt(bar.start)
            const bottom = bar.end === null ? height : yAt(bar.end)
            const inset = key.black ? 0 : key.width * 0.12
            const x = key.x + inset
            const w = key.width - inset * 2
            const age = now - bar.start

            ctx.save()
            if (age < GLOW_MS) {
                ctx.shadowColor = noteColor(bar.note)
                ctx.shadowBlur = 24 * (1 - age / GLOW_MS)
            }
            ctx.fillStyle = noteColor(bar.note, 0.35 + 0.65 * (bar.velocity / 127))
            ctx.beginPath()
            ctx.roundRect(x, top, w, Math.max(2, bottom - top), Math.min(4, w / 2))
            ctx.fill()
            ctx.restore()
        }
    }

    private handle(event: MidiEvent): void {
        if (event.type === "noteOn") {
            this.close(event.note, event.time)
            const bar = { note: event.note, velocity: event.velocity, start: event.time, end: null }
            this.bars.push(bar)
            this.open.set(event.note, bar)
        } else if (event.type === "noteOff") {
            this.close(event.note, event.time)
        }
    }

    private close(note: number, time: number): void {
        const bar = this.open.get(note)
        if (bar === undefined) return
        bar.end = Math.max(time, bar.start)
        this.open.delete(note)
    }
}
