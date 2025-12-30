"use client";

import React from "react";

export function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div style={backdrop()}>
      <div style={card()}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>
        <div style={{ marginTop: 10, color: "#475467", lineHeight: 1.4 }}>{message}</div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={btnSecondary()}>
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={destructive ? btnDestructive() : btnPrimary()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function backdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(16,24,40,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  };
}

function card(): React.CSSProperties {
  return {
    width: "min(520px, 100%)",
    background: "white",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 20px 60px rgba(16,24,40,0.25)",
    border: "1px solid #eaecf0",
  };
}

function btnPrimary(): React.CSSProperties {
  return { background: "var(--brand)", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700 };
}
function btnSecondary(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700 };
}
function btnDestructive(): React.CSSProperties {
  return { background: "#d92d20", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700 };
}