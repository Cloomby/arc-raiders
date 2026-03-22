import NextAuth from 'next-auth'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      discordId: string
      role: 'admin' | 'contributor' | 'reader'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    discordId?: string
    role?: string
    avatar?: string | null
  }
}
