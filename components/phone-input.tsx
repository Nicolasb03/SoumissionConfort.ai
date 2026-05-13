"use client"

import { forwardRef, useCallback, useEffect, useState } from "react"
import { isValidQuebecPhone } from "@/lib/phone"

type PhoneInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value"
> & {
  value: string
  onChange: (value: string) => void
  /** Called whenever the validity of the current input changes. */
  onValidChange?: (isValid: boolean) => void
  /** Show error styling and message once the user has blurred at least once. */
  errorMessage?: string
  className?: string
  inputClassName?: string
}

function maskPhoneInput(raw: string): string {
  // Strip everything except digits, drop a leading 1 (country code), cap at 10.
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("1")) digits = digits.slice(1)
  digits = digits.slice(0, 10)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      onValidChange,
      errorMessage = "Numéro de téléphone québécois invalide.",
      className,
      inputClassName,
      onBlur,
      placeholder = "(514) 555-1234",
      ...rest
    },
    ref,
  ) {
    const [touched, setTouched] = useState(false)
    const valid = isValidQuebecPhone(value)

    useEffect(() => {
      onValidChange?.(valid)
    }, [valid, onValidChange])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(maskPhoneInput(e.target.value))
      },
      [onChange],
    )

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setTouched(true)
        onBlur?.(e)
      },
      [onBlur],
    )

    const showError = touched && value.length > 0 && !valid

    return (
      <div className={className}>
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-invalid={showError ? "true" : undefined}
          aria-describedby={showError ? "phone-input-error" : undefined}
          className={inputClassName}
          {...rest}
        />
        {showError && (
          <p
            id="phone-input-error"
            className="mt-1 text-xs text-red-600"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    )
  },
)
