import type { MidiEvent } from "./types"

export type MidiListener = (event: MidiEvent) => void

/** The single stream of musical input that every part of Jambo listens to. */
export class MidiBus {
    private readonly listeners = new Set<MidiListener>()

    /** Listeners are called in subscription order. Returns an unsubscribe function. */
    subscribe(listener: MidiListener): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    publish(event: MidiEvent): void {
        for (const listener of this.listeners) listener(event)
    }
}
