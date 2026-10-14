# Local Development

## Keycloak administrator account

The local-development bootstrap script provisions an administrator account
for the `ai-starter` realm.

| Setting | Value |
|---|---|
| Username | `Admin` |
| Password | `password` |
| Realm | `ai-starter` |
| Role | `admin` |
| Application URL | http://localhost:3001 |
| Keycloak URL | http://localhost:8080 |

These credentials are intended exclusively for local development and
demonstrations. Do not use them in a shared, staging, or production
environment.

## Provision the account

From the repository root, run:

    ./scripts/bootstrap-keycloak-admin.sh

The script creates the account with the documented password if it does not
exist. If the account already exists, the script preserves its password by
default and ensures that the account is enabled and has the admin role.

The script does not reset developer/viewer passwords or recreate Keycloak
realms, containers, or volumes.

## Reset the local admin password

To explicitly reset the existing `Admin` password to the documented
local-development password, run:

    STARTER_ADMIN_RESET_PASSWORD=true ./scripts/bootstrap-keycloak-admin.sh

You can provide a different password for that explicit reset without editing
the script:

    STARTER_ADMIN_RESET_PASSWORD=true \
    STARTER_ADMIN_PASSWORD='Replace-With-Your-Own-Local-Password' \
    ./scripts/bootstrap-keycloak-admin.sh

Keep any custom password private. Do not commit personal credentials or
production secrets to source control.

## Sign in and verify access

1. Open http://localhost:3001.
2. Sign in as `Admin` using the credentials above.
3. Confirm that the homepage displays the `admin` role and Admin console link.
4. Open http://localhost:3001/admin.
5. Open http://localhost:3001/api/admin/status and verify the successful
   authorization response.

The initial admin console only verifies identity and access. User management
and role-editing operations are not implemented in this initial version.
