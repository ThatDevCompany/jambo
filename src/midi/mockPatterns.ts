import type { BarPlayer, MockNote, MockPattern } from "./MockMidiSource"

function randomInt(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1))
}

function pick<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)]
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

// ---------------------------------------------------------------------------
// 12-bar blues in C: boogie shuffle in the left hand, blues-scale licks in the right.

const BLUES_PROGRESSION = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7] // semitones above C
const BLUES_SHUFFLE = [7, 9, 10, 9] // interval above the root on each beat
const C_BLUES_RIGHT_HAND = [60, 63, 65, 66, 67, 70, 72, 75, 77, 78, 79, 82, 84] // C blues scale, C4-C6

export const bluesInC: MockPattern = {
    id: "blues-c",
    name: "12-bar blues in C",
    bpm: 100,
    beatsPerBar: 4,
    swing: true,
    createPlayer(): BarPlayer {
        let melodyIndex = 6

        return (barIndex) => {
            const root = 48 + BLUES_PROGRESSION[barIndex % 12]
            const notes: MockNote[] = []

            for (let beat = 0; beat < 4; beat++) {
                for (const half of [0, 0.5]) {
                    const velocity = half === 0 ? 78 : 62
                    notes.push({ beat: beat + half, length: 0.3, note: root, velocity, hand: "left" })
                    notes.push({
                        beat: beat + half,
                        length: 0.3,
                        note: root + BLUES_SHUFFLE[beat],
                        velocity,
                        hand: "left",
                    })
                }
            }

            // Phrases mostly in even bars, leaving space in between (like call and response).
            if (Math.random() < (barIndex % 2 === 0 ? 0.85 : 0.3)) {
                let beat = pick([0, 0.5, 1, 1.5])
                const length = randomInt(3, 7)
                for (let i = 0; i < length && beat < 4; i++) {
                    melodyIndex = clamp(melodyIndex + pick([-2, -1, -1, 1, 1, 2]), 0, C_BLUES_RIGHT_HAND.length - 1)
                    const last = i === length - 1
                    notes.push({
                        beat,
                        length: last ? 1 : 0.4,
                        note: C_BLUES_RIGHT_HAND[melodyIndex],
                        velocity: randomInt(72, 105),
                        hand: "right",
                    })
                    beat += last ? 1 : 0.5
                }
            }

            return { notes }
        }
    },
}

// ---------------------------------------------------------------------------
// Einaudi-style vamp in A minor: Am - F - C - G with flowing left-hand arpeggios,
// a sparse right-hand melody and legato pedalling.

interface VampChord {
    root: number
    third: number
    tones: number[] // chord pitch classes, for weighting the melody
}

const EINAUDI_CHORDS: VampChord[] = [
    { root: 45, third: 3, tones: [9, 0, 4] }, // Am
    { root: 41, third: 4, tones: [5, 9, 0] }, // F
    { root: 48, third: 4, tones: [0, 4, 7] }, // C
    { root: 43, third: 4, tones: [7, 11, 2] }, // G
]
const A_MINOR_RIGHT_HAND = [69, 71, 72, 74, 76, 77, 79, 81, 83, 84] // A4-C6
const MELODY_RHYTHMS = [[0, 2], [0, 1, 2, 3], [0, 1.5, 2, 3], [0, 3], [1, 2, 3], [2]]

export const einaudiVamp: MockPattern = {
    id: "einaudi-am",
    name: "Einaudi-style vamp in A minor",
    bpm: 72,
    beatsPerBar: 4,
    swing: false,
    createPlayer(): BarPlayer {
        let lastNote = 76

        return (barIndex) => {
            const chord = EINAUDI_CHORDS[barIndex % EINAUDI_CHORDS.length]
            const notes: MockNote[] = []

            const arpeggio = [0, 7, 12, 12 + chord.third, 19, 12 + chord.third, 12, 7]
            arpeggio.forEach((offset, i) => {
                notes.push({
                    beat: i * 0.5,
                    length: 0.45,
                    note: chord.root + offset,
                    velocity: i === 0 ? 62 : 50,
                    hand: "left",
                })
            })

            // Rest every fourth bar to leave room for the listener.
            if (barIndex % 4 !== 3) {
                const rhythm = pick(MELODY_RHYTHMS)
                rhythm.forEach((beat, i) => {
                    const candidates = A_MINOR_RIGHT_HAND.filter((n) => Math.abs(n - lastNote) <= 4)
                    const weighted = candidates.flatMap((n) => (chord.tones.includes(n % 12) ? [n, n, n] : [n]))
                    lastNote = pick(weighted.length > 0 ? weighted : A_MINOR_RIGHT_HAND)
                    const next = rhythm[i + 1] ?? 4
                    notes.push({
                        beat,
                        length: (next - beat) * 0.95,
                        note: lastNote,
                        velocity: randomInt(60, 82),
                        hand: "right",
                    })
                })
            }

            return {
                notes,
                pedal: [
                    { beat: 0, on: false },
                    { beat: 0.1, on: true },
                ],
            }
        }
    },
}

export const MOCK_PATTERNS: MockPattern[] = [bluesInC, einaudiVamp]
