import type { MidiBus } from "./MidiBus"

const SOURCE = "computer-keyboard"
const VELOCITY = 90

/** Piano-style layout on the home row: A = C, W = C#, S = D ... ; = E an octave up. */
const KEY_OFFSETS: Record<string, number> = {
    KeyA: 0,
    KeyW: 1,
    KeyS: 2,
    KeyE: 3,
    KeyD: 4,
    KeyF: 5,
    KeyT: 6,
    KeyG: 7,
    KeyY: 8,
    KeyH: 9,
    KeyU: 10,
    KeyJ: 11,
    KeyK: 12,
    KeyO: 13,
    KeyL: 14,
    KeyP: 15,
    Semicolon: 16,
}

/** Lets the computer keyboard stand in for the piano: Z/X shift octave, Space is the sustain pedal. */
export class ComputerKeyboardInput {
    private baseNote = 60
    private readonly down = new Map<string, number>()
    private sustain = false

    constructor(private readonly bus: MidiBus) {
        window.addEventListener("keydown", (e) => this.onKeyDown(e))
        window.addEventListener("keyup", (e) => this.onKeyUp(e))
        window.addEventListener("blur", () => this.releaseAll())
    }

    private onKeyDown(e: KeyboardEvent): void {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isFormField(e.target)) return
        const time = performance.now()

        if (e.code === "KeyZ") this.baseNote = Math.max(24, this.baseNote - 12)
        else if (e.code === "KeyX") this.baseNote = Math.min(96, this.baseNote + 12)
        else if (e.code === "Space") {
            e.preventDefault()
            this.sustain = true
            this.bus.publish({ type: "sustain", on: true, time, source: SOURCE })
        } else if (e.code in KEY_OFFSETS && !this.down.has(e.code)) {
            const note = this.baseNote + KEY_OFFSETS[e.code]
            this.down.set(e.code, note)
            this.bus.publish({ type: "noteOn", note, velocity: VELOCITY, time, source: SOURCE })
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        const time = performance.now()
        if (e.code === "Space" && this.sustain) {
            this.sustain = false
            this.bus.publish({ type: "sustain", on: false, time, source: SOURCE })
        }
        const note = this.down.get(e.code)
        if (note !== undefined) {
            this.down.delete(e.code)
            this.bus.publish({ type: "noteOff", note, time, source: SOURCE })
        }
    }

    private releaseAll(): void {
        const time = performance.now()
        for (const note of this.down.values()) this.bus.publish({ type: "noteOff", note, time, source: SOURCE })
        this.down.clear()
        if (this.sustain) this.bus.publish({ type: "sustain", on: false, time, source: SOURCE })
        this.sustain = false
    }
}

/** Fields that need the letter keys for themselves. Sliders don't, so playing still works after using one. */
function isFormField(target: EventTarget | null): boolean {
    if (target instanceof HTMLInputElement) return target.type !== "range"
    return target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
}
