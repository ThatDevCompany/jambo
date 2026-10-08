import { ElectricPiano, Soundfont, SplendidGrandPiano, type LoadProgress, type Smplr } from "smplr"
import { sampleStorage } from "./sampleStorage"
import { SimpleSynth } from "./SimpleSynth"

/** Anything Jambo can play a note on. `start` returns a function that releases the note. */
export interface Playable {
    readonly ready: Promise<void>
    start(note: number, velocity: number): () => void
    dispose?(): void
}

export interface CreateOptions {
    destination: AudioNode
    onProgress?: (progress: LoadProgress) => void
}

export interface InstrumentDef {
    id: string
    name: string
    create(context: AudioContext, options: CreateOptions): Playable
}

function smplrOptions({ destination, onProgress }: CreateOptions) {
    return { destination, onLoadProgress: onProgress, storage: sampleStorage }
}

function sampled(instrument: Smplr): Playable {
    return {
        ready: instrument.ready,
        start: (note, velocity) => instrument.start({ note, velocity }),
        dispose: () => instrument.dispose(),
    }
}

function soundfont(id: string, name: string, instrument: string): InstrumentDef {
    return {
        id,
        name,
        create: (context, options) => sampled(Soundfont(context, { ...smplrOptions(options), instrument })),
    }
}

function electricPiano(id: string, name: string, instrument: string): InstrumentDef {
    return {
        id,
        name,
        create: (context, options) => sampled(ElectricPiano(context, { ...smplrOptions(options), instrument })),
    }
}

export const SIMPLE_SYNTH = "simple-synth"

// Not included: smplr's "CP80" electric grand, because several of its samples are missing (404) on the host.
export const INSTRUMENTS: InstrumentDef[] = [
    {
        id: "grand-piano",
        name: "Grand piano",
        create: (context, options) => sampled(SplendidGrandPiano(context, smplrOptions(options))),
    },
    soundfont("rhodes", "Electric piano (Rhodes)", "electric_piano_1"),
    electricPiano("wurlitzer", "Wurlitzer", "WurlitzerEP200"),
    electricPiano("fm-piano", "FM electric piano", "TX81Z"),
    soundfont("organ", "Drawbar organ", "drawbar_organ"),
    soundfont("vibraphone", "Vibraphone", "vibraphone"),
    soundfont("strings", "Strings", "string_ensemble_1"),
    soundfont("pad", "Warm pad", "pad_2_warm"),
    soundfont("acoustic-bass", "Acoustic bass", "acoustic_bass"),
    soundfont("electric-bass", "Electric bass", "electric_bass_finger"),
    {
        id: SIMPLE_SYNTH,
        name: "Simple synth (no download)",
        create: (context, { destination }) => new SimpleSynth(context, destination),
    },
]

export const DEFAULT_INSTRUMENTS = { left: "rhodes", right: "grand-piano" } as const
