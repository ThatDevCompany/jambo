import type { MidiBus } from "./MidiBus"
import type { MidiEvent } from "./types"

/** Tracks which keys are held down and which notes are still sounding because of the sustain pedal. */
export class NoteTracker {
    /** Held keys: note -> velocity. */
    readonly held = new Map<number, number>()
    /** Notes whose keys were released while the pedal was down, so they are still ringing. */
    readonly sustained = new Set<number>()
    sustainOn = false

    constructor(bus: MidiBus) {
        bus.subscribe((event) => this.handle(event))
    }

    /** All notes currently sounding (held or sustained), lowest first. */
    sounding(): number[] {
        return [...new Set([...this.held.keys(), ...this.sustained])].sort((a, b) => a - b)
    }

    private handle(event: MidiEvent): void {
        switch (event.type) {
            case "noteOn":
                this.held.set(event.note, event.velocity)
                this.sustained.delete(event.note)
                break
            case "noteOff":
                if (this.held.delete(event.note) && this.sustainOn) this.sustained.add(event.note)
                break
            case "sustain":
                this.sustainOn = event.on
                if (!event.on) this.sustained.clear()
                break
        }
    }
}
