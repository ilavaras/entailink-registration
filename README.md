# EntaiLink registration and onboarding

Production project `entailink-registration` serves the registration form, capability-key request tracking and the protected operations workdesk. Data lives in an isolated `entailink_onboarding` schema in the existing Supabase project. The application uses a server-held secret to call a restricted database function. Public table access is denied and row-level security is enabled.

## Current execution

The deployed portal runs its workflow through transactional database transitions. Each task requires the current step and completion evidence. Concurrent or repeated completion cannot advance a later step. Initial registration reserves the workspace name and records the organisation, contact, selected ERP and role. A retry with the same request identity returns that same registration.

The six tasks are organisation and administrator review, domain and tenant provisioning, Okta setup, sign-in and permission testing, notification, and tenant activation. The operations workdesk accepts manual evidence for each external operation. The reviewer must verify the contact before approving provisioning.

Automatic domain entry creation is available from the workdesk when `PROVISIONING_VERCEL_TOKEN`, `CUSTOMER_PORTAL_PROJECT_ID` and optionally `PROVISIONING_VERCEL_TEAM_ID` are configured. It looks up an existing project-domain entry before attempting creation. DNS records at GoDaddy and tenant routing in the customer application require configuration. The domain helper does not create a tenant-aware customer application.

Automatic onboarding email is available when `RESEND_API_KEY` and `ONBOARDING_EMAIL_FROM` are configured. Use a verified sender. The notification step advances only after provider acceptance. A stable idempotency key is used for retries within the provider’s deduplication window. After a prolonged ambiguous delivery outcome, check the provider before retrying. Manual delivery remains available through the notification task.

Okta setup currently uses a manual task. Record the issuer, OIDC application client ID and administrator user ID. Configure exact customer callbacks and workspace-scoped roles in the chosen Okta organisation, then perform the access test. Application client secrets and provider tokens must remain in server-side configuration. Authentication and authorisation must be implemented in the customer portal before tenant activation.

The workdesk is `/operator.html`. Its operator access key is configured as `ONBOARDING_ADMIN_TOKEN` in Vercel. The separate private access file contains the initial key. Rotate that environment variable and redeploy when changing operators.

## Camunda handover

`workflow/EntaiLink_Customer_Onboarding.bpmn` and the accompanying six `.form` files define a Camunda 8 onboarding process with manual tasks, domain and notification service tasks, rejection, and manual fallback on BPMN errors. Upload and deploy the BPMN and forms together. The process ID is `entailink_customer_onboarding`, with candidate group `onboarding-operations`.

This Camunda model is supplied for integration and has not been deployed or connected to the registration API. It requires workers for `onboarding.provision-domain` and `onboarding.notify`. A worker should return a BPMN error when provider setup is unavailable so the process reaches the corresponding manual task. Exhausted transient retries create an incident for operations to resolve. Wire database transitions and process starts through a transactional outbox before making Camunda the execution authority, and retain one authority for task progression.

## Required DNS

In the `entailink.com` GoDaddy zone, add a CNAME with name `registration` pointing to `f5a97e71fb4ff55a.vercel-dns-016.com`. Vercel has attached and verified the hostname. The DNS configuration still needs to propagate before HTTPS on that hostname works.

## Runtime configuration

Already configured in the Vercel project are `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ONBOARDING_DB_SECRET` and `ONBOARDING_ADMIN_TOKEN`. They are server-only environment variables and are excluded from this source package. The source `schema.sql` creates the schema and operations function. Its API-secret hash must be provisioned separately in `entailink_onboarding.settings`.

Provider automation, the customer portal’s tenant registry and Okta sign-in remain pending configuration. The registration, tracking and manual operations workflow can be used now.
