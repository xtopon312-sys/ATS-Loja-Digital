export type MediaValidationCode =
  | 'access-denied'
  | 'access-pending'
  | 'empty-file'
  | 'file-too-large'
  | 'quantity-exceeded'
  | 'unsupported-type'

export interface MediaValidationIssue {
  code: MediaValidationCode
  message: string
}

export interface MediaValidationResult {
  valid: boolean
  issues: readonly MediaValidationIssue[]
}
