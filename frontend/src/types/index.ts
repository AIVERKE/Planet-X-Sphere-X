export type StatusKind =
  | 'activo'
  | 'pendiente'
  | 'rechazado'
  | 'borrador'
  | 'categoria'

export interface NavItem {
  title: string
  to: string
  icon?: string
}
