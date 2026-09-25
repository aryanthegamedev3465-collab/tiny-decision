import React, { useEffect } from "react";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { useStore } from "@/store";
import type { AppNotification } from "@/types";

function Toast({ notification }: { notification: AppNotification }): React.ReactElement {
  const dismiss = useStore((s) => s.dismissNotification);

  const icon = {
    success: <CheckCircle size={15} className="text-status-success flex-shrink-0" />,
    error:   <XCircle    size={15} className="text-status-error flex-shrink-0" />,
    warning: <AlertTriangle size={15} className="text-status-warning flex-shrink-0" />,
    info:    <Info       size={15} className="text-status-info flex-shrink-0" />,
  }[notification.type];

  const borderColor = {
    success: "border-status-success",
    error:   "border-status-error",
    warning: "border-status-warning",
    info:    "border-status-info",
  }[notification.type];

  return (
    <div
      className={`flex items-start gap-2.5 bg-bg-elevated border ${borderColor} rounded-md px-3 py-2.5 shadow-modal animate-slide-in w-72`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        {notification.title && (
          <p className="text-text-primary text-xs font-medium leading-tight truncate">{notification.title}</p>
        )}
        {notification.message && (
          <p className="text-text-secondary text-2xs leading-tight mt-0.5 line-clamp-2">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => dismiss(notification.id)}
        className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0 mt-0.5"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function NotificationToasts(): React.ReactElement {
  const notifications = useStore((s) => s.notifications);

  if (notifications.length === 0) return <></>;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {notifications.slice(-5).map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <Toast notification={n} />
        </div>
      ))}
    </div>
  );
}
