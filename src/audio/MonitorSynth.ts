import type { MidiBus } from "../midi/MidiBus"
import type { Hand, MidiEvent } from "../midi/types"
import { DEFAULT_INSTRUMENTS, INSTRUMENTS, SIMPLE_SYNTH, type Playable } from "./instruments"
import { SimpleSynth } from "./SimpleSynth"

/** Notes without a known hand are split here: below middle C is the left hand. */
const SPLIT_NOTE = 60
const MAX_ATTEMPTS = 3

export type LoadState = "waiting" | "loading" | "ready" | "failed"

export interface DownloadStatus {
    /** The instrument downloading right now, if any. */
    current: { name: string; loaded: number; total: number } | null
    ready: number
    failed: number
    total: number
}

/**
 * Lets the mock player (and screen or computer keys) be heard, with a different instrument per hand.
 * Only used in mock mode. The real piano makes its own sound, so this stays off for live playing.
 *
 * Every instrument is downloaded up front, one at a time (the hands' choices first), with retries.
 * Hundreds of parallel sample requests proved flaky, and one failed sample sinks a whole instrument.
 */
export class MonitorSynth {
    /** Called whenever download progress or state changes. */
    onLoadingChange: (() => void) | null = null
    readonly instruments: Record<Hand, string> = { ...DEFAULT_INSTRUMENTS }
    private context: AudioContext | null = null
    private output: GainNode | null = null
    private fallback: SimpleSynth | null = null
    private readonly loaded = new Map<string, Playable>()
    private readonly states = new Map<string, LoadState>()
    private queue: string[] = []
    private downloading = false
    private current: DownloadStatus["current"] = null
    private readonly sounding = new Map<number, () => void>()
    private readonly pedalHeld = new Set<number>()
    private sustainOn = false
    private enabled = false

    constructor(bus: MidiBus) {
        bus.subscribe((event) => this.handle(event))
    }

    get isEnabled(): boolean {
        return this.enabled
    }

    stateOf(id: string): LoadState {
        return this.states.get(id) ?? "waiting"
    }

    downloadStatus(): DownloadStatus {
        const states = INSTRUMENTS.map((i) => this.stateOf(i.id))
        return {
            current: this.current,
            ready: states.filter((s) => s === "ready").length,
            failed: states.filter((s) => s === "failed").length,
            total: INSTRUMENTS.length,
        }
    }

    /** Must first be called from a user gesture (a tap or click) because of browser autoplay rules. */
    async setEnabled(enabled: boolean): Promise<void> {
        this.enabled = enabled
        if (!enabled) {
            this.releaseAll()
            return
        }
        const context = this.ensureContext()
        this.downloadAll()
        await context.resume()
    }

    setInstrument(hand: Hand, id: string): void {
        this.instruments[hand] = id
        if (this.context !== null) this.downloadAll()
    }

    /**
     * Starts downloading every instrument, the hands' current choices first. Failed ones are tried again.
     * Safe to call before any user gesture: the audio context can decode samples while still suspended.
     */
    downloadAll(): void {
        this.ensureContext()
        const chosen = Object.values(this.instruments)
        const ordered = [...chosen, ...INSTRUMENTS.map((i) => i.id).filter((id) => !chosen.includes(id))]
        for (const id of ordered) {
            if (this.stateOf(id) === "failed") this.states.set(id, "waiting")
        }
        this.queue = [...new Set(ordered)].filter((id) => this.stateOf(id) === "waiting")
        this.onLoadingChange?.()
        void this.drainQueue()
    }

    private ensureContext(): AudioContext {
        if (this.context === null) {
            this.context = new AudioContext({ latencyHint: "interactive" })
            const compressor = this.context.createDynamicsCompressor()
            this.output = this.context.createGain()
            this.output.gain.value = 0.8
            this.output.connect(compressor).connect(this.context.destination)
            this.fallback = new SimpleSynth(this.context, this.output)
            this.loaded.set(SIMPLE_SYNTH, this.fallback)
            this.states.set(SIMPLE_SYNTH, "ready")
        }
        return this.context
    }

    private async drainQueue(): Promise<void> {
        if (this.downloading) return
        this.downloading = true
        while (this.queue.length > 0) {
            const id = this.queue.shift()!
            if (this.stateOf(id) !== "waiting") continue
            await this.download(id)
        }
        this.downloading = false
        this.current = null
        this.onLoadingChange?.()
    }

    private async download(id: string): Promise<void> {
        const def = INSTRUMENTS.find((i) => i.id === id)
        if (def === undefined || this.context === null || this.output === null) return
        this.states.set(id, "loading")

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            this.current = { name: def.name, loaded: 0, total: 0 }
            this.onLoadingChange?.()
            const instrument = def.create(this.context, {
                destination: this.output,
                onProgress: ({ loaded, total }) => {
                    this.current = { name: def.name, loaded, total }
                    this.onLoadingChange?.()
                },
            })
            try {
                await instrument.ready
                this.loaded.set(id, instrument)
                this.states.set(id, "ready")
                this.onLoadingChange?.()
                return
            } catch (error) {
                instrument.dispose?.()
                console.warn(`Couldn't load "${def.name}" (attempt ${attempt} of ${MAX_ATTEMPTS})`, error)
                if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, attempt * 2000))
            }
        }
        this.states.set(id, "failed")
        this.onLoadingChange?.()
    }

    private handle(event: MidiEvent): void {
        if (event.type === "sustain") {
            this.sustainOn = event.on
            if (!event.on) {
                for (const note of this.pedalHeld) this.release(note)
                this.pedalHeld.clear()
            }
            return
        }
        if (!this.enabled) return
        if (event.type === "noteOn") {
            this.pedalHeld.delete(event.note)
            this.release(event.note)
            const hand = event.hand ?? (event.note < SPLIT_NOTE ? "left" : "right")
            // Until an instrument has downloaded (or if it failed), the simple synth stands in.
            const instrument = this.loaded.get(this.instruments[hand]) ?? this.fallback
            if (instrument !== null) this.sounding.set(event.note, instrument.start(event.note, event.velocity))
        } else if (this.sustainOn) {
            this.pedalHeld.add(event.note)
        } else {
            this.release(event.note)
        }
    }

    private release(note: number): void {
        this.sounding.get(note)?.()
        this.sounding.delete(note)
    }

    private releaseAll(): void {
        for (const stop of this.sounding.values()) stop()
        this.sounding.clear()
        this.pedalHeld.clear()
    }
}
