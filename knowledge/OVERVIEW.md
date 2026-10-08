# Jambo: Project Overview

_Last updated: 2026-10-07. Status: early exploration. A first web-app skeleton exists, with MIDI input, a mock player and visuals. There is no teaching or AI yet._

Jambo is an AI music jamming partner. Steve James is building it for his own use. It is a personal project, not a commercial product, so choose fun, learning and "does it feel musical?" over scale, polish or generality.

## The user

Jambo has one user: Steve. Design every feature around him.

- **Instrument:** piano. He is a beginner to intermediate player.
- **Reading:** he reads music well and has done so on and off for 40+ years.
- **Theory:** he knows his scales.
- **Blues:** he plays the 12-bar blues and improvises with the blues scale over it.
- **Modern classical:** he improvises classical-style melodies over Einaudi-style vamps.
- **Self-assessment:** "I'm ok. Not great. But I'm ok."

So Jambo should be encouraging, forgiving and pitched at his level. It should play _with_ him, not show off. Its musical feedback should be concrete and actionable, and should not lecture.

## Hardware

- **Kawai ES110** digital piano with MIDI out. Jambo takes Steve's playing as **MIDI**, not audio. This gives exact notes, velocities and timings, so there is no pitch detection to do.
- The ES110 has 5-pin DIN MIDI and Bluetooth MIDI (Bluetooth 4.1 LE, BLE MIDI spec compliant) but **no USB port** (confirmed against the spec). Steve will likely connect through a USB-MIDI interface cable, or through Bluetooth MIDI if Windows and the browser support it reliably. Check this when setting up input.
- **Primary device: a large-screen Android tablet** that sits on the piano's music stand. It already holds Steve's sheet music. Jambo should run in **Chrome on that tablet**.
- **Connecting the piano to the tablet:**
    - **USB:** a USB-MIDI interface cable from the ES110's DIN MIDI out, plugged into the tablet through USB-OTG. This is the most reliable option.
    - **Bluetooth MIDI:** Android supports it, but Chrome may only see the piano after the device has been connected through a helper app. This needs testing.
- Development machine: Windows 11. Also test with desktop Chrome or Edge.

## Platform

- **Runs in the web browser**, specifically **Chrome on Android** first and desktop Chromium second. Design the UI for a large touch screen in landscape, sitting on the piano's music stand.
- **Web MIDI API** for input. It is supported in Chrome on Android and in desktop Chromium (Chrome, Edge). Safari does not support it.
    - Web MIDI requires a **secure context**: HTTPS, or localhost.
    - For development on the tablet, use `adb reverse` so the tablet can reach the PC's dev server as localhost, or serve the app over HTTPS.
    - For day-to-day use it is hosted on **Azure Static Web Apps** (free tier, HTTPS), deployed with `azd`. It could later be installed on the tablet as a PWA.
- **Audio latency:** Android audio output latency is higher than on desktop. Steve hears his own playing directly from the piano, so only Jambo's sounds are affected. Schedule Jambo's sounds ahead on the Web Audio clock and keep reactive responses tolerant of some delay.
- **Web Audio API** for sound output, for Jambo's own playing and any effects.
- **TypeScript** on Node tooling. The repo already has TypeScript 7 and Prettier set up: 4-space indent, no semicolons, double quotes, 120-column lines.
- The bundler, framework and audio libraries have not been chosen yet. Options for audio include Tone.js and raw Web Audio. Pick lightweight options and discuss them with Steve before committing.

## Goals

There are three goals. They share one core: listening to MIDI and understanding the music.

1. **Teaching aid**
    - Jambo helps Steve get better at improvising and playing.
    - It might give feedback on note choices against the current chord or scale, timing and groove, or variety.
    - It might suggest ideas to try and offer exercises.
2. **Visualizer**
    - Real-time visuals driven by what is being played: notes, chords, dynamics, Jambo's responses.
    - This part is partly for fun ("why not") and partly a teaching tool, for example by showing scale tones on a keyboard or the chord changes.
3. **Improvisation partner**
    - Jambo plays music _with_ Steve.
    - Expected starting scenarios:
        - **Blues:** Jambo backs a 12-bar blues (bass, drums, comping) while Steve solos. Later, they might trade fours or call and response.
        - **Einaudi-style:** Jambo holds a repeating vamp and chord pattern while Steve improvises the melody on top, or Jambo answers his phrases.

**Future thread: songwriting.** Steve wants Jambo to help with songwriting at some point (noted 2026-10-08). That's all that has been decided so far. Don't design or build anything for it until Steve brings it up.

## Architecture direction

These are working assumptions, not decisions.

- **Event bus around MIDI:** all features consume one stream of note on/off and velocity events with timestamps. The teacher, the visualizer and the partner subscribe to it.
- **Deterministic real-time engine and LLM "brain":**
    - LLMs are part of the plan, but they are far too slow for note-by-note playing, where responses take hundreds of milliseconds to seconds.
    - Keep anything that must stay in time in local, deterministic code: the clock, scheduling, playback of accompaniment, and real-time analysis such as chord and key detection.
    - Use the LLM for slower, higher-level work:
        - choosing styles and progressions
        - shaping phrase-level musical ideas, for example "play a response like this"
        - teaching feedback after a phrase or a session
        - conversation with Steve
- **Musical representation:** keep a simple internal model of notes, chords, scales, bars and beats that both the code and LLM prompts can use. Text forms such as note names and chord symbols suit LLMs well.
- **Use Claude models** for the LLM. A browser app calling the API needs a key, so handle it safely. For a personal app, a key entered into the app's settings and kept in browser storage on the tablet, or a tiny proxy, is acceptable. Never commit keys.

## Codebase

The code uses Vite and vanilla TypeScript, with no UI framework so far. A framework can be added if the UI grows enough to need one.

**Commands:**

- `npm run dev`: dev server at http://localhost:5173.
- `npm run tablet`: the same server, also exposed on the LAN. Over plain HTTP the mock player works, but Web MIDI does not.
- `npm run typecheck`, `npm run build`, `npm run format`.
- `azd up`: provisions the Azure resources and deploys over HTTPS. `azd deploy` redeploys code only.

**Hosting:**

- [azure.yaml](../azure.yaml) defines one service, `web`, hosted as a `staticwebapp`. azd builds the app with npm and uploads `dist/`.
- [infra/](../infra/) holds the Bicep templates: a resource group named `rg-<env>` and a Free-tier Static Web App.
    - The Static Web App resource is in `eastasia` by default. Only a few regions are allowed, and the content is served from a global CDN either way.
- [public/staticwebapp.config.json](../public/staticwebapp.config.json) sets the SPA fallback, asset caching and `Permissions-Policy: midi=(self)`.
- `.azure/` holds local azd environment state and is git-ignored.

**Data flow:** every input publishes `MidiEvent`s (`noteOn`, `noteOff`, `sustain`, timestamped on the `performance.now()` clock) to one `MidiBus`. Every feature subscribes to it.

**Key files:**

- [src/midi/](../src/midi/): inputs and shared state.
    - `WebMidiInput`: the real piano.
    - `MockMidiSource` and `mockPatterns`: a fake pianist that plays a 12-bar blues in C or an Einaudi-style Am–F–C–G vamp, so the UX can be developed without the piano.
    - `ComputerKeyboardInput`: the computer keyboard as a piano. A to ; are the keys, Z and X shift the octave, Space is the sustain pedal.
    - `NoteTracker`: which keys are held and which notes are sustained by the pedal.
- [src/ui/](../src/ui/): canvas views.
    - `KeyboardView`: an 88-key keyboard that can be played by touch.
    - `NoteRollView`: notes rise up from the keys as they're played.
    - `keyboardLayout`: key geometry shared by both views so they line up, plus pitch-class colours that follow the circle of fifths.
- [src/audio/](../src/audio/): sound, **in mock mode only**. This is Steve's rule: any other input (the live piano, or screen and computer keys only) is always silent, because the ES110 makes its own sound. The sound and instrument controls are hidden outside mock mode.
    - `MonitorSynth`: plays a different instrument for each hand. Mock notes carry a `hand` tag. Notes without one are split at middle C.
    - `instruments`: the instrument catalog. It uses sampled sounds from the [smplr](https://github.com/danigb/smplr) library: grand piano, Rhodes, Wurlitzer, organ, strings, bass and others. The defaults are electric piano for the left hand and grand piano for the right.
        - CP80 is left out because some of its samples return 404.
        - One Wurlitzer sample (Ab6, mp) doesn't decode, which is a known upstream problem.
    - **Downloads:** as soon as mock mode is selected, every instrument downloads one at a time, the two hands' choices first.
        - The UI shows progress, and each instrument's state appears in the menus.
        - A failed instrument is retried 3 times. Turning Sound off and on retries again.
    - `sampleStorage`: replaces smplr's own storage.
        - smplr's version fired every request at once (226 for the grand piano), never retried and cached error responses. That caused intermittent "Failed to fetch" errors that broke the grand piano.
        - Ours makes at most 6 parallel downloads, retries each sample with backoff, and caches only successful responses in Cache Storage (`jambo-samples`).
    - `SimpleSynth`: an oscillator fallback that stands in while samples load.
    - **Possible later uses:** the same engine could voice Jambo's own backing band. To change the ES110's own sounds, consider MIDI program changes or its multi-timbral mode.
- [src/music/theory.ts](../src/music/theory.ts): note names and chord detection.

**Testing:** automated browser tests **must be silent**. Launch Chrome or Edge with `--mute-audio`. Headless browsers refuse the Web MIDI permission, so the mock player is the way to drive the UI in tests.

## Open questions

Raise these with Steve when they become relevant. Don't guess at them.

- **Who leads the jam?** Does Jambo set a fixed tempo and key for Steve to follow, or does it follow Steve's tempo and key changes? Fixed is the likely starting point.
- **Jambo's voice:** which instruments it plays (bass, drums, piano comping, others), and whether it uses sampled or synthesized sounds.
- **Teaching:** whether feedback comes live or after a session, and through text, voice or visuals.
- **First milestone:** what makes Steve think "it's alive!". A likely candidate is to read ES110 MIDI in the browser, show the notes on screen, and play a simple blues backing that he can solo over.
- **Recording:** whether to record or save sessions.

## Working with Steve on this project

- The idea is still vague and evolving. Ask before building big features, and prefer small, playable steps.
- Update this overview as decisions get made, and record why each decision was made.
