const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10])

export function pitchClass(note: number): number {
    return ((note % 12) + 12) % 12
}

export function pitchClassName(pc: number): string {
    return NOTE_NAMES[pitchClass(pc)]
}

/** Scientific pitch notation, e.g. 60 -> "C4". */
export function noteName(note: number): string {
    return `${pitchClassName(note)}${Math.floor(note / 12) - 1}`
}

export function isBlackKey(note: number): boolean {
    return BLACK_PITCH_CLASSES.has(pitchClass(note))
}

interface ChordTemplate {
    suffix: string
    intervals: number[]
}

const CHORD_TEMPLATES: ChordTemplate[] = [
    { suffix: "", intervals: [0, 4, 7] },
    { suffix: "m", intervals: [0, 3, 7] },
    { suffix: "7", intervals: [0, 4, 7, 10] },
    { suffix: "maj7", intervals: [0, 4, 7, 11] },
    { suffix: "m7", intervals: [0, 3, 7, 10] },
    { suffix: "6", intervals: [0, 4, 7, 9] },
    { suffix: "m6", intervals: [0, 3, 7, 9] },
    { suffix: "9", intervals: [0, 4, 7, 10, 2] },
    { suffix: "add9", intervals: [0, 4, 7, 2] },
    { suffix: "m(add9)", intervals: [0, 3, 7, 2] },
    { suffix: "dim", intervals: [0, 3, 6] },
    { suffix: "dim7", intervals: [0, 3, 6, 9] },
    { suffix: "m7b5", intervals: [0, 3, 6, 10] },
    { suffix: "aug", intervals: [0, 4, 8] },
    { suffix: "sus2", intervals: [0, 2, 7] },
    { suffix: "sus4", intervals: [0, 5, 7] },
]

/**
 * Names the chord formed by a set of sounding notes, e.g. "C7" or "F/A".
 * Prefers chords that explain every note, then bigger chords, then a root in the bass.
 * Returns null when nothing sensible fits.
 */
export function detectChord(notes: number[]): string | null {
    if (notes.length === 0) return null
    const pcs = new Set(notes.map(pitchClass))
    if (pcs.size < 2) return null
    const bass = pitchClass(Math.min(...notes))

    let best: { name: string; score: number } | null = null
    for (const root of pcs) {
        for (const template of CHORD_TEMPLATES) {
            const chordPcs = template.intervals.map((i) => pitchClass(root + i))
            if (!chordPcs.every((pc) => pcs.has(pc))) continue
            const extras = pcs.size - chordPcs.length
            const score = chordPcs.length * 2 - extras * 3 + (root === bass ? 2 : 0)
            if (best === null || score > best.score) {
                const name = pitchClassName(root) + template.suffix
                best = { name: root === bass ? name : `${name}/${pitchClassName(bass)}`, score }
            }
        }
    }
    return best !== null && best.score > 0 ? best.name : null
}
