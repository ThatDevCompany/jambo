import "./styles.css"
import { INSTRUMENTS } from "./audio/instruments"
import { MonitorSynth } from "./audio/MonitorSynth"
import { ComputerKeyboardInput } from "./midi/ComputerKeyboardInput"
import { MidiBus } from "./midi/MidiBus"
import { MockMidiSource } from "./midi/MockMidiSource"
import { MOCK_PATTERNS } from "./midi/mockPatterns"
import { NoteTracker } from "./midi/NoteTracker"
import type { Hand } from "./midi/types"
import { ALL_INPUTS, WebMidiInput } from "./midi/WebMidiInput"
import { detectChord, noteName } from "./music/theory"
import { KeyboardView } from "./ui/KeyboardView"
import { NoteRollView } from "./ui/NoteRollView"

function element<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T
}

const inputSelect = element<HTMLSelectElement>("input-select")
const mockControls = element<HTMLDivElement>("mock-controls")
const playButton = element<HTMLButtonElement>("play-button")
const tempoInput = element<HTMLInputElement>("tempo")
const tempoValue = element<HTMLOutputElement>("tempo-value")
const soundButton = element<HTMLButtonElement>("sound-button")
const instrumentSelects: Record<Hand, HTMLSelectElement> = {
    left: element("left-instrument"),
    right: element("right-instrument"),
}
const statusText = element<HTMLSpanElement>("status")
const chordText = element<HTMLDivElement>("chord")
const notesText = element<HTMLDivElement>("notes")
const pedalBadge = element<HTMLDivElement>("pedal")

// The tracker subscribes first so everything after it sees up-to-date state.
const bus = new MidiBus()
const tracker = new NoteTracker(bus)
const synth = new MonitorSynth(bus)
const mock = new MockMidiSource(bus)
const midi = new WebMidiInput(bus)
new ComputerKeyboardInput(bus)
const roll = new NoteRollView(element("roll"), bus)
const keyboard = new KeyboardView(element("keyboard"), tracker, bus)

// --- Readout: chord name, sounding notes, pedal ----------------------------

bus.subscribe(() => {
    const sounding = tracker.sounding()
    chordText.textContent = detectChord(sounding) ?? " "
    notesText.textContent = sounding.length > 0 ? sounding.map(noteName).join("  ") : " "
    pedalBadge.classList.toggle("on", tracker.sustainOn)
})

// --- Input selection --------------------------------------------------------
// Option values: "none", "mock:<pattern id>", "midi:<device id or all>".

function selectedMockPattern() {
    const [kind, id] = splitValue(inputSelect.value)
    return kind === "mock" ? MOCK_PATTERNS.find((p) => p.id === id) : undefined
}

function splitValue(value: string): [string, string] {
    const i = value.indexOf(":")
    return i < 0 ? [value, ""] : [value.slice(0, i), value.slice(i + 1)]
}

function buildInputOptions(): void {
    const previous = inputSelect.value
    inputSelect.replaceChildren()

    const devices = midi.devices()
    if (WebMidiInput.supported) {
        const group = document.createElement("optgroup")
        group.label = "Piano (MIDI)"
        group.append(new Option(`All MIDI inputs (${devices.length})`, `midi:${ALL_INPUTS}`))
        for (const device of devices) group.append(new Option(device.name, `midi:${device.id}`))
        inputSelect.append(group)
    }

    const mocks = document.createElement("optgroup")
    mocks.label = "Mock player"
    for (const pattern of MOCK_PATTERNS) mocks.append(new Option(pattern.name, `mock:${pattern.id}`))
    inputSelect.append(mocks)

    inputSelect.append(new Option("Screen & computer keys only", "none"))

    const values = [...inputSelect.options].map((o) => o.value)
    if (values.includes(previous)) inputSelect.value = previous
    else inputSelect.value = devices.length > 0 ? `midi:${ALL_INPUTS}` : `mock:${MOCK_PATTERNS[0].id}`
}

function applyInput(): void {
    mock.stop()
    midi.disconnect()
    const [kind, id] = splitValue(inputSelect.value)
    if (kind === "midi") midi.connect(id)

    const pattern = selectedMockPattern()
    if (pattern !== undefined) {
        mock.bpm = pattern.bpm
        tempoInput.value = String(pattern.bpm)
        synth.downloadAll()
    } else {
        // Only the mock player is heard. With the real piano (or nothing), Jambo stays silent.
        void synth.setEnabled(false)
    }
    updateControls()
}

function updateControls(): void {
    const isMock = selectedMockPattern() !== undefined
    mockControls.hidden = !isMock
    playButton.textContent = mock.playing ? "Stop" : "Play"
    tempoValue.textContent = `${tempoInput.value} bpm`
    soundButton.textContent = synth.isEnabled ? "Sound on" : "Sound off"
    soundButton.setAttribute("aria-pressed", String(synth.isEnabled))

    updateInstrumentOptions()
    const soundStatus = isMock ? soundStatusText() : null
    if (soundStatus !== null) {
        statusText.textContent = soundStatus
    } else if (!WebMidiInput.supported) {
        statusText.textContent = window.isSecureContext
            ? "This browser has no Web MIDI. Use Chrome."
            : "Web MIDI needs HTTPS or localhost."
    } else if (midiRefused) {
        statusText.textContent = "MIDI permission was refused"
    } else if (midi.devices().length === 0) {
        statusText.textContent = "No MIDI devices found"
    } else {
        statusText.textContent = `${midi.devices().length} MIDI device(s) connected`
    }
}

inputSelect.addEventListener("change", () => {
    applyInput()
    inputSelect.blur() // hand the letter keys back to the computer-keyboard piano
})

playButton.addEventListener("click", () => {
    const pattern = selectedMockPattern()
    if (pattern === undefined) return
    if (mock.playing) {
        mock.stop()
    } else {
        // Starting the mock player is a natural moment to switch sound on (needs this click to unlock audio).
        // Not awaited: if the browser holds audio back, the music should still start visually.
        if (!synth.isEnabled) void synth.setEnabled(true).then(updateControls)
        mock.start(pattern)
    }
    playButton.blur()
    updateControls()
})

tempoInput.addEventListener("input", () => {
    mock.bpm = Number(tempoInput.value)
    updateControls()
})

soundButton.addEventListener("click", async () => {
    await synth.setEnabled(!synth.isEnabled)
    soundButton.blur()
    updateControls()
})

// --- Instruments, one per hand (remembered on this device) ----------------------

function storedInstrument(hand: Hand): string | null {
    try {
        return localStorage.getItem(`jambo.instrument.${hand}`)
    } catch {
        return null
    }
}

function storeInstrument(hand: Hand, id: string): void {
    try {
        localStorage.setItem(`jambo.instrument.${hand}`, id)
    } catch {
        // Storage can be unavailable (e.g. private browsing). Not remembering is fine.
    }
}

for (const hand of ["left", "right"] as const) {
    const select = instrumentSelects[hand]
    for (const instrument of INSTRUMENTS) select.append(new Option(instrument.name, instrument.id))
    const stored = storedInstrument(hand)
    if (stored !== null && INSTRUMENTS.some((i) => i.id === stored)) synth.setInstrument(hand, stored)
    select.value = synth.instruments[hand]
    select.addEventListener("change", () => {
        synth.setInstrument(hand, select.value)
        storeInstrument(hand, select.value)
        select.blur()
    })
}
synth.onLoadingChange = updateControls

const STATE_LABELS = { waiting: " (waiting)", loading: " (downloading…)", ready: "", failed: " (failed)" }

function updateInstrumentOptions(): void {
    for (const select of Object.values(instrumentSelects)) {
        for (const option of select.options) {
            const def = INSTRUMENTS.find((i) => i.id === option.value)!
            option.text = def.name + STATE_LABELS[synth.stateOf(def.id)]
        }
    }
}

/** What the sound downloads are up to, or null when there is nothing worth saying. */
function soundStatusText(): string | null {
    const failedChoice = (["left", "right"] as const)
        .map((hand) => synth.instruments[hand])
        .find((id) => synth.stateOf(id) === "failed")
    if (failedChoice !== undefined) {
        const name = INSTRUMENTS.find((i) => i.id === failedChoice)!.name
        return `${name} failed to download, so the simple synth is standing in. Turn Sound off and on to retry.`
    }
    const { current, ready, total } = synth.downloadStatus()
    if (current === null) return null
    const count = current.total > 0 ? ` ${current.loaded}/${current.total}` : ""
    return `Downloading sounds (${ready} of ${total} ready): ${current.name}${count}`
}

// --- Start up ---------------------------------------------------------------

let midiRefused = false

async function start(): Promise<void> {
    if (WebMidiInput.supported) {
        try {
            await midi.init()
            midi.onDevicesChanged = () => {
                buildInputOptions()
                updateControls()
            }
        } catch (error) {
            midiRefused = true
            console.warn("MIDI access was refused or failed", error)
        }
    }
    buildInputOptions()
    applyInput()

    const frame = (now: number) => {
        roll.draw(now)
        keyboard.draw()
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

void start()
