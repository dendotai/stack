# stack

The terms this project's code, issues and docs use.

## Language

**Release version**:
The git tag, such as `v1.4.2`, that semantic-release makes on `main` for the whole project; every app under `apps/` shows the same one.
_Avoid_: app version

**Social provider**:
A sign-in service outside the app, such as Google, that a project lists in `packages/api/convex/socialProviders.ts`; `auth.ts` and the login page offer only the listed ones.
_Avoid_: OAuth provider, social login
