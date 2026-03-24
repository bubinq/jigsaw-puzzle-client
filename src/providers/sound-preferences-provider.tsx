import * as React from "react"

type SoundPreferencesState = {
  pieceMatchSoundEnabled: boolean
  setPieceMatchSoundEnabled: (enabled: boolean) => void
  togglePieceMatchSoundEnabled: () => void
}

const SoundPreferencesContext = React.createContext<SoundPreferencesState | null>(null)

const PIECE_MATCH_SOUND_STORAGE_KEY = "pieceMatchSoundEnabled"

function getStoredPieceMatchSoundEnabled(): boolean {
  if (typeof window === "undefined") return true
  const stored = window.localStorage.getItem(PIECE_MATCH_SOUND_STORAGE_KEY)
  return stored === null ? true : stored === "true"
}

export function SoundPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [pieceMatchSoundEnabled, setPieceMatchSoundEnabledState] = React.useState<boolean>(() =>
    getStoredPieceMatchSoundEnabled()
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      PIECE_MATCH_SOUND_STORAGE_KEY,
      pieceMatchSoundEnabled ? "true" : "false"
    )
  }, [pieceMatchSoundEnabled])

  const setPieceMatchSoundEnabled = React.useCallback((enabled: boolean) => {
    setPieceMatchSoundEnabledState(enabled)
  }, [])

  const togglePieceMatchSoundEnabled = React.useCallback(() => {
    setPieceMatchSoundEnabledState((prev) => !prev)
  }, [])

  const value = React.useMemo<SoundPreferencesState>(
    () => ({
      pieceMatchSoundEnabled,
      setPieceMatchSoundEnabled,
      togglePieceMatchSoundEnabled,
    }),
    [pieceMatchSoundEnabled, setPieceMatchSoundEnabled, togglePieceMatchSoundEnabled]
  )

  return (
    <SoundPreferencesContext.Provider value={value}>{children}</SoundPreferencesContext.Provider>
  )
}

export function useSoundPreferencesContext() {
  const ctx = React.useContext(SoundPreferencesContext)
  if (!ctx) throw new Error("SoundPreferencesProvider missing")
  return ctx
}
