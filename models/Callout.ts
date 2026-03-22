import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IComment {
  _id: string
  userId: string
  username: string
  avatarUrl?: string
  text: string
  createdAt: Date
  replies: IComment[]
}

export interface IAuditEntry {
  userId: string
  username: string
  action: string
  timestamp: Date
}

export interface IGeometry {
  type: 'rectangle' | 'polygon'
  // Rectangle fields (normalized 0-1)
  x?: number
  y?: number
  width?: number
  height?: number
  // Polygon fields (flat array of normalized 0-1 coords: [x1,y1,x2,y2,...])
  points?: number[]
  rotation: number
}

export interface ICallout extends Document {
  name: string
  layer: 'top' | 'bottom'
  geometry: IGeometry
  color: string
  visible: boolean
  parentId: mongoose.Types.ObjectId | null
  comments: IComment[]
  auditLog: IAuditEntry[]
  deletedAt: Date | null
  createdBy: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema<IComment>(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    avatarUrl: String,
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    replies: [],
  },
  { _id: true }
)

// Self-referencing for nested replies
CommentSchema.add({ replies: [CommentSchema] })

const GeometrySchema = new Schema<IGeometry>(
  {
    type: { type: String, enum: ['rectangle', 'polygon'], required: true },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    points: [Number],
    rotation: { type: Number, default: 0 },
  },
  { _id: false }
)

const AuditSchema = new Schema<IAuditEntry>(
  {
    userId: String,
    username: String,
    action: String,
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
)

const CalloutSchema = new Schema<ICallout>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    layer: { type: String, enum: ['top', 'bottom'], required: true },
    geometry: { type: GeometrySchema, required: true },
    color: { type: String, default: '#FFD700', match: /^#[0-9A-Fa-f]{6}$/ },
    visible: { type: Boolean, default: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Callout', default: null },
    comments: [CommentSchema],
    auditLog: [AuditSchema],
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, required: true },
    createdByName: { type: String, default: '' },
  },
  { timestamps: true }
)

CalloutSchema.index({ layer: 1, deletedAt: 1 })
CalloutSchema.index({ parentId: 1 })

const Callout: Model<ICallout> =
  mongoose.models.Callout ?? mongoose.model<ICallout>('Callout', CalloutSchema)

export default Callout
