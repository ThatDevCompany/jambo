/**
 * The events that flow through Jambo's MIDI bus.
 * Every input (real piano, mock player, computer keyboard, on-screen keys) produces these,
 * and every feature (visuals, sound, teaching, the jam partner) consumes them.
 *
 * `time` is in milliseconds on the performance.now() clock.
 * `note` is a MIDI note number (60 = middle C). `velocity` is 1-127.
 */
export type MidiEvent = NoteOnEvent | NoteOffEvent | SustainEvent

export type Hand = "left" | "right"

export interface NoteOnEvent {
    type: "noteOn"
    note: number
    velocity: number
    time: number
    source: string
    /** Which hand played it, when the source knows (the mock player does; a real piano doesn't). */
    hand?: Hand
}

export interface NoteOffEvent {
    type: "noteOff"
    note: number
    time: number
    source: string
}

export interface SustainEvent {
    type: "sustain"
    on: boolean
    time: number
    source: string
}
