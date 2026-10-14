"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { KeycloakSignOutButton } from "./keycloak-sign-out-button";

interface UserAvatarDropdownProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
  roles: string[];
  isAdmin: boolean;
  isInAdminPage?: boolean;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  if (email && email.trim()) {
    const userPart = email.split("@")[0];
    const parts = userPart.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userPart.slice(0, 2).toUpperCase();
  }

  return "U";
}

export function UserAvatarDropdown({
  user,
  isAdmin,
  isInAdminPage = false,
}: UserAvatarDropdownProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(user.name, user.email);
  const displayName = user.name || user.email || "User";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="avatar-dropdown-wrapper" ref={menuRef}>
      <button
        type="button"
        className="avatar-circle-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="User menu"
        aria-expanded={open}
      >
        <span className="avatar-initials">{initials}</span>
      </button>

      {open && (
        <div className="avatar-dropdown-menu">
          <div className="avatar-dropdown-header">
            <div className="avatar-dropdown-user-row">
              <div className="avatar-circle-small">{initials}</div>
              <div className="avatar-dropdown-user-meta">
                <span className="avatar-user-name">{displayName}</span>
                {user.email && (
                  <span className="avatar-user-email">{user.email}</span>
                )}
              </div>
            </div>
          </div>

          {isAdmin && !isInAdminPage && (
            <>
              <div className="avatar-dropdown-divider" />
              <div className="avatar-dropdown-links">
                <Link
                  href="/admin"
                  className="avatar-dropdown-link"
                  onClick={() => setOpen(false)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Admin Console</span>
                </Link>
              </div>
            </>
          )}

          <div className="avatar-dropdown-divider" />

          <div className="avatar-dropdown-footer">
            <KeycloakSignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}

