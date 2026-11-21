import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

import { cn } from '../cn'

interface FieldMeta { label: string; hint?: string }

export function Input({ label, hint, className, id: providedId, 'aria-describedby': describedBy, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldMeta) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label><input aria-describedby={describedBy ?? hintId} className={cn('ui-input', className)} id={id} {...props} />{hint && <span className="field-hint" id={hintId}>{hint}</span>}</div>
}

export function Textarea({ label, hint, className, id: providedId, 'aria-describedby': describedBy, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldMeta) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label><textarea aria-describedby={describedBy ?? hintId} className={cn('ui-textarea', className)} id={id} {...props} />{hint && <span className="field-hint" id={hintId}>{hint}</span>}</div>
}

export function Select({ label, hint, className, id: providedId, children, 'aria-describedby': describedBy, ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldMeta) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const hintId = hint ? `${id}-hint` : undefined
  return <div className="field"><label className="field-label" htmlFor={id}>{label}</label><select aria-describedby={describedBy ?? hintId} className={cn('ui-select', className)} id={id} {...props}>{children}</select>{hint && <span className="field-hint" id={hintId}>{hint}</span>}</div>
}

export function Checkbox({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={cn('check-field', className)}><input type="checkbox" {...props} /><span>{label}</span></label>
}
