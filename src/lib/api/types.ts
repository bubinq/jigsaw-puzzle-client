export type User = {
  id: string
  email: string
  displayName?: string | null
  avatarUrl?: string | null
}

export type MeResponse = {
  user: User
}

export type AuthResponse = {
  user: User
}

export type FeedItem = {
  id: string
  name: string
  pieceCount: number
  tags: Array<string>
  createdAt: string
  imageUrl: string
}

export type FeedResponse = {
  items: Array<FeedItem>
}

export type UploadAvatarResponse = {
  ok: boolean
  avatarUrl: string
}

export type CreatePuzzleResponse = {
  puzzle: {
    id: string
    name: string
    pieceCount: number
    tags: Array<string>
    createdAt: string
  }
}

