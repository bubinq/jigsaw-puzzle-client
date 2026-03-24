import { Card, CardContent } from "@/components/ui/card"

export type PuzzleStatusCardProps = {
  message: string
  destructive?: boolean
}

export function PuzzleStatusCard({ message, destructive }: PuzzleStatusCardProps) {
  return (
    <Card>
      <CardContent
        className={`pt-4 text-sm ${destructive ? "text-destructive" : "text-muted-foreground"}`}
      >
        {message}
      </CardContent>
    </Card>
  )
}
