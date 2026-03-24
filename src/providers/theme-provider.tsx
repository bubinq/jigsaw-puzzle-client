import * as React from "react"

export type Theme = "light" | "dark"

type ThemeState = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeState | null>(null)

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const stored = window.localStorage.getItem("theme")
  return stored === "dark" ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => getStoredTheme())

  React.useEffect(() => {
    applyTheme(theme)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("theme", theme)
    }
  }, [theme])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
  }, [])

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"))
  }, [])

  const value = React.useMemo<ThemeState>(
    () => ({
      theme,
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("ThemeProvider missing")
  return ctx
}

