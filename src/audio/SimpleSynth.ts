import type { Playable } from "./instruments"

/** A small oscillator-based piano-ish sound. Needs no downloads, so it's the fallback while samples load. */
export class SimpleSynth implements Playable {
    readonly ready = Promise.resolve()

    constructor(
        private readonly context: AudioContext,
        private readonly destination: AudioNode,
    ) {}

    start(note: number, velocity: number): () => void {
        const context = this.context
        const now = context.currentTime
        const frequency = 440 * Math.pow(2, (note - 69) / 12)
        const loudness = Math.pow(velocity / 127, 1.6) * 0.35
        // Low notes ring longer than high ones, like a real piano.
        const decay = 2.2 - ((note - 21) / 87) * 1.6

        const envelope = context.createGain()
        envelope.gain.setValueAtTime(0, now)
        envelope.gain.linearRampToValueAtTime(loudness, now + 0.005)
        envelope.gain.setTargetAtTime(0, now + 0.005, decay / 3)

        const filter = context.createBiquadFilter()
        filter.type = "lowpass"
        filter.frequency.value = Math.min(16000, frequency * (3 + (velocity / 127) * 8))
        filter.connect(envelope).connect(this.destination)

        const oscillators = [
            { type: "triangle" as const, ratio: 1, level: 1 },
            { type: "sine" as const, ratio: 2, level: 0.25 },
            { type: "sine" as const, ratio: 3, level: 0.08 },
        ].map(({ type, ratio, level }) => {
            const oscillator = context.createOscillator()
            const gain = context.createGain()
            oscillator.type = type
            oscillator.frequency.value = frequency * ratio
            gain.gain.value = level
            oscillator.connect(gain).connect(filter)
            oscillator.start(now)
            oscillator.stop(now + decay * 2)
            return oscillator
        })

        return () => {
            const at = context.currentTime
            envelope.gain.cancelScheduledValues(at)
            envelope.gain.setValueAtTime(envelope.gain.value, at)
            envelope.gain.setTargetAtTime(0, at, 0.06)
            for (const oscillator of oscillators) oscillator.stop(at + 0.4)
        }
    }
}
