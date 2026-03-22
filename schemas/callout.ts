import { z } from 'zod'

export const GeometrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rectangle'),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
    rotation: z.number().default(0),
  }),
  z.object({
    type: z.literal('polygon'),
    points: z.array(z.number()).min(6), // at least 3 points (6 numbers)
    rotation: z.number().default(0),
  }),
])

export const CreateCalloutSchema = z.object({
  name: z.string().min(1).max(100),
  layer: z.enum(['top', 'bottom']),
  geometry: GeometrySchema,
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#FFD700'),
  parentId: z.string().nullable().optional(),
})

export const UpdateCalloutSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  layer: z.enum(['top', 'bottom']).optional(),
  geometry: GeometrySchema.optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  visible: z.boolean().optional(),
  order: z.number().optional(),
  parentId: z.string().nullable().optional(),
})

export const CreateCommentSchema = z.object({
  text: z.string().min(1).max(1000),
  parentCommentId: z.string().nullable().optional(),
})

export type CreateCalloutInput = z.infer<typeof CreateCalloutSchema>
export type UpdateCalloutInput = z.infer<typeof UpdateCalloutSchema>
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>
