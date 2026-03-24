import { Link } from "@tanstack/react-router"
import { LogOut, Moon, Settings, Sun } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "@/hooks/use-theme"
import { apiSameOriginUrl } from "@/lib/api/client"

const DEFAULT_AVATAR_DATA_URI =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23e5e7eb'/><circle cx='32' cy='24' r='12' fill='%239ca3af'/><path d='M12 58c3-12 13-18 20-18s17 6 20 18' fill='%239ca3af'/></svg>"

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const base = (name || email || "U").trim()
  const parts = base.split(/\s+/).filter(Boolean)
  if (!parts.length) return "U"
  const first = parts[0]?.[0] || ""
  const second = parts[1]?.[0] || ""
  return `${first}${second}`.toUpperCase()
}

export function Navbar() {
  const { user, loading, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const avatarSrc = user?.avatarUrl ? apiSameOriginUrl(user.avatarUrl) : DEFAULT_AVATAR_DATA_URI

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="font-semibold tracking-tight">
          Jigsaw
        </Link>

        <nav className="flex items-center gap-2">
          {!loading && user ? (
            <>
              <Link to="/create">
                <Button variant="outline" size="sm">
                  Create
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full cursor-pointer outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Open profile menu"
                  >
                    <Avatar className="size-9 border border-border">
                      <AvatarImage src={avatarSrc} alt={user.displayName || user.email} />
                      <AvatarFallback>{initials(user.displayName, user.email)}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-2">
                  <Link to="/profile" className="block">
                    <DropdownMenuItem className="gap-3 rounded-md py-2">
                      <Avatar className="size-10 border border-border">
                        <AvatarImage src={avatarSrc} alt={user.displayName || user.email} />
                        <AvatarFallback>{initials(user.displayName, user.email)}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {user.displayName || user.email}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">View profile</span>
                      </div>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <Link to="/settings" className="block">
                    <DropdownMenuItem className="py-2">
                      <Settings className="size-4" />
                      Settings
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem className="py-2" onClick={toggleTheme}>
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                    {theme === "dark" ? "Switch to light" : "Switch to dark"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="py-2 text-destructive focus:text-destructive"
                    onClick={() => {
                      void logout()
                    }}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

