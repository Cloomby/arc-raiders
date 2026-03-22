'use client'

import { useState } from 'react'
import { MessageSquare, Reply, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import type { IComment } from '@/models/Callout'

interface CommentThreadProps {
  calloutId: string
  comments: IComment[]
  canComment: boolean
}

function CommentInput({
  calloutId,
  parentCommentId,
  onDone,
}: {
  calloutId: string
  parentCommentId?: string
  onDone?: () => void
}) {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/callouts/${calloutId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, parentCommentId: parentCommentId ?? null }),
      })
      if (!res.ok) throw new Error('Failed to post comment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callouts'] })
      setText('')
      onDone?.()
    },
  })

  return (
    <div className="flex gap-2">
      <textarea
        className="flex-1 resize-none rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
        placeholder="Write a comment..."
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          disabled={!text.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Post
        </Button>
        {onDone && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  calloutId,
  canComment,
  depth = 0,
}: {
  comment: IComment
  calloutId: string
  canComment: boolean
  depth?: number
}) {
  const [replying, setReplying] = useState(false)
  const [showReplies, setShowReplies] = useState(true)

  return (
    <div className={depth > 0 ? 'ml-5 border-l border-zinc-700 pl-3' : ''}>
      <div className="flex gap-2 py-2">
        {comment.avatarUrl ? (
          <Image
            src={comment.avatarUrl}
            alt={comment.username}
            width={28}
            height={28}
            className="mt-0.5 h-7 w-7 shrink-0 rounded-full"
          />
        ) : (
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
            {comment.username[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-zinc-300">{comment.username}</span>
            <span className="text-xs text-zinc-600">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-200 wrap-break-word">{comment.text}</p>
          {canComment && depth === 0 && (
            <button
              onClick={() => setReplying((v) => !v)}
              className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
        </div>
      </div>

      {replying && (
        <div className="mb-2 ml-9">
          <CommentInput
            calloutId={calloutId}
            parentCommentId={comment._id}
            onDone={() => setReplying(false)}
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <>
          <button
            onClick={() => setShowReplies((v) => !v)}
            className="mb-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showReplies ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
          </button>
          {showReplies &&
            comment.replies.map((reply) => (
              <CommentItem
                key={reply._id}
                comment={reply}
                calloutId={calloutId}
                canComment={canComment}
                depth={depth + 1}
              />
            ))}
        </>
      )}
    </div>
  )
}

export function CommentThread({ calloutId, comments, canComment }: CommentThreadProps) {
  const [showInput, setShowInput] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        <MessageSquare className="h-3.5 w-3.5" />
        Comments ({comments.length})
      </div>

      <div className="max-h-52 overflow-y-auto">
        {comments.length === 0 && (
          <p className="py-2 text-xs text-zinc-600">No comments yet.</p>
        )}
        {comments.map((c) => (
          <CommentItem key={c._id} comment={c} calloutId={calloutId} canComment={canComment} />
        ))}
      </div>

      {canComment && (
        <>
          {showInput ? (
            <CommentInput calloutId={calloutId} onDone={() => setShowInput(false)} />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-xs"
              onClick={() => setShowInput(true)}
            >
              + Add comment
            </Button>
          )}
        </>
      )}
      {!canComment && (
        <p className="text-xs text-zinc-600">Sign in to comment.</p>
      )}
    </div>
  )
}
