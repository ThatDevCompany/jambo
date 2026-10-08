import type { MidiBus } from "./MidiBus"

export interface MidiDevice {
    id: string
    name: string
}

/** All connected inputs at once. Handy because a reconnected Bluetooth device can come back with a new id. */
export const ALL_INPUTS = "all"

/** Real MIDI input (e.g. the Kawai ES110) through the browser's Web MIDI API. */
export class WebMidiInput {
    /** Called when devices are plugged in, unplugged, or pair/unpair over Bluetooth. */
    onDevicesChanged: (() => void) | null = null
    private access: MIDIAccess | null = null
    private selected: string | null = null

    constructor(private readonly bus: MidiBus) {}

    /** Web MIDI needs a supporting browser (Chrome/Edge, incl. Android) and a secure context (HTTPS or localhost). */
    static get supported(): boolean {
        return window.isSecureContext && typeof navigator.requestMIDIAccess === "function"
    }

    async init(): Promise<void> {
        this.access = await navigator.requestMIDIAccess()
        this.access.onstatechange = () => {
            this.attach()
            this.onDevicesChanged?.()
        }
    }

    devices(): MidiDevice[] {
        if (this.access === null) return []
        return [...this.access.inputs.values()].map((input) => ({ id: input.id, name: input.name ?? "MIDI input" }))
    }

    /** Listen to one device by id, or ALL_INPUTS. */
    connect(id: string): void {
        this.selected = id
        this.attach()
    }

    disconnect(): void {
        this.selected = null
        this.attach()
    }

    private attach(): void {
        if (this.access === null) return
        for (const input of this.access.inputs.values()) {
            const wanted = this.selected === ALL_INPUTS || this.selected === input.id
            input.onmidimessage = wanted ? (message) => this.handle(message, input.name ?? "midi") : null
        }
    }

    private handle(message: MIDIMessageEvent, source: string): void {
        const data = message.data
        if (data === null || data.length < 2) return
        const status = data[0] & 0xf0
        const time = message.timeStamp
        const [, data1, data2 = 0] = data

        if (status === 0x90 && data2 > 0) {
            this.bus.publish({ type: "noteOn", note: data1, velocity: data2, time, source })
        } else if (status === 0x80 || status === 0x90) {
            this.bus.publish({ type: "noteOff", note: data1, time, source })
        } else if (status === 0xb0 && data1 === 64) {
            this.bus.publish({ type: "sustain", on: data2 >= 64, time, source })
        }
    }
}
