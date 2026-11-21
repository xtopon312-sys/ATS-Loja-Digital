import type { MediaValidationIssue } from '../media-validation'

export class MediaValidationError extends Error {
  readonly issues: readonly MediaValidationIssue[]

  constructor(issues: readonly MediaValidationIssue[]) {
    super(issues[0]?.message ?? 'Não foi possível validar o arquivo de mídia.')
    this.name = 'MediaValidationError'
    this.issues = issues
  }
}
