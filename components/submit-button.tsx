"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children?: ReactNode;
  className: string;
  disabled?: boolean;
  label?: string;
  testId: string;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "disabled" | "type">;

export function SubmitButton({
  children,
  className,
  disabled = false,
  label,
  testId,
  type = "submit",
  ...buttonProps
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...buttonProps}
      className={`relative ${className}`}
      data-testid={testId}
      disabled={isDisabled}
      type={type}
      aria-busy={pending}
    >
      <span className={pending ? "invisible" : undefined}>{children ?? label}</span>
      {pending ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
          <span className="sr-only">Loading</span>
        </span>
      ) : null}
    </button>
  );
}
