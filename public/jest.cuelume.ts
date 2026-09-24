// Jest cannot load the ESM-only cuelume package, and jsdom has no Web Audio.
export const play = jest.fn()
export const setEnabled = jest.fn()
export const setVolume = jest.fn()
export const bind = jest.fn()
export const sounds: string[] = []
export type SoundName = string
