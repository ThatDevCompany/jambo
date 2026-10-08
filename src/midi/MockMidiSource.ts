import type { MidiBus } from "./MidiBus"
import type { Hand, MidiEvent } from "./types"

/** A note in a mock bar. `beat` and `length` are in beats, counted before swing is applied. */
export interface MockNote {
    beat: number
    length: number
    note: number
    velocity: number
    hand: Hand
}

export interface MockPedal {
    beat: number
    on: boolean
}

export interface MockBar {
    notes: MockNote[]
    pedal?: MockPedal[]
}

/** Produces bar after bar of music. Players keep their own state (e.g. where a melody is heading). */
export type BarPlayer = (barIndex: number) => MockBar

export interface MockPattern {
    id: string
    name: string
    bpm: number
    beatsPerBar: number
    swing: boolean
    createPlayer(): BarPlayer
}

const SOURCE = "mock"
const TICK_MS = 5
const LOOKAHEAD_MS = 400
const START_DELAY_MS = 150

interface Scheduled {
    time: number
    event: MidiEvent
}

/**
 * Pretends to be a pianist: plays a MockPattern into the MidiBus in real time,
 * so the UI can be developed without the real piano attached.
 */
export class MockMidiSource {
    bpm = 100
    private pattern: MockPattern | null = null
    private player: BarPlayer | null = null
    private timer: number | undefined
    private queue: Scheduled[] = []
    private nextBar = 0
    private nextBarTime = 0
    private readonly notesOn = new Set<number>()
    private pedalOn = false

    constructor(private readonly bus: MidiBus) {}

    get playing(): boolean {
        return this.timer !== undefined
    }

    start(pattern: MockPattern): void {
        this.stop()
        this.pattern = pattern
        this.player = pattern.createPlayer()
        this.nextBar = 0
        this.nextBarTime = performance.now() + START_DELAY_MS
        this.timer = window.setInterval(() => this.tick(), TICK_MS)
    }

    /** Stops playing and releases anything still sounding so no notes get stuck. */
    stop(): void {
        if (this.timer !== undefined) window.clearInterval(this.timer)
        this.timer = undefined
        this.queue = []
        const time = performance.now()
        for (const note of this.notesOn) this.bus.publish({ type: "noteOff", note, time, source: SOURCE })
        this.notesOn.clear()
        if (this.pedalOn) this.bus.publish({ type: "sustain", on: false, time, source: SOURCE })
        this.pedalOn = false
    }

    private tick(): void {
        const now = performance.now()
        while (this.nextBarTime < now + LOOKAHEAD_MS) this.scheduleNextBar()
        while (this.queue.length > 0 && this.queue[0].time <= now) {
            const { event } = this.queue.shift()!
            if (event.type === "noteOn") this.notesOn.add(event.note)
            if (event.type === "noteOff") this.notesOn.delete(event.note)
            if (event.type === "sustain") this.pedalOn = event.on
            this.bus.publish(event)
        }
    }

    private scheduleNextBar(): void {
        const pattern = this.pattern!
        const bar = this.player!(this.nextBar)
        const beatMs = 60000 / this.bpm
        const barStart = this.nextBarTime
        const at = (beat: number) => barStart + this.swung(beat, pattern.swing) * beatMs

        for (const pedal of bar.pedal ?? []) {
            const time = at(pedal.beat)
            this.queue.push({ time, event: { type: "sustain", on: pedal.on, time, source: SOURCE } })
        }
        for (const n of bar.notes) {
            const start = at(n.beat)
            const end = Math.max(start + 10, at(n.beat + n.length))
            this.queue.push({
                time: start,
                event: {
                    type: "noteOn",
                    note: n.note,
                    velocity: n.velocity,
                    time: start,
                    source: SOURCE,
                    hand: n.hand,
                },
            })
            this.queue.push({ time: end, event: { type: "noteOff", note: n.note, time: end, source: SOURCE } })
        }
        // Releases go before presses at the same instant so repeated notes retrigger cleanly.
        this.queue.sort((a, b) => a.time - b.time || order(a.event) - order(b.event))

        this.nextBar++
        this.nextBarTime = barStart + pattern.beatsPerBar * beatMs
    }

    /** Swing: the off-beat eighth lands two-thirds of the way through the beat instead of halfway. */
    private swung(beat: number, swing: boolean): number {
        if (!swing) return beat
        const whole = Math.floor(beat)
        const frac = beat - whole
        return whole + (frac <= 0.5 ? frac * (4 / 3) : 2 / 3 + (frac - 0.5) * (2 / 3))
    }
}

function order(event: MidiEvent): number {
    return event.type === "noteOff" ? 0 : event.type === "sustain" ? 1 : 2
}
